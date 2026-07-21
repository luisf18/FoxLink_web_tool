export class FoxWireWidget {

    constructor(container, options = {}) {
        this.container = container;

        container.classList.add("fx-wg");

        // CSS vars
        if(options.width) container.style.setProperty('--fx-wg-width', options.width);
        if(options.height) container.style.setProperty('--fx-wg-height', options.height);
        if(options.primary) container.style.setProperty('--fx-wg-primary', options.primary);
        if(options.bg) container.style.setProperty('--fx-wg-bg', options.bg);
        if(options.font_size) container.style.setProperty('--fx-wg-font_size', options.font_size);

        this.use_title = options.use_title || false;
        this.uiOnly = options.uiOnly || false;

        this.on_selectDevice = options.on_selectDevice || null;

        console.log("use title?",this.use_title,options.use_title);

        container.innerHTML = this.template();

        this.init();
    }

    template(){
        console.log("use title2?",this.use_title);
        return `

        ${ this.use_title ? `<div class="fx-wg-title">Fox Wire Connection</div>` : `` }
        
        <div class="fx-wg-controls">
            <button class="fx-wg-btn fx-wg-connect" id="connBtn" title="Connect / Disconnect">

                <svg id="iconOff" viewBox="0 0 24 24">
                    <path d="M12 2v10" stroke="white" stroke-width="2"/>
                    <circle cx="12" cy="14" r="8" stroke="white" stroke-width="2" fill="none"/>
                </svg>

                <svg id="iconOn" viewBox="0 0 24 24" style="display:none;">
                    <circle cx="12" cy="12" r="10" fill="white"/>
                    <path d="M8 12l3 3 5-6" stroke="#22c55e" stroke-width="2" fill="none"/>
                </svg>

            </button>

            <button class="fx-wg-btn fx-wg-scan" id="scanBtn" title="Scan devices">
                <div class="radar-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                        <path d="M12 12 L19 9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            </button>

            <div class="fx-wg-select-slot">

                <div class="fx-wg-progress-box" id="progressBox">
                    <div class="fx-wg-progress-bar" id="progressBar"></div>
                </div>

                <div class="fx-wg-select-box" id="selectBox">
                    <div class="fx-wg-select-selected" id="selected">—</div>
                    <div class="fx-wg-select-items" id="selectItems"></div>
                </div>

                <div class="fx-wg-device-count" id="deviceCount" style="display:none;">0</div>
            </div>
        </div>`;
    }

    async init(){

        if(!this.uiOnly){
            const { FoxWire } = await import("./foxwire.js");
            this.fx = new FoxWire();
            this.fx.log.level = "info";
        }

        const el = (q) => this.container.querySelector(q);

        this.connected = false;
        this.devices = new Set();

        const connBtn = el("#connBtn");
        const scanBtn = el("#scanBtn");

        const iconOn  = el("#iconOn");
        const iconOff = el("#iconOff");

        const progressBox = el("#progressBox");
        const progressBar = el("#progressBar");

        const selectBox = el("#selectBox");
        const selected  = el("#selected");
        const items     = el("#selectItems");

        const countEl   = el("#deviceCount");

        const setCount = (n) => {
            countEl.style.display = n > 0 ? "block" : "none";
            countEl.innerText = n;
        };

        const resetDevices = async () => {
            setCount(0);
            selected.innerText = "—";
            this.addr = -1;
            if( this.on_selectDevice ){
                await this.on_selectDevice(this.addr);
            }
        };

        connBtn.onclick = async () => {

            if(this.uiOnly){
                this.connected = !this.connected;
            }else{
                if(this.fx.isConnected()){
                    this.fx.log.i("DESCONECTANDO...");
                    await this.fx.disconnect();
                }else{
                    this.fx.log.i("CONECTANDO...");
                    await this.fx.connect();
                }
                this.connected = this.fx.isConnected();
            }

            connBtn.classList.toggle("on", this.connected );

            iconOn.style.display  = this.connected ? "block" : "none";
            iconOff.style.display = this.connected ? "none" : "block";

            resetDevices();
        };

        selected.onclick = () => {
            items.style.display =
                items.style.display === "block" ? "none" : "block";
        };

        document.addEventListener("click", e => {
            if(!e.target.closest(".fx-wg-select-box")){
                items.style.display = "none";
            }
        });

        // SCAN
        scanBtn.onclick = async () => {
            if(!this.connected){
                alert("Conecte primeiro");
                return;
            }
            resetDevices();
            scanBtn.classList.add("scanning");
            progressBox.style.display = "block";
            selectBox.style.visibility = "hidden";
            progressBar.style.width = "0%";
            const scanLoop = async ({ addr, found, info }) => {
                let progress = Math.ceil( 100*(addr/32) );
                progressBar.style.width = progress + "%";
                if (found) {
                    this.devices.add(addr);
                    setCount( this.devices.size );
                    //await addDeviceCard(addr, info);
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            };
            if( this.uiOnly ){
                for( let i=0;i<32;i++){
                    const found = (Math.random() > 0.7);
                    await scanLoop({
                        addr: i,
                        found: found,
                        info: {}
                    });
                    await new Promise(resolve => setTimeout(resolve, 8));
                }
            }else{
                await this.fx.scan( "id fxv version", scanLoop );
            }
            progressBox.style.display = "none";
            selectBox.style.visibility = "visible";
            await showDevices(this.devices.size);
            scanBtn.classList.remove("scanning");
        };

        const showDevices = async () => {

            items.innerHTML = "";

            if(this.devices.size === 0){
                selected.innerText = "—";
                return;
            }

            selected.innerText = "Selecionar";

            for (const addr of this.devices) {

                const opt = document.createElement("div");
                opt.innerText = "Device " + addr;

                opt.onclick = async () => {
                    items.querySelectorAll("div")
                        .forEach(el => el.classList.remove("active"));
                    opt.classList.add("active");
                    selected.innerText = opt.innerText;
                    items.style.display = "none";
                    if( this.addr != addr ){
                        console.log("opt:", this.addr, addr);
                        this.addr = addr;
                        if( this.on_selectDevice ){
                            await this.on_selectDevice(this.addr);
                        }
                    }
                };
                items.appendChild(opt);
            }
        };
    }
}