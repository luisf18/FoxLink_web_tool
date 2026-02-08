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
        this.baudRate = baudRate;

        this.busy = false;
        this.busy_counter = 0;

        this.timeout_read = 20;
        this.timeout_write = 5;
        this.retry = false;

        this.logLevel = "lowLevel";
        this.logLUT = {
            "error": 0,
            "warn": 1,
            "info": 2,
            "midleLevel": 3,
            "lowLevel": 4
        };

        this.HEAD_CHECK = 0x80;
        this.HEAD_READ  = 0xA0;
        this.HEAD_WRITE = 0xC0;
        this.HEAD_EXTENDED  = 0xE0;
        this.HEAD_CMD = 0x00;
        this.HEAD_REG = 0x80;
    }

    /*------------------
       logging
    ------------------*/

    log(level, ...args) {
        if (this.logLUT[level] <= this.logLUT[this.logLevel]) {
            const tag = level.toUpperCase();
            console.log(`[FoxWire][${tag}]`, ...args);
        }
    }

    logE(...a){ this.log("error", ...a); }
    logW(...a){ this.log("warn", ...a); }
    logI(...a){ this.log("info", ...a); }
    logLL(...a){ this.log("lowLevel", ...a); }
    logML(...a){ this.log("midleLevel", ...a); }

    toHexLine(data) {
        if (!data) return "";
        return Array.from(data, b =>
            (b & 0xFF).toString(16).padStart(2, "0")
        ).join(" ");
    }

    /*-----------------------
       Serial connection
    -----------------------*/

    isConnected() {
        return !!this.port && this.port.readable && this.port.writable;
    }

    // Inicia a conexão serial
    async connect() {
        try {
            if (!("serial" in navigator)) {
                this.logE("A API Web Serial não é suportada neste navegador.");
                throw new Error("A API Web Serial não é suportada neste navegador.");
            }

            if (this.port && this.isConnected()) {
                return true; // já conectado
            }

            // Solicita ao usuário escolher a porta
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: this.baudRate });
            
            this.logI("Conexão serial estabelecida.");

            return true;

        } catch (error) {
            this.logE("Erro ao conectar:", error);
            //console.error("Erro ao conectar:", error);
            this.port = null;
            return false;
        }
    }

    // Encerra a conexão serial
    async disconnect() {
        try {
            if (!this.port) return;

            //// espera liberar busy
            //while (this.busy) {
            //    await new Promise(r => setTimeout(r, 5));
            //}

            await this.port.close();
            this.logI("[FoxWire] disconnected");
            
        } catch (e) {
            this.logE( "Disconnect error:", e );
            console.error("[FoxWire] disconnect error:", e);
        } finally {
            this.port = null;
        }
    }

    /*--------------------------------
       Low Level: receive and send
    --------------------------------*/

    async receiveRaw(n = 1, timeout = 50) {
        if (!this.isConnected()) return new Uint8Array([]);

        const reader = this.port.readable.getReader();
        const result = new Uint8Array(n);
        let offset = 0;

        try {
            while (offset < n) {
                const res = await Promise.race([
                    reader.read(),
                    new Promise(r =>
                        setTimeout(() => r({ timeout: true }), timeout)
                    )
                ]);

                if (!res || res.timeout || res.done || !res.value) break;

                // consome TODOS os bytes recebidos
                for (let i = 0; i < res.value.length && offset < n; i++) {
                    result[offset++] = res.value[i];
                }
            }
        } finally {
            reader.releaseLock();
        }

        const out = result.slice(0, offset);
        this.logLL("rx:", this.toHexLine(out) );
        return out;
    }

    async sendRaw(data) {
        if (!this.isConnected()) return;

        const payload = this.toU8Array(data);

        if (!(payload instanceof Uint8Array)) {
            this.logE("sendRaw: invalid payload", data);
            return;
        }

        const writer = this.port.writable.getWriter();
        try {
            await writer.write(payload);
        } catch (e) {
            this.logE("sendRaw:", e);
        } finally {
            this.logLL("tx:", this.toHexLine(payload) );
            writer.releaseLock();
        }
    }

    /*--------------------------------
       Midle Level: send
    --------------------------------*/

    // envia e remove os bytes repetidos (eco)
    async send( data, sizeIn = 1, timeout = 1000 ){
        if (!this.isConnected()) {
            return { ok: false, data: new Uint8Array([]) };
        }

        data = this.toU8Array(data);
        const sizeOut = data.length;

        // TX
        await this.sendRaw(data);

        // RX
        const rx = await this.receiveRaw( sizeOut + sizeIn, timeout );

        // remove eco
        const payload = rx.slice(sizeOut);
        const ans = {
            ok: payload.length === sizeIn,
            data: payload
        };

        this.logLL( `send-rx(${ans.ok?"ok":"fail"}): ${ans.data} from ${rx}` );

        return ans;
    }

    /*--------------------------------
       Pack Level utils:
       - byteChecksum
    --------------------------------*/

    checksum( data ) {
        let crc = 0;
        for(let i=0;i<data.length;i++){
            crc += data[i];
        }
        return crc&0xFFFF;
    }

    byteChecksum(v){
        v = v&0x1F;
        let cs = ( 0x3 & ( (v&1) + ((v>>1)&1) + ((v>>2)&1) + ((v>>3)&1) + ((v>>4)&1) ) );
        return (cs << 5) | v;
    }

    toU8Array(data) {
        if (data instanceof Uint8Array) {
            return data;
        }

        if (Array.isArray(data)) {
            return Uint8Array.from(
                data.map(v => (v ?? 0) & 0xFF)
            );
        }

        if (typeof data === "number") {
            return Uint8Array.from([data & 0xFF]);
        }

        return new Uint8Array(0);
    }



    /*--------------------------------
       Pack Level (Midle Level):
       - Check
       - Read
       - Write
       - Extended
       Sub division (Midle Level):
       - Read Reg
       - Write Reg
       - 1byte cmd (R-CMD)
       - 2bytes cmd (W-CMD)
       - Extended Cmd
       - Extended Read
       - Extended Write
    --------------------------------*/

    async sendPack(addr, head, data = [], sizeIn = 1) {
        const payload = this.toU8Array(data);

        const packet = new Uint8Array(1 + payload.length);
        packet[0] = head | (addr & 0x1F);
        packet.set(payload, 1);

        return await this.send(packet, sizeIn);
    }

    async check(addr){
        const ans = await this.sendPack(addr, this.HEAD_CHECK);
        let ansOut = {
            ok: false,
            data: ans.data,
            arg: 0
        };
        if( ans.ok ){
            const byte = ans.data[0];
            ansOut.arg = ((byte>>5)&3);
            // Sucesso
            if( (byte & 0x1F) == addr ){
                ansOut.ok = true;
            }
        }
        return ansOut;
    }
    
    async packRead(addr,argument){
        return this.sendPack(addr, this.HEAD_READ, [argument] );
    }

    async packWrite( addr, argument, value ) {
        return this.sendPack(addr, this.HEAD_WRITE, [argument,value] );
    }

    // Registers Read and Write fast Packs
    async registerRead(addr, reg_addr) {
        if (reg_addr > 31) {
            this.logE(
                "Invalid register address. Valid range is 0–31. For higher addresses, use the extended read command."
            );
            return { ok: false, data: [] };
        }
        return await this.packRead(addr, this.HEAD_REG | this.byteChecksum(reg_addr)  );
    }

    async registerWrite(addr, reg_addr, value) {
        if (reg_addr > 31) {
            this.logE(
                "Invalid register address. Valid range is 0–31. For higher addresses, use the extended write command."
            );
            return { ok: false, data: [] };
        }
        return await this.packWrite(addr, this.HEAD_REG | this.byteChecksum(reg_addr), value );
    }

    // Comandos com Fast Packs Read e Write
    async command( addr, cmd, value = null ) {
        return await (
            value ? 
            this.packWrite(addr, this.HEAD_CMD | this.byteChecksum(cmd), value ) :
            this.packRead(addr, this.HEAD_CMD | this.byteChecksum(cmd) )
        );
    }

    // Comandos com chave pra dificultar escrita acidental
    async commandKey( addr, cmd ) {
        const keyIn = await this.command( addr, FX_BASE.cmd.REQUEST_WRITE );
        if( keyIn.ok ){
            const keyOut = 0xff&(255-keyIn.data[0]);
            return await this.command( addr, cmd, keyOut );
        }
        return keyIn;
    }

    // EXTENDED --------------------------------------------------------------------------------------

    /*/==========================================================
    EXTENDED
    - comando: header(1)+(cmd<0x80)(1)+crc(1) -> AKC(2)
    - dados_read:  header(1)+(cmd>=0x80)(1)+len(1)+addr(2)+crc(2) -> data(len)+crc(2)
    - dados_write: header(1)+(cmd>=0x80)(1)+len(1)+addr(2)+data(len)+crc(2) -> AKC(2)
    
    EXTENDED Read:
    - exemplo: 0xE0 0x80 0xFF 0x00 0x04 0x00 0x00
    - tradução: [ extended, addr = 0 ][extended_cmd = 0x80 = READ ][ len = 0xFF + 1 = 256 ]
                [ (2) addr-u16: 0x0400 ][ (2) crc-u16: 0x0263 ] 
    -> CRC = soma todos os bytes menos os do proprio CRC
    ==========================================================/*/

    /*
    async extended(addr, cmd, data = null, len = null) {
        const head = this.HEAD_EXTENDED | (addr&0xFF);

        // ======================
        // EXTENDED Command
        // ======================
        if( cmd < 0x80 ) {
            this.logI("extendedLow", { addr, cmd });

            const packet = new Uint8Array(3);
            packet[0] = head;
            packet[1] = cmd & 0xFF;

            // CRC8 = soma dos bytes anteriores
            packet[2] = (packet[0] + packet[1]) & 0xFF;

            return await this.send(packet, 2); // espera ACK(2)
        }

        // ======================
        // EXTENDED
        // ======================
        if( len === null && data == null ){
            this.logE("expected data or len");
        }
        const payload = this.toU8Array(data ?? []);

        if( len == null ){

        }
        const realLen = len & 0xFF;

        if (realLen === 0) {
            this.logW("extendedHigh with zero length");
        }

        if (payload.length > 256) {
            this.logW("Extended packet payload exceeds 256 bytes", payload.length);
        }

        this.logI("extendedHigh", {
            addr,
            cmd,
            len: realLen,
            payload: payload.length
        });

        const size =
            1 + // head
            1 + // cmd
            1 + // len
            2 + // addr u16
            payload.length +
            2;  // crc16

        const packet = new Uint8Array(size);
        let i = 0;

        packet[i++] = head;
        packet[i++] = cmd & 0xFF;
        packet[i++] = realLen;
        packet[i++] = addr & 0xFF;
        packet[i++] = (addr >> 8) & 0xFF;

        packet.set(payload, i);
        i += payload.length;

        // CRC16 = soma de todos os bytes anteriores
        let crc = 0;
        for (let j = 0; j < i; j++) crc += packet[j];
        crc &= 0xFFFF;

        packet[i++] = crc & 0xFF;
        packet[i++] = (crc >> 8) & 0xFF;

        return await this.send(packet, 2); // ACK ou resposta
    }
    async extended( addr, cmd, data = null, len=null ){

        this.send( addr,  )
    }
    */
    
    async extendedRead( addr, dataAddr, size, base = "reg", log = true ) {

        //const outSize =
        //    1 + // head
        //    1 + // cmd
        //    1 + // len
        //    2 + // addr u16
        //    2;  // crc16

        dataAddr = dataAddr & 0xFFFF;

        if( size > 256 ){
            this.logW( "extendedRead can't read more than 256 bytes" );
            size = 256;
        }

        let packet = [
            this.HEAD_EXTENDED|(addr&0x1F),
            0x80, // cmd-read
            (size-1)&0xFF,
            (dataAddr>>8)&0xFF,
            dataAddr&0xFF
        ];

        // por enquanto só le reg
        const crc = this.checksum(packet) & 0xFFFF;

        // CRC u16 little-endian
        packet.push(crc & 0xFF);        // LSB
        packet.push((crc >> 8) & 0xFF); // MSB

        this.logI(`[EXTENDED READ TX][crc: ${crc.toString(16)}]`,
            packet.map(b => b.toString(16).padStart(2, "0")).join(" ")
        );

        const ans = await this.send( this.toU8Array(packet) );
        let ansOut = { ok: false, data: [], crc: 0 };

        if ( !ans || !ans.ok || !ans.data || ans.data.length <= 2 ) {
            return ansOut;
        }

        // -----------------------------
        // extrai CRC RX (u16 LE)
        // -----------------------------
        const len = ans.data.length;
        ansOut.data = ans.data.slice(0, len - 2);
        ansOut.crc  = ans.data[len - 2] | (ans.data[len - 1] << 8);

        // -----------------------------
        // valida CRC
        // -----------------------------
        const crc_calc = this.checksum(ansOut.data) & 0xFFFF;
        ansOut.ok = (ansOut.crc === crc_calc);
        
        this.logI("[EXTENDED READ RX DATA]",
            ansOut.data.map(b => b.toString(16).padStart(2, "0")).join(" ")
        );
        this.logI(
            `[CRC] rx=0x${ansOut.crc.toString(16)} calc=0x${crc_calc.toString(16)}`
        );

        return ansOut;
    }

    /*--------------------------------
       High Level comamnds
    --------------------------------*/

    // Comando de reset
    async reset(addr) {
        return await this.command( addr, FX_BASE.cmd.MCU_RESET );
    }

    // Comando de save
    async save(addr) {
        return await this.commandKey( addr, FX_BASE.cmd_write.SAVE );
    }

    // Comando de default keep addr
    async default(addr) {
        return await this.commandKey( addr, FX_BASE.cmd_write.RESTORE_KEPP_ADDR );
    }

    // get ID
    async getID(addr) {
        const ID_L = await this.command(addr,FX_BASE.cmd.DEVICE_ID_L);
        const ID_H = await this.command(addr,FX_BASE.cmd.DEVICE_ID_H);
        if (ID_L.ok && ID_H.ok) {
            return { ok: true, data: ((ID_H.data<<8)|ID_L.data) };
        }
        return { ok: false, data: 0 };
    }

    // get Firmware Version
    async getFirmwareVersion(addr) {
        const FW_ID  = await this.command(addr,FX_BASE.cmd.FIRMWARE_ID);
        const FW_VER = await this.command(addr,FX_BASE.cmd.FIRMWARE_VERSION);
        if (FW_ID.ok && FW_VER.ok) {
            return { ok: true, data: (FW_ID.data*1000 + FW_VER.data) };
        }
        return { ok: false, data: 0 };
    }

    // get ID
    async getLot(addr) {
        const pipeline = [
            FX_BASE.cmd.LOT_DATE_H,
            FX_BASE.cmd.LOT_DATE_L,
            FX_BASE.cmd.LOT_H,
            FX_BASE.cmd.LOT_L
        ];
        let results = [];
        for(const cmd of pipeline){
            const ans = await fx.command(addr, cmd);
            if (!ans.ok) {
                return { ok: false, id: 0, date: 0 };
            }
            results.push(ans.data);
        }

        const date = (results[0] << 8) | results[1];
        const monthStr = String(date % 12).padStart(2, '0');
        const yearStr = String(Math.floor(date / 12)).padStart(4, '0');  // se o ano for codificado como "25" para 2025
        const date_str = `${monthStr}-${yearStr}`;
        const id = (results[2]<<8)|results[3];

        this.logI( "getLot" );
        this.logI( "Date:",date );
        this.logI( "Date_str:",date_str );

        return { ok: true, id: id, date: date_str };
    }

    
    // High level Read
    async readType(deviceAddr, dataAddr, type = 'u8', len = 1, littleEndian = true, useExtended=true) {
        if (len <= 0) return null;

        const validTypes = ['u8','u16','u32','i8','i16','i32','char','str'];
        if (!validTypes.includes(type)) return null;

        // [1] Determina quantidade de bytes
        let byteSize = 1;
        let bits = 8;
        let isSigned = false;

        if (type !== 'str' && type !== 'char') {
            bits = parseInt(type.slice(1), 10);
            byteSize = bits / 8;
            isSigned = type.startsWith('i');
        }

        const totalBytes = (type === 'str' || type === 'char') ? len : len * byteSize;
        let bytes = [];

        // [2] Leitura byte a byte
        if( useExtended ){
            const ans = await this.extendedRead(
                deviceAddr, 0x0400 + dataAddr, totalBytes
            );
            if (!(ans?.ok)) return null;
            bytes = ans.data;
        }else{
            for (let i = 0; i < totalBytes; i++) {
                const ans = await this.registerRead(
                    deviceAddr, dataAddr + i 
                );
                if (!ans?.ok) return null;
                bytes.push(ans.value & 0xFF);
            }
        }

        this.logI( `ReadType[${deviceAddr}][${deviceAddr}]: ${bytes}` );

        return bytesToTypedValue( bytes, type, littleEndian );
    }

}
