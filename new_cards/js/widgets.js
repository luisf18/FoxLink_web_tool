
// 
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

class Widget {
    constructor(opts) {
        
        this.name = opts.name || 'name';
        this.type = opts.type || 'int';

        // Output Formato de saida
        this.outputType = this.type == 'string' ? 'str' : (opts.outputType || 'u8'); // u8, i16, string...
        this.endian = (opts?.endian === 'big') ? 'big' : 'little';

        // Comprimento da variavel
        this.outputLen = TypeRules[this.outputType];
        if( this.outputType == 'str' && opts.outputLen )
            this.outputLen = opts.outputLen;
        
        //this.value = opts.value ?? 0;
        this.checkOptions = opts.checkOptions || ["bit0"];
        this.selOptions   = opts.selOptions || {"sel0":0};

        // Propriedade do tipo
        this.real = TypeRules[this.outputType]; // min/max naturais

        // Valor abstrato
        // Exemplo: valor de um canal varia de 1000 a 2000 mas é u8 -> 0, 255
        this.abstract = null;
        if (opts.abstract) {
            this.abstract = {
                min: opts.abstract[0],
                max: opts.abstract[1],
            };
        }

        // Limites válidos (subconjunto do real ou do abstrato)
        // Para casos em que valores possiveis não fazem sentido
        // Ex: Endereço, só pode de 0 a 31
        this.realLimit = {
            min: this.real.min,
            max: this.real.max,
        };
        
        if (opts.limit) {
            this.realLimit.min = Math.max(
                this.realLimit.min,
                opts.limit[0]
            );
            this.realLimit.max = Math.min(
                this.realLimit.max,
                opts.limit[1]
            );
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
        
        this.defaultValue = opts.defaultValue ?? 0;
        this.savedValue   = opts.savedValue ?? 0;
        this.currentValue = this.savedValue;
        this.dirty        = false;

        this.el = document.createElement('div');
        this.el.className = 'widget';

        console.log(
            `Wg-${this.name} | ` +
            `real=${this.currentValue} ` +
            `[type:${this.real.min}..${this.real.max}] ` +
            `[limit:${this.realLimit.min}..${this.realLimit.max}] ` +
            (this.abstract
                ? `[abstract:${this.abstract.min}..${this.abstract.max}]`
                : `[abstract:none]`)
        );

        this.render();

        this.setValue( this.currentValue );
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
                    <span class="home-btn" title="Restaurar padrão">
                        <svg xmlns="http://www.w3.org/2000/svg"
                            width="16" height="16"
                            fill="currentColor"
                            class="home-icon"
                            viewBox="0 0 16 16">
                            <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z"/>
                            <path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z"/>
                        </svg>
                    </span>
                    <span class="status" title="Salvo?"></span>
                </div>
            </div>
        `;

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
            right.insertAdjacentHTML('afterbegin', `
                <span class="real-value editable" title="register value">[${this.savedValue}]</span>
                <input class="real-input"
                    type="number"
                    min="${this.real.min}"
                    max="${this.real.max}">
            `);
            this.elRealSpan = this.el.querySelector('.real-value:not(.abs)');
            this.elRealInp  = this.el.querySelector('.real-input');
            makeEditable(this.elRealSpan, this.elRealInp, v => this.setValue(v));
        }
        this.elStatus   = this.el.querySelector('.status');

        // renderiza o restante em função do tipo
        if( this.type == 'int' ) this.renderInt();
        else if( this.type == 'slide' ) this.renderSlide();
        else if( this.type == 'check' ) this.renderCheck();
        else if( this.type == 'string' ) this.renderString();
        else if( this.type == 'select' ) this.renderSelect();

        if( this.type != 'slide' && this.type != 'check' ){
            this.elAbsInp   = this.el.querySelector('.abs-input');
            this.elAbsInp.onchange = () => {
                //console.log(`set: ${this.elAbsInp.value}`);
                this.setFromAbstract(this.elAbsInp.value);
            };
        }

    }

    renderInt() {
        this.elMain.innerHTML = `
            <input class="abs-input int" type="number">
        `;
    }

    renderSelect() {
        this.select = document.createElement("select");
        this.select.className = "abs-input select";
        
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
            <input class="abs-input string" type="text" value="${this.currentValue}" maxlength="${this.outputLen-1}">
        `;
    }
    renderSlide() {
        //<span class="real-value abs editable"></span>
        this.elMain.innerHTML = `
            <span class="hide-span slide">${this.currentValue}</span>
            <input class="hide-input slide" type="number">
            <input class="abs-input slide" type="range"
            min="${this.real.min}"
            max="${this.real.max}">
        `;
        this.elHideAbsInp   = this.el.querySelector('.hide-input');
        this.elHideAbsSpan   = this.el.querySelector('.hide-span');
        makeEditable(this.elHideAbsSpan, this.elHideAbsInp, v => this.setFromAbstract(v));
        this.elRealInp2   = this.el.querySelector('.abs-input');
        this.elRealInp2.onchange = () => {
            this.setValue(this.elRealInp2.value);
        };
    }
    renderCheck() {
        this.elCheck = document.createElement('div');
        this.elCheck.className = "checkbox-group-vertical";
        
        this.checkOptions.forEach((opt, i) => {
            const label = document.createElement('label');
            const chk   = document.createElement('input');
            chk.type = 'checkbox';

            chk.onchange = () => this.updateFromChecks();

            label.append(chk, ' ', opt);
            this.elCheck.appendChild(label);
        });
        this.el.appendChild(this.elCheck);
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
                const opt = document.createElement("option");
                if( this.selOptions[option] === v )
                    return option;
            }
            return v;
        }else if( this.abstract ){
            return intResizeClamp(
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
        if( this.type == 'select' ){
            return this.selOptions[a];
        }else if( this.abstract ){
            return intResizeClamp(
                a,
                this.abstract.min,
                this.abstract.max,
                this.real.min,
                this.real.max
            );
        }
        return a;
    }

    setValue(v) {
        v = this.clamp(v);
        this.currentValue = v;
        this.dirty = (v !== this.savedValue);
        this.updateUIValue();
    }

    setSavedValue(v) {
        v = this.clamp(v);
        this.savedValue   = v;
        this.currentValue = v;
        this.dirty        = false;
        this.updateUIValue();
    }

    updateFromChecks() {
        let v = 0;
        [...this.elCheck.querySelectorAll('input')].forEach((chk, i) => {
            if (chk.checked) v |= (1 << i);
        });
        this.setValue(v);
    }

    updateUIValue(){

        //console.log(
        //    `Wg-${this.name} | ` +
        //    `real=${this.currentValue} ` +
        //    `sel=${ this.elAbsInp?.value || 0 } `
        //);

        if (this.elHome) {
            this.elHome.classList.toggle(
                'active',
                this.currentValue == this.defaultValue
            );
        }

        if (this.elReturn) {
            this.elReturn.classList.toggle(
                'active',
                this.currentValue == this.savedValue
            );
        }

        // set Abstract value
        const abstract = this.abstractFromReal( this.currentValue );
        [
            this.elHideAbsInp,
            this.elAbsInp,
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
            el.value = this.currentValue;
        });

        if( this.elCheck ){
            [...this.elCheck.querySelectorAll('input')].forEach((chk, i) => {
                chk.checked = (this.currentValue >> i) & 1;
            });
        }
        
        if (this.elHideAbsSpan)
            this.elHideAbsSpan.textContent = `${abstract}`;
        if (this.elRealSpan)
            this.elRealSpan.textContent = `[${this.currentValue}]`;
        if (this.elStatus)
            this.elStatus.classList.toggle('ok', !this.dirty);
    }

    /* =================================================
      Data out. Gera o array de dados de escrita
    ================================================= */
    output() {
        let bytes = [];

        // caso especial: string
        if (this.outputType === 'str') {
            console.log('str.output');
            const str = String(this.currentValue);
            console.log(str);
            bytes = stringToBytes(str, this.outputLen);
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
            bytes = numberToBytes(v, size, signed, this.endian);
        }

        // converte para HEX
        return bytes;
        //.map(b =>
        //    b.toString(16).padStart(2, '0').toUpperCase()
        //);
    }


}
