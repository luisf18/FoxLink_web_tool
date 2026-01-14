// ================================================
// Device: FX-S50
// ================================================

const FX_S50_REG = Object.freeze({
    cmd: {
        DEVICE_ID_L:        0x00,
        DEVICE_ID_H:        0x01,
        LOT_L:              0x02,
        LOT_H:              0x03,
        LOT_DATE_L:         0x04,
        LOT_DATE_H:         0x05,
        FOXWIRE_VERSION_ID: 0x06,
        FIRMWARE_ID:        0x07,
        FIRMWARE_VERSION:   0x08,
        REQUEST_WRITE:      0x09,
        MCU_RESET:          0x0A,
        MCU_VOLTAGE:        0x0B,
        MCU_TEMPERATURE:    0x0C,
        READ:               0x0D
    },
    cmd_write: {
        SAVE:               0x01,
        RESTORE:            0x02,
        RESTORE_KEPP_ADDR:  0x03
    },
    reg: {
        ADDR:          0x00,
        CTRL:          0x01,
        L_HZ:          0x02,
        L_DC:          0x03,
        F_TOP:         0x04,
        F_TRIG:        0x05,
        CTRL1:         0x06,
        CTRL2:         0x07,
        NAME:          0x08, // 16 bytes
        SCAN_COUNT:    0x18, // 24 em decimal
        SCAN_VALUE:    0x19, // 25 em decimal
        SCAN_DELAY:    0x1A, // 26 em decimal
        SCAN_PERIODE:  0x1B  // 27 em decimal
    }
});

class fxs50 extends FxDevice {
    constructor(addr) {
        super(addr, {
            name: "FxS50",
            model: "FX-S50",
            image: "https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png",
            graph_mode: "digital",
            REG: FX_S50_REG,
            parameters: (self) => ({
                addr: {
                    addr: FX_S50_REG.reg.ADDR,
                    wg: new widget_int(self.id, "Addr", 0, 0, 31),
                    saved_value: addr
                },
                name: {
                    addr: FX_S50_REG.reg.NAME,
                    wg: new widget_string(self.id, "name", "FX-S50", 32),
                    saved_value: 0
                },
                CTRL1: {
                    addr: FX_S50_REG.reg.CTRL1,
                    wg: new widget_select(self.id, "Read mode", 0, {
                        Digital: 0,
                        Analog: 1
                    }),
                    saved_value: 0
                },
                led_hz: {
                    addr: FX_S50_REG.reg.L_HZ,
                    wg: new widget_int(self.id, "led_hz", 120, 0, 255),
                    saved_value: 0
                },
                led_brilho: {
                    addr: FX_S50_REG.reg.L_DC,
                    wg: new widget_int(self.id, "led_brilho", 50, 0, 200),
                    saved_value: 0
                },
                filter_size: {
                    addr: FX_S50_REG.reg.F_TOP,
                    wg: new widget_int(self.id, "filter_size", 5, 0, 255),
                    saved_value: 0
                },
                filter_trigger: {
                    addr: FX_S50_REG.reg.F_TRIG,
                    wg: new widget_int(self.id, "filter_trigger", 5, 0, 255),
                    saved_value: 0
                }
            })
        });

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

        this.graph_mode = 'digital';
        this.grafico = {};
        this.card = null;
    }

    /* firmware antigo não possui CTRL1 */
    param_available(p) {
        if (this.firmwareVersion <= 1002) {
            return p !== "CTRL1";
        }
        return true;
    }

    async html(){
        let card = document.createElement("div");
        this.card = card;
        card.className = "user-card";
        card.id = `device_${this.id}"`;
        cards_container.appendChild(card);
        const HTML = `
            <div class="user-header">
                <img src=${"https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png"}>
                <div>
                    <div class="device-title">${"FX-S50"} [${this.id}]</div>
                    <div class="device-info">Modelo: ${"FX-S50"} | Lote: ${"2025"} | V${parseInt(this.firmwareVersion/1000)}.${this.firmwareVersion%1000} </div>
                </div>
            </div>
            <div class="user-info"> </div>

            <!-- Gráfico -->
            <div class="chart-container">
                <canvas id="grafico"></canvas>
                <div class="chart-labels">Leitura em tempo real | 60 leituras</div>
            </div>

            <div class="action-buttons">
                <button id="btn_read">Read</button>
                <button id="btn_apply">Apply</button>
                <button class="save-btn" id="btn_save">Save</button>
                <button id="btn_default">Default</button>
                <button id="btn_reset">Reset</button>
            </div>
        `;
        console.log(HTML);
        card.innerHTML = HTML;
        //container.appendChild(box);
        let INFO = card.querySelector(".user-info");
        for (const p in this.parameters){
            if( this.param_available(p) ){
                INFO.appendChild( this.parameters[p].wg.html() );
            }
        }

        const btn_read = card.querySelector("#btn_read");
        if (btn_read) btn_read.addEventListener("click", () => this.read());
        const btn_default = card.querySelector("#btn_default");
        if (btn_default) btn_default.addEventListener("click", () => this.default());
        const btn_save = card.querySelector("#btn_save");
        if (btn_save) btn_save.addEventListener("click", () => this.save());
        const btn_apply = card.querySelector("#btn_apply");
        if (btn_apply) btn_apply.addEventListener("click", () => this.apply());
        const btn_rst = card.querySelector("#btn_reset");
        if (btn_rst) btn_rst.addEventListener("click", () => this.reset());
        

        this.canvas = card.querySelector("#grafico");
        console.log(this.canvas);
        this.grafico = {
            canvas: this.canvas,
            w: this.canvas.width,
            h: this.canvas.height,
            ctx: this.canvas.getContext("2d"),
            data: new Array(50).fill(0),
            mode: 'digital'
        };
        console.log(this.grafico);
        //this.grafico.interval = setInterval(this.adicionarValor.bind(this), 200);
    }

