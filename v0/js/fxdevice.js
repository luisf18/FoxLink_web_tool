// ====================================================
// Fox Devices
// ====================================================
class FxDevice extends devices_card {
    constructor(addr, options) {
        super(addr);

        this.id = Cards.length; // ??
        this.Addr = addr;

        this.name = options.name;
        this.model = options.model;
        this.image = options.image;
        this.REG = options.REG;

        this.parameters = options.parameters(this);

        // variaveis do dispositivo
        this.card = null;
        this.firmwareVersion = 0;
        this.lot = 0;

        // Gráfico
        this.graphOptions = options.graphOptions ?? null;
        this.grafico      = null;

        if( this.parameters.addr ){
            /* callback de conflito de endereço */
            this.parameters.addr.wg.currentValue = this.Addr;
            this.parameters.addr.wg.trim_callback = (self) => {
                for (const card of Cards) {
                    if (card.id !== this.id && self.value() === card.Addr) {
                        console.log("ERRO: endereço já utilizado!");
                        self.input.value = this.Addr;
                    }
                }
            };
        }
    }

    param_available(p) {
        return true;
    }

    async get_firmware_version() {
        const lot = await fx.getLot(this.Addr, true);
        const fw1 = await fx.command(this.Addr, FX_BASE.cmd.FIRMWARE_ID);
        const fw2 = await fx.command(this.Addr, FX_BASE.cmd.FIRMWARE_VERSION);

        if (fw1.ok && fw2.ok) {
            this.firmwareVersion = fw1.value * 1000 + fw2.value;
        }

        if (lot.ok) this.lot = lot.date;
    }

    async html() {
        const card = document.createElement("div");
        this.card = card;
        card.className = "user-card";

        card.id = `device_${this.id}"`;

        card.innerHTML = `
            <div class="user-header">
                <img src="${this.image}">
                <div>
                    <div class="device-title">${this.model} [${this.id}]</div>
                    <div class="device-info">
                        Modelo: ${this.model} |
                        Lote: ${this.lot} |
                        V${Math.floor(this.firmwareVersion / 1000)}.${this.firmwareVersion % 1000}
                    </div>
                </div>
            </div>

            <div class="user-info"></div>

            ${this.graphOptions ? `
            <!-- Gráfico -->
            <div class="chart-container">
                <canvas id="grafico"></canvas>
                <div class="chart-labels">Leitura em tempo real</div>
            </div>` : ""}

            <div class="action-buttons">
                <button id="btn_read">Read</button>
                <button id="btn_apply">Apply</button>
                <button id="btn_save">Save</button>
                <button id="btn_default">Default</button>
                <button id="btn_reset">Reset</button>
            </div>
        `;

        cards_container.appendChild(card);

        const info = card.querySelector(".user-info");
        for (const p in this.parameters) {
            if (this.param_available(p)) {
                info.appendChild(this.parameters[p].wg.html());
            }
        }

        this.bind_buttons();

        this.graph_init();
    }

    bind_buttons() {
        this.card.querySelector("#btn_read")?.addEventListener("click", () => this.read());
        this.card.querySelector("#btn_apply")?.addEventListener("click", () => this.apply());
        this.card.querySelector("#btn_save")?.addEventListener("click", () => this.save());
        this.card.querySelector("#btn_default")?.addEventListener("click", () => this.default());
        this.card.querySelector("#btn_reset")?.addEventListener("click", () => this.reset());
    }

