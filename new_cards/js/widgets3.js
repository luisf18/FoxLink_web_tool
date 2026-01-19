
// 
const TypeRules = {
    u8: {
        min: 0,
        max: 255,
        clamp: v => Math.min(255, Math.max(0, v)),
        toAbstract: v => v * 4 + 200,      // exemplo
        toReal: a => Math.round((a - 200) / 4)
    },

    i16: {
        min: -32768,
        max: 32767,
        clamp: v => Math.min(32767, Math.max(-32768, v))
    },

    string: {
        clamp: v => v.toString()
    }
};


class Widget {
    constructor( savedValue, defaultValue, type ) {
        this.type         = type;        // u8, i16, string...
        this.savedValue   = savedValue;
        this.currentValue = savedValue;
        this.defaultValue = defaultValue;
        this.dirty        = false;
        // cria a div do widget
        this.el = document.createElement('div');
        this.el.className = 'widget';
    }

    clamp(v) {
        return TypeRules[this.type].clamp(v);
    }

    abstractFromReal(v) {
        return TypeRules[this.type].toAbstract?.(v) ?? v;
    }

    realFromAbstract(a) {
        return TypeRules[this.type].toReal?.(a) ?? a;
    }

    setValue(v) {
        v = this.clamp(v);
        this.currentValue = v;
        this.dirty = (v !== this.savedValue);
        this.updateStatus();
    }

    setSavedValue(v) {
        v = this.clamp(v);
        this.savedValue   = v;
        this.currentValue = v;
        this.dirty        = false;
        this.updateStatus();
    }

    updateStatus() {
        if (this.statusEl)
            this.statusEl.classList.toggle('ok', !this.dirty);
    }
}


class IntWidget extends Widget {
    constructor( name, savedValue, defaultValue=0, type='u8' ) {
        super( savedValue, defaultValue, type );

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>

                <input class="abs-input" type="number">

                <div class="widget-right">
                    <span class="real-value editable"></span>
                    <input class="real-input" type="number">
                    <span class="status"></span>
                </div>
            </div>
        `;

        this.absInp   = this.el.querySelector('.abs-input');
        this.realSpan = this.el.querySelector('.real-value:not(.abs)');
        this.realInp  = this.el.querySelector('.real-input');
        this.statusEl = this.el.querySelector('.status');

        makeEditable(this.realSpan, this.realInp, v => this.setFromReal(v));

        this.setFromReal(savedValue);
        this.setSavedValue(savedValue);
    }

    setFromReal(v) {
        v = this.clamp(v);

        this.realSpan.textContent = `[${v}]`;
        this.realInp.value = v;

        const abs = this.abstractFromReal(v);
        this.absInp.value = abs;

        this.setValue(v);
    }

    setFromAbstract(a) {
        const v = this.realFromAbstract(a);
        this.setFromReal(v);
    }
}

class SlideWidget extends IntWidget {
    constructor({ name, type, savedValue, defaultValue }) {
        super({ name, type, savedValue, defaultValue });

        // cria slider
        this.slider = document.createElement('input');
        this.slider.type = 'range';

        const rule = TypeRules[type];
        this.slider.min = rule.min;
        this.slider.max = rule.max;

        // insere ANTES do widget-right
        const row = this.el.querySelector('.widget-row');
        row.insertBefore(this.slider, row.querySelector('.widget-right'));

        // eventos
        this.slider.oninput = () => {
            this.setFromReal(Number(this.slider.value));
        };

        // sincroniza estado inicial
        this.slider.value = savedValue;
    }

    setFromReal(v) {
        super.setFromReal(v);
        this.slider.value = v;
    }
}


class CheckWidget extends Widget {
    constructor(name, options, savedValue = 0) {
        super({ savedValue, defaultValue: 0, type: 'u8' });

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>

                <div class="widget-right">
                    <span class="real-value editable"></span>
                    <input class="real-input" type="number">
                    <span class="status"></span>
                </div>
            </div>
            <div class="checkbox-group-vertical"></div>
        `;

        this.byteSpan = this.el.querySelector('.real-value');
        this.byteInp  = this.el.querySelector('.real-input');
        this.statusEl = this.el.querySelector('.status');
        this.group    = this.el.querySelector('.checkbox-group-vertical');

        options.forEach((opt, i) => {
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.onchange = () => this.updateFromChecks();

            const label = document.createElement('label');
            label.append(chk, ' ', opt);
            this.group.appendChild(label);
        });

        makeEditable(this.byteSpan, this.byteInp, v => this.setFromReal(v));

        this.setFromReal(savedValue);
        this.setSavedValue(savedValue);
    }

    setFromReal(v) {
        v = this.clamp(v);

        this.byteSpan.textContent = `[${v}]`;
        this.byteInp.value = v;

        [...this.group.querySelectorAll('input')]
            .forEach((chk, i) => chk.checked = !!(v & (1 << i)));

        this.setValue(v);
    }

    updateFromChecks() {
        let v = 0;
        [...this.group.querySelectorAll('input')]
            .forEach((chk, i) => chk.checked && (v |= 1 << i));

        this.setFromReal(v);
    }
}


class StringWidget extends Widget {
    constructor(name, value = '') {
        super({ savedValue: value, defaultValue: value, type: 'string' });

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>
                <input class="string-input" type="text" value="${value}">
                <div class="widget-right">
                    <span class="status ok"></span>
                </div>
            </div>
        `;

        this.input    = this.el.querySelector('.string-input');
        this.statusEl = this.el.querySelector('.status');

        this.input.oninput = () => {
            this.setValue(this.input.value);
        };
    }
}


