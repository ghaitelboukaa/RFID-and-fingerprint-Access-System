#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const char* ssid = "Redmi A3x";
const char* password = "00000000";
String IP_FLASK = "10.241.153.77";

const String serverUrl = "http://"+ IP_FLASK +":5000/api/verifier-carte"; 

#define SS_PIN 5
#define RST_PIN 22
#define LED_ZARQA 25
#define LED_7AMRA 26
#define BUZZER_PIN 13 // PIN pour le Module Capteur de Son/Buzzer

// --- I3dadat dyal sswt (PWM ESP32) ---
#define PWM_CANAL 2       // 👈 HADA HOWA L'7EL! BDELNAHA MN 0 L 2 BACH YB3ED MN L'MOTEUR
#define PWM_RESOLUTION 8  // 8 bits (0-255)

MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo moteurLbab;

HardwareSerial mySerial(2); 
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

LiquidCrystal_I2C lcd(0x27, 16, 2);

String modeActuel = "NORMAL";
unsigned long tempsPrecedent = 0;

byte lockChar[] = {0x0E,0x11,0x11,0x1F,0x1B,0x1B,0x1F,0x00};
byte unlockChar[] = {0x0E,0x01,0x01,0x1F,0x1B,0x1B,0x1F,0x00};

void sonBuzzer(int frequence, int duree) {
  // Configurer l'canal m3a l'fréquence jdida
  ledcSetup(PWM_CANAL, frequence, PWM_RESOLUTION);
  // Rbet l'Pin 13 b l'canal
  ledcAttachPin(BUZZER_PIN, PWM_CANAL);
  // Tlq sda3 (Mstawa 128 = Nos l'jahd max d 255)
  ledcWrite(PWM_CANAL, 128); 
  delay(duree);
  // Ssket sda3 (Mstawa 0)
  ledcWrite(PWM_CANAL, 0);
  // Fek l'Pin
  ledcDetachPin(BUZZER_PIN);
}

void beepSuccess() {
sonBuzzer(2500, 200); // Sswt r9i9 w 9ssir (200ms)
}

void beepError() {
for(int i=0; i<3; i++) {
    sonBuzzer(500, 200); // Sswt ghlid
    delay(100);
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(LED_ZARQA, OUTPUT);
  pinMode(LED_7AMRA, OUTPUT);
  digitalWrite(LED_ZARQA, LOW);
  digitalWrite(LED_7AMRA, LOW);

  Wire.begin(21, 27);
  lcd.init();
  lcd.backlight();
  lcd.createChar(0, lockChar);
  lcd.createChar(1, unlockChar);
  
  lcd.setCursor(0, 0);
  lcd.print("Demarrage...");

  SPI.begin(); mfrc522.PCD_Init();
  moteurLbab.setPeriodHertz(50); moteurLbab.attach(4, 500, 2400); moteurLbab.write(0);
  
  mySerial.begin(57600, SERIAL_8N1, 16, 17);
  finger.begin(57600);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  Serial.println("\n✅ Wi-Fi OK! Mode Normal.");

  afficherMenuPrincipal();
}

void afficherMenuPrincipal() {
  lcd.init();
  lcd.setCursor(0, 0); lcd.write(0); lcd.print(" Systeme Pret "); lcd.write(0);
  lcd.setCursor(0, 1); lcd.print("Scanner Carte/DP");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://"+ IP_FLASK +":5000/api/mode");
    int httpCode = http.GET();
    
    if (httpCode > 0) {
      String payload = http.getString();
      
      String nouveauMode = "NORMAL";
      if (payload.indexOf("ENROLL_CARTE") >= 0) {
          nouveauMode = "ENROLL_CARTE";
      }
      else if (payload.indexOf("ENROLL_BASMA") >= 0) {
          nouveauMode = "ENROLL_BASMA";
      }
      else if (payload.indexOf("DELETE_BASMA") >= 0) nouveauMode = "DELETE_BASMA";

      if (nouveauMode != modeActuel) {
        modeActuel = nouveauMode; 
        
        if (modeActuel == "ENROLL_CARTE") {
          lcd.init();
          lcd.setCursor(0, 0); lcd.print("Mode Inscript.:");
          lcd.setCursor(0, 1); lcd.print("Scanner Carte...");
          Serial.println("🔄 MODE INSCRIPTION: 💳 Scanner Carte...");
        } 
        else if (modeActuel == "ENROLL_BASMA") {
          lcd.init();
          lcd.setCursor(0, 0); lcd.print("Mode Inscript.:");
          lcd.setCursor(0, 1); lcd.print("Placer Doigt...");
          Serial.println("🔄 MODE INSCRIPTION: 👆 Placer Doigt...");
        } 
        else {
          afficherMenuPrincipal();
          Serial.println("✅ MODE NORMAL");
        }
      }

      if (modeActuel == "ENROLL_CARTE") {
        if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
          String idCarte = "";
          for (byte i = 0; i < mfrc522.uid.size; i++) {
            idCarte += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
            idCarte += String(mfrc522.uid.uidByte[i], HEX);
          }
          idCarte.toUpperCase();
          Serial.println("👉 Carte: " + idCarte);
          envoyerNouvelID("CARTE", idCarte);
          delay(1500);
        }
      } 
      else if (modeActuel == "ENROLL_BASMA") {
        if (finger.getImage() == FINGERPRINT_OK) {
          int nouvelID = getFreeID(); 
          if (nouvelID != -1) {
             if (continuerEnrollment(nouvelID)) {
               envoyerNouvelID("BASMA", "FINGER_" + String(nouvelID));
             }
          } else {
             Serial.println("❌ Memoire Pleine!");
          }
        }
      } 
      else if (modeActuel == "DELETE_BASMA") {
         int index = payload.indexOf("\"id_a_supprimer\"");
         if (index > 0) {
            int start = payload.indexOf("\"", index + 17) + 1;
            int end = payload.indexOf("\"", start);
            String idStr = payload.substring(start, end);
            int idSup = idStr.toInt();
            
            if (idSup > 0) {
               finger.deleteModel(idSup);
            }
         }
         HTTPClient httpReset;
         httpReset.begin("http://"+ IP_FLASK +":5000/api/mode");
         httpReset.addHeader("Content-Type", "application/json");
         httpReset.POST("{\"mode\": \"NORMAL\"}");
         httpReset.end();
      }
      else {
         int fingerStatus = checkFingerprint();
         if (fingerStatus > 0) { 
            verifierDansFlask("FINGER_" + String(fingerStatus)); 
            delay(1500); 
         } 
         else if (fingerStatus == -2) {
            verifierDansFlask("BASMA_INCONNU"); 
            delay(1500);
         }
         
         if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
            String idCarte = "";
            for (byte i = 0; i < mfrc522.uid.size; i++) {
              idCarte += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
              idCarte += String(mfrc522.uid.uidByte[i], HEX);
            }
            idCarte.toUpperCase();
            verifierDansFlask(idCarte);
            delay(1500);
         }
      }
    }
    http.end();
  }
  delay(500);
}

