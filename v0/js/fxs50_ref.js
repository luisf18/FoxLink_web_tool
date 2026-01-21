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


class fxs50 extends devices_card {
    constructor(Addr) {
        super(Addr);
        this.firmwareVersion = 1002;
        this.id = Cards.length;
        this.parameters = {
            addr: { addr: FX_S50_REG.reg.ADDR, wg: new widget_int(this.id,"Addr",0,0,31), saved_value: this.Addr },
            name: { addr: FX_S50_REG.reg.NAME, wg: new widget_string(this.id,"name","FX-S50",32), saved_value: 0 },
            CTRL1: { addr: FX_S50_REG.reg.CTRL1, wg: new widget_select(this.id,"Read mode",0,{"Digital":0,"Analog":1}), saved_value: 0 },
            //CTRL: 0x01,
            led_hz: { addr: FX_S50_REG.reg.L_HZ, wg: new widget_int(this.id,"led_hz",120,0,255), saved_value: 0 },
            led_brilho: { addr: FX_S50_REG.reg.L_DC, wg: new widget_int(this.id,"led_brilho",50,0,200), saved_value: 0 },
            filter_size: { addr: FX_S50_REG.reg.F_TOP, wg: new widget_int(this.id,"filter_size",5,0,255), saved_value: 0 },
            filter_trigger: { addr: FX_S50_REG.reg.F_TRIG, wg: new widget_int(this.id,"filter_trigger",5,0,255), saved_value: 0 }
            //READ: 0x06
        };
        
        this.parameters.addr.wg.currentValue = this.Addr;

        this.parameters.addr.wg.trim_callback = (self) => {
            //console.log(`Lambda executado! Valor do objeto: ${self.value()}`);
            for( const card of Cards ){
                if( card.id != this.id ){
                    if( self.value() == card.Addr ){
                        console.log(`ERRO esse endereço ja é utilizado por outro dispositivo da rede!`);
                        self.input.value = this.Addr;
                    }
                }
            }
        }

        //this.graphs = {
        //    read: { addr: 0x00, wg: new widget_int(this.id,"Addr",0,31) },
        //}
        this.graph_mode = 'digital';
        this.grafico = {};
        this.card = null;
    }

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

    async update(){
        this.check_save();
        await this.adicionarValor();
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

    param_available( p ){
        if( this.firmwareVersion <= 1002 ){
            return ( p!="CTRL1" );
        }
        return 1;
    }

    async read( save_val = false ){

        const btn_save = this.card.querySelector("#btn_save");
        btn_save.classList.add('ok');

        // atualiza o endereço
        this.parameters.addr.wg.input.value = this.Addr;
        //console.log(`READ-BTN [0x${this.Addr} / ID: ${this.id}]`);
        
        // Le cada parâmetro
        for( const param in this.parameters ){
            if( param != "addr" && param != "name" && this.param_available( param ) ){
                const ans = await fx.register_read( this.Addr, this.parameters[param].addr  );
                if( ans.ok ){
                    console.log(`READ-BTN-RESULT[${param} 0x${ this.parameters[param].addr }] ${ans.value}`);
                    this.parameters[param].wg.display( ans.value );
                    if( save_val ){
                        this.parameters[param].saved_value = ans.value;
                    }
                }else{
                    console.log(`READ-BTN-RESULT[${param} 0x${ this.parameters[param].addr }] ERRO`);
                }
            }
        }
    }
    
    async default(){
        // Comando que retorna as configurações aos valores padrão
        // mantendo o endereço do dispositivo
        await fx.command_key(this.Addr,FX_S50_REG.cmd_write.RESTORE_KEPP_ADDR, true);
        await delay(20);
        await this.read();
        //for( const param in this.parameters ){
        //    //await this.parameters[param].wg.display( this.parameters[param].wg.defaultValue );
        //}
    }

    async apply( save_val = false ){
        console.log(`APPLY-BTN [ Device 0x${this.Addr} id: ${this.id}]`);
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
                    }
                }else{
                    console.log(`ERRO-1`);
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
                        console.log( `[DEVICE ${this.id}][CHANGE ADDR TO ${this.Addr}]` );
                        if( save_val ){
                            this.parameters.addr.saved_value = ans.value;
                        }
                    }else{
                        console.log(`ERRO ao alterar o endereço!!!`);
                    }
                }
            }
        }
    }

    async save(){
        console.log("comando de salvamento especifico do fxs50");
        await this.apply( true );
        let ans = await fx.command_key(this.Addr,FX_S50_REG.cmd_write.SAVE,true); // Comando de save
        console.log( "save->", ans );

        const btn_save = this.card.querySelector("#btn_save");
        btn_save.classList.add('ok');
        //ans = await fx.command(this.Addr,0x03); // Comando de READ
        //console.log( "save/command(READ)->", ans );
    }

    async reset(){
        await fx.command(this.Addr,FX_S50_REG.cmd.MCU_RESET, null, true); // Comando de reset
        await delay(20);
        await this.read( true );
    }

    async check_save(){
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

}