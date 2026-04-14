import { resolveDevice } from "./device_resolver.js";
import { FxdeviceCard } from "./device_card.js";
import { DebugLog } from "./debug.js";
import * as utils from "./utils.js";

// Variavies globais da aplicação
export let app = {
    version: "1.1.0",
    devMode: false, // set true to test UI (sem FoxWire)
    connected: false,
    fx: null,
    devices: new Map(),
    cardsInterval: null,
    log: new DebugLog( "WEBTOOL", "#aa00ff" )
};

window.app = app;
window.resolveDevice = resolveDevice;

const cardContainer = document.querySelector('#cards');

/* ========================
    Init WebTool
========================= */

// Faz o bind dos botões da side bar
export async function webtoolInit() {
    document.getElementById("webtool-version").innerHTML = `v${app.version}`;
    document.getElementById("brand").addEventListener("click", openRepo);
    document.getElementById("connectBtn").addEventListener("click", toggleConnection);
    document.getElementById("scanBtn").addEventListener("click", scanDevices);
    if (!app.devMode) {
        const { FoxWire } = await import("./foxwire.js");
        app.fx = new FoxWire();
        app.fx.log.level = "info";
        //console.log("FoxWire carregado em modo dev");
    }
}

export async function cardsUpdate() {
    // Atualização em tempo real os graficos
    for (const [addr, card] of app.devices) {
        await card.update();
        await utils.delay(10);
    }
}

/* ========================
    Conexão
========================= */
export async function toggleConnection() {

    let connected = false;

    if( app.devMode ){
        app.connected = !app.connected;
        connected = app.connected;
    }else{
        if(app.fx.isConnected()){
            app.log.i("DESCONECTANDO...");
            await app.fx.disconnect();
            // precisa encerrar os devices!!
        }else{
            app.log.i("CONECTANDO...");
            await app.fx.connect();
        }
        connected = app.fx.isConnected();
    }

    const btn = document.getElementById("connectBtn");
    const scanBtn = document.querySelector(".scan-btn");

    clearDevices();

    if(connected){
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

/* ========================
    Devices Manage
========================= */

function clearDevices(){
    if( app.cardsInterval )
        clearInterval(app.cardsInterval);
    app.devices.clear();
    cardContainer.innerHTML = "";
    // Somente pra testes
    /*/
    if( app.devMode ){
        // Cria e coloca todos os cards como offline
        [0,1].forEach(i => {
            const card = new FxdeviceCard( i, i, resolveDevice({1,0}) );
            app.devices.set( i, card );
            card.setConnected( false );
            cardContainer.appendChild( card.el );
        });
        utils.delay(200);
    }
    /*/

    // clear list
    const results = document.getElementById("scanResults");
    const list    = document.getElementById("scanList");
    list.innerHTML = "";
    results.style.display = "none";
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

    await app.fx.scan("id fxv version", async ({ addr, found, info }) => {
        let progress = Math.ceil( 100*(addr/32) );
        progressBar.style.width = progress + "%";
        if (found) {
            await addDeviceCard(addr, info);
            await utils.delay( 20 );
        }
    });

    progressWrap.style.display = "none";

    // cria uma task pra atualizar os cards
    if( app.devices.size ){
        if( app.cardsInterval )
            clearInterval(app.cardsInterval);
        app.cardsInterval = setInterval( cardsUpdate, 400 );
    }
}

async function addDeviceCard(addr,info) {
    
    app.log.i(`[addCard][DEV-${addr}] info:`,info);
    
    let card = null;
    const deviceId = info?.id ?? null;
    const card_id = app.devices.size;
    if( app.devices.has( addr ) ){
        card = app.devices.get(addr);
    }else{
        const options = await resolveDevice( info );
        if (options){
            app.log.i(`[addCard][DEV-${addr}] op:`,options);
            card = new FxdeviceCard( card_id, addr, info, options, app );
            await card.init();
            if( !card.el ){
                card = null;
            }
        }
        if( card ){
            app.devices.set( addr, card );
            cardContainer.appendChild( card.el );
            card.renderGraph();
        }
    }

    if(card)
        card.setConnected();

    /* ----------------------------------------
        Adiciona na Lista Lateral de devices
     ---------------------------------------- */
    const results = document.getElementById("scanResults");
    const list    = document.getElementById("scanList");
    const div     = document.createElement("div");

    div.className = "scan-item";
    div.textContent = `Addr ${addr} - ID ${
        deviceId != null
        ? "0x" + deviceId.toString(16)
        : "N/A"
    }`;
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

    /* ----------------------------------------
        Scroll
     ---------------------------------------- */
    // scroll na lista
    div.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // scroll no card
    card?.el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
    });

    app.log.i(`[addCard][DEV-${addr}] END`);
}

function openRepo() {
    window.open(
        "https://github.com/luisf18/FoxLink_web_tool",
        "_blank"
    );
}