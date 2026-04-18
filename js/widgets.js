
import * as utils from "./utils.js";

const TypeRules = {
    u8: {
        min: 0,
        max: 255,
        len: 1
    },

    i8: {
        min: -127,
        max: 128,
        len: 1
    },

    i16: {
        min: -32768,
        max: 32767,
        len: 2
    },

    u16: {
        min: 0,
        max: 65535,
        len: 1
    },

    str: {
        len: 16 // default
    }
};

export class Widget {
    constructor(opts) {
        
        this.name = opts.name || 'name';
        this.type = opts.type || 'int';

        // Output Formato de saida
        this.outputType = this.type == 'string' ? 'str' : (opts.outputType || 'u8'); // u8, i16, string...
        this.endian = (opts?.endian === 'big') ? 'big' : 'little';

        // Comprimento da variavel
        this.outputLen = TypeRules[this.outputType].len * ( opts.size || 1 );
        if( this.outputType == 'str' && opts.outputLen )
            this.outputLen = opts.outputLen;
        
        //this.value = opts.value ?? 0;
        this.checkOptions   = opts.checkOptions || ["bit0"];
        this.selOptions     = opts.selOptions || {"sel0":0};
        this.checkBaseValue = opts.checkBaseValue || 0;

        // Propriedade do tipo
        this.real =
            this.type == 'multiChannels' ?
            { min: 0, max: 2**(8*this.outputLen) } ://(1<<(this.outputLen<<3))-1 } :
            TypeRules[this.outputType]
        ; // min/max naturais

        if( this.type == "multiChannels" ){
            console.log("multiChannels -> ",this.real, this.outputLen);
        }

        // Valor abstrato
        // Exemplo: valor de um canal varia de 1000 a 2000 mas é u8 -> 0, 255
        this.abstract = null;
        if (opts.abstract) {
            this.abstract = {
                min: opts.abstract[0],
                max: opts.abstract[1],
            };
        }
        this.abstractOriginal = this.abstract;

        // Limites válidos (subconjunto do real ou do abstrato)
        // Para casos em que valores possiveis não fazem sentido
        // Ex: Endereço, só pode de 0 a 31
        this.realLimit = {
            min: this.real.min,
            max: this.real.max,
        };

        console.log( `wg-${this.name} limit: `, opts.limit );
        
        if( opts.limit ){
            this.realLimit.min = Math.max(
                this.realLimit.min,
                opts.limit[0]
            );
            this.realLimit.max = Math.min(
                this.realLimit.max,
                opts.limit[1]
            );
            console.log( `wg-${this.name} this.realLimit: `, this.realLimit );
        }else if (opts.abstractLimit && this.abstract) {
            this.realLimit.min = Math.max(
                this.realLimit.min,
                this.realFromAbstract(opts.abstractLimit[0])
            );
            this.realLimit.max = Math.min(
                this.realLimit.max,
                this.realFromAbstract(opts.abstractLimit[1])
            );
        }

        this.slide = {
            mask: 0xFFFF,
            min: this.realLimit.min,
            max: this.realLimit.max,
            offset: 0,
            bit_size: 8,
            abstract: {
                min: this.abstract?.min || this.realLimit.min,
                max: this.abstract?.max || this.realLimit.max
            } 
        };

        // SÓ USE "slideRange" PRA SLIDE + CHECK !!
        if (
            opts.slide?.offset != null &&
            opts.slide?.bit_size != null
        ) {
            this.slide.offset = opts.slide.offset;
            this.slide.bit_size = opts.slide.bit_size;
            this.slide.mask = ((1<<(this.slide.bit_size))-1);
            if( opts.slide.range ){
                this.slide.min = opts.slide.range[0];
                this.slide.max = opts.slide.range[1];
            }else{
                this.slide.min = 0;
                this.slide.max = (1<<(this.slide.bit_size))-1;
            }
            if( opts.slide.abstract ){
                this.slide.abstract.min = opts.slide.abstract[0];
                this.slide.abstract.max = opts.slide.abstract[1];
            }
        }


        // status
        this.STATUS_NONE    = 0; // vermelho
        this.STATUS_APPLIED = 1; // amarelo
        this.STATUS_SAVED   = 2; // azul
        this.STATUS_SAVED_AND_APPLIES =  // verde
            this.STATUS_APPLIED | 
            this.STATUS_SAVED;
        this.status = this.STATUS_NONE;
        
        this.defaultValue = opts.defaultValue ?? this.realFromAbstract(opts.defaultValueAbs) ?? 0;
        this.savedValue   = 0;
        this.currentValue = 0;
        this.appliedValue = 0;
        this.isSaved      = false;
        this.isApplied    = false;

        this.el = document.createElement('div');
        this.el.className = 'widget';

        this.change_callback = null;

        this.unit = opts.unit ?? "";

        // action
        this.actions = [];
        this.isBlocked = false;

        this.opts = opts;

        //console.log(
        //    `Wg-${this.name} | ` +
        //    `real=${this.currentValue} ` +
        //    `[type:${this.real.min}..${this.real.max}] ` +
        //    `[limit:${this.realLimit.min}..${this.realLimit.max}] ` +
        //    (this.abstract
        //        ? `[abstract:${this.abstract.min}..${this.abstract.max}]`
        //        : `[abstract:none]`)
        //);

        this.render();

        this.setSavedValue( this.defaultValue );
    }

