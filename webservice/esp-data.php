<?php
// Painel de medições do ESP32 (PBL 03).
// Sem parâmetros: página HTML (carrega app.js, que consome os JSON abaixo).
// JSON (sempre Cache-Control: no-store):
//   ?latest=1                           -> maior id (texto puro; a página usa para saber se há dado novo)
//   ?devices=1                          -> lista de dispositivos: última leitura, total, idade em s
//   ?series=1&device=ID|all&since=S     -> pontos {id, device_id, t, h, data_hora}; S em s (0 = tudo)
//   ?readings=1&device=ID|all&limit=N   -> últimas N leituras (N <= 200), da mais recente
//   ?config=1                           -> {"simulation": true|false} (SIMULATION=1 no ambiente)
//   POST ?reset=1 + header X-Confirmar: apagar -> apaga todas as leituras; só com SIMULATION=1
// Horário: data_hora sai com o ajuste de -3 h (Brasília) só na exibição; o banco guarda o valor original.

// Carrega a configuração: config.php (local) ou config.example.php (variáveis de ambiente)
$configFile = file_exists(__DIR__ . "/config.php") ? __DIR__ . "/config.php" : __DIR__ . "/config.example.php";
require $configFile;

const LIMITE_PONTOS   = 2000;
const LIMITE_LEITURAS = 200;

// Escapa qualquer valor antes de mostrar na página
function e($valor) {
    return htmlspecialchars((string) $valor, ENT_QUOTES, "UTF-8");
}

function enviarJson($dados) {
    header("Content-Type: application/json; charset=utf-8");
    header("Cache-Control: no-store");
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function erroJson($codigo, $mensagem) {
    http_response_code($codigo);
    enviarJson(["erro" => $mensagem]);
}

// Dispositivo pedido na URL: "all" ou um device_id válido
function lerDispositivo() {
    $dev = $_GET["device"] ?? "all";
    if ($dev === "all") return "all";
    if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $dev)) erroJson(400, "device invalido");
    return $dev;
}

// Valor do banco (VARCHAR) para número; "--", "NULL" ou vazio viram null
function numero($valor) {
    if ($valor === null) return null;
    $texto = trim((string) $valor);
    return is_numeric($texto) ? (float) $texto : null;
}

// Exibição em horário de Brasília: -3 h aplicado só aqui, formato ISO com offset -03:00
function dataExibicao($bruta) {
    if ($bruta === null) return null;
    return date("Y-m-d\TH:i:s", strtotime($bruta . " - 3 hours")) . "-03:00";
}

// Modo simulação (SIMULATION=1 no .env): liga o atalho de limpeza no site e o endpoint de reset
$simulacao = getenv("SIMULATION") === "1";

if (isset($_GET["config"])) {
    enviarJson(["simulation" => $simulacao]);
}

// Conexão com o MariaDB
mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    error_log("Falha na conexao com o MariaDB: " . $conn->connect_error);
    erroJson(500, "Conexão Falhou.");
}
$conn->set_charset("utf8mb4");

// Reset para simulação: apaga todas as leituras. Só com SIMULATION=1, por POST e com confirmação no header.
// O usuário do banco só tem DELETE em medicoes quando o docker/mariadb/02-create-user.sh foi rodado com SIMULATION=1.
if (isset($_GET["reset"])) {
    if (!$simulacao) erroJson(403, "reset desativado");
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        header("Allow: POST");
        erroJson(405, "use POST");
    }
    if (($_SERVER["HTTP_X_CONFIRMAR"] ?? "") !== "apagar") {
        erroJson(400, "confirmacao ausente (header X-Confirmar: apagar)");
    }
    // Sem ALTER/TRUNCATE: o usuário não tem esses privilégios, então o auto_increment continua de onde parou
    error_log("reset do banco solicitado");
    if ($conn->query("DELETE FROM medicoes") === false) {
        error_log("Falha no reset do banco: " . $conn->error);
        $conn->close();
        erroJson(500, "falha ao apagar");
    }
    $apagadas = $conn->affected_rows;
    $conn->close();
    enviarJson(["ok" => true, "apagadas" => $apagadas]);
}

// Modo leve: maior ID
if (isset($_GET["latest"])) {
    header("Content-Type: text/plain; charset=utf-8");
    header("Cache-Control: no-store");
    $res = $conn->query("SELECT COALESCE(MAX(id), 0) AS ultimo FROM medicoes");
    echo $res ? (int) $res->fetch_assoc()["ultimo"] : 0;
    $conn->close();
    exit;
}

