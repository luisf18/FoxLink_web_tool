import { MultiLineGraph } from "./graph.js"
import { DebugLog } from "./debug.js";
import { Widget } from "./widgets.js";

// ====================================================
// Fox Devices
// Depende de FoxWire
// ====================================================

export class FxdeviceCard {
    constructor( id, addr, info, opts, app = null ){
        
        this.id = id;

        this.connected = true;        
        
        /*
        app -> variaveis globais
            por hora só usa fx.
            Mas vai precisar verificar 
            a lista de dispositivos em breve. vai?
        */
        this.app = app;
        this.fx = app?.fx ?? null;

        this.devMode = (app == "dev");

        this.log = new DebugLog( `CARD-DEV-${addr}${this.devMode?"-DEV_MODE":""}`, "#ff7300" );

        // Informations
        this.info = info;

        this.fx = app?.fx ?? null;

        // Endereço
        this.addr = addr;

        this.showAddrWidget = opts.showAddrWidget || true;

        // Identificação do modelo/versão
        this.image = opts.image;
        this.model = opts.model;
        this.firmwareVersion = 0;
        this.lot = 0;
        this.REG = opts.REG || {};

        // Parametros
        this.optParam = opts.param || {};

        // Gráfico
        this.graphOptions = opts.graphOptions ?? null;
        this.graph      = null;
    }

    /* =================================================
      Funções dev
    ================================================= */
    async _devApplyDefault( ){
        for( v in this.param ){
            const wg = this.param[v].wg
            wg.setSavedValue( wg.defaultValue );
        }
    }

    /* =================================================
      Funções Foxwire
    ================================================= */

    async delay(ms){
        await new Promise(r => setTimeout(r, ms));
    }

    async _fx_retry_until_ok(f, options = {}, ...a) {
        if (!this.fx) return null;

        const { n = 3, delayMs = 20 } = options;

        const fn = f.bind(this.fx); // bind uma vez

        for (let i = 0; i < n; i++) {
            const ans = await fn(this.addr, ...a);

            if (ans.ok) return ans;

            await this.delay(delayMs);
        }

        return null;
    }

    async _reset() {
        return (await this._fx_retry_until_ok( this.fx?.reset ) !== null);
    }

    /*/
    async getBasicInfo(){
        const fw = this.fx.getFirmwareVersion(this.addr);
        const lot = this.fx.getLot(this.addr);
        if( fw.ok ) this.firmwareVersion = fw.value;
        if( lot.ok ) this.lot = lot.date;
        //this.foxWireVersion
    }
    /*/

    async _getFxv( ){
        const ans = await this._fx_retry_until_ok( this.fx?.getFoxWireVersion )
        return ( ans ? ans.data : 0 );
    }

    async _save(){
        return ( await this._fx_retry_until_ok( this.fx?.save ) != null );
    }

    async _default(){
        return ( await this._fx_retry_until_ok( this.fx?.restore ) != null );
    }

    async _writeReg( addr, byte, opt={} ){
        return ( await this._fx_retry_until_ok( this.fx?.registerWrite, opt, addr, byte ) != null );
    }

    async _readReg( addr, byte, opt={} ){
        return await this._fx_retry_until_ok( this.fx?.registerRead, opt, addr, byte );
    }

    async _writeBytes( addr, bytes, opt={} ){
        
        if( !this.fx ) return false;
        
        if( this.info.fxv >= 2 ){
            console.log( "try extenderWrite: ", bytes );
            return (
                await this._fx_retry_until_ok( this.fx?.extendedWrite, opt, addr, bytes ) != null
            );
        }

        // registerWrite não acessa addr maior que 31
        if( bytes.length + addr >= 32 ) return false;

        for (let i = 0; i < bytes.length; i++) {
            if( ! await this._writeReg( addr+i,bytes[i] ) )
                return false;
        }

        return true;
    }

    /* =================================================
      Buttons Actions
    ================================================= */

    // Read
    async read( saved = false ){
        
        if( !this.param || !this.fx ) return;
        
        for( const p in this.param ){
            
            const addr = this.param[p].addr;
            const wg = this.param[p].wg;

            const value = ( 
                addr ? 
                await this.fx?.readType(
                    this.addr,
                    addr,
                    wg.outputType,
                    wg.outputLen,
                    ( this.info.fxv >= 2 )
                ) :
                this.addr
            );
            
            if (value !== null) {
                ( saved ? 
                    wg.setSavedValue(value) :
                    wg.setAppliedValue(value) 
                );
            }

            this.log.packI(
                "read",
                (value !== null),
                null,
                value,
                `${wg.name} 0x${addr.toString(16)} <${wg.outputType}-${wg.outputLen}> `
            );
        }

        this.updateButtons();
    }

