// Modelo de credenciais do projeto.
// Copie este arquivo para include/secrets.h (ignorado pelo Git) e preencha os valores reais.
// NUNCA commite o secrets.h com senhas ou chaves verdadeiras.
#pragma once

// Modo de execução. 0 = placa real (padrão). 1 = simulação (Wokwi/Velxio).
//   0 (real):      device_id derivado do MAC ("esp32-xxxxxx"); sensor DHT11;
//                  local_instalado = SENSOR_LOCAL (em src/main.cpp).
//   1 (simulação): device_id sorteado de uma lista fixa + sufixo hex, guardado na NVS;
//                  sensor DHT22 (a peça wokwi-dht22 do diagram.json só combina com 1);
//                  local_instalado = local sorteado.
#define SIMULATION 0

// Rede Wi-Fi da placa real: troque pela sua rede.
// Simulação (SIMULATION 1): use "Wokwi-GUEST" e senha vazia.
#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA"

// Endereço do Webservice (sem barra no final). Com o Docker, use o IP da máquina na LAN
// e a porta 8081, ex.: "http://192.168.0.10:8081".
// Na simulação na nuvem (Wokwi) o servidor precisa estar acessível por túnel público.
#define SERVER_HOST "http://SUBSTITUIR-PELO-IP-OU-DOMINIO-DO-SERVIDOR"

// Chave que o ESP32 envia e o Webservice PHP valida (deve ser igual ao API_KEY do .env)
#define API_KEY_VALUE "SUBSTITUIR-PELA-SUA-API-KEY"

// Local do dispositivo, gravado em local_instalado (só no modo real, SIMULATION 0)
#define SENSOR_LOCAL "Sala"

// Apelido opcional do dispositivo (só aparece no Serial). Vazio = usa o device_id.
#define DEVICE_NAME ""

// ID fixo do dispositivo (vale nos dois modos e vence o MAC e o sorteio). Vazio = não usar.
// Letras, números, "_" ou "-" (até 40 caracteres), ex.: "esp32-sala".
#define DEVICE_ID_OVERRIDE ""
