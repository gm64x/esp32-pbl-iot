// Modelo de credenciais do projeto.
// Copie este arquivo para include/secrets.h (ignorado pelo Git) e preencha os valores reais.
// NUNCA commite o secrets.h com senhas ou chaves verdadeiras.
#pragma once

// Rede Wi-Fi (no Wokwi use "Wokwi-GUEST" sem senha)
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""

// Endereço do Webservice (sem barra no final). Com o Docker, use o IP da máquina na LAN
// e a porta 8081, ex.: "http://192.168.0.10:8081"
#define SERVER_HOST "http://SUBSTITUIR-PELO-IP-OU-DOMINIO-DO-SERVIDOR"

// Chave que o ESP32 envia e o Webservice PHP valida (deve ser igual ao API_KEY do .env)
#define API_KEY_VALUE "SUBSTITUIR-PELA-SUA-API-KEY"
