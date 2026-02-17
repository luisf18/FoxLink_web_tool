import { MultiLineGraph } from "./graph.js"
import { DebugLog } from "./debug.js";

// ====================================================
// Fox Devices
// Depende de FoxWire
// ====================================================

export class FxdeviceCard {
    constructor( id, addr, info, opts, app = null ){
        
        this.id = id;

        this.connected = true;

        this.log = new DebugLog( `CARD-DEV-${addr}`, "#ff7300" );
        
        /*
        app -> variaveis globais
            por hora só usa fx.
            Mas vai precisar verificar 
            a lista de dispositivos em breve. vai?
        */
        this.app = app;
        this.fx = app?.fx ?? null;

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

    async retry_until_ok(f, n=3, delayMs = 20) {
        for (let i = 0; i < n; i++) {
            const ans = await f();
            if( ans.ok ) return true;
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    async _reset() {
        return await this.retry_until_ok( () => { return this.fx.reset(this.addr); } );
    }

    async init() {
        
        // Reset
        if( !(await this._reset()) ){
            this.log.packE( "RESET", false );
            return false;
        }

        this.log.packI( "RESET", true );
        await delay( 20 );

        if (!("fxv" in this.info)) {
            let x;
            this.info.fxv = (
                await this.retry_until_ok(
                    async () => {
                        const ans = await this.fx.getFoxWireVersion( this.addr );
                        x = ans.data;
                        return ans;
                    }
                ) ? 
                x :
                0 
            );
        }

        this.log.i( `fxv = ${this.info.fxv}` );

        /*/
        // Get required informations off device
        const requiredInfo = {
            lot: this.fx.CMD_,
            fwv: 1,
            fwx: 1,
            id: 0,
        };
        for (const field of requiredInfo) {
            if (!(field in this.info)) {
                this.log.i(`${field} não existe, buscar...`);
                this.info[field] = await buscarCampo(field);
            }
        }
        /*/

        this.render();
        await this.read( true );

        return true;
    }

    static async create(id, addr, opts, app) {
        const dev = new Device(id, addr, opts, app);
        await dev.init();
        return dev;
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
        // Parametros
        this.param = {};

        if( this.showAddrWidget ){
            const wg = new Widget({
                name: "Addr", limit: [0,31]
            });
            this.param["addr"] = {
                addr: 0,
                wg: wg
            };
            this.cardBody.appendChild(wg.el);
        }

        for (const name in this.optParam) {
            const p = this.optParam[name];
            let p_name = name;
            //  se o widget de endereço ja estiver
            // ativo descarta outros. Se não adimite ele
            // Mas com o nome "addr" pra garantir que vai funcionar
            if( p.addr == 0 ){
                if( this.showAddrWidget ) continue;
                p_name = "addr";
            }else if( name == 'addr' ){ // impede que exista outro Addr
                p_name = 'addr2';
            }
            // constrói o widget a partir da config
            const wg = new Widget(p.wg);
            wg.change_callback = (r) => { this.updateButtons() };
            if (!wg || !wg.el) continue;
            // estrutura final normalizada
            this.param[p_name] = {
                addr: p.addr,
                wg: wg
            };
            //this.widgets[name] = wg;
            this.cardBody.appendChild(wg.el);
        }

        this.param["addr"]?.wg.setSavedValue( this.addr );

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
        const ans = await this.fx.read(this.addr);
        this.log.packI("read",ans.ok);
        if( ans.ok ){
            this.graph.addValue(0, ans.data);
            this.graph.update();
        }else{
            this.log.packE("read",ans.ok,null,ans.data);
        }
    }

    /* =================================================
      Funções Foxwire
    ================================================= */
    async getBasicInfo(){
        const fw = this.fx.getFirmwareVersion(this.addr);
        const lot = this.fx.getLot(this.addr);
        if( fw.ok ) this.firmwareVersion = fw.value;
        if( lot.ok ) this.lot = lot.date;
        //this.foxWireVersion
    }

    async fxRegWrite( addr, byte, retry = 3 ){
        return await this.retry_until_ok(
            async () => {
                return this.fx.registerWrite( this.addr, addr, byte );
            }, retry
        );
    }

    async fxRegRead( addr, retry = 3 ){
        let value;
        if( !await this.retry_until_ok(
            async () => {
                const ans = this.fx.registerRead( this.addr, addr );
                value = ans.data;
                return ans;
            }, retry
        )) return null;
        return value;
    }

    async fxWriteBytes( addr, bytes ){
        if( !this.fx ) return false;

        if( this.info.fxv >= 2 ){
            if( await this.retry_until_ok(
                async () => {
                    return this.fx.extendedWrite( this.addr, addr, bytes );
                }
            ) ){
                return true;
            }
        }

        // register Write não acessa addr maior que 31
        if( bytes.length + addr >= 32 ) return false;

        for (let i = 0; i < bytes.length; i++) {
            if( ! await fxRegWrite( addr+i,bytes[i] ) )
                return false;
        }
        
        return true;
    }

    /* =================================================
      Actions
    ================================================= */

    // Read
    async read( saved = false ){
        
        if( !this.param || !this.fx ) return;
        
        for( const p in this.param ){
            
            const addr = this.param[p].addr;
            const wg = this.param[p].wg;

            const value = ( 
                addr ? 
                await this.fx.readType(
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
                "apply",
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
                if( await fxRegWrite( 0, wg.currentValue ) ){
                    ok = true;
                    this.addr = wg.currentValue;
                    wg.setAppliedValue( this.addr );
                }
            }else{
                // Outros endereços
                await this.fxWriteBytes( addr, bytes );
            }
            this.log.packI(
                "apply",
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
        let ans = await this.fx.save(this.addr); // Comando de save
        this.log.i( "[BTN-SAVE] return: ", ans );
        if( ans.ok ){
            await delay(20);
            await this.read( true );
        }
        this.updateButtons();
    }

    // Reset
    async reset() {
        if( !this.fx ) return false;
        const ans = await this.fx.reset(this.addr,true);
        await delay(20);
        await this.read( true );
        if( this.graph ){
            this.graph.clear();
        }
    }

    // Default
    async default() {
        if( !this.fx ) return;
        const ans = await this.fx.default(this.addr);
        this.log.i( "[Default] -> ", ans );
        await delay(20);
        await this.read();
    }

    /* =================================================
      Status de conexão
    ================================================= */
    setConnected( connected = true, blink = true ){
        
        this.connected = connected;

        if (connected) {
            this.el.classList.remove("inactive");
            this.el.classList.add("connected");
            //card.querySelector(".label").textContent = "Online";
        } else {
            this.el.classList.remove("connected");
            this.el.classList.add("inactive");
            //card.querySelector(".label").textContent = "Offline";
        }

        if( blink && connected ){
            this.blink();
        }
    }

    async update(){
        if( !this.fx ){
            this.setConnected(false);
            return;
        }
        
        let connected = await this.retry_until_ok(
            () => {
                return this.fx.check(this.addr);
            } 
        );
        
        if( this.connected != connected ){
            this.setConnected(connected);
        }
        
        if(connected){
            await this.graphUpdate();
            //if( !this.param ) return;
            //for( const p in this.param ){
            //    const wg = this.param[p].isSaved;
            //}
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

        this.elBtnApply.classList.toggle('pending', !isApplied);
        this.elBtnSave.classList.toggle('pending', !isSaved);

        this.log.i(
            `[btn-update][ ${
                isApplied ? "applied" : "" } ${
                isSaved ? "saved" : ""
            } ]`
        );

    }

    blink(){
        this.el.classList.remove("blink");
        void this.el.offsetWidth; // reset da animação
        this.el.classList.add("blink");
    }
}