    // Apply
    async apply( readAtEnd = true ){
        if( !this.param || !this.fx ) return;
        for( const p in this.param ){
            let addr = this.param[p].addr;
            const wg = this.param[p].wg;
            const bytes = wg.output();
            let ok = false;
            if( addr == 0 ){
                // se é o mesmo não precisa reescreve
                if( wg.currentValue == this.addr ) continue
                // endereço do dispositivo na rede FoxWire
                // [todo!] precisa verifica se outro dispositivo esta usando o novo endereço!!
                if( await this._writeReg( 0, wg.currentValue ) ){
                    ok = true;
                    this.addr = wg.currentValue;
                    wg.setAppliedValue( this.addr );
                }
            }else{
                // Outros endereços
                ok = await this._writeBytes( addr, bytes );
            }
            this.log.i( "bytes:", bytes );
            this.log.packI(
                "APPLY",
                ok,
                bytes,
                null, 
                `${wg.name} 0x${addr.toString(16)}`
            );
        }
        if(readAtEnd)
            await this.read();
    }

    // Save
    async save(){
        if( !this.fx ) return;
        await this.apply(false);
        this.log.packI( "SAVE", await this._save() );
        await this.delay(20);
        await this.read( true );
        this.updateButtons();
    }

    // Reset
    async reset() {
        if( !this.fx ) return;
        this.log.packI( "RESET", await this._reset() );
        await this.delay(20);
        await this.read( true );
        if( this.graph ){
            this.graph.clear();
        }
    }

    // Default
    async default() {
        if( !this.fx ) return;
        this.log.packI( "DEFAULT", await this._default() );
        await this.delay(1);
        await this.read();
    }

    /* =================================================
      Init
    ================================================= */
    async init() {

        // Modo desenvolvimento
        if( this.devMode ){
            // renderiza no DOM
            this.render();
            return true;
        }
        
        // Reset
        if( !(await this._reset()) ){
            this.log.packE( "RESET", false );
            return false;
        }

        this.log.packI( "RESET", true );
        await this.delay( 20 );

        // Get fox wire version
        if(!("fxv" in this.info)) {
            this.info.fxv = await this._getFxv();
        }
        this.log.i( `fxv=${this.info.fxv}` );

        // renderiza no DOM
        this.render();

        // Le os valores de cada parametro
        await this.read( true );

        return true;
    }

    /* =================================================
      Render
    ================================================= */
    render() {
        
        this.el = document.createElement("div");
        this.el.className = "card";
        this.el.id = `card-${this.id}`;
        this.el.innerHTML = `
            <div class="card-header">
                <img class="card-device-img" src="${this.image}" alt="${this.model}">
                
                <div class="card-device-info">
                    <div class="card-device-title">
                        ${this.model} [${this.id}]
                    </div>
                    <div class="card-device-meta">
                        Firmware v${Math.floor(this.firmwareVersion / 1000)}.${this.firmwareVersion % 1000} |
                        FoxWire v${this.info.fxv} |
                        Lote ${this.lot}
                    </div>
                </div>
            </div>

            <div class="card-body"></div>

            <div class="card-footer">
                
                ${this.graphOptions ? `
                    <!-- Gráfico -->
                    <div class="chart-container">
                        <canvas class="graph-canvas"></canvas>
                        <div class="chart-labels">Leitura em tempo real</div>
                    </div>` : ""
                }
                
                <div class="card-footer-buttons">
                    <button id="btn_read" title="read settings">Read</button>
                    <button id="btn_apply" title="apply settings">Apply</button>
                    <button id="btn_save" title="save settings">Save</button>
                    <button id="btn_default" title="return default settings">Default</button>
                    <button id="btn_reset" title="reset device">Reset</button>
                </div>

            </div>
        `;

        // Grafico
        //this.renderGraph();

        // Parametros
        this.cardBody = this.el.querySelector(".card-body");
        this.renderParams();

        // Botões de baixo
        this.bindButtons();

    }

    renderGraph() {
        this.canvas = this.el.querySelector(".graph-canvas");
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;

        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width  = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        const ctx = this.canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.graph = new MultiLineGraph(
            this.canvas,
            this.graphOptions || {}
        );

        this.log.i( "->", this.canvas );

        this.graph.update();
    }

