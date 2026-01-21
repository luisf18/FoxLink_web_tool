/* ==========================================================
   Conexão
 ==========================================================*/

 async function toggleConnection() {
    if(fx.isConnected()){
        console.log("DESCONECTANDO...");
        await fx.disconnect();
    }else{
        console.log("CONECTANDO...");
        await fx.connect();
    }

    // atualiza o botão de conexão
    const startButton = document.querySelector('.start-btn');
    if( fx.isConnected() ){
        console.log("CONECTADO!!");
        startButton.classList.add('active');
        startButton.textContent = 'conectado';
    }else{
        console.log("DESCONECTADO!!");
        startButton.classList.remove('active');
        startButton.textContent = 'desconectado';
    }
}

// Escaneia a linha buscando dispositivos conectados
async function scan() {

    // 1 - verifica se esta conectado
    if (!fx.isConnected()) {
        alert("Conecte primeiro a porta serial.");
        return;
    }

    // 2 - Ajusta elementos gráficos...
    document.getElementById("result").textContent = "Escaneando...";
    document.getElementById("scannedAddresses").innerHTML = "";
    document.getElementById("progressBar").style.width = "0%";
    document.getElementById("progressContainer").style.display = "block";
    const startButton = document.querySelector('.scan-btn');
    startButton.classList.add('active');
    startButton.textContent = "scanning...";
    
    // 3 - Limpa os cards
    clearCards();

    // 4 - Verifica os endereços um por um
    
    let validAddresses = [];
    await delay(200);
    console.log(`SCANNING`);
    
    for (let i = 0; i <= 32; i++) {
        try {
            const ans = await fx.check(i,true); // Aguarda a resposta antes de continuar
            if (ans.ok) {
                console.log(`ID check:`);
                const ID = await fx.getID( i, true );
                if( ID.ok ){
                    validAddresses.push({ addr: i, ID: ID.value });
                    console.log(`Endereço ${i}: arg ${ID.value}`);
                    // printa na barra lateral o endereço encontrado
                    document.getElementById("scannedAddresses").innerHTML += `Endereço ${i}<br>`; //: arg ${ans.arg}<br>`;
                    //document.getElementById("scannedAddresses").innerHTML += `Endereço ${i} (${ID.value})<br>`; //: arg ${ans.arg}<br>`;
                }
            }
        }catch (error) {
            console.error(`Erro ao verificar endereço ${i}:`, error);
        }
        // Atualiza progress bar
        document.getElementById("progressBar").style.width = `${(i / 32) * 100}%`;
    }

    for (const i of validAddresses) {
        await addCard(i);
    }

    // Finaliza scan
    startButton.classList.remove('active');
    startButton.textContent = "scan";
    document.getElementById("progressBar").style.width = "100%";
    document.getElementById("result").textContent = "ok";

    // Atualização em tempo real dos graficos
    if( Cards.length ){
        cards_interval = setInterval( cards_update, 400 );
    }
}
