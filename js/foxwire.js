// ================================================
// FOXWIRE 
// ================================================

export class FoxWire {
    constructor(baudRate = 115200) {
        
        // Porta UART
        this.port = null;
        this.baudRate = baudRate;

        this.busy = false;
        this.busy_counter = 0;

        this.timeoutRead = 5;
        this.retry = false;

        this.logLevel = "midleLevel";
        this.logLUT = {
            "error": 0,
            "warn": 1,
            "info": 2,
            "apiLevel": 3,
            "highLevel": 4,
            "midleLevel": 5,
            "lowLevel": 6
        };

        // request
        this._requestQueue = [];
        this._requestBusy  = 0;
        this._requestTimeout = 300; // ms
        this._inRequest = false;

        this._warnedSendDeprecated = false;

        this.LOG_STYLE = {
            error:      "color:#ff5555;font-weight:bold",
            warn:       "color:#ffcc00;font-weight:bold",
            info:       "color:#4aa3ff",
            lowLevel:   "color:#888",
            midleLevel: "color:#aaa",
            highLevel:  "color:#aaa",
            apiLevel:   "color:#004FA3",

            tx: "color:#00A857;font-weight:bold",   // verde
            rx: "color:#7A00A8;font-weight:bold",    // roxo
            ok: "color:#03E000;font-weight:bold",
            name: "color:#0092F5;font-weight:bold",
            fail: "color:#E00000;font-weight:bold"
        };

        this.LOG_OK = [`%c(ok)`, this.LOG_STYLE.ok];
        this.LOG_FAIL = [`%c(fail)`, this.LOG_STYLE.fail];
        this.LOG_TX = [`%cTX:`, this.LOG_STYLE.tx];
        this.LOG_RX = [`%cRX:`, this.LOG_STYLE.rx];

        // Headers
        this.HEAD_CHECK = 0x80;
        this.HEAD_READ  = 0xA0;
        this.HEAD_WRITE = 0xC0;
        this.HEAD_EXTENDED  = 0xE0;
        this.HEAD_CMD = 0x00;
        this.HEAD_REG = 0x80;

        // comandos
        this.CMD_DEVICE_ID_L        = 0x00;
        this.CMD_DEVICE_ID_H        = 0x01;
        this.CMD_LOT_L              = 0x02;
        this.CMD_LOT_H              = 0x03;
        this.CMD_LOT_DATE_L         = 0x04;
        this.CMD_LOT_DATE_H         = 0x05;
        this.CMD_FOXWIRE_VERSION_ID = 0x06;
        this.CMD_FIRMWARE_ID        = 0x07;
        this.CMD_FIRMWARE_VERSION   = 0x08;
        this.CMD_REQUEST_WRITE      = 0x09;
        this.CMD_MCU_RESET          = 0x0A;
        this.CMD_MCU_VOLTAGE        = 0x0B;
        this.CMD_MCU_TEMPERATURE    = 0x0C;
        this.CMD_READ               = 0x0D;
        
        // comandos com valor
        this.CMD2_SAVE              = 0x01;
        this.CMD2_RESTORE           = 0x02;
        this.CMD2_RESTORE_KEPP_ADDR = 0x03;
        
        // Registradores fixos
        this.REG_ADDR = 0x00;
        this.REG_CTRL = 0x01;
    }

    /*------------------
       logging
    ------------------*/
    
    log(level, ...args) {
        if (this.logLUT[level] > this.logLUT[this.logLevel]) return;

        const tag    = level.toUpperCase();
        const prefix = `[FoxWire][${tag}]`;
        const style  = this.LOG_STYLE[level];

        // log já estilizado?
        if (typeof args[0] === "string" && args[0].includes("%c")) {

            // prefix entra como %c também
            if (style) {
                console.log(
                    `%c${prefix} ` + args[0],
                    style,
                    ...args.slice(1)
                );
            } else {
                console.log(
                    `${prefix} ` + args[0],
                    ...args.slice(1)
                );
            }

            return;
        }

        // log normal
        if (style) {
            console.log(`%c${prefix}`, style, ...args);
        } else {
            console.log(prefix, ...args);
        }
    }


    logE(...a){ this.log("error", ...a); }
    logW(...a){ this.log("warn", ...a); }
    logI(...a){ this.log("info", ...a); }
    logLL(...a){ this.log("lowLevel", ...a); }
    logML(...a){ this.log("midleLevel", ...a); }
    logHL(...a){ this.log("highLevel", ...a); }
    logA(...a){ this.log("apiLevel", ...a); }

    toHexLine(data) {
        if (!data) return "";
        if (typeof data === "number") data = [data];
        return Array.from(data, b =>
            (b & 0xFF).toString(16).toUpperCase().padStart(2, "0")
        ).join(" ");
    }

    logStatus(ok) { 
        return (ok ? this.LOG_OK : this.LOG_FAIL);
    }

