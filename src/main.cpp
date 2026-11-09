// PBL 01 - Requisição HTTP GET para a API OpenWeatherMap (clima atual)
//
// O ESP32 conecta ao Wi-Fi, consulta a API a cada 10 segundos, faz o parse
// do JSON retornado e imprime temperatura, pressão, umidade e vento no Serial.

// Bibliotecas Necessárias
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Arduino_JSON.h>

// Credenciais (WIFI_SSID, WIFI_PASSWORD, OWM_API_KEY, OWM_CITY, OWM_COUNTRY).
// O arquivo include/secrets.h NÃO vai para o git: copie include/secrets.example.h.
#include "secrets.h"

// Endpoint de clima atual do OpenWeatherMap
const char* SERVER_URL = "https://api.openweathermap.org/data/2.5/weather";

// Timer: intervalo entre requisições HTTP GET - 10 segundos.
// Não diminuir o tempo: o plano gratuito tem limite de chamadas.
const unsigned long TIMER_DELAY = 10000;
unsigned long lastTime = 0;

// Método para realização da Requisição HTTP GET
String httpGETRequest(const char* url) {
  // Cliente TLS (a API é acessada por HTTPS).
  // setInsecure() não valida o certificado do servidor; é aceitável para
  // exemplo de aula, mas em produção use client.setCACert(...).
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  // Definindo a URL completa (domínio + caminho + parâmetros)
  http.begin(client, url);

  // Envio da Requisição HTTP GET
  int httpResponseCode = http.GET();

  String payload = "{}";

  if (httpResponseCode > 0) {
    Serial.printf("Código da resposta HTTP: %d\n", httpResponseCode);
    payload = http.getString();
  } else {
    Serial.printf("Erro na requisição: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  // Liberando recursos
  http.end();

  return payload;
}

void setup() {
  // Definindo a baud rate
  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando à rede Wi-Fi: ");
  Serial.println(WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Conexão Wi-Fi estabelecida com sucesso!");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());

  Serial.println("Aguarde 10 segundos para a primeira leitura...");
}

void loop() {
  if (millis() - lastTime < TIMER_DELAY) {
    return;
  }
  // Marca o instante antes da requisição: assim, mesmo em caso de erro,
  // a próxima tentativa só ocorre após o intervalo (evita flood na API).
  lastTime = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi desconectado...");
    return;
  }

  // Montando a URL: ?q=cidade,país&units=metric&appid=chave
  // units=metric retorna temperatura em °C, vento em m/s
  String serverPath = String(SERVER_URL) + "?q=" + OWM_CITY + "," + OWM_COUNTRY +
                      "&units=metric&appid=" + OWM_API_KEY;

  // Realizando a requisição HTTP GET
  String jsonBuffer = httpGETRequest(serverPath.c_str());

  // Decodificando o retorno do objeto JSON
  JSONVar myObject = JSON.parse(jsonBuffer);

  if (JSON.typeof(myObject) == "undefined") {
    Serial.println("Falha ao interpretar o JSON recebido.");
    return;
  }

  // Em caso de erro (ex.: chave inválida), a API retorna {"cod":401,"message":"..."}
  if (!myObject.hasOwnProperty("main")) {
    Serial.print("A API retornou um erro: ");
    Serial.println(myObject["message"]);
    return;
  }

  Serial.printf("Temperatura: %.1f °C\n", (double)myObject["main"]["temp"]);
  Serial.printf("Pressão: %d hPa\n", (int)myObject["main"]["pressure"]);
  Serial.printf("Umidade: %d %%\n", (int)myObject["main"]["humidity"]);
  Serial.printf("Velocidade do vento: %.1f m/s\n", (double)myObject["wind"]["speed"]);
  Serial.println();
}
