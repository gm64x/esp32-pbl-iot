// Painel de medições do ESP32: lista de dispositivos, leitura atual, estatísticas,
// gráficos SVG (sem bibliotecas), tabela e atualização automática por polling.
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var PERIODOS = { "15m": 900, "1h": 3600, "24h": 86400, "tudo": 0 };
    var INTERVALO_CONSULTA_MS = 2000;   // polling do último id
    var INTERVALO_RELOGIO_MS = 1000;    // atualiza "visto há Xs" e online/offline
    var LIMITE_ONLINE_S = 30;           // online = última leitura há menos de 30 s
    var LEITURAS_NA_TABELA = 200;
    var LEGADO = "desconhecido";        // device_id das linhas antigas (sem device_id)
    var MAX_PONTOS_COM_MARCADOR = 400;  // acima disso, o gráfico não desenha um marcador por ponto

    var estado = {
        dispositivo: "all",
        periodo: "1h",
        dispositivos: [],
        buscadoEm: 0,          // Date.now() da última lista de dispositivos
        serie: null,           // resposta de ?series=1
        leituras: [],          // resposta de ?readings=1
        ultimoId: null,
        emCarregamento: false,
        pendente: false
    };

    var itensLista = new Map();  // chave ("all" ou device_id) -> itens da lista

    function $(id) { return document.getElementById(id); }

    function criar(tag, classe, texto) {
        var n = document.createElement(tag);
        if (classe) n.className = classe;
        if (texto !== undefined && texto !== null) n.textContent = String(texto);
        return n;
    }

    function svg(tag, attrs) {
        var n = document.createElementNS(SVG_NS, tag);
        for (var k in attrs) n.setAttribute(k, attrs[k]);
        return n;
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }

    // Número com uma casa decimal e vírgula (pt-BR); nulo vira travessão
    function fmt(v, casas) {
        if (v === null || v === undefined || isNaN(v)) return "—";
        return Number(v).toFixed(casas === undefined ? 1 : casas).replace(".", ",");
    }

    // Nome exibido para um device_id (linhas antigas não têm id)
    function nomeExibicao(dev) {
        return dev === LEGADO ? "sem id (legado)" : dev;
    }

    // Seleciona um dispositivo ("all" ou device_id): mesmo efeito de clicar na lista
    function selecionarDispositivo(chave) {
        if (estado.dispositivo === chave) return;
        estado.dispositivo = chave;
        gravarHash();
        carregar();
    }

    // Botão discreto com o nome do dispositivo (Enter/Espaço funcionam nativamente)
    function botaoDispositivo(dev) {
        var b = criar("button", "link-dispositivo", nomeExibicao(dev));
        b.type = "button";
        b.setAttribute("aria-label", "ver " + nomeExibicao(dev));
        b.addEventListener("click", function () { selecionarDispositivo(dev); });
        return b;
    }

    // Horário de parede ("YYYY-MM-DDTHH:MM:SS-03:00") como ms, sem depender do fuso do navegador
    function paraMs(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso || "");
        if (!m) return NaN;
        return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }

    function hora(ms) {
        var d = new Date(ms);
        return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
    }

    function diaHora(ms) {
        var d = new Date(ms);
        return pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) + " " + hora(ms);
    }

    function idadeTexto(s) {
        if (s < 60) return "visto há " + Math.floor(s) + " s";
        if (s < 3600) return "visto há " + Math.floor(s / 60) + " min";
        return "visto há " + Math.floor(s / 3600) + " h";
    }

    function idadeAgora(d) {
        return d.idade_s + (Date.now() - estado.buscadoEm) / 1000;
    }

    function dispositivoPorId(id) {
        for (var i = 0; i < estado.dispositivos.length; i++) {
            if (estado.dispositivos[i].device_id === id) return estado.dispositivos[i];
        }
        return null;
    }

    // Cor da série: posição do dispositivo na lista (1 a 4)
    function corDoDispositivo(id) {
        for (var i = 0; i < estado.dispositivos.length; i++) {
            if (estado.dispositivos[i].device_id === id) return (i % 4) + 1;
        }
        return 1;
    }

    // ---------- URL (hash) ----------

    function lerHash() {
        var p = new URLSearchParams(location.hash.replace(/^#/, ""));
        var dev = p.get("dispositivo") || "all";
        if (dev !== "all" && !/^[A-Za-z0-9_-]{1,40}$/.test(dev)) dev = "all";
        var per = p.get("periodo");
        if (!PERIODOS.hasOwnProperty(per)) per = "1h";
        estado.dispositivo = dev;
        estado.periodo = per;
    }

    function gravarHash() {
        var novo = "#dispositivo=" + encodeURIComponent(estado.dispositivo) + "&periodo=" + estado.periodo;
        if (location.hash !== novo) history.replaceState(null, "", novo);
    }

    // ---------- Dados ----------

    function getJson(url) {
        return fetch(url, { cache: "no-store" }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        });
    }

    function marcarStatus(texto, erro) {
        $("status-texto").textContent = texto;
        $("status").classList.toggle("erro", !!erro);
    }

    // Indicador ASCII que gira só enquanto busca dados
    var girador = null;
    function girarIndicador(ligar) {
        var el = $("spinner");
        if (ligar && !girador) {
            var quadros = ["|", "/", "-", "\\"], i = 0;
            girador = setInterval(function () { el.textContent = quadros[i++ % 4]; }, 100);
        } else if (!ligar && girador) {
            clearInterval(girador);
            girador = null;
            el.textContent = "";
        }
    }

    function carregar() {
        if (estado.emCarregamento) {
            estado.pendente = true;
            return Promise.resolve();
        }
        estado.emCarregamento = true;
        girarIndicador(true);
        var dev = encodeURIComponent(estado.dispositivo);
        var since = PERIODOS[estado.periodo];

        return Promise.all([
            getJson("esp-data.php?devices=1"),
            getJson("esp-data.php?series=1&device=" + dev + "&since=" + since),
            getJson("esp-data.php?readings=1&device=" + dev + "&limit=" + LEITURAS_NA_TABELA)
        ]).then(function (r) {
            estado.dispositivos = r[0];
            estado.buscadoEm = Date.now();
            estado.serie = r[1];
            estado.leituras = r[2];
            mostrarErroConexao(false);
            render();
            marcarStatus("atualizado " + new Date().toLocaleTimeString("pt-BR"), false);
        }).catch(function () {
            estado.ultimoId = null;   // força nova tentativa no próximo ciclo
            mostrarErroConexao(true);
            marcarStatus("sem conexão", true);
        }).then(function () {
            estado.emCarregamento = false;
            girarIndicador(false);
            if (estado.pendente) {
                estado.pendente = false;
                return carregar();
            }
        });
    }

    function consultar() {
        fetch("esp-data.php?latest=1", { cache: "no-store" })
            .then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.text();
            })
            .then(function (texto) {
                var id = parseInt(texto, 10);
                if (isNaN(id)) throw new Error("resposta invalida");
                mostrarErroConexao(false);
                if (id !== estado.ultimoId) {
                    estado.ultimoId = id;
                    return carregar();
                }
                marcarStatus("atualizado " + new Date().toLocaleTimeString("pt-BR"), false);
            })
            .catch(function () {
                mostrarErroConexao(true);
                marcarStatus("sem conexão", true);
            });
    }

    // ---------- Lista de dispositivos ----------

    function criarItem(chave) {
        var li = criar("li");
        var botao = criar("button", "dispositivo");
        botao.type = "button";
        var nome = criar("span", "nome");
        var local = criar("span", "local");
        var sensor = criar("span", "sensor");
        var estadoLinha = criar("span", "estado");
        var marca = criar("span", "marca");
        marca.setAttribute("aria-hidden", "true");
        var texto = criar("span", "texto-estado");
        var visto = criar("span", "visto");
        estadoLinha.appendChild(marca);
        estadoLinha.appendChild(texto);
        estadoLinha.appendChild(criar("span", "sep", " · "));
        estadoLinha.appendChild(visto);
        botao.appendChild(nome);
        botao.appendChild(local);
        botao.appendChild(sensor);
        botao.appendChild(estadoLinha);
        botao.addEventListener("click", function () { selecionarDispositivo(chave); });
        li.appendChild(botao);
        return { li: li, botao: botao, nome: nome, local: local, sensor: sensor,
                 estadoLinha: estadoLinha, texto: texto, visto: visto };
    }

    function renderLista() {
        var lista = $("lista");
        var chaves = ["all"].concat(estado.dispositivos.map(function (d) { return d.device_id; }));

        itensLista.forEach(function (item, chave) {
            if (chaves.indexOf(chave) < 0) {
                item.li.remove();
                itensLista.delete(chave);
            }
        });

        chaves.forEach(function (chave, posicao) {
            var item = itensLista.get(chave);
            if (!item) {
                item = criarItem(chave);
                itensLista.set(chave, item);
                lista.insertBefore(item.li, lista.children[posicao] || null);
            }
            if (chave === "all") {
                item.nome.textContent = "Todos";
                item.local.textContent = "todos os dispositivos";
                item.sensor.hidden = true;
                item.estadoLinha.hidden = true;
            } else {
                var d = dispositivoPorId(chave);
                item.nome.textContent = nomeExibicao(chave);
                item.local.textContent = (d && d.local_instalado) || "";
                item.sensor.textContent = (d && d.sensor) || "";
                item.sensor.hidden = !(d && d.sensor);
            }
            if (chave === estado.dispositivo) {
                item.botao.setAttribute("aria-current", "true");
            } else {
                item.botao.removeAttribute("aria-current");
            }
        });
    }

    // Atualiza só texto e classe online/offline (a cada segundo)
    function atualizarEstados() {
        estado.dispositivos.forEach(function (d) {
            var item = itensLista.get(d.device_id);
            if (!item) return;
            var idade = idadeAgora(d);
            var online = idade < LIMITE_ONLINE_S;
            item.botao.classList.toggle("online", online);
            item.botao.classList.toggle("offline", !online);
            item.texto.textContent = online ? "online" : "offline";
            item.visto.textContent = idadeTexto(idade);
        });
        var todos = itensLista.get("all");
        if (todos) {
            var n = estado.dispositivos.length;
            todos.local.textContent = n + (n === 1 ? " dispositivo" : " dispositivos");
        }
        atualizarFaixasParados();
    }

    // ---------- Ilustrações (webservice/assets/*.svg, injetadas inline) ----------
    // Inline (não <img>) para que currentColor e var(--ilu-accent) sigam o tema.

    var ilusCache = new Map();

    // Remove <script> e atributos on* por precaução; devolve o <svg> raiz ou null
    function sanitizarSvg(texto) {
        var doc = new DOMParser().parseFromString(texto, "image/svg+xml");
        var raiz = doc.documentElement;
        if (!raiz || raiz.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
        raiz.querySelectorAll("script").forEach(function (n) { n.remove(); });
        raiz.querySelectorAll("*").forEach(function (el) {
            Array.prototype.slice.call(el.attributes).forEach(function (a) {
                if (/^on/i.test(a.name)) el.removeAttribute(a.name);
            });
        });
        return raiz;
    }

    // Busca assets/NOME.svg uma vez; falha (arquivo ausente) não fica em cache
    function carregarIlu(nome) {
        if (!ilusCache.has(nome)) {
            var p = fetch("assets/" + nome + ".svg")
                .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
                .then(sanitizarSvg)
                .catch(function () { return null; })
                .then(function (svg) { if (!svg) ilusCache.delete(nome); return svg; });
            ilusCache.set(nome, p);
        }
        return ilusCache.get(nome);
    }

    // Preenche um contêiner [data-ilu]; sem o arquivo, mostra data-fallback em texto
    function preencherIlu(el) {
        var nome = el.getAttribute("data-ilu");
        if (!nome || el.getAttribute("data-carregado") === nome) return Promise.resolve();
        return carregarIlu(nome).then(function (svg) {
            el.textContent = "";
            if (!svg) {
                el.classList.add("ilu-fallback");
                el.textContent = el.getAttribute("data-fallback") || "";
                return;
            }
            var copia = document.importNode(svg, true);
            copia.setAttribute("role", "img");
            if (!copia.querySelector("title")) {
                copia.setAttribute("aria-label", el.getAttribute("data-aria") || "");
            }
            el.appendChild(copia);
            el.setAttribute("data-carregado", nome);
        });
    }

    // ---------- Estados de erro e vazio ----------

    // Faixa discreta no topo dos gráficos: dispositivo selecionado (ou algum, em "Todos") sem leitura há 30 s ou mais
    function atualizarFaixasParados() {
        var escopo = estado.dispositivo === "all"
            ? estado.dispositivos
            : [dispositivoPorId(estado.dispositivo)].filter(Boolean);
        var paradas = escopo.filter(function (d) { return idadeAgora(d) >= LIMITE_ONLINE_S; });
        var texto = "";
        if (paradas.length) {
            var maior = paradas.reduce(function (a, b) { return idadeAgora(b) > idadeAgora(a) ? b : a; });
            var s = idadeAgora(maior);
            var tempo = s < 60 ? Math.floor(s) + " s" : Math.floor(s / 60) + " min";
            texto = "Dados parados há " + tempo +
                (estado.dispositivo === "all" ? " · " + nomeExibicao(maior.device_id) : "");
        }
        ["faixa-temp", "faixa-umid"].forEach(function (id) {
            var el = $(id);
            el.querySelector(".faixa-texto").textContent = texto;
            el.hidden = !texto;
            if (texto) preencherIlu(el.querySelector("[data-ilu]"));
        });
    }

    // Ilustração clonada de um <template> e legenda curta, dentro do próprio bloco
    function estadoErroNoBloco(box, nomeIlu, titulo, explicacao) {
        var wrap = criar("div", "estado-erro");
        var ilu = criar("div", "ilu ilu-medio");
        ilu.setAttribute("data-ilu", nomeIlu);
        ilu.setAttribute("data-fallback", "[ erro ]");
        ilu.setAttribute("data-aria", titulo);
        wrap.appendChild(ilu);
        wrap.appendChild(criar("p", "erro-titulo", titulo));
        wrap.appendChild(criar("p", "erro-texto", explicacao));
        box.appendChild(wrap);
        preencherIlu(ilu);
    }

    // Falha ao falar com o servidor: aparece acima dos blocos; some na primeira resposta boa
    function mostrarErroConexao(falhou) {
        $("erro-conexao").hidden = !falhou;
    }

    // ---------- Séries ----------

    // Agrupa os pontos por dispositivo; cada ponto recebe ms (horário de parede)
    function agruparSeries() {
        var grupos = new Map();
        var pontos = (estado.serie && estado.serie.pontos) || [];
        pontos.forEach(function (p) {
            var ms = paraMs(p.data_hora);
            if (isNaN(ms)) return;
            if (!grupos.has(p.device_id)) grupos.set(p.device_id, []);
            grupos.get(p.device_id).push({ ms: ms, t: p.t, h: p.h, id: p.id, dev: p.device_id });
        });
        var lista = [];
        grupos.forEach(function (pts, dev) {
            pts.sort(function (a, b) { return a.ms - b.ms; });
            lista.push({ dev: dev, nome: nomeExibicao(dev), cor: corDoDispositivo(dev), pontos: pts });
        });
        lista.sort(function (a, b) { return a.cor - b.cor; });
        return lista;
    }

    function estatisticas(valores) {
        var v = valores.filter(function (x) { return x !== null && x !== undefined; });
        if (v.length === 0) return null;
        var soma = 0, min = v[0], max = v[0];
        v.forEach(function (x) {
            soma += x;
            if (x < min) min = x;
            if (x > max) max = x;
        });
        return { min: min, max: max, media: soma / v.length };
    }

    // ---------- Renderização ----------

    function render() {
        var vazio = estado.dispositivos.length === 0;
        $("vazio").hidden = !vazio;
        document.querySelector(".b-disp").hidden = vazio;
        document.querySelectorAll(".dados").forEach(function (b) { b.hidden = vazio; });
        $("atual-unico").hidden = vazio;

        renderLista();
        atualizarEstados();
        gravarRadios();
        if (vazio) return;

        var series = agruparSeries();
        renderAtual();
        renderEstatisticas(series);
        $("nota-amostragem").hidden = !(estado.serie && estado.serie.amostrado);
        renderRotulosGraficos();
        renderGrafico("grafico-temp", series, "t", "t", "temperatura", "°C");
        renderGrafico("grafico-umid", series, "h", "u", "umidade", "%");
        renderLeituras();
    }

    function gravarRadios() {
        var radios = document.querySelectorAll('input[name="periodo"]');
        for (var i = 0; i < radios.length; i++) {
            radios[i].checked = radios[i].value === estado.periodo;
        }
    }

    // Títulos dos gráficos mostram o sensor do dispositivo selecionado
    function renderRotulosGraficos() {
        var d = estado.dispositivo === "all" ? null : dispositivoPorId(estado.dispositivo);
        var sufixo = estado.dispositivo === "all" ? " · todos" : (d ? " · " + d.sensor : "");
        $("t-temp").textContent = "temperatura (°C)" + sufixo;
        $("t-umid").textContent = "umidade (%)" + sufixo;
    }

    function renderAtual() {
        var unico = $("atual-unico");
        var todos = $("atual-todos");
        if (estado.dispositivo === "all") {
            unico.hidden = true;
            todos.hidden = false;
            var corpo = $("atual-todos-corpo");
            corpo.textContent = "";
            estado.dispositivos.forEach(function (d) {
                var tr = criar("tr");
                var celulaId = criar("td");
                celulaId.appendChild(botaoDispositivo(d.device_id));
                tr.appendChild(celulaId);
                tr.appendChild(criar("td", "", d.local_instalado));
                tr.appendChild(criar("td", "", d.sensor));
                tr.appendChild(criar("td", "num", fmt(d.t)));
                tr.appendChild(criar("td", "num", fmt(d.h)));
                tr.appendChild(criar("td", "", idadeTexto(idadeAgora(d))));
                corpo.appendChild(tr);
            });
            return;
        }

        unico.hidden = false;
        todos.hidden = true;
        var d = dispositivoPorId(estado.dispositivo);
        $("temp-atual").textContent = d ? fmt(d.t) : "—";
        $("umid-atual").textContent = d ? fmt(d.h) : "—";
        $("meta-atual").textContent = d
            ? nomeExibicao(d.device_id) + " · " + d.local_instalado + " · " + d.sensor +
              " · leitura de " + (d.data_hora ? d.data_hora.replace("T", " ").slice(0, 19) : "—")
            : "";
    }

    function renderEstatisticas(series) {
        var corpo = $("estatisticas-corpo");
        corpo.textContent = "";
        if (series.length === 0) {
            var vazio = criar("tr");
            var td = criar("td", "vazio", "Sem medições neste período ainda.");
            td.colSpan = 7;
            vazio.appendChild(td);
            corpo.appendChild(vazio);
            return;
        }
        series.forEach(function (s) {
            var temp = estatisticas(s.pontos.map(function (p) { return p.t; }));
            var umid = estatisticas(s.pontos.map(function (p) { return p.h; }));
            var tr = criar("tr");
            var celulaNome = criar("td");
            celulaNome.appendChild(botaoDispositivo(s.dev));
            tr.appendChild(celulaNome);
            [temp && temp.min, temp && temp.max, temp && temp.media,
             umid && umid.min, umid && umid.max, umid && umid.media].forEach(function (v) {
                tr.appendChild(criar("td", "num", fmt(v)));
            });
            corpo.appendChild(tr);
        });
    }

    // Tabela de leituras: a coluna "valor 3" só aparece se alguma linha visível tiver valor
    function renderLeituras() {
        var cabeca = $("leituras-cabeca");
        var corpo = $("leituras-corpo");
        var todos = estado.dispositivo === "all";
        var temValor3 = estado.leituras.some(function (l) { return l.valor3 !== null && l.valor3 !== ""; });
        cabeca.textContent = "";
        corpo.textContent = "";

        var tr = criar("tr");
        var colunas = [["ID", "num"]];
        if (todos) colunas.push(["Dispositivo", ""]);
        colunas.push(["Sensor", ""], ["Local", ""], ["Temperatura (°C)", "num"], ["Umidade (%)", "num"]);
        if (temValor3) colunas.push(["Valor 3", "num"]);
        colunas.push(["Data / Hora", ""]);
        colunas.forEach(function (c) {
            var th = criar("th", c[1], c[0]);
            th.setAttribute("scope", "col");
            tr.appendChild(th);
        });
        cabeca.appendChild(tr);

        if (estado.leituras.length === 0) {
            var vazio = criar("tr");
            var td = criar("td", "vazio", "Ainda sem leituras por aqui. Elas aparecem assim que o sensor enviar.");
            td.colSpan = colunas.length;
            vazio.appendChild(td);
            corpo.appendChild(vazio);
            return;
        }
        estado.leituras.forEach(function (l) {
            var linha = criar("tr");
            linha.appendChild(criar("td", "num", l.id));
            if (todos) {
                var celulaDev = criar("td");
                celulaDev.appendChild(botaoDispositivo(l.device_id));
                linha.appendChild(celulaDev);
            }
            linha.appendChild(criar("td", "", l.sensor));
            linha.appendChild(criar("td", "", l.local_instalado));
            linha.appendChild(criar("td", "num", celulaNumero(l.valor1)));
            linha.appendChild(criar("td", "num", celulaNumero(l.valor2)));
            if (temValor3) linha.appendChild(criar("td", "num", celulaNumero(l.valor3)));
            var ms = paraMs(l.data_hora);
            linha.appendChild(criar("td", "", isNaN(ms) ? "—" : diaHora(ms)));
            corpo.appendChild(linha);
        });
    }

    // Valor de leitura para a tabela: nulo ou vazio vira travessão; número com vírgula
    function celulaNumero(v) {
        if (v === null || v === undefined || v === "") return "—";
        var n = parseFloat(v);
        return isNaN(n) ? String(v) : fmt(n);
    }

    // Escolhe um passo "redondo" (1, 2, 2.5, 5 x 10^n) para os rótulos do eixo Y
    function passoRedondo(intervalo, alvo) {
        var bruto = intervalo / alvo;
        var pot = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
        var r = bruto / pot;
        var f = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
        return f * pot;
    }

    // Gráfico de linha em SVG. campo: "t" ou "h"; prefixo: "t" (cores de temperatura) ou "u" (umidade).
    // O eixo X vai do início da janela (ou do primeiro ponto, se for mais recente) até a última leitura.
    function renderGrafico(id, series, campo, prefixo, titulo, unidade) {
        var box = $(id);
        box.textContent = "";
        box.style.position = "relative";

        var todos = [];
        series.forEach(function (s) {
            s.pontos.forEach(function (p) {
                if (p[campo] !== null && p[campo] !== undefined) todos.push({ s: s, p: p, v: p[campo] });
            });
        });

        if (todos.length === 0) {
            var temPontos = series.some(function (s) { return s.pontos.length > 0; });
            if (temPontos) {
                // Há leituras, mas o valor deste sensor veio vazio ("--" do DHT com falha)
                estadoErroNoBloco(box, "error-sensor", "Sem leituras de " + titulo,
                    "O sensor não está enviando este valor. Confira a fiação do DHT.");
            } else {
                box.appendChild(criar("p", "sem-dados", "Nenhuma leitura de " + titulo + " neste período."));
            }
            return;
        }

        var largura = Math.max(280, Math.min(box.clientWidth || 640, 960));
        var altura = largura < 520 ? 220 : 240;
        var m = { top: 10, right: 14, bottom: 26, left: 50 };

        var dadosMin = Math.min.apply(null, todos.map(function (x) { return x.p.ms; }));
        var tMax = Math.max.apply(null, todos.map(function (x) { return x.p.ms; }));
        var tMin = estado.periodo === "tudo"
            ? dadosMin
            : Math.max(tMax - PERIODOS[estado.periodo] * 1000, dadosMin);
        if (tMax - tMin < 60000) tMin = tMax - 60000;  // janela mínima de 1 min

        var vMin = Math.min.apply(null, todos.map(function (x) { return x.v; }));
        var vMax = Math.max.apply(null, todos.map(function (x) { return x.v; }));
        if (vMax - vMin < 1) { vMin -= 1; vMax += 1; }
        var folga = (vMax - vMin) * 0.1;
        var passo = passoRedondo((vMax - vMin) + 2 * folga, 4);
        var lo = Math.floor((vMin - folga) / passo) * passo;
        var hi = Math.ceil((vMax + folga) / passo) * passo;

        var plotL = m.left, plotR = largura - m.right, plotT = m.top, plotB = altura - m.bottom;
        function X(ms) { return plotL + (ms - tMin) / (tMax - tMin) * (plotR - plotL); }
        function Y(v) { return plotT + (hi - v) / (hi - lo) * (plotB - plotT); }

        var raiz = svg("svg", {
            width: largura, height: altura, viewBox: "0 0 " + largura + " " + altura,
            role: "img",
            "aria-label": titulo + " (" + unidade + ") por horário, " + todos.length + " leituras. Mínimo " +
                fmt(vMin) + " " + unidade + ", máximo " + fmt(vMax) + " " + unidade + "."
        });
        var titulo_svg = svg("title", {});
        titulo_svg.textContent = titulo + " (" + unidade + ")";
        raiz.appendChild(titulo_svg);

        // Grade horizontal e rótulos do eixo Y
        var n = Math.round((hi - lo) / passo);
        for (var i = 0; i <= n; i++) {
            var v = lo + i * passo;
            var y = Y(v);
            raiz.appendChild(svg("line", { x1: plotL, x2: plotR, y1: y, y2: y, class: "grade" }));
            var rotulo = svg("text", { x: plotL - 6, y: y + 4, "text-anchor": "end" });
            rotulo.textContent = fmt(v);
            raiz.appendChild(rotulo);
        }

        // Rótulos do eixo X (5 marcas)
        var comData = estado.periodo === "tudo" || (tMax - tMin) > 86400000;
        var marcas = largura < 420 ? 2 : 4;   // menos rótulos em telas estreitas
        for (var k = 0; k <= marcas; k++) {
            var ms = tMin + k * (tMax - tMin) / marcas;
            var anc = k === 0 ? "start" : k === marcas ? "end" : "middle";
            var rx = svg("text", { x: X(ms), y: altura - 6, "text-anchor": anc });
            rx.textContent = (comData && largura >= 420)
                ? diaHora(ms).slice(0, 11) + " " + hora(ms).slice(0, 5)
                : hora(ms).slice(0, 5);
            raiz.appendChild(rx);
        }
        raiz.appendChild(svg("line", { x1: plotL, x2: plotR, y1: plotB, y2: plotB, class: "eixo" }));

        // Linhas: quebra o traço onde não há leitura válida; marcador por ponto quando couber
        var desenharPontos = todos.length <= MAX_PONTOS_COM_MARCADOR;
        series.forEach(function (s) {
            var d = "";
            var abrir = true;
            var cor = "var(--" + prefixo + s.cor + ")";
            s.pontos.forEach(function (p) {
                if (p[campo] === null || p[campo] === undefined) { abrir = true; return; }
                d += (abrir ? "M" : "L") + X(p.ms).toFixed(1) + " " + Y(p[campo]).toFixed(1) + " ";
                abrir = false;
                if (desenharPontos) {
                    var c = svg("circle", { cx: X(p.ms).toFixed(1), cy: Y(p[campo]).toFixed(1), r: 2, class: "ponto" });
                    c.style.fill = cor;
                    raiz.appendChild(c);
                }
            });
            if (!d) return;
            var linha = svg("path", { d: d, class: "linha", fill: "none" });
            linha.style.stroke = cor;
            raiz.appendChild(linha);
        });

        // Marcador do ponto sob o mouse e área de captura
        var marcador = svg("circle", { r: 4, class: "marcador", visibility: "hidden" });
        raiz.appendChild(marcador);
        var captura = svg("rect", { x: plotL, y: plotT, width: plotR - plotL, height: plotB - plotT, fill: "transparent" });
        raiz.appendChild(captura);

        box.appendChild(raiz);

        // Legenda (só com mais de um dispositivo), com a mesma cor e traço da série
        if (series.length > 1) {
            var legenda = criar("div", "legenda");
            series.forEach(function (s) {
                var item = criar("span", "item-legenda");
                var sw = criar("span", "amostra");
                sw.setAttribute("aria-hidden", "true");
                sw.style.borderTopColor = "var(--" + prefixo + s.cor + ")";
                item.appendChild(sw);
                item.appendChild(document.createTextNode(s.nome));
                legenda.appendChild(item);
            });
            box.appendChild(legenda);
        }

        var dica = criar("div", "dica");
        dica.hidden = true;
        box.appendChild(dica);

        captura.addEventListener("pointermove", function (ev) {
            var r = raiz.getBoundingClientRect();
            var xs = (ev.clientX - r.left) * largura / r.width;
            var melhor = null, melhorDist = Infinity;
            todos.forEach(function (x) {
                var dx = Math.abs(X(x.p.ms) - xs);
                if (dx < melhorDist) { melhorDist = dx; melhor = x; }
            });
            if (!melhor) return;
            var px = X(melhor.p.ms), py = Y(melhor.v);
            marcador.setAttribute("cx", px);
            marcador.setAttribute("cy", py);
            marcador.style.fill = "var(--" + prefixo + melhor.s.cor + ")";
            marcador.setAttribute("visibility", "visible");
            dica.textContent = (series.length > 1 ? melhor.s.nome + " · " : "") +
                fmt(melhor.v) + " " + unidade + " · " + hora(melhor.p.ms);
            dica.hidden = false;
            dica.classList.toggle("esquerda", px > largura * 0.6);
            dica.style.left = (px * r.width / largura) + "px";
            dica.style.top = (py * r.height / altura) + "px";
        });
        captura.addEventListener("pointerleave", function () {
            marcador.setAttribute("visibility", "hidden");
            dica.hidden = true;
        });
    }

    // ---------- Eventos ----------

    function ligarEventos() {
        var radios = document.querySelectorAll('input[name="periodo"]');
        for (var i = 0; i < radios.length; i++) {
            radios[i].addEventListener("change", function (ev) {
                estado.periodo = ev.target.value;
                gravarHash();
                carregar();
            });
        }

        window.addEventListener("hashchange", function () {
            lerHash();
            carregar();
        });

        var redimensionar = null;
        window.addEventListener("resize", function () {
            clearTimeout(redimensionar);
            redimensionar = setTimeout(function () {
                if (estado.serie && estado.dispositivos.length) render();
            }, 150);
        });
    }

    // ---------- Efeito ASCII dither (reutilizável) ----------
    // ditherOut: os textos viram glifos de densidade crescente, em ordem aleatória (60% do tempo),
    // e depois são apagados em ordem de documento (≈ de cima para baixo).
    // ditherIn: restaura os textos guardados pelo ditherOut e revela o elemento em blocos (steps).
    var GLIFOS_DITHER = [".", ":", "░", "▒", "▓", "█"];

    function nosDeTexto(el) {
        var nos = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        while (w.nextNode()) if (w.currentNode.nodeValue.trim()) nos.push(w.currentNode);
        return nos;
    }

    function ditherOut(el, duracao) {
        return new Promise(function (resolver) {
            var nos = nosDeTexto(el);
            var originais = nos.map(function (no) { return { no: no, texto: no.nodeValue }; });
            el._ditherOriginais = originais;
            if (reduzirMovimento()) {                      // versão estática: apaga na hora
                nos.forEach(function (no) { no.nodeValue = no.nodeValue.replace(/\S/g, " "); });
                resolver();
                return;
            }
            var chars = [];
            originais.forEach(function (o, ni) {
                for (var i = 0; i < o.texto.length; i++) {
                    if (o.texto[i] !== " ") chars.push({ ni: ni, i: i, r: Math.random(), ordem: chars.length });
                }
            });
            var total = Math.max(1, chars.length), fase1 = duracao * 0.6, inicio = performance.now();
            function quadro() {
                var t = performance.now() - inicio;
                var p = Math.min(1, t / fase1);
                var varrer = t > fase1 ? Math.min(1, (t - fase1) / (duracao - fase1)) : 0;
                var linhas = originais.map(function (o) { return o.texto.split(""); });
                chars.forEach(function (c) {
                    var linha = linhas[c.ni];
                    if (varrer > 0 && c.ordem / total < varrer) { linha[c.i] = " "; return; }
                    if (c.r < p) {
                        var k = Math.min(GLIFOS_DITHER.length - 1, Math.floor(p * GLIFOS_DITHER.length));
                        linha[c.i] = GLIFOS_DITHER[k];
                    }
                });
                originais.forEach(function (o, ni) { o.no.nodeValue = linhas[ni].join(""); });
                if (t >= duracao) { resolver(); return; }
                setTimeout(quadro, 50);
            }
            quadro();
        });
    }

    function ditherIn(el, duracao) {
        (el._ditherOriginais || []).forEach(function (o) {
            if (o.no.isConnected) o.no.nodeValue = o.texto;
        });
        el._ditherOriginais = null;
        if (reduzirMovimento() || !duracao) return Promise.resolve();
        el.style.setProperty("--dither-dur", duracao + "ms");
        el.classList.remove("dither-in");
        void el.offsetWidth;                              // reinicia a animação CSS
        el.classList.add("dither-in");
        return new Promise(function (r) {
            setTimeout(function () { el.classList.remove("dither-in"); r(); }, duracao);
        });
    }

    // ---------- Atalho escondido de limpeza (só com SIMULATION=1) ----------
    // Segurar Backspace por 5 s: 0-2 s nada; 2-5 s tremor e overlay vermelho com contagem 3, 2, 1; 5 s apaga o banco.

    var ATALHO = { tecla: "Backspace", inicioMs: 2000, totalMs: 5000, tickMs: 33 };
    var atalho = { ativo: false, ocupado: false, t0: 0, timer: null, sobreposicao: null, contagem: null };

    function reduzirMovimento() {
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    // Campos de texto e seleções não disparam o atalho
    function alvoEditavel(el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
    }

    // Overlay criado só na hora (não há nada visível na página). pointer-events: none, sem foco
    function garantirSobreposicao() {
        if (atalho.sobreposicao) return atalho.sobreposicao;
        var sob = criar("div", "limpeza");
        sob.setAttribute("role", "alertdialog");
        sob.setAttribute("aria-live", "assertive");
        sob.setAttribute("aria-label", "Limpeza do banco em andamento");
        sob.hidden = true;
        var n = criar("span", "contagem");
        var dica = criar("p", "dica-cancelar", "solte para cancelar");
        sob.appendChild(n);
        sob.appendChild(dica);
        document.body.appendChild(sob);
        atalho.sobreposicao = sob;
        atalho.contagem = n;
        return sob;
    }

    function tremer(p) {
        var main = document.querySelector(".pagina");
        if (!main) return;
        if (reduzirMovimento()) { main.style.transform = ""; return; }
        var amp = 1 + 6 * p;
        var dx = (Math.random() * 2 - 1) * amp;
        var dy = (Math.random() * 2 - 1) * amp * 0.5;
        main.style.transform = "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px)";
    }

    function pararTremor() {
        var main = document.querySelector(".pagina");
        if (main) main.style.transform = "";
    }

    function mostrarSobreposicao(p, segundos) {
        var sob = garantirSobreposicao();
        sob.classList.remove("esmaecer");
        sob.hidden = false;
        sob.style.opacity = String(reduzirMovimento() ? 0.88 : 0.15 + 0.77 * p);
        var texto = String(segundos);
        if (atalho.contagem.textContent !== texto) atalho.contagem.textContent = texto;
    }

    // Tira tudo na hora (soltou a tecla, perdeu o foco ou trocou de aba)
    function cancelarAtalho() {
        if (!atalho.ativo) return;
        atalho.ativo = false;
        clearTimeout(atalho.timer);
        atalho.timer = null;
        pararTremor();
        if (atalho.sobreposicao) {
            atalho.sobreposicao.hidden = true;
            atalho.sobreposicao.style.opacity = "";
            atalho.contagem.textContent = "";
        }
    }

    function passoAtalho() {
        atalho.timer = null;
        if (!atalho.ativo) return;
        var decorrido = performance.now() - atalho.t0;
        if (decorrido >= ATALHO.totalMs) {
            concluirAtalho();
            return;
        }
        if (decorrido >= ATALHO.inicioMs) {
            var p = (decorrido - ATALHO.inicioMs) / (ATALHO.totalMs - ATALHO.inicioMs);
            mostrarSobreposicao(p, Math.ceil((ATALHO.totalMs - decorrido) / 1000));
            tremer(p);
        }
        atalho.timer = setTimeout(passoAtalho, ATALHO.tickMs);
    }

    function concluirAtalho() {
        atalho.ativo = false;
        atalho.ocupado = true;
        pararTremor();
        var sob = garantirSobreposicao();
        sob.hidden = false;
        sob.style.opacity = "0.8";                       // um pouco de transparência para o dither aparecer
        atalho.contagem.textContent = "";

        var duracao = reduzirMovimento() ? 300 : 1200;
        var pagina = document.querySelector(".pagina");
        var desfazendo = ditherOut(pagina, duracao);     // o conteúdo se desfaz em dither enquanto o POST corre
        var pedido = fetch("esp-data.php?reset=1", {
            method: "POST",
            headers: { "X-Confirmar": "apagar" },
            cache: "no-store"
        }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        }).then(function () {
            estado.ultimoId = null;
            marcarStatus("banco limpo " + new Date().toLocaleTimeString("pt-BR"), false);
            return true;
        }).catch(function () {
            marcarStatus("falha ao limpar o banco", true);
            return false;
        });
        Promise.all([desfazendo, pedido]).then(function (res) {
            ditherIn(pagina, 0);                         // devolve os textos antes de renderizar o estado vazio
            if (!res[1]) return;
            return carregar().then(function () { return ditherIn($("vazio"), 600); });
        }).then(function () {
            sob.classList.add("esmaecer");   // fade-out revela a página já limpa
            setTimeout(function () {
                sob.hidden = true;
                sob.style.opacity = "";
                sob.classList.remove("esmaecer");
                atalho.ocupado = false;
            }, duracao + 50);
        });
    }

    function aoTeclaAtalhoDown(ev) {
        if (ev.key !== ATALHO.tecla || ev.repeat) return;   // só o primeiro keydown, sem auto-repeat
        if (atalho.ativo || atalho.ocupado || alvoEditavel(ev.target)) return;
        atalho.ativo = true;
        atalho.t0 = performance.now();
        atalho.timer = setTimeout(passoAtalho, ATALHO.tickMs);
    }

    function aoTeclaAtalhoUp(ev) {
        if (ev.key === ATALHO.tecla) cancelarAtalho();
    }

    function armarAtalho() {
        window.addEventListener("keydown", aoTeclaAtalhoDown);
        window.addEventListener("keyup", aoTeclaAtalhoUp);
        window.addEventListener("blur", cancelarAtalho);
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) cancelarAtalho();
        });
    }

    // ---------- Início ----------

    lerHash();
    gravarHash();
    ligarEventos();
    document.querySelectorAll("[data-ilu]").forEach(function (el) { preencherIlu(el); });
    $("tentar-de-novo").addEventListener("click", function () {
        estado.ultimoId = null;
        carregar();
    });
    consultar();
    setInterval(consultar, INTERVALO_CONSULTA_MS);
    setInterval(atualizarEstados, INTERVALO_RELOGIO_MS);
    // O atalho só é armado se o servidor estiver em SIMULATION=1
    getJson("esp-data.php?config=1")
        .then(function (c) { if (c && c.simulation === true) armarAtalho(); })
        .catch(function () {});
})();
