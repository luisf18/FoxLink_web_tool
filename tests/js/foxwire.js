// ================================================
// FOXWIRE 
// ================================================

// valores comuns a todos os dispositivos
export const FX_BASE = Object.freeze({
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
        ADDR:     0x00,
        FX_CTRL:  0x01,
    }
});


export class FoxWire {
    constructor(baudRate = 115200) {
        
        // Porta UART
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.baudRate = baudRate;
        this.busy = false;
        this.busy_counter = 0;

        this.timeout_read = 20;
        this.timeout_write = 5;
        this.retry = false;
    }

    isConnected() {
        return !(!this.writer || !this.reader);
    }

    // Inicia a conexão serial
    async connect() {
        try {
            if (!("serial" in navigator)) {
                throw new Error("A API Web Serial não é suportada neste navegador.");
            }
            this.port = await navigator.serial.requestPort(); // Solicita ao usuário escolher a porta
            await this.port.open({ baudRate: this.baudRate });
            this.writer = this.port.writable.getWriter();
            this.reader = this.port.readable.getReader();
            console.log("Conexão serial estabelecida.");
            return true;
        } catch (error) {
            console.error("Erro ao conectar:", error);
        }
        return false;
    }

    // Encerra a conexão serial
    async disconnect() {
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
            }
            if (this.writer) {
                this.writer.releaseLock();
            }
            if (this.port) {
                await this.port.close();
            }
            console.log("Conexão serial encerrada.");
        } catch (error) {
            console.error("Erro ao desconectar:", error);
        }
    }

    async read(){
        //const reader = port.readable.getReader();
        const timeoutController = new AbortController();
        const signal = timeoutController.signal;

        let ret = {
            value: new Uint8Array([]), // Correto
            done: false
        };


        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                timeoutController.abort();
                reject(new Error("Timeout atingido na leitura da porta serial!"));
            }, this.timeout_read);
        });

        try {
            const readPromise = this.reader.read();
            ret = await Promise.race([readPromise, timeoutPromise]);
        } catch (error) {
            console.error("Erro:", error.message);
        }
        
        //finally {
        //    this.reader.releaseLock(); // Libera o leitor da porta
        //}
        return ret;
    }

    // Envia bytes e aguarda resposta dentro de um timeout
    async sendAndReceive( sendData ) {
        if (!this.writer || !this.reader) {
            throw new Error("A conexão serial não está aberta.");
            return [];
        }

        //if (this.reader) {
        //    console.log("O reader está aberto!");
        //} else {
        //    console.log("O reader foi fechado!");
        //}

        if( this.busy_counter > 10 ){
            console.error("[ERRO] muitos acessos simultaneos a port. reinicie a página",this.busy_counter);
            return [];
        }
        this.busy_counter++;
        while( this.busy ){
            console.log('.uart-busy');
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        this.busy_counter--;

        this.busy = true;

        if( this.port ){
            // Cancela o reader e fecha o writer atuais
            if (this.reader) {
                await this.reader.cancel();
            }
            if (this.writer) {
                await this.writer.close();
            }
            // Cria novos writer e reader
            this.writer = this.port.writable.getWriter();
            this.reader = this.port.readable.getReader();
        }

        //console.log('.1');
        // Envia os dados
        await this.writer.write(sendData);
        //console.log("Dados enviados:", sendData);
        //console.log('.2');
        await new Promise(resolve => setTimeout(resolve, this.timeout_write));
        // Aguarda resposta
        const receivedData = [];
        //console.log('.3');
        const { value, done } = await this.read( 10 ); //this.reader.read();
        //console.log('.3.done');
        if (done){
            this.busy = false;
            //console.log('.4');
            return [];
        }
        receivedData.push(...value);

        this.busy = false;
        //if(log) console.log("[SendAndRecive] Dados recebidos:", receivedData);
        //console.log('.5');
        return receivedData;
    }

    // envia e remove os bytes repetidos
    async send(data,log=false) {
        //if(log) console.log("*");
        let recive = new Uint8Array([]);
        let n = (this.retry | 0);
        while( n >= 0  ){
            let ok = true;
            recive = await this.sendAndReceive(data); // Aguarda resposta
            if(log)console.log(`[Send: ${data}][Receive: ${recive}]`);
            if (recive.length < data.length) {
                if( n > 0 ){
                    ok = false;
                }else{
                    return { ok: false, values: [] }; // Erro: resposta muito curta
                }
            }
            for (let i = 0; i < data.length; i++) {
                if (data[i] !== recive[i]) {
                    if( n > 0 ){
                        ok = false;
                        break;
                    }else{
                        return { ok: false, values: [] }; // Erro: dados não batem
                    }
                }
            }
            if( ok ) break;
            n--;
        }
        return { ok: true, values: recive.slice(data.length) }; // Sucesso
    }

    async check( addr, log=false ) {
        const ans = await this.send( new Uint8Array([0x80|addr]), log );
        //if(log)console.log("[CHECK] ans:", ans );
        if( ans.ok ){
            if(ans.values.length >= 1){
                if( (ans.values[0] & 0x1F) == addr ){
                    return { ok: true, arg: (0x03&(ans.values[0]>>5)), value: ans.values[0] }; // Sucesso
                }
                return { ok: false, arg: 0, value: ans.values[0], send_ok: true };
            }
            return { ok: false, arg: 0, value: 0, send_ok: true };
        }
        return { ok: false, arg: 0, value: 0, send_ok: false };
    }

    checksum(v){
        v = v&0x1F;
        let cs = ( 0x3 & ( (v&1) + ((v>>1)&1) + ((v>>2)&1) + ((v>>3)&1) + ((v>>4)&1) ) );
        return (cs << 5) | v;
    }

    // READ ----------------------------------------------------------
    async READ( addr, arg, log=false  ) {
        addr = 0xA0|(addr & 0x1F);
        arg = arg & 0xFF;
        const ans = await this.send( new Uint8Array([addr,arg]), log );
        //console.log("[READ] ans:", ans );
        if( ans.ok ){
            if(ans.values.length >= 1){
                return { ok: true, arg: 0, value: ans.values[0], send_ok: true };
            }
        }
        return { ok: false, arg: 0, value: 0, send_ok: ans.ok };
    }
    async register_read( addr, reg_addr, log = false  ) {
        reg_addr = reg_addr & 0x1F;
        reg_addr = 0x80 | this.checksum(reg_addr);
        const ans = await this.READ( addr, reg_addr, log );
        if(log) console.log("[REG READ] ans:", ans );
        return ans;
    }

    // PACOTE WRITE ----------------------------------------------------------

    async WRITE( addr, arg1, arg2, log=false ) {
        addr = 0xC0|(addr & 0x1F);
        arg1 = arg1 & 0xFF;
        arg2 = arg2 & 0xFF;
        const ans = await this.send( new Uint8Array([addr,arg1,arg2]), log );
        //console.log("[WRITE] ans:", ans );
        if( ans.ok && ans.values.length >= 1 ){
            return { ok: true, arg: 0, value: ans.values[0], send_ok: true };
        }
        return { ok: false, arg: 0, value: 0, send_ok: ans.ok };
    }

    async register_write( addr, reg_addr, val, log=false ) {
        reg_addr = 0x80 | this.checksum(reg_addr); // 0x80 -> indica que é um registrador e não um comando
        const ans = await this.WRITE( addr, reg_addr, val, log );
        return ans;
    }

    async command( addr, cmd, val = null, log = false) {
        //console.log( `checksum ${cmd} -> ${(this.checksum(cmd)<<5)}` );
        //if(log)console.log( `[addr ${addr}] command: ${cmd} (${cmd.toString(2)}) val: ${val}` );
        addr = (addr & 0x1F);
        cmd = this.checksum(cmd);
        //if(log)console.log( `|->[addr ${addr}] command: ${cmd.toString(2)} val: ${val}` );
        if( val ){
            val = val & 0xFF;
            return await this.WRITE( addr, cmd, val, log );
        }
        return await this.READ( addr, cmd, log );
    }

    async command_key( addr, cmd, log=false) {
        const key = await this.command( addr, FX_S50_REG.cmd.REQUEST_WRITE, null, log );
        //console.log("key",key);
        if( key.value && key.ok ){
            const KEY = 0xff&(255-key.value);
            if(log){
                console.log("key:",key.value);
                console.log("key\\:",KEY);
            }
            return await this.command( addr, cmd, KEY, log );
        }
        return { ok: false, arg: 0, value: 0, send_ok: key.send_ok };
    }

    // Comando de reset
    async reset(addr,log=false) {
        return await this.command(addr,FX_BASE.cmd.MCU_RESET, null,log);
    }

    // get ID
    async getID(addr,log=false) {
        const ID_L = await this.command(addr,FX_BASE.cmd.DEVICE_ID_L,null,log);
        const ID_H = await this.command(addr,FX_BASE.cmd.DEVICE_ID_H,null,log);
        if (ID_L.ok && ID_H.ok) {
            return { ok: true, value: ((ID_H.value<<8)|ID_L.value) };
        }
        return { ok: false, value: 0 };
    }

    // get Firmware Version
    async getFirmwareVersion(addr,log=false) {
        const FW_ID = await this.command(addr,FX_BASE.cmd.FIRMWARE_ID,null,log);
        const FW_VER = await this.command(addr,FX_BASE.cmd.FIRMWARE_VERSION,null,log);
        if (FW_ID.ok && FW_VER.ok) {
            return { ok: true, value: (FW_ID*1000 + FW_VER) };
        }
        return { ok: false, value: 0 };
    }

    // get ID
    async getLot(addr,log=false) {
        if(log){ console.log( "[FX] reading Lot:" ); }
        const pipeline = [
            FX_BASE.cmd.LOT_DATE_H,
            FX_BASE.cmd.LOT_DATE_L,
            FX_BASE.cmd.LOT_H,
            FX_BASE.cmd.LOT_L
        ];
        let results = [];
        for(const cmd of pipeline){
            const ans = await fx.command(addr, cmd, null, log);
            if (!ans.ok) {
                console.error(`[FX] Erro ao ler comando 0x${cmd.toString(16)} no endereço ${i}`);
                return { ok: false, id: 0, date: 0 };
            }
            results.push(ans.value);
        }

        const date = (results[0] << 8) | results[1];
        if(log){console.log( "Date:",date );}
        const monthStr = String(date % 12).padStart(2, '0');
        const yearStr = String(Math.floor(date / 12)).padStart(4, '0');  // se o ano for codificado como "25" para 2025
        const date_str = `${monthStr}-${yearStr}`;
        //const date_str = `${ data%12 }-${ int(date/12) }`
        if(log){console.log( "Date_str:",date_str );}
        const id = (results[2]<<8)|results[3];
        return { ok: true, id: id, date: date_str };
    }

}
