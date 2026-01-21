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


