# Mudanças nas versões

## Versão 0.4.2
- novo tipo de grafico com escala automatica. possibilidade de mais de uma leitura em tempo real.

## Versão 0.4.1
- Adição do dispositivo "IrKey".
- (Interno) Nova classe mais flexivel para criar novos dispositivos.

## Versão 1.0.1 e .0
- Melhorias significativas de UI/UX
- Device são criados via DeviceTree (equivalente a JSON)
- Adição do Serial Monitor
- Adição do Arduino Uploader
- Adição do Binary Viewer
- Adição do Device Resolver

## Versão 1.1.0
- Alterações na estrutura interna do FoxWire.js para dar mais robustes ao modulo
- FoxWire.js:
    - suporte a extendedRead e Write
    - console log melhorado e colorido
    - retorno {ok,data} antes era {ok,value}
    - request substitui funções como send e sendAndReceive
    - _read e _write com reader e writers temporarios
    - suporte fila queue pra executar comandos de request
- Device são criados via JSON
