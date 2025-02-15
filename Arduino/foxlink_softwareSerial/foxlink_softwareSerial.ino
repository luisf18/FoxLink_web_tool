/*

  FoxLink

  Modos suportados:
  
   - Modo Shell: 
     Esta funcionando com o modo shell.
    Conecte um sensor de cada vez e digite "FOX-SHELL",
    para entrar no modo shell. Digite "help" para 
    listar os comandos disponiveis.
  
  - FoxWire e "Foxlink_Web_tool": 
    Este codigo ainda não tem suposte para este modo.

*/


#include <SoftwareSerial.h>

SoftwareSerial fx(10, 11); // RX, TX

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(20);
  fx.begin(115200);
  fx.setTimeout(20);
}

void loop() {
  if(fx.available()) {
    char x = fx.read();
    Serial.write(x);
  }
  if(Serial.available()) {
    char x = Serial.read();
    Serial.write(x);
    fx.write(x);
  }
}
