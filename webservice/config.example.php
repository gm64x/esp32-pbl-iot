<?php
// Configuração do Webservice, lida de variáveis de ambiente.
// No Docker elas vêm do .env via docker-compose.yml (DB_HOST=db).
// Fora do Docker, defina as variáveis ou troque os valores de fallback abaixo.
// Se existir um config.php na mesma pasta, ele tem prioridade (ignorado pelo Git).

// Dados de conexão com o MariaDB
$servername = getenv("DB_HOST") ?: "localhost";
$dbname     = getenv("DB_NAME") ?: "dbesp32mysql";
$username   = getenv("DB_USER") ?: "esp32";
$password   = getenv("DB_PASSWORD") ?: "";

// API Key que o ESP32 deve enviar (igual ao API_KEY_VALUE do secrets.h)
$api_key_value = getenv("API_KEY") ?: "";