    _valueLen(v) {
        if (v == null) return 0;

        if (typeof v === "number") return 1;
        if (typeof v === "string") return v.length;

        if (v instanceof Uint8Array) return v.length;
        if (v instanceof ArrayBuffer) return v.byteLength;

        if (Array.isArray(v)) return v.length;

        // fallback (obj estranho, etc)
        return 1;
    }


    logPack(name, ok, tx = null, rx = null) {
        const parts  = [];
        const styles = [];

        const txLen = this._valueLen(tx);
        const rxLen = this._valueLen(rx);

        const [statusStr, statusStyle] = this.logStatus(ok);

        parts.push(`%c${name.toUpperCase()} ${statusStr}`);
        styles.push(this.LOG_STYLE.name);
        styles.push(statusStyle);

        if (tx != null) {
            parts.push(`\n  %cTX(${txLen}): ${typeof tx === "string" ? tx : this.toHexLine(tx)}`);
            styles.push(this.LOG_STYLE.tx);
        }

        if (rx != null) {
            parts.push(`\n  %cRX(${rxLen}): ${typeof rx === "string" ? rx : this.toHexLine(rx)}`);
            styles.push(this.LOG_STYLE.rx);
        }

        return [
            parts.join(""),
            ...styles
        ];
    }

    logTx( ...a ){
        return [
            ...this.LOG_TX,
            ...a
        ];
    }

    logRx( ...a ){
        return [
            ...this.LOG_RX,
            ...a
        ];
    }


    // sempre visivel
    //_textStyled(label, style, ...a) { return [`%c${label}`, style, ...a]; }
    //logTx(...a) { return this._logFrag("TX:", this.LOG_STYLE.tx, ...a); }
    //logRx(...a) { return this._textStyled("RX:", this.LOG_STYLE.rx, ...a); }
    //logTxHex(v) { this.logTxHex( this.toHexLine(v) ); }
    //logRxHex(v) { this.logRxHex( this.toHexLine(v) ); }

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
       Low Level: _write and _read
    --------------------------------*/

    async _write(data) {
        if (!this.isConnected()) return;

        if (!this._inRequest) {
            this.logW("_write called outside request()");
        }

        const payload = this.toU8Array(data);
        if (!(payload instanceof Uint8Array)) {
            this.logE("_write: invalid payload", data);
            return;
        }

        const writer = this.port.writable.getWriter();
        try {
            await writer.write(payload);
            this.logLL("tx:", this.toHexLine(payload));
        } catch (e) {
            this.logE("_write:", e);
        } finally {
            writer.releaseLock();
        }
    }


    async _read(n = 1, timeout = this.timeoutRead) {
        if (!this.isConnected()) return new Uint8Array([]);

        if (!this._inRequest) {
            this.logW("Protocol warning: _read called outside request()");
        }

        const result = new Uint8Array(n);
        let offset = 0;

        const reader = this.port.readable.getReader();

        try {
            while (offset < n) {
                const res = await Promise.race([
                    reader.read(),
                    new Promise(r =>
                        setTimeout(() => r({ timeout: true }), timeout)
                    )
                ]);

                if (!res || res.timeout || res.done || !res.value) break;

                for (let i = 0; i < res.value.length && offset < n; i++) {
                    result[offset++] = res.value[i];
                }
            }
        } finally {
            reader.releaseLock();
        }

        const out = result.slice(0, offset);
        this.logLL("rx:", this.toHexLine(out));
        return out;
    }



    /*--------------------------------
       Midle Level: request
    --------------------------------*/

    async _withRequestLock(fn, timeout = this._requestTimeout) {
        return new Promise(resolve => {
            const task = async () => {
                try {
                    resolve(await fn());
                } catch (e) {
                    this.logE("RequestLock Fail: ",e);
                    resolve({ ok: false, data: [], error: e });
                } finally {
                    this._nextRequest();
                }
            };

            const entry = { task };

            entry.timer = setTimeout(() => {
                const i = this._requestQueue.indexOf(entry);
                if (i >= 0) {
                    this._requestQueue.splice(i, 1);
                    this.logW("requestLock timeout");
                    resolve({ ok: false, data: [], error: "lock-timeout" });
                }
            }, timeout);

            this._requestQueue.push(entry);

            // WARN se fila crescendo demais
            const pending = this._requestQueue.length + (this._requestBusy ? 1 : 0);
            if (pending > 3) {
                this.logW(
                    `RequestLock congestion: ${pending} pending requests`
                );
            }

            this._pumpRequest();
        });
    }

    _pumpRequest() {
        if (this._requestBusy) return;
        const entry = this._requestQueue.shift();
        if (!entry) return;

        clearTimeout(entry.timer);
        this._requestBusy = true;
        entry.task();
    }

    _nextRequest() {
        this._requestBusy = false;
        this._pumpRequest();
    }

    async request(data, sizeIn = 1, timeout = this.timeoutRead) {
        if (!this.isConnected()) {
            return { ok: false, data: new Uint8Array([]) };
        }

        return this._withRequestLock(async () => {

            data = this.toU8Array(data);
            const sizeOut = data.length;

            this._inRequest = true;
            // write
            await this._write(data);
            // read
            const rx = await this._read(sizeOut + sizeIn, timeout);
            this._inRequest = false;

            // process
            const payload = rx.slice(sizeOut); // remove eco
            const ans = {
                ok: payload.length === sizeIn,
                data: payload
            };

            this.logML(
                ...this.logPack('request',ans.ok, data, payload )
            );

            return ans;
        });
    }