    renderParams(){
        
        this.param = {};
        
        const addWg = (p, name, isAddr=false) => {
            if( !isAddr ){
                if (p.addr == 0) {
                    if (this.showAddrWidget) return null;
                    name = "addr";
                } else if (name === "addr") {
                    name = "addr2";
                }
            }
            const wg = new Widget(p.wg);
            wg.setNameTitle( `start at 0x${(p.addr).toString(16)}` );
            wg.change_callback = () => this.updateButtons();
            this.param[name] = {
                addr: p.addr,
                wg: wg
            };
            return wg.el;
        };

        this.log.i( "showAddrWidget: ", this.showAddrWidget );

        if (this.showAddrWidget) {
            const el = addWg( {
                    addr: 0,
                    wg:{
                        name: "Addr",
                        limit: [0, 31]
                    }
                },
                "addr",
                true 
            );

            if (el) this.cardBody.appendChild(el);
        }

        for (const name in this.optParam) {

            const p = this.optParam[name];

            // -------- GRUPO DE WIDGETS --------
            if (name.startsWith(">")) {

                const groupInternalName = name.substring(1);
                const groupName = p["!opt"]?.name || p["!name"] || groupInternalName;

                const groupContainer = document.createElement("div");
                groupContainer.className = "widget-group";

                const header = document.createElement("div");
                header.className = "widget-group-header";
                const toggleIcon = document.createElement("div");
                toggleIcon.className = "widget-group-toggle";
                toggleIcon.innerHTML = `
                <svg class="widget-group-arrow" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>`;
                
                const title = document.createElement("span");
                title.textContent = groupName;
                header.appendChild(toggleIcon);
                header.appendChild(title);

                const body = document.createElement("div");
                body.className = "widget-group-body";
                //body.style.display = "none";
                body.className = "widget-group-body";

                header.onclick = () => {
                    const open = body.classList.toggle("wg-open");
                    toggleIcon.classList.toggle("wg-open", open);
                };

                groupContainer.appendChild(header);
                groupContainer.appendChild(body);
                this.cardBody.appendChild(groupContainer);

                // renderiza widgets internos
                for (const innerName in p) {
                    if (innerName.startsWith("!")) continue;
                    const el = addWg(
                        p[innerName],
                        `${groupInternalName}_${innerName}`
                    );
                    body.appendChild(el);
                }

                continue;
            }

            // -------- NORMAL --------
            const el = addWg( p, name );
            if (el) this.cardBody.appendChild(el);
        }

        this.param["addr"]?.wg.setSavedValue(this.addr);
    }

    bindButtons(){
        this.elFooterButtons = this.el.querySelector(".card-footer-buttons");
        this.elBtnRead    = this.elFooterButtons.querySelector('#btn_read');
        this.elBtnApply   = this.elFooterButtons.querySelector('#btn_apply');
        this.elBtnSave    = this.elFooterButtons.querySelector('#btn_save');
        this.elBtnDefault = this.elFooterButtons.querySelector('#btn_default');
        this.elBtnReset   = this.elFooterButtons.querySelector('#btn_reset');
        
        this.elBtnRead.onclick = async () => { await this.read(); };
        this.elBtnApply.onclick = async () => { await this.apply(); };
        this.elBtnSave.onclick = async () => { await this.save(); };
        this.elBtnDefault.onclick = async () => { await this.default(); };
        this.elBtnReset.onclick = async () => { await this.reset(); };
        
        // Apply all registers (testes)
        //this.elBtnApply.onclick = async () => { 
        //    for (const p in this.param) {
        //        const wg = this.param[p].wg;
        //        this.log.i(`wg-${p}.v = ${wg.currentValue} .output =`, wg.output(), );
        //    }
        //};
    }

    async graphUpdate(){
        //this.log.i("|-- ", this.graph);
        if( !this.graph ) return;
        //const ans = await this.fx?.read(this.addr);
        const ans = (
            this.devMode ?
            await this._fx_retry_until_ok( this.fx?.read ) :
            { ok: true, data: 70 }
        );
        this.log.packI("sensor_read",ans.ok);
        if( ans.ok ){
            this.graph.addValue(0, ans.data);
            this.graph.update();
        }else{
            this.log.packE("read",ans.ok,null,ans.data);
        }
    }

    /* =================================================
      Status de conexão
    ================================================= */
    setConnected( connected = true, blink = true ){
        
        this.connected = connected;

        this.el.classList.toggle("card-inactive",!connected);

        /*/
        if (connected) {
            this.el.classList.remove("card-inactive");
            //this.el.classList.add("card-connected");
        } else {
            //this.el.classList.remove("card-connected");
            this.el.classList.add("card-inactive");
        }
        /*/

        if( blink && connected ){
            this.blink();
        }
    }

    async update(){
        if( !this.fx ){
            if(!this.devMode) this.setConnected(false);
            return;
        }
        
        let connected = (await this._fx_retry_until_ok( this.fx?.check ) !== null);
        
        if( this.connected != connected ){
            this.setConnected(connected);
        }
        
        if(connected){
            await this.graphUpdate();
        }
    }

    updateButtons(){
        let isApplied = true;
        let isSaved   = true;
        for( const p in this.param ){
            if( !this.param[p].wg.isApplied ){
                isApplied = false;
            }
            if( !this.param[p].wg.isSaved ){
                isSaved = false;
            }
            //if( !isSaved && !isApplied ) break;
        }
        //this.isApplied = isApplied;
        //this.isSaved = isSaved;

        this.elBtnApply.classList.toggle('card-pending', !isApplied);
        this.elBtnSave.classList.toggle('card-pending', !isSaved);

        this.log.i(
            `[btn-update][ ${
                isApplied ? "applied" : "" } ${
                isSaved ? "saved" : ""
            } ]`
        );

    }

    blink(){
        this.el.classList.remove("card-blink");
        void this.el.offsetWidth; // reset da animação
        this.el.classList.add("card-blink");
    }
}