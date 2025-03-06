// Fox Dynamics Team
// FoxLink bitwise ASM V0.2

#include <avr/io.h>

int main() {
  // Configura PD0 como entrada com pull-up
  DDRD &= ~(1 << PD0);  // PD0 como entrada
  PORTD |= (1 << PD0);   // Habilita o pull-up em PD0

  // Configura PD1 como saída
  DDRD |= (1 << PD1);    // PD1 como saída
  while (1) {
      // Copia o estado de PD0 para PD1 o mais rápido possível
      asm volatile (
          "in r0, %[pin]" "\n\t"    // Lê o estado do PIND (estado dos pinos de entrada)
          "bst r0, 0" "\n\t"         // Copia o bit 0 (PD0) para o T-flag
          "bld r0, 1" "\n\t"         // Copia o T-flag para o bit 1 (PD1)
          "out %[port], r0" "\n\t"   // Escreve de volta no PORTD
          :
          : [pin] "I" (_SFR_IO_ADDR(PIND)),
            [port] "I" (_SFR_IO_ADDR(PORTD))
          : "r0"
      );
  }
}
