<?php
// Listagem das medições gravadas pelo ESP32.
// Modos:
//   esp-data.php            -> página completa (atualiza sozinha a cada nova inserção)
//   esp-data.php?latest=1   -> só o maior ID (usado pela página para detectar novas linhas)
//   esp-data.php?partial=1  -> só a tabela (usada pela página para se atualizar)

// Carrega a configuração: config.php (local) ou config.example.php (variáveis de ambiente)
$configFile = file_exists(__DIR__ . "/config.php") ? __DIR__ . "/config.php" : __DIR__ . "/config.example.php";
require $configFile;

// Escapa qualquer valor antes de mostrar na página
function e($valor) {
    return htmlspecialchars((string) $valor, ENT_QUOTES, "UTF-8");
}

// Criando conexão com o MariaDB
mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    die("Conexão Falhou.");
}
$conn->set_charset("utf8mb4");

// Modo leve: devolve apenas o maior ID, para a página saber se chegou dado novo
if (isset($_GET["latest"])) {
    header("Content-Type: text/plain; charset=utf-8");
    header("Cache-Control: no-store");
    $res = $conn->query("SELECT COALESCE(MAX(id), 0) AS ultimo FROM medicoes");
    echo $res ? (int) $res->fetch_assoc()["ultimo"] : 0;
    $conn->close();
    exit;
}

// Desenha a tabela com todas as medições
function renderTabela(mysqli $conn) {
    $sql = "SELECT id, sensor, local_instalado, valor1, valor2, valor3, data_hora
            FROM medicoes
            ORDER BY id DESC";

    $linhas = [];
    if ($result = $conn->query($sql)) {
        while ($row = $result->fetch_assoc()) {
            // Ajuste de timezone para o horário de Brasília (-3 h)
            $row["data_hora"] = date("Y-m-d H:i:s", strtotime($row["data_hora"] . " - 3 hours"));
            $linhas[] = $row;
        }
        $result->free();
    }
?>
<table>
    <caption class="sr-only">Medições do ESP32 gravadas no banco, da mais recente para a mais antiga</caption>
    <thead>
        <tr>
            <th scope="col" class="num">ID</th>
            <th scope="col">Sensor</th>
            <th scope="col">Local Instalado</th>
            <th scope="col" class="num">Valor 1</th>
            <th scope="col" class="num">Valor 2</th>
            <th scope="col" class="num">Valor 3</th>
            <th scope="col">Data / Hora</th>
        </tr>
    </thead>
    <tbody>
<?php if (count($linhas) === 0): ?>
        <tr class="sem-dados">
            <td colspan="7" class="vazio">Nenhuma medição ainda. Aguardando o ESP32...</td>
        </tr>
<?php endif; ?>
<?php foreach ($linhas as $row): ?>
        <tr>
            <td class="num"><?= e($row["id"]) ?></td>
            <td><?= e($row["sensor"]) ?></td>
            <td><?= e($row["local_instalado"]) ?></td>
            <td class="num"><?= e($row["valor1"]) ?></td>
            <td class="num"><?= e($row["valor2"]) ?></td>
            <td class="num"><?= e($row["valor3"]) ?></td>
            <td class="num"><?= e($row["data_hora"]) ?></td>
        </tr>
<?php endforeach; ?>
    </tbody>
</table>
<?php
}

// Modo parcial: só a tabela
if (isset($_GET["partial"])) {
    header("Cache-Control: no-store");
    renderTabela($conn);
    $conn->close();
    exit;
}

// Descobre o maior ID atual para a página começar sincronizada
$res = $conn->query("SELECT COALESCE(MAX(id), 0) AS ultimo FROM medicoes");
$ultimoId = $res ? (int) $res->fetch_assoc()["ultimo"] : 0;
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Medições ESP32</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<main class="pagina">
    <header class="cabecalho">
        <h1>Medições ESP32</h1>
        <p id="status" class="status"></p>
    </header>
    <div id="tabela" class="tabela-wrap">
<?php renderTabela($conn); $conn->close(); ?>
    </div>
</main>
<script>
// A cada 2 s pergunta ao servidor qual é o último ID; se mudou, recarrega só a tabela.
let ultimoId = <?= $ultimoId ?>;
const statusEl = document.getElementById("status");
const tabela = document.getElementById("tabela");

function agora() {
    return new Date().toLocaleTimeString("pt-BR");
}

// Destaque breve da linha nova: marca a primeira linha, força o estilo e tira a marca;
// a transição de fundo do CSS faz o resto (desligada com prefers-reduced-motion).
function destacarNova() {
    const primeira = tabela.querySelector("tbody tr");
    if (!primeira || primeira.classList.contains("sem-dados")) return;
    primeira.classList.add("novo");
    void primeira.offsetWidth;
    primeira.classList.remove("novo");
}

async function verificar() {
    try {
        const r = await fetch("?latest=1", { cache: "no-store" });
        const id = parseInt(await r.text(), 10);
        if (!Number.isNaN(id) && id !== ultimoId) {
            const t = await fetch("?partial=1", { cache: "no-store" });
            tabela.innerHTML = await t.text();
            ultimoId = id;
            destacarNova();
        }
        statusEl.classList.remove("erro");
        statusEl.textContent = "atualizado " + agora();
    } catch (erro) {
        statusEl.classList.add("erro");
        statusEl.textContent = "sem conexão";
    }
}

statusEl.textContent = "atualizado " + agora();
setInterval(verificar, 2000);
</script>
</body>
</html>
