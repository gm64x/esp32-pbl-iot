// PBL 02 - HTTP GET para o ThingSpeak
//
// O ESP32 conecta na rede Wi-Fi e, a cada 10 segundos, envia uma requisição
// HTTP GET para o ThingSpeak atualizando o field1 com um valor aleatório.
// O código HTTP e a resposta do servidor são impressos no Serial Monitor.
//
// Credenciais (Wi-Fi e API Key) ficam em include/secrets.h, que não vai para
// o Git. Copie include/secrets.example.h para include/secrets.h e preencha.

// Bibliotecas necessárias
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>

// Credenciais: WIFI_SSID, WIFI_PASSWORD e THINGSPEAK_API_KEY
#include "secrets.h"

// URL base de atualização do canal ThingSpeak
const char* THINGSPEAK_UPDATE_URL = "http://api.thingspeak.com/update";

// Timer: intervalo entre as requisições HTTP GET ao ThingSpeak.
// 10 segundos é o limite do plano gratuito. Não diminua este tempo.
const unsigned long TIMER_DELAY_MS = 10000;
unsigned long lastTime = 0;

void conectarWiFi() {
  Serial.print("Conectando à rede Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Conexão Wi-Fi estabelecida com sucesso!");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  // Velocidade do Serial Monitor
  Serial.begin(115200);

  conectarWiFi();

  Serial.println("Aguardando 10 segundos para enviar a primeira leitura...");

  // A semente do gerador aleatório vem de uma leitura analógica do pino 33
  randomSeed(analogRead(33));
}

void loop() {
  if (millis() - lastTime > TIMER_DELAY_MS) {
    if (WiFi.status() == WL_CONNECTED) {
      // Monta a URL: base + API Key + valor do field1
      String serverPath = String(THINGSPEAK_UPDATE_URL) +
                          "?api_key=" + THINGSPEAK_API_KEY +
                          "&field1=" + String(random(40));

      WiFiClient client;
      HTTPClient http;
      http.begin(client, serverPath);

      // Envio da requisição HTTP GET
      int httpResponseCode = http.GET();

      if (httpResponseCode > 0) {
        Serial.print("Código da resposta HTTP: ");
        Serial.println(httpResponseCode);
        Serial.print("Resposta: ");
        Serial.println(http.getString());
      } else {
        Serial.print("Código do erro: ");
        Serial.println(httpResponseCode);
        Serial.println(HTTPClient::errorToString(httpResponseCode));
      }

      // Libera os recursos da conexão
      http.end();
    } else {
      Serial.println("Wi-Fi desconectado. Tentando reconectar...");
      conectarWiFi();
    }
    lastTime = millis();
  }
}
