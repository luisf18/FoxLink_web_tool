# Todo Versão 1.1.0

- FoxWire.js
    - ✅ extendedWrite
    - ✅ no readType ajuste inteligente se usa readExtend
    - ✅ scan com leitura de meta data
    - ✅ estrutura de retry
    - ⚠️ extendedCommnds **[rever protocolo!!]**
    - 👉 função que pega todos infos de uma vez

- ✅ Devices Resolver
    - ✅ suporte a JSON
    - ✅ Verificação da versão do FoxWire
    - ✅ Informar versão e outros dados
    - rever estrutura dos devices
    - robustez: se o json vem errado o app quebra muitas das vezes. Por enquanto não é um problema, mas quando for suportar input de json vai ser.

- Widgets.js
    - ✅ "title" dos widgets informando o endereço e etc.
        - ⚠️ colocar no device tree input de "title"
        - ⚠️ colocar addr no widget (!isso seria uma mudança de estrutura. avaliando. talvez uma opção sem quebrar compatibilidade com "!addr" e sem "wg:")
    
    - widgets de botão / ações como mover ou escolher cor
    - ✅ Widget de check com maior flexibilidade, inserção por mascara e valor base fixo

- Cards
    - Informar uuid num box talvez
    - ✅ Campos de widgets
    - ✅ Structs de widgets
    - ✅ widget com valor e visibilidade condicional, em função de outros widgets
    - botão de download das configurações. usar json ou bin?

### Protocolo FoxWire V2

- Hardware
    - ✅(quase-revisão final) versão nova de "foxwire_ver" indicando suporte a read/write extended
    - 👉⚠️ Definição dos outros endereços do Extended e retornos
        - ACK, NACK ...
    - 👉 Suporte completo aos ESCs duplos
        - 👉 como diferenciar as variações do esc8p? ideia: no json suporte a "!variante:{...}"


- revisar:
    - ✅ comando extendedWrite
    - 👉⚠️ metadata/infodata
        - qual a melhor forma de iniciar eles no app
        - revisar: struct é mesmo preciso?
    - ✅ sistem de enderções do extendedRead e write
        - ✅ acho q seria melhor o reg ser base 0x00
        - ✅ Solucionado com um modelo de memoria virtual
- fazer:
    - ⚠️ comandos core extended (?)

## Alterações importantes 📝

### JSON: Novas definições 📝

- "!" Em geral, simboliza propriedade do objeto anterior
- "\_\<struct\>\_\<nome\>" simboliza um struct de widgets
- ">" simboliza um campo de widgets