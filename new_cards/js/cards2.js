// ====================================================
// Fox Devices
// Depende de FoxWire
// ====================================================

class FxdeviceCard {
    constructor( id, addr, opts ){

        this.id = id;

        // Endereço
        this.addr = addr;

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
        this.grafico      = null;
        
        // html etc
        this.render();
    }

    /* =================================================
      Render
    ================================================= */
    async render() {
        
        this.el = document.createElement("div");
        this.el.className = "card";
        this.el.id = `device_${this.id}"`;
        this.el.innerHTML = `
            <div class="card-header">
                <img class="device-img" src="${this.image}" alt="${this.model}">
                
                <div class="device-info">
                    <div class="device-title">
                        ${this.model} [${this.id}]
                    </div>
                    <div class="device-meta">
                        Firmware: V${Math.floor(this.firmwareVersion / 1000)}.${this.firmwareVersion % 1000} |
                        Lote: ${this.lot}
                    </div>
                </div>
            </div>

            <div class="card-body"></div>

            <div class="card-footer">
                
                ${this.graphOptions ? `
                    <!-- Gráfico -->
                    <div class="chart-container">
                        <canvas id="grafico"></canvas>
                        <div class="chart-labels">Leitura em tempo real</div>
                    </div>` : ""
                }
                
                <div class="card-footer-buttons">
                    <button id="btn_read">Read</button>
                    <button id="btn_apply">Apply</button>
                    <button id="btn_save">Save</button>
                    <button id="btn_default">Default</button>
                    <button id="btn_reset">Reset</button>
                </div>

            </div>
        `;

        // Grafico
        this.renderGraph();

        // Parametros
        this.cardBody = this.el.querySelector(".card-body");
        this.renderParam();

        // Botões de baixo
        this.bindButtons();

    }

    renderGraph() {
        this.canvas = this.el.querySelector("#grafico");
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;

        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width  = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        const ctx = this.canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.grafico = new MultiLineGraph(
            this.canvas,
            this.graphOptions || {}
        );
    }

    renderParam(){
        // Parametros
        this.param = {};

        for (const name in this.optParam) {
            if (!this.paramAvailable(name)) continue;

            const p = this.optParam[name];

            // constrói o widget a partir da config
            const wg = new Widget(p.wg);
            if (!wg || !wg.el) continue;

            // estrutura final normalizada
            this.param[name] = {
                addr: p.addr,
                wg: wg
            };

            //this.widgets[name] = wg;
            this.cardBody.appendChild(wg.el);
        }

    }

    bindButtons(){
        this.elFooterButtons = this.el.querySelector(".card-footer-buttons");
        this.elBtnRead    = this.elFooterButtons.querySelector('#btn_read');
        this.elBtnApply   = this.elFooterButtons.querySelector('#btn_apply');
        this.elBtnSave    = this.elFooterButtons.querySelector('#btn_save');
        this.elBtnDefault = this.elFooterButtons.querySelector('#btn_default');
        this.elBtnReset   = this.elFooterButtons.querySelector('#btn_reset');
        
        this.elBtnRead.onclick = async () => { this.read(); };
        this.elBtnApply.onclick = async () => { this.apply(); };
        this.elBtnSave.onclick = async () => { this.save(); };
        this.elBtnDefault.onclick = async () => { this.default(); };
        this.elBtnReset.onclick = async () => { this.reset(); };
        
        // Apply all registers (testes)
        //this.elBtnApply.onclick = async () => { 
        //    for (const p in this.param) {
        //        const wg = this.param[p].wg;
        //        console.log(`wg-${p}.v = ${wg.currentValue} .output =`, wg.output(), );
        //    }
        //};
    }

    /* =================================================
      Actions
    ================================================= */

    // Read
    async read(){
        if( !this.param || !this.fx ) return;
        for( const p in this.param ){
            const addr = this.param[p].addr;
            if( addr ){ // Addr=0 é o endereço do dispositivo
                const wg = this.param[p].wg;
                const ans = await this.fx.register_read( this.addr, addr );
                if( ans.ok ){
                    wg.setSavedValue(ans.value);
                }else{
                    if(ans.log) console.log( ans.value );
                }
            }
        }
    }

    // Apply
    async apply(){
        if( !this.param || !this.fx ) return;
        for( const p in this.param ){
            let addr = this.param[p].addr;
            const wg = this.param[p].wg;
            if( addr == 0 ){ // endereço do dispositivo na rede FoxWire
                const ans = await this.fx.register_write( this.addr, 0, wg.value );
                if( ans.ok ){
                    this.addr = ans.value;
                    wg.setValue( this.addr );
                }
            }else{ // Outros endereços
                const bytes = wg.output();
                fxWriteBytes( addr, bytes );
            }
        }
    }

    // Save
    async save(){
        if( !this.fx ) return;
        await this.apply();
        let ans = await this.fx.save(this.addr); // Comando de save
        if( ans.ok ){
            await delay(20);
            await this.read();
            //console.log( "[BTN-SAVE] return: ", ans );
            this.elBtnSave.classList.add('ok');
        }
    }

    // Reset
    async reset() {
        if( !this.fx ) return;
        await fx.reset(this.addr);
        await delay(20);
        await this.read();
        if( this.grafico ){
            this.grafico.clear();
        }
    }

    // Default
    async default() {
        if( !this.fx ) return;
        //await fx.command_key(this.Addr, this.REG.cmd_write.RESTORE_KEPP_ADDR);
        //await fx.default(this.addr);
        await delay(20);
        await this.read();
    }

    /* =================================================
      Parametros
    ================================================= */
    paramAvailable(p) {
        return true;
    }

    /* =================================================
      Funções Foxwire
    ================================================= */
    async getBasicInfo(){
        const fw = fx.getFirmwareVersion(this.addr);
        const lot = fx.getLot(this.addr);
        if( fw.ok ) this.firmwareVersion = fw.value;
        if( lot.ok ) this.lot = lot.date;
        //this.foxWireVersion
    }
    async fxWriteBytes( addr, bytes ){
        if( !this.fx ) return false;
        for (let i = 0; i < bytes.length; i++) {
            const ans = await fx.register_write(
                this.addr,
                addr + i,
                bytes[i]
            );
            if (!ans.ok) {
                if (ans.log) console.log(ans.value);
                return false;
            }
        }
        return true;
    }
    

}