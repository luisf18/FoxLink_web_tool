const STK_OK        = 0x10;
const STK_INSYNC   = 0x14;
const CRC_EOP      = 0x20;
const STK_GET_SYNC = 0x30;
const STK_GET_SIGN_ON = 0x31;
const STK_GET_PARAMETER = 0x41;
const STK_SET_DEVICE = 0x42;
const STK_SET_DEVICE_EXT = 0x45;
const STK_ENTER_PROGMODE = 0x50;
const STK_LEAVE_PROGMODE = 0x51;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const STK_READ_PAGE = 0x74;
const STK_READ_SIGN = 0x75;

const STK500V1_BOARDS = {
    uno: {
        name: "Arduino Uno/Nano (Atmega328p)",
        baud: 115200,
        flash: 32 * 1024 - 516, // minus bootloader
        page: 128,
        signature: 0x1E950f
    },
    uno_old: {
        name: "Arduino Nano old bootloader (Atmega328p)",
        baud: 57600,
        flash: 32 * 1024 - 2048, // minus bootloader
        page: 128,
        signature: 0x1E950f
    }
    /*/
    mega: {
        name: "Arduino Mega 2560 (Atmega2560)",
        baud: 115200,
        flash: 256 * 1024,
        page: 256,
        signature: [0x1E, 0x98, 0x01]
    },
    pro_micro: {
        name: "Pro Micro (ATmega32U4)",
        baud: 57600,
        flash: 32 * 1024,
        page: 128,
        signature: [0x1E, 0x95, 0x87]
    }
    /*/
};

/* ================= STK500V1 ================= */
export class STK500V1 {
    constructor( {boards = STK500V1_BOARDS, logFn = null} ){
        //ogFn, progressFn, boardSelect, boards = STK500V1_BOARDS, setBaudrate_callback = null }) {
        this.log = logFn || console.log;
        this.target_board = null;
        this.boards = boards;
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.synced = false;
        this.log_level = 1;
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async reset() {
        if( !this.port ){
            return;
        }
        await this.port.setSignals({ dataTerminalReady: false });
        await this.sleep(10);
        await this.port.setSignals({ dataTerminalReady: true });
        await this.sleep(400);
    }

    async read(n, timeout = 300) {
        if( !this.port ){
            return null;
        }
        let buf = [];
        const start = performance.now();
        while (buf.length < n) {
            if (performance.now() - start > timeout){
                if( this.log_level>=2 ){
                    console.log("stk read Timeout");
                    this.log("stk read Timeout");
                }
                break;
            }
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) buf.push(...value);
        }
        const data = new Uint8Array(buf.slice(0, n));
        if (data.length !== n){
            if( this.log_level>=2 ){
                this.log( `stk read error -> ${data}` );
                console.log("stk read Timeout");
            }
            return null;
        }
        return data;
    }

    async cmd(data, resp_len = 2) {
        if( !this.port ){
            return null;
        }
        const out = data instanceof Uint8Array ? data : new Uint8Array(data);
        await this.writer.write(out);
        const resp = await this.read(resp_len);
        if ( resp && resp[0] === 0x14 && resp[resp.length - 1] === 0x10){
            if(this.log_level >= 3){
                this.log( `cmd ${out} -> ${resp}` );
            }
            return resp.slice(1, resp.length - 1);
        }
        if( this.log_level >= 2 ){
            const msg = ("Erro STK: " + [...resp].map(b=>b.toString(16).padStart(2,"0")).join(" "));
            console.log( msg );
            this.log( msg );
        }
        return null;
    }

    async read_signature() {
        if( !this.port ){
            return null;
        }
        const sig = await this.cmd([STK_READ_SIGN, CRC_EOP], 5);
        return (
            sig ?
            (sig[0] << 16) | (sig[1] << 8) | sig[2] : 
            null
        );
    }

    async release_port() {
        if( this.port ){
            try {
                if (this.reader) { await this.reader.cancel(); this.reader.releaseLock(); this.reader = null; }
                if (this.writer) { this.writer.releaseLock(); this.writer = null; }
                await this.port.close();
            } catch {}
        }
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.synced = false;
    }

