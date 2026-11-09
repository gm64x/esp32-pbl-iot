// PBL 03 - ESP32 lê temperatura e umidade do DHT11 e envia ao Webservice PHP,
// que grava os dados na tabela MySQL `medicoes`.

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include "secrets.h"

// Caminho do Webservice no servidor (pasta esp32mysql no htdocs do Apache)
const char* SERVER_PATH = "/esp32mysql/post-esp-data.php";

// Identificação do sensor e do local gravados no banco
const char* SENSOR_NOME = "DHT11";
const char* SENSOR_LOCAL = "Sala";

// Intervalo entre envios (ms)
const unsigned long INTERVALO_ENVIO_MS = 10000;

// Definição do pino de conexão do DHT11
#define DHTPIN 4

// Definição do tipo do sensor DHT
#define DHTTYPE DHT11

// Configuração do sensor: pino e tipo
DHT dht(DHTPIN, DHTTYPE);

// Lê a temperatura em Celsius. Retorna "--" em caso de falha.
String readDHTTemperature() {
  // Este sensor é lento: a leitura demora cerca de 2 segundos entre medições.
  float t = dht.readTemperature();  // Celsius (padrão)
  // float t = dht.readTemperature(true);  // Fahrenheit, se necessário

  if (isnan(t)) {
    Serial.println("Falha ao ler a temperatura do DHT11!");
    return "--";
  }
  return String(t);
}

// Lê a umidade relativa em %. Retorna "--" em caso de falha.
String readDHTHumidity() {
  float h = dht.readHumidity();

  if (isnan(h)) {
    Serial.println("Falha ao ler a umidade do DHT11!");
    return "--";
  }
  return String(h);
}

void setup() {
  Serial.begin(115200);

  // Inicializa o sensor DHT
  dht.begin();

  // Conecta na rede Wi-Fi
  Serial.print("Conectando a rede Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Conectado. IP do ESP32: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Lê os sensores uma vez por ciclo
    String temperatura = readDHTTemperature();
    String umidade = readDHTHumidity();

    String serverName = String(SERVER_HOST) + SERVER_PATH;

    // Monta os dados no formato application/x-www-form-urlencoded
    String httpRequestData = "api_key=" + String(API_KEY_VALUE)
                           + "&sensor=" + String(SENSOR_NOME)
                           + "&local_instalado=" + String(SENSOR_LOCAL)
                           + "&valor1=" + temperatura
                           + "&valor2=" + umidade
                           + "&valor3=NULL";

    Serial.print("Enviando: ");
    Serial.println(httpRequestData);

    WiFiClient client;
    HTTPClient http;
    http.begin(client, serverName);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");

    int httpResponseCode = http.POST(httpRequestData);

    if (httpResponseCode > 0) {
      Serial.print("Codigo da resposta HTTP: ");
      Serial.println(httpResponseCode);
      Serial.println(http.getString());
    } else {
      Serial.print("Erro na requisicao HTTP: ");
      Serial.println(http.errorToString(httpResponseCode));
    }

    // Libera os recursos da conexão
    http.end();
  } else {
    Serial.println("Wi-Fi desconectado");
  }

  delay(INTERVALO_ENVIO_MS);
}
