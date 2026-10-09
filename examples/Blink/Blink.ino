// SPDX-License-Identifier: GPL-3.0-only
// EduBoard IDE classroom Blink example for ESP32 development boards.
// Many ESP32 boards use GPIO 2 as an LED; some do not.
// Change LED_PIN to the correct onboard/external LED pin.

const int LED_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