    /* gráfico específico do FXS50 */
    atualizarGrafico() {
        const g = this.grafico;
        g.ctx.clearRect(0, 0, g.w, g.h);

        let max_val = 1;
        let min_val = 0;

        if (this.firmwareVersion > 1002 && g.mode === "analogico") {
            max_val = 20;
        }

        g.ctx.strokeStyle = "lightgray";
        g.ctx.setLineDash([5, 5]);

        const yMax = 5;
        const yMin = 5 + (g.h - 10);

        g.ctx.beginPath();
        g.ctx.moveTo(0, yMax);
        g.ctx.lineTo(g.w, yMax);
        g.ctx.stroke();

        g.ctx.beginPath();
        g.ctx.moveTo(0, yMin);
        g.ctx.lineTo(g.w, yMin);
        g.ctx.stroke();

        g.ctx.setLineDash([]);

        g.ctx.beginPath();
        g.ctx.moveTo(
            0,
            5 + (g.h - 10) * (1 - g.data[0] / max_val)
        );

        for (let i = 1; i < g.data.length; i++) {
            const x = (i / (g.data.length - 1)) * g.w;
            const y = 5 + (g.h - 10) * (1 - g.data[i] / max_val);
            g.ctx.lineTo(x, y);
        }

        g.ctx.strokeStyle = "blue";
        g.ctx.lineWidth = 1.5;
        g.ctx.stroke();
    }

    async adicionarValor() {
        this.grafico.data.shift();

        const x = await fx.command(this.Addr, FX_S50_REG.cmd.READ);

        if (this.firmwareVersion > 1002) {
            const mode = await fx.register_read(this.Addr, this.parameters.CTRL1.addr);
            if (mode.ok) {
                this.grafico.mode = mode.value === 1 ? "analogico" : "digital";
            }
        }

        this.grafico.data.push(parseInt(x.value));
        this.atualizarGrafico();
    }

    /* reset do FXS50 é diferente */
    //async reset() {
    //    await fx.command(this.Addr, FX_S50_REG.cmd.MCU_RESET, null, true);
    //    await delay(20);
    //    await this.read(true);
    //}

    /* get_firmware_version do FXS50 é diferente */
    async get_firmware_version(){
        let fw1 = await fx.command( this.Addr, FX_S50_REG.cmd.FIRMWARE_ID  );
        let fw2 = await fx.command( this.Addr, FX_S50_REG.cmd.FIRMWARE_VERSION  );
        if( fw1.ok && fw1.ok ){
            this.firmwareVersion = fw1.value*1000 + fw2.value;
        }else{
            this.firmwareVersion = 1002;
        }
        console.log( "Version:", this.firmwareVersion );
    }


    atualizarGrafico() {
        this.grafico.ctx.clearRect(0, 0, this.grafico.w, this.grafico.h);

        let max_val = 1;
        let min_val = 0;

        if(this.firmwareVersion>1002){
            if( this.grafico.mode == 'analogico' ){
                max_val = 20;
                min_val = 0;
            }
        }

        // Definir estilos para as linhas limite
        this.grafico.ctx.strokeStyle = "lightgray";
        this.grafico.ctx.setLineDash([5, 5]); // Padrão tracejado

        // Linha superior (máximo)
        let yMax = 5 + (this.grafico.h - 10) * (1 - (max_val / max_val));
        this.grafico.ctx.beginPath();
        this.grafico.ctx.moveTo(0, yMax);
        this.grafico.ctx.lineTo(this.grafico.w, yMax);
        this.grafico.ctx.stroke();

        // Linha inferior (mínimo)
        let yMin = 5 + (this.grafico.h - 10) * (1 - (min_val / max_val));
        this.grafico.ctx.beginPath();
        this.grafico.ctx.moveTo(0, yMin);
        this.grafico.ctx.lineTo(this.grafico.w, yMin);
        this.grafico.ctx.stroke();

        // Resetar estilo de linha para normal (sólido)
        this.grafico.ctx.setLineDash([]);

        // Linhas do gráfico principal
        this.grafico.ctx.beginPath();
        this.grafico.ctx.moveTo(0, 5 + (this.grafico.h - 10) * (1 - (this.grafico.data[0] / max_val)) );

        for (let i = 1; i < this.grafico.data.length; i++) {
            let x = (i / (this.grafico.data.length - 1)) * this.grafico.w;
            let y = 5 + (this.grafico.h - 10) * (1 - (this.grafico.data[i] / max_val));
            this.grafico.ctx.lineTo(x, y);
        }

        this.grafico.ctx.strokeStyle = "blue";
        this.grafico.ctx.lineWidth = 1.5;
        this.grafico.ctx.stroke();
    }

    async adicionarValor() {
        //console.log(this.grafico);
        this.grafico.data.shift();
        //this.grafico.data.push(Math.random() * 10);
        //let x = await fx.check( this.Addr );
        //let x = await fx.command( this.Addr, 13, null, true );
        let x = await fx.command( this.Addr, FX_S50_REG.cmd.READ );

        if( this.firmwareVersion > 1002 ){
            let mode = await fx.register_read( this.Addr, this.parameters.CTRL1.addr );
            if( mode.ok ){
                if( mode.value == 1 ) this.grafico.mode = 'analogico';
                else this.grafico.mode = 'digital';
            }
        }
        
        this.grafico.data.push( parseInt(x.value) );
        this.atualizarGrafico();
    }

    async update(){
        this.save_status();
        await this.adicionarValor();
    }
}
