
// 
const TypeRules = {
    u8: {
        min: 0,
        max: 255,
    },

    i16: {
        min: -32768,
        max: 32767,
    },

    u16: {
        min: 0,
        max: 65535,
    },

    str: { }
};

class Widget {
    constructor(opts) {
        //this.opts = opts; // salva as opções caso precise reiniciar

        this.name = opts.name || 'name';
        this.type = opts.type || 'int';

        // Valores
        this.outputType = this.type == 'string' ? 'str' : (opts.outputType || 'u8'); // u8, i16, string...
        this.outputLen = opts.outputLen || (this.type == 'string' ? 16 : 1 );
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
                    <span class="status"></span>
                </div>
            </div>
        `;

        this.elRow    = this.el.querySelector('.widget-row');
        this.elMain   = this.el.querySelector('.widget-main');

        // Caixa a direita com o Valor Real e Status
        if( this.outputType != 'str' ){
            const right = this.el.querySelector('.widget-right');
            right.insertAdjacentHTML('afterbegin', `
                <span class="real-value editable">[${this.savedValue}]</span>
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
                console.log(`set: ${this.elAbsInp.value}`);
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
            <input class="abs-input string" type="text" value="${this.currentValue}" maxlength="${this.outputLen}">
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
}
