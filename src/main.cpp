// PBL 04: ESP32 lê temperatura e umidade do DHT11 e envia ao Firebase Realtime Database
// a cada 10 segundos, com autenticação anônima.

#include <Arduino.h>
#include <WiFi.h>
#include <DHT.h>
#include <Firebase_ESP_Client.h>

// Auxiliares da biblioteca (token e impressão de resultados RTDB)
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

#include "secrets.h"

// Sensor DHT11 ligado ao pino 4
#define DHTPIN 4
#define DHTTYPE DHT11

// Caminhos no Realtime Database
#define CAMINHO_TEMPERATURA "/test/temperature"
#define CAMINHO_UMIDADE "/test/humidity"

// Intervalo entre leituras e envios (ms)
const unsigned long INTERVALO_ENVIO_MS = 10000;

DHT dht(DHTPIN, DHTTYPE);

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long ultimoEnvio = 0;

// Conecta ao Wi-Fi e aguarda a conexão
void conectarWiFi() {
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi conectado. IP: ");
  Serial.println(WiFi.localIP());
}

// Lê a temperatura em Celsius; retorna NAN em caso de falha
float lerTemperatura() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("Falha ao ler a temperatura do DHT11");
  }
  return t;
}

// Lê a umidade relativa; retorna NAN em caso de falha
float lerUmidade() {
  float h = dht.readHumidity();
  if (isnan(h)) {
    Serial.println("Falha ao ler a umidade do DHT11");
  }
  return h;
}

// Cria uma conta anônima no Firebase (e-mail e senha vazios)
void autenticarAnonimamente() {
  while (!Firebase.signUp(&config, &auth, "", "")) {
    Serial.printf("Erro na autenticação anônima: %s\n", config.signer.signupError.message.c_str());
    Serial.println("Nova tentativa em 5 s...");
    delay(5000);
  }
  Serial.println("Autenticação anônima no Firebase OK");
}

void setup() {
  Serial.begin(115200);

  dht.begin();
  conectarWiFi();

  // Sincroniza o horário, necessário para validar certificados TLS e tokens
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  autenticarAnonimamente();

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // Aguarda o Firebase obter o token antes de enviar
  if (!Firebase.ready()) {
    return;
  }

  if (millis() - ultimoEnvio < INTERVALO_ENVIO_MS) {
    return;
  }
  ultimoEnvio = millis();

  float temperatura = lerTemperatura();
  float umidade = lerUmidade();
  if (isnan(temperatura) || isnan(umidade)) {
    return;  // tenta de novo no próximo ciclo
  }

  Serial.printf("Temperatura: %.1f C | Umidade: %.1f %%\n", temperatura, umidade);

  if (Firebase.RTDB.setFloat(&fbdo, CAMINHO_TEMPERATURA, temperatura)) {
    Serial.printf("Enviado para %s\n", CAMINHO_TEMPERATURA);
  } else {
    Serial.printf("Erro ao enviar temperatura: %s\n", fbdo.errorReason().c_str());
  }

  if (Firebase.RTDB.setFloat(&fbdo, CAMINHO_UMIDADE, umidade)) {
    Serial.printf("Enviado para %s\n", CAMINHO_UMIDADE);
  } else {
    Serial.printf("Erro ao enviar umidade: %s\n", fbdo.errorReason().c_str());
  }
}