// Lista de dispositivos: a última leitura de cada um, com a idade medida pelo próprio banco
if (isset($_GET["devices"])) {
    $sql = "SELECT m.id, m.device_id, m.sensor, m.local_instalado, m.valor1, m.valor2, m.data_hora,
                   g.total, TIMESTAMPDIFF(SECOND, m.data_hora, NOW()) AS idade_s
            FROM medicoes m
            JOIN (SELECT device_id, MAX(id) AS ultimo_id, COUNT(*) AS total
                  FROM medicoes GROUP BY device_id) g ON g.ultimo_id = m.id
            ORDER BY m.id DESC";
    $lista = [];
    if ($res = $conn->query($sql)) {
        while ($row = $res->fetch_assoc()) {
            $lista[] = [
                "device_id"       => $row["device_id"],
                "sensor"          => $row["sensor"],
                "local_instalado" => $row["local_instalado"],
                "ultimo_id"       => (int) $row["id"],
                "t"               => numero($row["valor1"]),
                "h"               => numero($row["valor2"]),
                "data_hora"       => dataExibicao($row["data_hora"]),
                "total"           => (int) $row["total"],
                "idade_s"         => max(0, (int) $row["idade_s"]),
            ];
        }
        $res->free();
    }
    $conn->close();
    enviarJson($lista);
}

// Condições comuns: dispositivo ("all" ou ID) e janela de tempo (0 = tudo).
// Os parâmetros são sempre vinculados (prepared statements), nunca concatenados.
const FILTRO = "FROM medicoes
                WHERE (? = 'all' OR device_id = ?)
                  AND (? = 0 OR data_hora >= NOW() - INTERVAL ? SECOND)";

// Série para os gráficos. Com muitos pontos, amostra 1 a cada N por dispositivo
// (ROW_NUMBER por device_id, para que um dispositivo não "some" na amostragem),
// sempre mantendo a última leitura de cada um.
if (isset($_GET["series"])) {
    $dev = lerDispositivo();
    $since = min(max(0, (int) ($_GET["since"] ?? 0)), 31536000);

    $st = $conn->prepare("SELECT COUNT(*) AS n " . FILTRO);
    $st->bind_param("ssii", $dev, $dev, $since, $since);
    $st->execute();
    $total = (int) $st->get_result()->fetch_assoc()["n"];
    $st->close();

    $passo = max(1, (int) ceil($total / LIMITE_PONTOS));

    $sql = "SELECT id, device_id, valor1, valor2, data_hora FROM (
                SELECT id, device_id, valor1, valor2, data_hora,
                       ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY id) AS rn,
                       COUNT(*)     OVER (PARTITION BY device_id)            AS cnt
                " . FILTRO . "
            ) x
            WHERE MOD(rn - 1, ?) = 0 OR rn = cnt
            ORDER BY id DESC
            LIMIT " . LIMITE_PONTOS;
    $st = $conn->prepare($sql);
    $st->bind_param("ssiii", $dev, $dev, $since, $since, $passo);
    $st->execute();
    $res = $st->get_result();

    $pontos = [];
    while ($row = $res->fetch_assoc()) {
        $pontos[] = [
            "id"        => (int) $row["id"],
            "device_id" => $row["device_id"],
            "t"         => numero($row["valor1"]),
            "h"         => numero($row["valor2"]),
            "data_hora" => dataExibicao($row["data_hora"]),
        ];
    }
    $st->close();
    $conn->close();

    // Consulta veio do mais novo para o mais antigo; o gráfico quer ordem crescente
    enviarJson([
        "amostrado" => $passo > 1,
        "passo"     => $passo,
        "pontos"    => array_reverse($pontos),
    ]);
}

// Últimas leituras para a tabela
if (isset($_GET["readings"])) {
    $dev = lerDispositivo();
    $limite = min(max(1, (int) ($_GET["limit"] ?? 100)), LIMITE_LEITURAS);

    $st = $conn->prepare(
        "SELECT id, device_id, sensor, local_instalado, valor1, valor2, valor3, data_hora
         FROM medicoes
         WHERE (? = 'all' OR device_id = ?)
         ORDER BY id DESC
         LIMIT ?"
    );
    $st->bind_param("ssi", $dev, $dev, $limite);
    $st->execute();
    $res = $st->get_result();

    $linhas = [];
    while ($row = $res->fetch_assoc()) {
        $linhas[] = [
            "id"              => (int) $row["id"],
            "device_id"       => $row["device_id"],
            "sensor"          => $row["sensor"],
            "local_instalado" => $row["local_instalado"],
            "valor1"          => $row["valor1"],
            "valor2"          => $row["valor2"],
            "valor3"          => $row["valor3"],
            "data_hora"       => dataExibicao($row["data_hora"]),
        ];
    }
    $st->close();
    $conn->close();
    enviarJson($linhas);
}

