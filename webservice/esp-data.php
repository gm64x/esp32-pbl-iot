<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Medições ESP32</title>
</head>
<body>
<?php
// Carrega as credenciais do banco (config.php fica fora do Git)
$configFile = __DIR__ . "/config.php";
if (!file_exists($configFile)) {
    die("Arquivo config.php nao encontrado. Copie config.example.php para config.php.");
}
require $configFile;

// Escapa qualquer valor antes de mostrar na página
function e($valor) {
    return htmlspecialchars((string) $valor, ENT_QUOTES, "UTF-8");
}

// Criando conexão com o MySQL
mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    die("Conexão Falhou.");
}
$conn->set_charset("utf8mb4");

// SQL para listagem dos dados de medição
$sql = "SELECT id, sensor, local_instalado, valor1, valor2, valor3, data_hora
        FROM medicoes
        ORDER BY id DESC";
?>
<table cellspacing="5" cellpadding="5" border="1">
    <tr>
        <td>ID</td>
        <td>Sensor</td>
        <td>Local Instalado</td>
        <td>Valor 1</td>
        <td>Valor 2</td>
        <td>Valor 3</td>
        <td>Data / Hora</td>
    </tr>
<?php
if ($result = $conn->query($sql)) {
    while ($row = $result->fetch_assoc()) {
        // Ajuste de timezone para o horário de Brasília (-3 h)
        $data_hora = date("Y-m-d H:i:s", strtotime($row["data_hora"] . " - 3 hours"));
?>
    <tr>
        <td><?= e($row["id"]) ?></td>
        <td><?= e($row["sensor"]) ?></td>
        <td><?= e($row["local_instalado"]) ?></td>
        <td><?= e($row["valor1"]) ?></td>
        <td><?= e($row["valor2"]) ?></td>
        <td><?= e($row["valor3"]) ?></td>
        <td><?= e($data_hora) ?></td>
    </tr>
<?php
    }
    $result->free();
}
$conn->close();
?>
</table>
</body>
</html>