    async sync( port, target_board, check_signature = true ) {

        if( !port ){
            this.log(`no port`);
            return false;
        }

        // Target board
        this.target_board = target_board;
        const baud = this.boards[this.target_board].baud;
        this.log(`sync to board '${this.target_board}' @ ${baud} baud`);

        // reopen port
        this.port = port;
        await this.release_port();
        this.port = port;
        this.synced = false;
        await this.port.open({ baudRate: baud });
        this.port._baudRate = baud;

        // Reset
        this.log(`reset...`);
        await this.reset();

        // recria streams
        this.writer = this.port.writable.getWriter();
        this.reader = this.port.readable.getReader();

        // sync
        this.synced = (await this.cmd([STK_GET_SYNC, CRC_EOP])) !== null;

        if( !this.synced ){
            this.log("sync fail!");
            return false;
        }

        if(check_signature){
            const sig = await this.read_signature();
            const expected = this.boards[this.target_board].signature;
            this.log(`Signature = 0x${ sig?.toString(16) } / expected = 0x${ expected.toString(16) }`);
            if (expected && sig !== expected) {
                this.synced = false;
                this.log("ERROR: device signature mismatch!");
                return false;
            }
        }

        this.log("synced!");
        return true;
    }

    async write_flash( addr, bin, progress = {value: 0} ){
        if( !this.port || !this.synced ){
            return false;
        }

        // Firmware data
        const inputSize = bin.length;
        const pageSize  = this.boards[this.target_board].page;
        const flashSize = this.boards[this.target_board].flash; // -516 bootloader
        progress.value = 0;

        const last_addr = flashSize-1;

        if( inputSize > flashSize ){
            this.log("ERROR: firmware is larger than available flash memory");
            return false;
        }

        if( last_addr < (addr+inputSize-1) ){
            this.log(
                `ERROR: firmware size exceeds flash limit `
            + `(end=0x${last_addr.toString(16)}, `
            + `max=0x${(addr + inputSize - 1).toString(16)})`
            );
            return false;
        }

        // Enter progmode
        await this.cmd([STK_ENTER_PROGMODE, CRC_EOP]);

        for (let i = 0; i < inputSize; i += pageSize) {
            let page = bin.slice(i, i + pageSize);
            if (page.length < pageSize) page = page.concat(Array(pageSize - page.length).fill(0xFF));

            const wordAddr = addr >> 1;
            await this.cmd([STK_LOAD_ADDRESS, wordAddr & 0xFF, (wordAddr >> 8) & 0xFF, CRC_EOP]);

            const pkt = [0x64, 0x00, pageSize, 'F'.charCodeAt(0), ...page, CRC_EOP];
            await this.cmd(pkt);

            addr += pageSize;
            progress.value = Math.floor((i + page.length) / inputSize * 100);

            await this.sleep(3);
        }

        //console.log(`Página ${Math.floor(i/pageSize)}: addr=0x${(bin.addr+i).toString(16)}, size=${page.length}`);

        // Leave progmode
        await this.cmd([STK_LEAVE_PROGMODE, CRC_EOP]);
        
        return true;
    }

    async upload( bin, port, target_board, progress = {value: 0} ){
        
        if ( !bin ) {
            this.log("No file to upload!");
            return false;
        }

        if (!target_board || !this.boards[target_board]) {
            this.log(`Error: target board '${target_board}' not supported`);
            return false;
        }

        this.target_board = target_board;

        // Firmware data
        const inputSize = bin.length;
        const flashSize = this.boards[this.target_board].flash;
        const startTime = performance.now();

        this.log(`\n============================================`);
        this.log(`Upload Flash: (${((inputSize/flashSize)*100).toFixed(1)}%) ${inputSize} of ${flashSize} bytes`);
        this.log(`============================================`);

        let upload_ok = false;

        // Sync
        if( await this.sync(port,target_board,true) ){
            // Write flash
            upload_ok = await this.write_flash( 0, bin, progress );
        }
        //else{
        //    this.log("ERROR: no sync. Upload aborted.");
        //}

        // update UI
        if( upload_ok ){
            const t = ((performance.now() - startTime)/1000).toFixed(2);
            progress.value = 100;
            this.log(`done ${t}s`);
        }else{
            progress.value = 0;
            this.log(`Upload fail`);
        }

        this.log(`============================================\n`);

        // libera a porta
        await this.release_port();

        return true;
    }
}
