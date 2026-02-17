
export class DebugLog {
    constructor(module = "?", color = "#0047de") {
        
        this.module = module;
        this.module_color = color;

        this.module_style = `color:${this.module_color};font-weight:bold`;

        this.level = "midleLevel";
        this.logLUT = {
            "error": 0,
            "warn": 1,
            "info": 2,
            "apiLevel": 3,
            "highLevel": 4,
            "midleLevel": 5,
            "lowLevel": 6
        };

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

        //this.e = this.logE;
        //this.a = this.logA;
        //this.i = this.logI;
        //this.w = this.logW;
        //this.ll = this.logLL;
        //this.hl = this.logHL;
        //this.ml = this.logML;
    }

    /*------------------
       logging
    ------------------*/

    log(level, ...args) {
        if (this.logLUT[level] > this.logLUT[this.level]) return;

        const tag    = level.toUpperCase();
        const style  = this.LOG_STYLE[level];

        // log já estilizado?
        if (typeof args[0] === "string" && args[0].includes("%c")) {

            // prefix entra como %c também
            if (style) {
                console.log(
                    `%c[${this.module}]%c[${tag}] ` + args[0],
                    this.module_style,
                    style,
                    ...args.slice(1)
                );
            } else {
                console.log(
                    `[${this.module}][${tag}] ` + args[0],
                    ...args.slice(1)
                );
            }

            return;
        }

        // log normal
        if (style) {
            console.log(`%c[${this.module}]%c[${tag}] `, this.module_style, style, ...args);
        } else {
            console.log(prefix, ...args);
        }
    }


    e(...a){ this.log("error", ...a); }
    w(...a){ this.log("warn", ...a); }
    i(...a){ this.log("info", ...a); }
    ll(...a){ this.log("lowLevel", ...a); }
    ml(...a){ this.log("midleLevel", ...a); }
    hl(...a){ this.log("highLevel", ...a); }
    a(...a){ this.log("apiLevel", ...a); }

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

    packE( name, ok, tx = null, rx = null ){
        this.e( ...this.logPack(name,ok,tx,rx) );
    }
    packW( name, ok, tx = null, rx = null ){
        this.w(...this.logPack(name,ok,tx,rx) );
    }
    packI( name, ok, tx = null, rx = null, txt = "" ){
        this.i(...this.logPack(name,ok,tx,rx,txt) );
    }
    packA( name, ok, tx = null, rx = null ){
        this.a(...this.logPack(name,ok,tx,rx) );
    }
    packLL( name, ok, tx = null, rx = null ){
        this.ll(...this.logPack(name,ok,tx,rx) );
    }
    packML( name, ok, tx = null, rx = null ){
        this.hl(...this.logPack(name,ok,tx,rx) );
    }
    packHL( name, ok, tx = null, rx = null ){
        this.hl(...this.logPack(name,ok,tx,rx) );
    }

    logPack(name, ok, tx = null, rx = null, txt = "") {
        const parts  = [];
        const styles = [];

        const txLen = this._valueLen(tx);
        const rxLen = this._valueLen(rx);

        const [statusStr, statusStyle] = this.logStatus(ok);

        if( txt.length ){
            txt += " ";
        }

        parts.push(`%c${name.toUpperCase()} ${txt}${statusStr}`);
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
}