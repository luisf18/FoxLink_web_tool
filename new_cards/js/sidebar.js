/* sidebar. e funções que controlam conexão. */

// Variavies globais da aplicação
let app = {
    connected: false,
    devices: {},
    //sidebar:{
    //    progressWrap: document.getElementById("progressWrap"),
    //    progressBar:  document.getElementById("progressBar"),
    //    results:      document.getElementById("scanResults"),
    //    list:         document.getElementById("scanList"),
    //},
    
    // para testes!
    scanTimer: null,
    foundAddrs: new Set(),
    addrToCardId: {
        1: "card-1",
        3: "card-2",
    }
};

/* ==========================================================
   Conexão
 ==========================================================*/
 function toggleConnection() {
    const btn = document.getElementById("connectBtn");
    const scanBtn = document.querySelector(".scan-btn");

    app.connected = !app.connected;

    if (app.connected) {
        btn.classList.add("connected", "just-connected");
        btn.querySelector(".text").textContent = "Connected";
        scanBtn.disabled = false;

        setTimeout(() => {
            btn.classList.remove("just-connected");
        }, 800);

    } else {
        btn.classList.remove("connected", "just-connected");
        btn.querySelector(".text").textContent = "Disconnected";
        scanBtn.disabled = true;
    }
}


/* ==========================================================
   Scanner de dispositivos
 ==========================================================*/
 function scanDevices() {
    const progressWrap = document.getElementById("progressWrap");
    const progressBar  = document.getElementById("progressBar");
    const results      = document.getElementById("scanResults");
    const list         = document.getElementById("scanList");

    if (app.scanTimer) clearInterval(app.scanTimer);
    app.foundAddrs.clear();

    // 🔒 coloca todos os cards como offline
    Object.values(app.addrToCardId).forEach(id => {
        setCardConnected(id, false);
    });

    list.innerHTML = "";
    results.style.display = "none";
    progressWrap.style.display = "block";
    progressBar.style.width = "0%";

    let progress = 0;

    app.scanTimer = setInterval(() => {
        progress += Math.random() * 6 + 2;
        if (progress > 100) progress = 100;

        progressBar.style.width = progress + "%";

        if (Math.random() < 0.35) {
            discoverDevice();
        }

        if (progress >= 100) {
            clearInterval(app.scanTimer);
            progressWrap.style.display = "none";
        }
    }, 180);
}

function discoverDevice() {
    if (app.foundAddrs.size >= 16) return;

    let addr;
    do {
        addr = Math.floor(Math.random() * 16);
    } while (app.foundAddrs.has(addr));

    app.foundAddrs.add(addr);

    const results = document.getElementById("scanResults");
    const list    = document.getElementById("scanList");

    const div = document.createElement("div");
    div.className = "scan-item";
    div.textContent = `Addr ${addr}`;

    div.onclick = () => {
        const card = document.querySelector(`.card[data-addr="${addr}"]`);
        if (!card) return;

        card.classList.remove("blink");
        void card.offsetWidth;
        card.classList.add("blink");
    };

    list.appendChild(div);
    results.style.display = "block";

    // 🔥 ATIVA CARD SE EXISTIR
    const cardId = app.addrToCardId[addr];
    if (cardId) {
        setCardConnected(cardId, true);
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.remove("blink");
            void card.offsetWidth; // reset da animação
            card.classList.add("blink");
        }
    }

    div.scrollIntoView({ behavior: "smooth", block: "nearest" });
}


function addScanResult(addr) {
    const results = document.getElementById("scanResults");
    const list    = document.getElementById("scanList");

    results.style.display = "block";

    const item = document.createElement("div");
    item.className = "scan-item";
    item.textContent = `Addr ${addr} – FX-S50`;

    item.onclick = () => {
        const cardId = addrToCardId[addr];
        if (!cardId) return;

        const card = document.getElementById(cardId);
        card.classList.add("blink");
        setTimeout(() => card.classList.remove("blink"), 1200);
    };

    list.appendChild(item);
}

function setCardConnected(cardId, connected) {
    console.log(`card: ${cardId}`)
    const card = document.getElementById(cardId);
    if( card ){
        if (connected) {
            card.classList.remove("inactive");
            card.classList.add("connected");
            //card.querySelector(".label").textContent = "Online";
        } else {
            card.classList.remove("connected");
            card.classList.add("inactive");
            //card.querySelector(".label").textContent = "Offline";
        }
    }
}

function openRepo() {
    window.open(
        "https://github.com/luisf18/FoxLink_web_tool",
        "_blank"
    );
}


function blinkCard(addr) {
    const card = document.querySelector(`.card[data-addr="${addr}"]`);
    if (!card) return;

    card.classList.remove("blink");
    void card.offsetWidth; // força reset
    card.classList.add("blink");
}