    /* =================================================
      RENDER
    ================================================= */
    render() {
        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${this.name}</span>
                <div class="widget-main"></div>
                <div class="widget-right">
                    <span class="return-btn" title="Retornar salvo">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            width="16" height="14"
                            fill="currentColor"
                            class="return-icon"
                            viewBox="0 0 16 14">
                            <path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5"/>
                        </svg>
                    </span>
                    <span class="home-btn" title="valor padrão">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            width="16" height="16"
                            fill="currentColor"
                            class="home-icon"
                            viewBox="0 0 16 16">
                            <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z"/>
                            <path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z"/>
                        </svg>
                    </span>
                    <span class="wg-status" title="status:\nverde: salvo e aplicado\nazul: salvo apenas\namarelo: aplicado apenas\nvermelho: nem salvo nem aplicado"></span>
                </div>
            </div>
        `;

        /*
        // tooltip do status
        <span class="status">
            <div class="widget_tooltip">
                <div class="green">Verde: salvo e aplicado</div>
                <div class="blue">Azul: salvo apenas</div>
                <div class="yellow">Amarelo: aplicado apenas</div>
                <div class="red">Vermelho: nem salvo nem aplicado</div>
            </div>
        </span>
        */

        this.elRow    = this.el.querySelector('.widget-row');
        this.elMain   = this.el.querySelector('.widget-main');
        this.elHome   = this.elRow.querySelector('.home-btn');
        this.elReturn = this.elRow.querySelector('.return-btn');

        // Home button
        this.elHome.onclick = () => {
            this.setValue(this.defaultValue);
        };
        
        // Return button
        this.elReturn.onclick = () => {
            this.setValue(this.savedValue);
        };

        // Caixa a direita com o Valor Real e Status
        if( this.outputType != 'str' ){
            const right = this.el.querySelector('.widget-right');
            // real-input
            //<span class="real-value editable" title="register value">[${this.currentValue}]</span>
            // <input class="wg wg-input--real"
            right.insertAdjacentHTML('afterbegin', `
                <span class="wg-input-hide" title="register value" data-wg="${this.type}">[${this.currentValue}]</span>
                <input class="wg-input-hide"
                    data-wg="${this.type}"
                    type="number"
                    min="${this.realLimit.min}"
                    max="${this.realLimit.max}">
            `);
            //this.elRealSpan = this.el.querySelector('.real-value:not(.abs)');
            this.elRealInp   = this.el.querySelector('input.wg-input-hide');
            this.elRealSpan  = this.el.querySelector('span.wg-input-hide');
            utils.makeEditable( this.elRealSpan, this.elRealInp, v => this.setValue(v) );
        }
        this.elStatus = this.el.querySelector('.wg-status');

        // renderiza o restante em função do tipo
        if( this.type == 'int' ){ this.renderInt();}
        else if( this.type == 'slide' ){ this.renderSlide();}
        else if( this.type == 'check' ){ this.renderCheck();}
        else if( this.type == 'slideCheck' ){ this.renderSlide(); this.renderCheck(); }
        else if( this.type == 'string' ){ this.renderString();}
        else if( this.type == 'select' ){ this.renderSelect();}
        else if( this.type == 'multiChannels' ){ this.renderMultichannels();}
        else if( this.type == 'color8' ){ this.renderColor8();}
        else if( this.type == 'rtttl' ){ this.renderRTTTL();}

        if( this.type == 'int' || this.type == 'select' || this.type == 'string' ){
            this.elAbsInp   = this.el.querySelector('.wg-input');
            this.elAbsInp.onchange = () => {
                //console.log(`set: ${this.elAbsInp.value}`);
                this.setFromAbstract(this.elAbsInp.value);
            };
        }

        this.isApplied = true;
    }

    renderInt() {
        this.elMain.innerHTML = `
            <input class="wg-input" type="number" data-wg=${this.type}>
        `;
    }

    renderMultichannels() {

        this.multiChannels = {};

        const grid = document.createElement("div");
        grid.className = "wg-multi-grid";

        const optDefault = this.opts.optionsDefault;
        const options = this.opts.options;

        const totalValue = Number(this.currentValue) || 0;

        this.channelMap = {};

        // helper: resolve cor
        const resolveColor = (color) => {
            if (!color || color === "normal") return "";
            if (color === "off") return "#6c6c6c";
            return color; // aceita hex ou nome direto
        };

        for (const name in options) {
            let opt = options[name];

            // --------------------------
            // resolve config do campo
            // --------------------------
            let cfg = {};
            let bitOffset = 0;

            if (typeof opt === "number") {
                bitOffset = opt;
                cfg = { ...optDefault };
            } else {
                bitOffset = opt.offset ?? 0;
                cfg = { ...optDefault, ...opt };
            }

            const { bit_size, range, prefix, special_values, color } = cfg;
            const [min, max] = range;

            const mask = (1 << bit_size) - 1;

            const item = document.createElement("div");
            item.className = "wg-multi-item";

            // LABEL
            const label = document.createElement("span");
            label.className = "wg-multi-label";
            label.innerText = name;

            // SELECT
            const select = document.createElement("select");
            select.className = "wg-input";

            // gera opções
            for (let i = min; i <= max; i++) {
                const optEl = document.createElement("option");
                optEl.value = i;

                if (special_values && special_values[i]) {
                    optEl.innerText = special_values[i].name;

                    const c = resolveColor(special_values[i].color);
                    if (c) optEl.style.color = c;
                } else {
                    optEl.innerText = `${prefix}${i}`;

                    const c = resolveColor(color);
                    if (c) optEl.style.color = c;
                }

                select.appendChild(optEl);
            }

            // extrai valor atual
            const current = (totalValue >> bitOffset) & mask;

            select.value = current;

            // aplica cor inicial no select
            const applySelectColor = () => {
                const val = Number(select.value);

                if (special_values && special_values[val]) {
                    select.style.color = resolveColor(special_values[val].color);
                } else {
                    select.style.color = resolveColor(color);
                }
            };

            applySelectColor();


            this.multiChannels[name] = {
                offset: bitOffset,
                bit_size,
                mask,
                select,
                cfg,
                applyColor: applySelectColor
            };

            // evento change
            select.onchange = () => {
                const val = Number(select.value);

                let newValue = Number(this.currentValue) || 0;

                newValue &= ~(mask << bitOffset);
                newValue |= (val & mask) << bitOffset;

                this.setValue(newValue);

                applySelectColor();
            };

            item.appendChild(label);
            item.appendChild(select);
            grid.appendChild(item);
        }

        this.el.appendChild(grid);
    }

    renderSelect() {
        this.select = document.createElement("select");
        this.select.className = "wg-input";
        this.select.dataset.wg = `${this.type}`;
        
        for( const option in this.selOptions ){
            const opt = document.createElement("option");
            opt.value = option;
            opt.innerText = option;
            if (option === this.defaultValue) {
                opt.selected = true;
            }
            this.select.appendChild(opt);
        }
        
        //this.select.onchange = () => {
        //    console.log(`select: ${this.select.value}`);
        //    this.setValue( this.select.value );
        //};

        this.elMain.appendChild(this.select);
    }

    renderString() {
        this.elMain.innerHTML = `
            <input type="text" class="wg-input" data-wg="${this.type}" value="${this.currentValue}" maxlength="${this.outputLen-1}">
        `;
    }

    renderSlide() {
        this.elMain.innerHTML = `
            <span class="wg-input-hide wg-left" title="physical value">${(this.currentValue>>this.slide.offset)&this.slide.mask}</span>
            <input class="wg-input-hide" type="number">
            <input class="wg-input" type="range"
                data-wg="${this.type}"
                min="${this.slide.min}"
                max="${this.slide.max}"
            >
        `;
        this.elHideAbsInp  = this.elMain.querySelector('input.wg-input-hide');
        this.elHideAbsSpan = this.elMain.querySelector('span.wg-input-hide');
        //utils.makeEditable(this.elHideAbsSpan, this.elHideAbsInp, (v) => {
        //    
        //    this.setFromAbstract(v)
        //});
        
        this.elRealInp2 = this.elMain.querySelector('.wg-input');
        if( this.type == "slideCheck" ){
            this.elRealInp2.onchange = (v) => {
                let value = (this.elRealInp2.value<<this.slide.offset) | this.getCheckValue();
                this.setValue(value);
            };
        }else{
            this.elRealInp2.onchange = () => {
                this.setValue(this.elRealInp2.value);
            };
        }
        // Atualiza visual enquanto arrasta
        this.elRealInp2.addEventListener('input', () => {
            let v = (this.elRealInp2.value << this.slide.offset);
            //v = this.clamp(v);
            this.setAbsSpanText( this.abstractFromReal(v) );
        });
    }

    color8_to_hue(h_bin){ return Math.ceil(180*(h_bin)/63); }
    color8_to_hue_bin(h){ return (h*63/180)&63; }
    color8_to_bright(b_bin){ return (b_bin*100/3)|0; }
    color8_to_bright_bin(b){ return Math.ceil(3*b/100); }

    color8_from_bin(x){
        return { 
            v: this.color8_to_bright(x&3),
            h: this.color8_to_hue(x>>2)
        };
    }

    color8_join_bin(h_bin,v_bin){
        console.log( "color8_join_bin -> ", h_bin, v_bin );
        return ((h_bin<<2)|(v_bin&3));
    }

    color8_to_bin(h,v){
        const h_bin = this.color8_to_hue_bin(h);
        const v_bin = this.color8_to_bright_bin(v);
        console.log( "color8_to_bin -> ",h, v, " -> ",h_bin, v_bin );
        return this.color8_join_bin(h_bin,v_bin);
    }


    renderColor8(){

        this.elColor8 = document.createElement('div');
        this.elColor8.innerHTML = `
            <div class="wg-color8">
                <div class="wg-color8-left">
                    <div class="wg-color8-row">
                        <span class="wg-input-hide"></span>
                        <input class="wg-input-hide" type="number">
                        <input class="wg-color-input wg-hue" type="range" min="0" max="63" value="0">
                    </div>
                    <div class="wg-color8-row">
                        <span class="wg-input-hide"></span>
                        <input class="wg-input-hide" type="number">
                        <input class="wg-color-input wg-bright" type="range" min="0" max="3" value="0">
                    </div>
                </div>
                <div class="wg-color8-preview"></div>
            </div>
        `;

        this.el.appendChild(this.elColor8);

        const spans   = this.elColor8.querySelectorAll('span.wg-input-hide');
        const sliders = this.elColor8.querySelectorAll('input[type="range"]');
        const numInp = this.elColor8.querySelectorAll('input[type="number"]');

        const hueInp = numInp[0];
        const brightInp = numInp[1];

        const hueSlider = sliders[0];
        const brightSlider = sliders[1];

        const hueSpan = spans[0];
        const brightSpan = spans[1];

        const preview = this.elColor8.querySelector('.wg-color8-preview');

        // função central (recalcula valor final)
        const updateValue_fromSlides = () => {
            const newValue = this.color8_join_bin(
                Number(hueSlider.value),
                Number(brightSlider.value)
            );
            this.color8_updateUI(newValue);
            this.setValue(newValue);
        };

        const updateValue_fromInp = () => {
            const newValue = this.color8_to_bin(
                Number(hueInp.value),
                Number(brightInp.value)
            );
            this.color8_updateUI(newValue);
            this.setValue(newValue);
        };

        const update_preview = (x) => { 
            const color = this.color8_from_bin(x);
            preview.style.background = `hsl(${color.h<<1}, 100%, ${color.v/2}%)`;
        }
        
        const update_preview_live = () => { 
            update_preview(
                this.color8_join_bin(
                    Number(hueSlider.value),
                    Number(brightSlider.value)
                )
            );
        }

        const update_hueSpan = (h) => { hueSpan.textContent = `${h}`; }
        const update_brightSpan = (v) => { brightSpan.textContent = `${v}`; }

        this.color8_updateUI = (x) => {
            const color = this.color8_from_bin(x);
            console.log( "color8_updateUI", x, color );
            hueInp.value = color.h;
            brightInp.value = color.v;
            update_hueSpan(color.h);
            update_brightSpan(color.v);
            hueSlider.value = (x>>2)&63;
            brightSlider.value = (x&3);
            update_preview( x );
        };

        //this.color8_updateUI(this.currentValue);

        utils.makeEditable(hueSpan, hueInp, updateValue_fromInp );
        utils.makeEditable(brightSpan, brightInp, updateValue_fromInp );

        hueSlider.onchange = updateValue_fromSlides;
        brightSlider.onchange = updateValue_fromSlides;

        // eventos
        brightSlider.addEventListener('input', (e) => { update_brightSpan(this.color8_to_bright(e.target.value)); update_preview_live(); });
        hueSlider.addEventListener('input', (e) => { update_hueSpan( this.color8_to_hue(e.target.value)); update_preview_live(); });

    }

    playRTTTL_local(str) {
        console.log("Play local:", str);

        // placeholder (depois você liga parser RTTTL)
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();

        osc.type = "square";
        osc.frequency.value = 440;

        osc.connect(ctx.destination);
        osc.start();

        setTimeout(() => osc.stop(), 300);
    }

    renderRTTTL() {
        this.elRTTTL = document.createElement('div');

        this.elRTTTL.innerHTML = `
            <div class="wg-rtttl">

                <button class="wg-rtttl-btn wg-left" title="Play on Computer">▶</button>

                <input class="wg-input wg-rtttl-input"
                    type="text"
                    placeholder="RTTTL..."
                    value="${this.currentValue || ''}"
                >

                <button class="wg-rtttl-btn wg-right" title="Play on motors">▶</button>

            </div>
        `;

        this.el.appendChild(this.elRTTTL);

        const input = this.elRTTTL.querySelector('.wg-rtttl-input');
        const btnPC = this.elRTTTL.querySelector('.wg-left');
        const btnRobot = this.elRTTTL.querySelector('.wg-right');

        // salvar valor
        input.onchange = () => {
            this.setValue(input.value);
        };

        // play local
        btnPC.onclick = () => {
            this.playRTTTL_local(input.value);
        };

        // play remoto
        btnRobot.onclick = () => {
            this.playRTTTL_robot(input.value);
        };
    }

    setAbsSpanText( v ){
        if (this.elHideAbsSpan)
            this.elHideAbsSpan.textContent = `${v}${this.unit}`
    }

    renderCheck() {

        function normalizeCheckOptions(checkOptions) {

            const result = {};
            if (!checkOptions) return {};
            // -------- ARRAY --------
            if (Array.isArray(checkOptions)) {
                checkOptions.forEach((label, i) => {
                    result[label] = i;
                });
            }

            // -------- OBJECT --------
            else if (typeof checkOptions === "object") {
                Object.entries(checkOptions).forEach(([key, value]) => {
                    // valor absoluto
                    //if (key.startsWith("$")) {
                    //    const label = key.substring(1);
                    //    result[label] = Number(value);
                    //}
                    // bit position
                    //else {
                        result[key] = Number(value);
                    //}
                });
            }

            return result;
        }

        this.elCheck = document.createElement('div');
        this.elCheck.className = "checkbox-group-vertical";

        const options = normalizeCheckOptions(this.checkOptions);

        //this._checkMap = options;

        Object.entries(options).forEach(([opt, bit]) => {
            const label = document.createElement('label');
            const chk   = document.createElement('input');
            chk.type = 'checkbox';
            chk.title = `bit ${bit}`;
            chk.className = `wg-input`;
            label.title = `bit ${bit}`;
            
            chk.dataset.value = bit;
            
            chk.onchange = () => this.updateFromChecks();
            
            label.append(chk, ' ', opt);
            this.elCheck.appendChild(label);
        });

        this.el.appendChild(this.elCheck);

        if( this.defaultValue < this.checkBaseValue ){
            this.defaultValue |= this.checkBaseValue;
        }

        this.realLimit.min |= this.checkBaseValue;
    }

    /* =================================================
      External Actions
    ================================================= */
    visible( state ){
        console.log( `[widget ${this.name}] Action -> visible=`, state );
        if( state == null ) return;
        this.isBlocked = !!state;
        this.el.classList.toggle("wg-blocked", this.isBlocked);
    }

    get( property ){
        const value = (
            (property == "reg" || property == "real" ) ?
            this.currentValue :
            ( property == 'abs' ) ?
            this.abstractFromReal( this.currentValue ) :
            null
        );
        console.log( `[widget ${this.name}] get ${property}=${value}` );
        return value;
    }

    setAction(action) {
        if (typeof action === "function") {
            this.actions.push(action);
            console.log( `[widget ${this.name}] setAction -> ${action}` );
            action();
        }
    }

    set(property, value){
        
        console.log(`[widget ${this.name}] Action -> ${property}=${value}`);
        
        if( property == null || value == null) return;
        
        const parts = property.split(".");
        const base = parts[0];          // real | reg | abs
        const sub  = parts[1] ?? null;  // limitMin | limitMax | limit | null

        const isAbs = (base === "abs");
        const isReal = (base === "real" || base === "reg");

        if( isAbs ){
            value = this.realFromAbstract(value);
            console.log(`[widget ${this.name}] Action -> convert to real value=${value}`);
        }

        // ================================
        // VALUE SET
        // ================================
        if (!sub) {
            if( isAbs || isReal )
                this.setValue(real);
            return;
        }

        // ================================
        // LIMITS
        // ================================
        if( sub && sub.startsWith("limit") ) {
            if( sub === "limitMin" ){
                this.realLimit.min = value;
                console.log(`[widget ${this.name}] Action -> this.realLimit.min=${value}`);
            }else if (sub === "limitMax") {
                this.realLimit.max = value;
                console.log(`[widget ${this.name}] Action -> this.realLimit.max=${value}`);
            }else{
                return;
            }
            this.update();
            //this.setUIlimits();
        }
    }

    /*/
    setUIlimits(){
        if( this.type == 'slide' ){
            this.elRealInp2.min = this.realLimit.min;
            this.elRealInp2.max = this.realLimit.max;
        }
        if( this.elRealInp ){
            this.elRealInp.min = this.realLimit.min;
            this.elRealInp.max = this.realLimit.max;
        }
    }
    /*/

    // força a recalcular os valores e atualizar UI
    update(){
        this.setValue( this.currentValue );
    }
        

    /* =================================================
      Tratamento dos Valores e status
    ================================================= */
    clamp(v) {
        if( this.type == 'string' ){
            return v.toString();
        }else{
            return Math.min(this.realLimit.max, Math.max(this.realLimit.min, v));
        }
    }

    setFromAbstract(a){
        this.setValue( this.realFromAbstract(a) )
    }

    abstractFromReal(v) {
        if( this.type == 'select' ){
            for( const option in this.selOptions ){
                if( this.selOptions[option] === v )
                    return option;
            }
            return v;
        }else if( this.type == 'slideCheck' ){
            return utils.intResizeClamp(
                (v>>this.slide.offset)&this.slide.mask,
                this.slide.min,
                this.slide.max,
                this.slide.abstract.min,
                this.slide.abstract.max
            );
        }else if( this.abstract ){
            return utils.intResizeClamp(
                v,
                this.real.min,
                this.real.max,
                this.abstract.min,
                this.abstract.max
            );
        }
        return v;
    }

    realFromAbstract(a) {
        if( a == null ) return null;
        if( this.type == 'select' ){
            return this.selOptions[a];
        }else if( this.abstract ){
            return utils.intResizeClamp(
                a,
                this.abstract.min,
                this.abstract.max,
                this.real.min,
                this.real.max
            );
        }
        return a;
    }

    //_checkIsSaved(v) {
    //    return this.isSaved = (v !== this.savedValue);
    //}

    updateStatus( ){
        this.isApplied = (this.currentValue == this.appliedValue);
        this.isSaved   = (this.currentValue == this.savedValue);
        this.status = (this.isSaved<<1) | this.isApplied;
    }

    setMultiChannels(v){
        // se for multiChannels e receber array
        if (this.multiChannels && Array.isArray(v)) {
            let newValue = 0;
            let shift = 0;
            for (const val of v) {
                const n = 0xFF&Number(val ?? 0);
                newValue |= (n<<shift);
                shift += 8;
            }
            v = newValue;
        }
        return v;
    }
    
    setValue(v) {
        if( this.multiChannels ) v = this.setMultiChannels(v);
        v = this.clamp(v);
        this.currentValue = v;
        this.updateUIValue();
        if( this.change_callback ){
            this.change_callback(this);
        }
    }

    setAppliedValue(v) {
        if( this.multiChannels ) v = this.setMultiChannels(v);
        v = this.clamp(v);
        this.currentValue = v;
        this.appliedValue = v;
        this.updateUIValue();
    }

    setSavedValue(v) {
        if( this.multiChannels ) v = this.setMultiChannels(v);
        v = this.clamp(v);
        this.currentValue = v;
        this.appliedValue = v;
        this.savedValue   = v;
        this.updateUIValue();
    }

    getCheckValue(){
        let value = this.checkBaseValue;
        this.elCheck.querySelectorAll("input[type=checkbox]")
            .forEach(chk => {
                if (chk.checked) {
                    value |= (1<<Number(chk.dataset.value));
                }
            });
        return value;
    }

    updateFromChecks(){
        let value = this.getCheckValue();
        if( this.type == "slideCheck" ){
            value |= ( this.currentValue & (this.slide.mask<<this.slide.offset) );
        }
        this.setValue(value);
    }

    updateUIValue(){

        this.updateStatus();

        //console.log(
        //    `Wg-${this.name} | ` +
        //    `real=${this.currentValue} ` +
        //    `sel=${ this.elAbsInp?.value || 0 } `
        //);

        if (this.elHome) {
            this.elHome.classList.toggle(
                'wg-active',
                this.currentValue == this.defaultValue
            );
        }

        if (this.elReturn) {
            this.elReturn.classList.toggle(
                'wg-active',
                this.isSaved
            );
        }

        if( this.color8_updateUI ){
            this.color8_updateUI(this.currentValue);
        }

        // set Abstract value
        const abstract = this.abstractFromReal( this.currentValue );

        //console.log( "UI-Abstract:", abstract );
        //console.log( "UI-Value:", this.currentValue );

        [
            this.elHideAbsInp,
            this.elAbsInp
        ].forEach(el => {
            if (!el) return;   // se não existe, ignora
            el.value = abstract;
        });

        // set Real value
        [
            this.elRealInp,
            this.elRealInp2,
        ].forEach(el => {
            if (!el) return;   // se não existe, ignora
            el.value = (
                this.type == "slideCheck" ?
                (this.currentValue>>this.slide.offset)&this.slide.mask :
                this.currentValue
            );
        });

        if( this.elCheck ){
            let value = Math.max( 0, this.currentValue - this.checkBaseValue );
            [...this.elCheck.querySelectorAll('input')].forEach((chk, i) => {
                chk.checked = (value>>chk.dataset.value) & 1;
            });
        }

        if (this.multiChannels ) {
            let value = Number(this.currentValue) || 0;

            for (const name in this.multiChannels) {
                const ch = this.multiChannels[name];

                const fieldValue = (value >> ch.offset) & ch.mask;

                ch.select.value = fieldValue;
                ch.applyColor();
            }
        }
        
        this.setAbsSpanText( abstract );

        if (this.elRealSpan){
            if( this.type == "multiChannels" ){
                const bytes = this.outputLen;
                const hex = Number(this.currentValue)
                    .toString(16)
                    .padStart(bytes * 2, "0") // 2 dígitos por byte
                    .toUpperCase();
                this.elRealSpan.textContent = `[0x${hex}]`;
            }else{
                this.elRealSpan.textContent = `[${this.currentValue}]`;
            }
        }
        if (this.elStatus){
            this.elStatus.classList.toggle('wg-saved', this.isSaved);
            this.elStatus.classList.toggle('wg-applied', this.isApplied);
        }

        for (const action of this.actions) {
            console.log(`[widget ${this.name}] action:`, action);
            action();
        }
    }

    /* =================================================
      Data out. Gera o array de dados de escrita
    ================================================= */
    output() {
        let bytes = [];

        // caso especial: string
        if (this.outputType === 'str') {
            const str = String(this.currentValue);
            bytes = utils.stringToBytes(str, this.outputLen);
        }else if( this.multiChannels ){
            for (let i = 0; i < this.outputLen; i++) {
                bytes.push((this.currentValue >> (8 * i)) & 0xFF);
            }
            console.log( "multiChannels output->", bytes );
        } else {
            // tipos numéricos: u8, i8, u16, i16, ...
            const type = this.outputType;

            const signed = type.startsWith('i');          // i = signed
            const bits   = parseInt(type.slice(1), 10);   // 8, 16, ...
            const size   = bits / 8;                       // bytes

            if (![1, 2, 4].includes(size)) {
                throw new Error(`Tamanho inválido: ${type}`);
            }

            const v = Number(this.currentValue);
            bytes = utils.numberToBytes(v, size, signed, this.endian);
        }

        // converte para HEX
        return bytes;
        //.map(b =>
        //    b.toString(16).padStart(2, '0').toUpperCase()
        //);
    }

    setNameTitle( text ){
        const elName = this.el.querySelector( ".widget-name" );
        if( elName ){
            elName.title = text;
        }
    }


}
