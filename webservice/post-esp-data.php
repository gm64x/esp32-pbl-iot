<?php
// Webservice: recebe os dados do ESP32 por HTTP POST e grava na tabela medicoes (MariaDB).

// Carrega a configuração: config.php (local) ou config.example.php (variáveis de ambiente)
$configFile = file_exists(__DIR__ . "/config.php") ? __DIR__ . "/config.php" : __DIR__ . "/config.example.php";
require $configFile;

// Função auxiliar para tratar dados
function test_input($data) {
    $data = trim($data);        // remove espaços em branco no início e no final
    $data = stripslashes($data); // remove as barras invertidas (\) da string
    return $data;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo "Nenhum dado foi postado com HTTP POST.";
    exit;
}

// Validando a API Key (comparação em tempo constante)
$api_key = test_input($_POST["api_key"] ?? "");
if ($api_key_value === "" || !hash_equals($api_key_value, $api_key)) {
    http_response_code(401);
    echo "API Key fornecida não está compatível.";
    exit;
}

// Capturando e tratando os dados enviados pelo ESP32
$sensor          = test_input($_POST["sensor"] ?? "");
$local_instalado = test_input($_POST["local_instalado"] ?? "");
$valor1          = test_input($_POST["valor1"] ?? "");
$valor2          = test_input($_POST["valor2"] ?? "");
$valor3          = test_input($_POST["valor3"] ?? "");

// Valor vazio ou "NULL" (qualquer caixa) vira SQL NULL de verdade, não o texto 'NULL'
function valor_ou_nulo($valor) {
    $valor = trim($valor);
    return ($valor === "" || strcasecmp($valor, "NULL") === 0) ? null : $valor;
}
$valor1 = valor_ou_nulo($valor1);
$valor2 = valor_ou_nulo($valor2);
$valor3 = valor_ou_nulo($valor3);

// device_id é opcional (firmware antigo não envia): sem ele ou inválido, grava "desconhecido"
$device_id = test_input($_POST["device_id"] ?? "");
if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $device_id)) {
    $device_id = "desconhecido";
}

// Criando a conexão com o MariaDB
mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    error_log("Falha na conexao com o MariaDB: " . $conn->connect_error);
    die("Conexão Falhou.");
}
$conn->set_charset("utf8mb4");

// Inserindo o dado no Banco de Dados com prepared statement
$stmt = $conn->prepare(
    "INSERT INTO medicoes (device_id, sensor, local_instalado, valor1, valor2, valor3, data_hora)
     VALUES (?, ?, ?, ?, ?, ?, NOW())"
);
if ($stmt === false) {
    http_response_code(500);
    error_log("Erro ao preparar INSERT: " . $conn->error);
    $conn->close();
    die("Erro ao gravar os dados.");
}
$stmt->bind_param("ssssss", $device_id, $sensor, $local_instalado, $valor1, $valor2, $valor3);

if ($stmt->execute()) {
    echo "Novo registro foi inserido com sucesso!";
} else {
    http_response_code(500);
    error_log("Erro ao gravar medicao: " . $stmt->error);
    echo "Erro ao gravar os dados.";
}

$stmt->close();
$conn->close();
