// Modelo de credenciais. Copie este arquivo para include/secrets.h e preencha.
// include/secrets.h está no .gitignore e não deve ser commitado.

#pragma once

// Rede Wi-Fi. "Wokwi-GUEST" e senha vazia funcionam apenas no simulador Wokwi.
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""

// API Key de escrita (Write API Key) do canal ThingSpeak.
// Com o servidor local, use a mesma chave definida em LOCAL_API_KEY (arquivo .env).
#define THINGSPEAK_API_KEY "SUA_WRITE_API_KEY_AQUI"

// 0 = envia para o ThingSpeak na nuvem
// 1 = envia para o servidor local em Docker (local-thingspeak/)
#define USE_LOCAL_SERVER 0

// Servidor local: IP da máquina na rede local (não use localhost, o ESP32 não enxerga o PC por ele)
#define LOCAL_SERVER_HOST "192.168.0.100"
#define LOCAL_SERVER_PORT 8082