    // ============================================================
    // Gráfico
    // ============================================================
    graph_init() {
        this.canvas = this.card.querySelector("#grafico");
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

    async graph_add() {
        const x = await fx.command(this.Addr, this.REG.cmd.READ);
        if (!x.ok) return;
        this.grafico.addValue(0, x.value);
    }


    // ============================================================
    // Ações dos Botões
    // ============================================================

    // Botão read
    async read( save_val = false ){
        const btn_save = this.card.querySelector("#btn_save");
        btn_save.classList.add('ok');

        // atualiza o endereço
        this.parameters.addr.wg.input.value = this.Addr;
        
        // Le cada parâmetro
        for( const param in this.parameters ){
            if( param != "addr" && param != "name" && this.param_available( param ) ){
                const ans = await fx.register_read( this.Addr, this.parameters[param].addr  );
                if( ans.ok ){
                    console.log(`[BTN-READ] result [${param} 0x${ this.parameters[param].addr }] ${ans.value}`);
                    this.parameters[param].wg.display( ans.value );
                    if( save_val ){
                        this.parameters[param].saved_value = ans.value;
                    }
                }else{
                    console.log(`[BTN-READ] result [${param} 0x${ this.parameters[param].addr }] ERRO`);
                }
            }
        }
    }
    
    // Botão apply
    async apply( save_val = true ){
        console.log(`[BTN-APPLY] [0x${this.Addr} / ID: ${this.id}]`);
        for( const param in this.parameters ){
            //if( param != "addr" && param != "name" ){
            if( param != "addr" && param != "name" && this.param_available( param ) ){
                const wg = this.parameters[param].wg;
                const reg_addr = this.parameters[param].addr;
                //let IN = wg.input.value;
                let IN = wg.value();
                let ans = await fx.register_write( this.Addr, reg_addr,  IN );
                if( ans.ok ){
                    wg.display( ans.value );
                    if( save_val ){
                        this.parameters[param].saved_value = ans.value;
                        console.log( `[BTN-APPLY][ADDR ${this.Addr}][save ${param} ${ans.value}]` );
                    }
                }else{
                    console.log(`[BTN-APPLY] ERRO-1`);
                }
            }else if( param == "addr" ){
                const wg = this.parameters[param].wg;
                //addr_check(); // vai verificar se existe conflito de endereço com outros dispositivos
                wg.trim();
                const new_addr = wg.value();
                if( new_addr != this.Addr ){
                    const ans = await fx.register_write( this.Addr, this.parameters.addr.addr,  new_addr );
                    if( ans.ok ){
                        wg.display( ans.value );
                        this.Addr = ans.value;
                        console.log( `[BTN-APPLY][DEVICE ${this.id}][CHANGE ADDR TO ${this.Addr}]` );
                        if( save_val ){
                            this.parameters.addr.saved_value = ans.value;
                        }
                    }else{
                        console.log(`[BTN-APPLY] ERRO ao alterar o endereço!!!`);
                    }
                }
            }
        }
    }

    // Botão save
    async save(){
        await this.apply( true );
        let ans = await fx.command_key(this.Addr,FX_S50_REG.cmd_write.SAVE,true); // Comando de save
        console.log( "[BTN-SAVE] return: ", ans );
        const btn_save = this.card.querySelector("#btn_save");
        btn_save.classList.add('ok');
    }

    // Botão reset
    async reset() {
        await fx.reset(this.Addr, true);
        await delay(20);
        await this.read(true);
        if( this.grafico ){
            this.grafico.clear();
        }
    }

    // Botão default
    async default() {
        await fx.command_key(this.Addr, this.REG.cmd_write.RESTORE_KEPP_ADDR, true);
        await delay(20);
        await this.read();
    }

    // ============================================================
    // Monitoramento em tempo real
    // ============================================================

    // verifica o status de cada variavel
    async save_status(){
        let all_saved = true;
        const btn_save = this.card.querySelector("#btn_save");
        for( const param in this.parameters ){
            if( param != "name"  && this.param_available( param ) ){
                if( this.parameters[param].saved_value != this.parameters[param].wg.value() ){
                    //console.log( "[!=]",param," val:",this.parameters[param].saved_value," saved: ",this.parameters[param].wg.value() );
                    this.parameters[param].wg.status.classList.remove('ok');
                    all_saved = false;
                }else{
                    this.parameters[param].wg.status.classList.add('ok');
                }
            }
        }
        if( all_saved ){
            btn_save.classList.add('ok');
        }else{
            btn_save.classList.remove('ok');
        }
    }

    // atualização
    async update(){
        this.save_status();
        if(this.grafico){
            this.graph_add();
            this.grafico.update();
        }
    }

}