// Página HTML
$conn->close();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Medições ESP32</title>
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="style.css?v=4">
</head>
<body>
<main class="pagina">
    <header class="cabecalho">
        <h1>Medições ESP32<span class="cursor" aria-hidden="true">▮</span></h1>
        <p id="status" class="status" role="status"><span id="spinner" class="spinner" aria-hidden="true"></span><span id="status-texto"></span></p>
    </header>

    <section id="erro-conexao" class="bloco b-erro" role="alert" hidden>
        <div class="ilu ilu-grande" data-ilu="error-unplugged" data-fallback="[ erro ]" data-aria="Servidor não responde"></div>
        <div class="erro-texto-bloco">
            <p class="erro-titulo">Sem conexão com o servidor.</p>
            <p class="erro-texto">Os dados mostrados podem estar antigos. A página tenta de novo sozinha.</p>
            <button type="button" id="tentar-de-novo" class="botao-discreto">tentar de novo</button>
        </div>
    </section>

    <div class="bento">
        <section id="vazio" class="bloco b-vazio" aria-labelledby="t-vazio" hidden>
            <div class="ilu ilu-grande" data-ilu="empty-state" data-fallback="[ vazio ]" data-aria="Nenhuma leitura ainda"></div>
            <h2 id="t-vazio" class="vazio-titulo">Nada por aqui ainda.</h2>
            <p class="vazio-texto">Ligue um ESP32 e as leituras aparecem sozinhas.</p>
        </section>

        <nav class="bloco b-disp" aria-labelledby="t-disp">
            <h2 id="t-disp" class="titulo-bloco">dispositivos</h2>
            <ul id="lista" class="lista"></ul>
        </nav>

        <section class="bloco b-atual dados" aria-labelledby="t-atual">
            <h2 id="t-atual" class="titulo-bloco">leitura atual</h2>
            <div id="atual-unico" class="atual-unico">
                <div class="medida">
                    <span class="rotulo">Temperatura (°C)</span>
                    <span id="temp-atual" class="numero">--</span>
                </div>
                <div class="medida">
                    <span class="rotulo">Umidade (%)</span>
                    <span id="umid-atual" class="numero">--</span>
                </div>
                <p id="meta-atual" class="meta"></p>
            </div>
            <div id="atual-todos" class="tabela-wrap" hidden>
                <table>
                    <caption class="sr-only">Leitura mais recente de cada dispositivo</caption>
                    <thead><tr>
                        <th scope="col">Dispositivo</th>
                        <th scope="col">Local</th>
                        <th scope="col">Sensor</th>
                        <th scope="col" class="num">Temperatura (°C)</th>
                        <th scope="col" class="num">Umidade (%)</th>
                        <th scope="col">Última leitura</th>
                    </tr></thead>
                    <tbody id="atual-todos-corpo"></tbody>
                </table>
            </div>
        </section>

        <div class="bloco b-periodo dados" role="radiogroup" aria-labelledby="t-periodo">
            <h2 id="t-periodo" class="titulo-bloco">período</h2>
            <div class="opcoes-periodo">
                <label><input type="radio" name="periodo" value="15m"><span>15 min</span></label>
                <label><input type="radio" name="periodo" value="1h"><span>1 h</span></label>
                <label><input type="radio" name="periodo" value="24h"><span>24 h</span></label>
                <label><input type="radio" name="periodo" value="tudo"><span>tudo</span></label>
            </div>
        </div>

        <section class="bloco b-temp dados" aria-labelledby="t-temp">
            <h2 id="t-temp" class="titulo-bloco">temperatura (°C)</h2>
            <p id="faixa-temp" class="faixa-parados" hidden><span class="ilu ilu-mini" data-ilu="stale-data" data-fallback="" aria-hidden="true"></span><span class="faixa-texto"></span></p>
            <div id="grafico-temp" class="grafico grafico-temp"></div>
        </section>

        <section class="bloco b-umid dados" aria-labelledby="t-umid">
            <h2 id="t-umid" class="titulo-bloco">umidade (%)</h2>
            <p id="faixa-umid" class="faixa-parados" hidden><span class="ilu ilu-mini" data-ilu="stale-data" data-fallback="" aria-hidden="true"></span><span class="faixa-texto"></span></p>
            <div id="grafico-umid" class="grafico grafico-umid"></div>
        </section>

        <section class="bloco b-stats dados" aria-labelledby="t-stats">
            <h2 id="t-stats" class="titulo-bloco">mín / máx / média do período</h2>
            <div class="tabela-wrap">
                <table class="tabela-compacta">
                    <caption class="sr-only">Estatísticas do período por dispositivo</caption>
                    <thead><tr>
                        <th scope="col">Dispositivo</th>
                        <th scope="col" class="num">Temp. mín (°C)</th>
                        <th scope="col" class="num">Temp. máx (°C)</th>
                        <th scope="col" class="num">Temp. média (°C)</th>
                        <th scope="col" class="num">Umid. mín (%)</th>
                        <th scope="col" class="num">Umid. máx (%)</th>
                        <th scope="col" class="num">Umid. média (%)</th>
                    </tr></thead>
                    <tbody id="estatisticas-corpo"></tbody>
                </table>
            </div>
            <p id="nota-amostragem" class="meta" hidden>Período com muitos pontos: gráficos e estatísticas usam amostragem.</p>
        </section>

        <section class="bloco b-leit dados" aria-labelledby="t-leit">
            <h2 id="t-leit" class="titulo-bloco">leituras</h2>
            <div class="tabela-wrap tabela-leituras">
                <table>
                    <caption class="sr-only">Leituras do dispositivo selecionado, da mais recente para a mais antiga</caption>
                    <thead id="leituras-cabeca"></thead>
                    <tbody id="leituras-corpo"></tbody>
                </table>
            </div>
        </section>
    </div>
</main>
<script src="app.js?v=4" defer></script>
</body>
</html>