    async send(...args) {
        if (!this._warnedSendDeprecated) {
            this._warnedSendDeprecated = true;
            this.logW("send() is deprecated, use request() instead");
        }
        return this.request(...args);
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

        return await this.request(packet, sizeIn);
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
        this.logI(
            ...this.logPack(
                `[DEV-${addr}] check`,
                ansOut.ok
            ),
            ':',
            ansOut.arg
        );
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
        const keyIn = await this.command( addr, this.CMD_REQUEST_WRITE );
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
            dataAddr&0xFF,
            (dataAddr>>8)&0xFF
        ];

        // por enquanto só le reg
        const crc = this.checksum(packet) & 0xFFFF;

        // CRC u16 little-endian
        packet.push(crc & 0xFF);        // LSB
        packet.push((crc >> 8) & 0xFF); // MSB

        const ans = await this.request( this.toU8Array(packet), size+2 );
        let ansOut = { ok: false, data: [], crc: 0 };

        if ( !ans || !ans.ok || !ans.data || ans.data.length <= 2 ) {
            this.logHL(
                ...this.logPack( 
                    `[EXTENDED-READ]`,
                    false
                )
            );
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

        this.logML(
            ...this.logPack( 
                `[EXTENDED-READ]`,
                ansOut.ok,
                null,
                ans.data
            )
        );

        return ansOut;
    }

    /*--------------------------------
       High Level comamnds
    --------------------------------*/

    async scan({ getId = false } = {}) {
        const devices = new Map();

        for (let addr = 0; addr <= 0x1F; addr++) {
            const ans = await this.check(addr);
            if (!ans?.ok) continue;

            const info = {};

            if (getId) {
                const idAns = await this.getID(addr);
                info.id = idAns?.ok ? idAns.data : null;
            }

            devices.set(addr, info);
        }

        return devices;
    }


    // Comando de reset
    async reset(addr) {
        return await this.command( addr, this.CMD_MCU_RESET );
    }

    // Comando de read
    async read(addr) {
        return await this.command( addr, this.CMD_READ );
    }

    // Comando de save
    async save(addr) {
        return await this.commandKey( addr, CMD2_SAVE );
    }

    // Comando de default keep addr
    async default(addr) {
        return await this.commandKey( addr, CMD2_RESTORE_KEPP_ADDR );
    }

    // get ID
    async getID(addr) {
        const ID_L = await this.command(addr,this.CMD_DEVICE_ID_L);
        const ID_H = await this.command(addr,this.CMD_DEVICE_ID_H);
        if (ID_L.ok && ID_H.ok) {
            return { ok: true, data: ((ID_H.data<<8)|ID_L.data) };
        }
        return { ok: false, data: 0 };
    }

    // get Firmware Version
    async getFirmwareVersion(addr) {
        const FW_ID  = await this.command(addr,this.CMD_FIRMWARE_ID);
        const FW_VER = await this.command(addr,this.CMD_FIRMWARE_VERSION);
        if (FW_ID.ok && FW_VER.ok) {
            return { ok: true, data: (FW_ID.data*1000 + FW_VER.data) };
        }
        return { ok: false, data: 0 };
    }

    // get ID
    async getLot(addr) {
        const pipeline = [
            this.CMD_LOT_DATE_H,
            this.CMD_LOT_DATE_L,
            this.CMD_LOT_H,
            this.CMD_LOT_L
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
    async readType(deviceAddr, dataAddr, type = 'u8', len = 1, useExtended=true, littleEndian = true) {
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

        
        let ok = false;

        // Modo Extended
        // ideal para muitos bytes
        if( useExtended ){
            const ans = await this.extendedRead(
                deviceAddr, 0x0400 + dataAddr, totalBytes
            );
            if( ans?.ok ){
                ok = true;
                bytes = ans.data;
            }
        }

        // modo classico de Leitura byte a byte
        // (lento pra varios bytes)
        if( !ok ){
            if( (totalBytes + dataAddr) > 32 ){
                this.logW( "readType cannot read address register bigger than 31 with READ pack, use extended" );
            }else{
                ok = true;
                for (let i = 0;i < totalBytes; i++) {
                    const ans = await this.registerRead(
                        deviceAddr, dataAddr + i 
                    );
                    if (ans?.ok){
                        bytes.push(ans.data & 0xFF);
                        continue;
                    }
                    ok = false;
                    break;
                }
            }
        }

        const ret = ok ? bytesToTypedValue( this.toU8Array(bytes), type, littleEndian ) : null;
        this.logA(
            ...this.logPack(
                `[DEV-${deviceAddr}] ReadType<${type}-0x${dataAddr.toString(16)}>`,
                ok
            ),
            ":",
            ret,
            bytes
        );

        return ret;
    }

}
