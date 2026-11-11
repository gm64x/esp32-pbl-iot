// PBL 03 - ESP32 lê temperatura e umidade do DHT11 e envia ao Webservice PHP,
// que grava os dados na tabela medicoes (MariaDB).

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Preferences.h>
#include <esp_system.h>  // esp_random()
#include "secrets.h"

// Valores padrão caso o secrets.h antigo não tenha estes campos
#ifndef DEVICE_NAME
#define DEVICE_NAME ""
#endif
#ifndef DEVICE_ID_OVERRIDE
#define DEVICE_ID_OVERRIDE ""
#endif
#ifndef SENSOR_LOCAL
#define SENSOR_LOCAL "Sala"
#endif
#ifndef SIMULATION
#define SIMULATION 0  // 0 = placa real (padrão); 1 = Wokwi/Velxio
#endif

// Caminho do Webservice no servidor (montado em /esp32mysql pelo docker-compose.yml)
const char* SERVER_PATH = "/esp32mysql/post-esp-data.php";

// Sensor: a placa real usa DHT11; a peça simulada wokwi-dht22 usa o DHT22
#if SIMULATION
#define DHTTYPE DHT22
const char* SENSOR_NOME = "DHT22";
#else
#define DHTTYPE DHT11
const char* SENSOR_NOME = "DHT11";
#endif

// Lista fixa de locais para o modo de simulação (SIMULATION 1)
const char* LOCAIS_SIMULACAO[] = {"sala", "quarto", "cozinha", "garagem", "varanda", "escritorio"};
const int NUM_LOCAIS = 6;

// ID e local do dispositivo (preenchidos no setup)
String DEVICE_ID;
String LOCAL_INSTALADO;

// Intervalo entre envios (ms)
const unsigned long INTERVALO_ENVIO_MS = 10000;

// Definição do pino de conexão do sensor DHT (GPIO 4)
#define DHTPIN 4

// Configuração do sensor: pino e tipo
DHT dht(DHTPIN, DHTTYPE);

// Modo 0: "esp32-" + 6 últimos hex do MAC
String idDoMac() {
  String mac = WiFi.macAddress();  // ex.: "24:6F:28:A1:B2:C3"
  mac.replace(":", "");
  mac.toLowerCase();
  return "esp32-" + mac.substring(mac.length() - 6);
}

// Simulação: sorteia (uma vez) um local da lista + sufixo hex e guarda na NVS.
// Nos boots seguintes reutiliza o que está gravado. ORIGEM_ID recebe "NVS" ou "sorteio".
String ORIGEM_ID = "MAC";

String idSorteado() {
  Preferences prefs;
  prefs.begin("device", false);  // namespace "device"

  int idx = prefs.getUChar("idx", 255);
  String suf = prefs.getString("suf", "");
  bool daNvs = idx < NUM_LOCAIS && suf.length() == 2;

  if (!daNvs) {
    idx = esp_random() % NUM_LOCAIS;
    char buf[3];
    snprintf(buf, sizeof(buf), "%02x", (unsigned int)(esp_random() & 0xFF));
    suf = String(buf);
    prefs.putUChar("idx", (uint8_t)idx);
    prefs.putString("suf", suf);
  }
  prefs.end();

  LOCAL_INSTALADO = String(LOCAIS_SIMULACAO[idx]);
  ORIGEM_ID = daNvs ? "NVS" : "sorteio";
  return "esp32-" + LOCAL_INSTALADO + "-" + suf;
}

// Escolhe o ID: DEVICE_ID_OVERRIDE (se preenchido) > SIMULATION (sorteio/NVS) > MAC
String gerarDeviceId() {
  String fixo = String(DEVICE_ID_OVERRIDE);
  LOCAL_INSTALADO = String(SENSOR_LOCAL);
  if (fixo.length() > 0) {
    ORIGEM_ID = "DEVICE_ID_OVERRIDE";
    return fixo;
  }
  if (SIMULATION == 1) return idSorteado();

  ORIGEM_ID = "MAC";
  return idDoMac();
}

// Mesma regra do Webservice: letras, números, "_" ou "-", de 1 a 40 caracteres
bool idValido(const String& id) {
  if (id.length() < 1 || id.length() > 40) return false;
  for (unsigned int i = 0; i < id.length(); i++) {
    char c = id.charAt(i);
    bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
              (c >= '0' && c <= '9') || c == '_' || c == '-';
    if (!ok) return false;
  }
  return true;
}

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

  // WiFi.mode antes de ler o MAC, para que ele seja válido
  WiFi.mode(WIFI_STA);
  DEVICE_ID = gerarDeviceId();
  String apelido = String(DEVICE_NAME);
  if (apelido.length() == 0) apelido = DEVICE_ID;
  Serial.print("Modo: ");
  Serial.println(SIMULATION == 1 ? "SIMULACAO" : "REAL");
  Serial.print("Sensor: ");
  Serial.println(SENSOR_NOME);
  Serial.print("ID do dispositivo: ");
  Serial.println(DEVICE_ID);
  Serial.print("Origem do ID: ");
  Serial.println(ORIGEM_ID);
  Serial.print("Local: ");
  Serial.println(LOCAL_INSTALADO);
  Serial.print("Apelido: ");
  Serial.println(apelido);
  if (!idValido(DEVICE_ID)) {
    Serial.println("Aviso: DEVICE_ID invalido (use letras, numeros, _ ou -, ate 40 caracteres)");
  }

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
    // (os campos antigos são mantidos; device_id é o campo novo)
    String httpRequestData = "api_key=" + String(API_KEY_VALUE)
                           + "&sensor=" + String(SENSOR_NOME)
                           + "&local_instalado=" + LOCAL_INSTALADO
                           + "&valor1=" + temperatura
                           + "&valor2=" + umidade
                           + "&valor3=NULL"
                           + "&device_id=" + DEVICE_ID;

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