bool continuerEnrollment(int id) {
  if (finger.image2Tz(1) != FINGERPRINT_OK) return false;
  lcd.init();
  lcd.clear(); lcd.print("Retirer Doigt...");
  delay(2000);
  int p = 0; while (p != FINGERPRINT_NOFINGER) { p = finger.getImage(); }
  lcd.init();
  lcd.clear(); lcd.print("Replacer Doigt..");
  p = -1; while (p != FINGERPRINT_OK) { p = finger.getImage(); delay(100); }
  if (finger.image2Tz(2) != FINGERPRINT_OK) return false;
  if (finger.createModel() != FINGERPRINT_OK) return false;
  if (finger.storeModel(id) == FINGERPRINT_OK) {
    lcd.init();
     lcd.clear(); lcd.print("Empreinte OK!");
     delay(1000);
     return true;
  }
  return false;
}

void envoyerNouvelID(String type, String valeur) {
  HTTPClient http;
  http.begin("http://"+ IP_FLASK +":5000/api/nouvel-id");
  http.addHeader("Content-Type", "application/json");
  String json = "{\"type\": \"" + type + "\", \"valeur\": \"" + valeur + "\"}";
  http.POST(json);
  http.end();
  lcd.init();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("ID Envoyee!");
  delay(1000);
}

int getFreeID() {
  for (int i = 1; i <= 127; i++) {
    if (finger.loadModel(i) != FINGERPRINT_OK) {
      return i; 
    }
  }
  return -1; 
}

void verifierDansFlask(String idSift) {
  lcd.init();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Verification...");
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  int responseCode = http.POST("{\"id_carte\": \"" + idSift + "\"}");
  
  if (responseCode > 0) {
    String resp = http.getString();
    
    if (resp == "OK") {
      digitalWrite(LED_ZARQA, HIGH);
      beepSuccess();
      lcd.init();
      lcd.clear();
      lcd.setCursor(0, 0); lcd.write(1); lcd.print(" Acces Autorise");
      lcd.setCursor(0, 1); lcd.print(" Bienvenue :)");
      moteurLbab.write(90); delay(3000); moteurLbab.write(0);
      digitalWrite(LED_ZARQA, LOW); 
      
    } else if (resp == "HORS_HORAIRE") {
      digitalWrite(LED_7AMRA, HIGH);
      beepError();
      lcd.init();
      lcd.clear();
      lcd.setCursor(0, 0); lcd.write(0); lcd.print(" Acces Refuse!");
      lcd.setCursor(0, 1); lcd.print(" Hors Horaire.");
      delay(3000);
      digitalWrite(LED_7AMRA, LOW); 
      
    } else {
      digitalWrite(LED_7AMRA, HIGH);
      beepError();
      lcd.init();
      lcd.clear();
      lcd.setCursor(0, 0); lcd.write(0); lcd.print(" Acces Refuse!");
      lcd.setCursor(0, 1); lcd.print(" ID Inconnu");
      delay(3000);
      digitalWrite(LED_7AMRA, LOW); 
    }
  }
  http.end();
  afficherMenuPrincipal();
}

int checkFingerprint() {
int8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return 0; 

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1; 

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_NOTFOUND) return -2; 
  if (p != FINGERPRINT_OK) return -1; 
  return finger.fingerID; 
}