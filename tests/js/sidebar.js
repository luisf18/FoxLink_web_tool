import { resolveDevice } from "./device_resolver.js";

// Variavies globais da aplicação
export let app = {
    devMode: false, // set true to test UI (sem FoxWire)
    connected: false,
    fx: null,
    devices: new Map()
};

// Faz o bind dos botões da side bar
export async function sidebarInit() {
    document.getElementById("brand").addEventListener("click", openRepo);
    document.getElementById("connectBtn").addEventListener("click", toggleConnection);
    document.getElementById("scanBtn").addEventListener("click", scanDevices);
    if (!app.devMode) {
        const { FoxWire } = await import("./foxwire.js");
        app.fx = new FoxWire();
        console.log("FoxWire carregado em modo dev");
    }
}

// Botão de conexão
export async function toggleConnection() {

    let connected = false;

    if( app.devMode ){
        app.connected = !app.connected;
        connected = app.connected;
    }else{
        if(app.fx.isConnected()){
            console.log("DESCONECTANDO...");
            await app.fx.disconnect();
        }else{
            console.log("CONECTANDO...");
            await app.fx.connect();
        }
        connected = app.fx.isConnected();
    }

    const btn = document.getElementById("connectBtn");
    const scanBtn = document.querySelector(".scan-btn");

    if(connected){
        clearDevices();
        btn.classList.add("connected", "just-connected");
        btn.querySelector(".text").textContent = "Connected";
        scanBtn.disabled = false;
        setTimeout(() => {
            btn.classList.remove("just-connected");
        }, 800);
    }else{
        btn.classList.remove("connected", "just-connected");
        btn.querySelector(".text").textContent = "Disconnected";
        scanBtn.disabled = true;
    }
}

function clearDevices(){
    app.devices.clear();
    const cc = document.querySelector('#cards');
    cc.innerHTML = "";
    // Somente pra testes
    if( app.devMode ){
        // Cria e coloca todos os cards como offline
        [0,1].forEach(i => {
            const card = new FxdeviceCard( i, i, resolveDevice(1,0) );
            app.devices.set( i, card );
            card.setConnected( false );
            cc.appendChild( card.el );
        });
        delay(200);
    }
}

// Escaneia a linha buscando dispositivos conectados
export async function scanDevices() {

    const progressWrap = document.getElementById("progressWrap");
    const progressBar  = document.getElementById("progressBar");
    const results      = document.getElementById("scanResults");
    const list         = document.getElementById("scanList");

    clearDevices();

    // 1 - verifica se esta conectado
    if( !app.devMode ){
        if (!app.fx.isConnected()) {
            alert("Conecte primeiro a porta serial.");
            return;
        }
    }

    list.innerHTML = "";
    results.style.display = "none";
    progressWrap.style.display = "block";
    progressBar.style.width = "0%";

    for (let i = 0; i <= 32; i++) {

        let progress = Math.ceil( 100*(i/32) );
        if (progress > 100) progress = 100;
        progressBar.style.width = progress + "%";

        let found = false;
        let id = 0;
        if( app.devMode ){
            await delay(120);
            if( Math.floor(Math.random() * 10) % 2 ){
                found = true;
            }
        }else{
            try {
                let ans = await app.fx.check(i,true); // Aguarda a resposta antes de continuar
                if (ans.ok) {
                    console.log(`ID check:`);
                    ans = await app.fx.getID( i, true );
                    if( ans.ok ){
                        id = ans.value;
                        found = true;
                    }
                }
            }catch (error) {
                console.error(`Erro ao verificar endereço ${i}:`, error);
            }
        }

        if( found ){
            console.log(`Endereço ${i}: arg ${id}`);
            discoverDevice(i,id);
        }

    }
    
    progressWrap.style.display = "none";
}

function discoverDevice(addr,id) {

    console.log(`[discover device] addr ${addr} list:`,app.devices);

    let card = null;
    const card_id = app.devices.size;
    const cardContainer = document.querySelector('#cards');

    if( app.devices.has( addr ) ){
        card = app.devices.get(addr);
    }else{
        card = new FxdeviceCard( card_id, addr, resolveDevice(1,0), app.fx );
        if( !card.el ) return;
        app.devices.set( addr, card );
        cardContainer.appendChild( card.el );
    }

    card.setConnected();

    // Adiciona na Lista ------------------------------
    const results = document.getElementById("scanResults");
    const list    = document.getElementById("scanList");
    const div     = document.createElement("div");

    div.className = "scan-item";
    div.textContent = `Addr ${addr} - ID${id}`;
    div.onclick = () => {
        console.log( "card: ", addr );
        if (!card || !card.el) return;
        card.el.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
        card.blink();
    };
    list.appendChild(div);
    results.style.display = "block";

    div.scrollIntoView({ behavior: "smooth", block: "nearest" });

    card.el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
    });
}

function openRepo() {
    window.open(
        "https://github.com/luisf18/FoxLink_web_tool",
        "_blank"
    );
}