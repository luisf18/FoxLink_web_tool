class Widget {
    constructor(savedValue = 0, defaultValue = 0) {
        this.savedValue   = savedValue;
        this.currentValue = savedValue;
        this.defaultValue = defaultValue;
        this.dirty        = false;

        this.el = document.createElement('div');
        this.el.className = 'widget';
    }

    setValue(v) {
        v = clamp(v);

        this.currentValue = v;
        this.dirty = (this.currentValue !== this.savedValue);

        this.updateStatus();
    }

    setSavedValue(v) {
        v = clamp(v);

        this.savedValue   = v;
        this.currentValue = v;
        this.dirty        = false;

        this.updateStatus();
    }

    needsWrite() {
        return this.dirty;
    }

    updateStatus() {
        if (!this.statusEl) return;

        this.statusEl.classList.toggle('ok', !this.dirty);
    }
}



/* =========================================================
 * TEXT WIDGET
 * =======================================================*/
class TextWidget extends Widget {
    constructor(text = '') {
        super();
        this.el.textContent = text || 'Texto de exemplo...';
    }
}

/* =========================================================
 * INT WIDGET
 * =======================================================*/
class IntWidget extends Widget {
    constructor(name = 'int', savedValue = 0, defaultValue = 0) {
        super(savedValue,defaultValue);

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>
                <input class="int-input" type="number" value="${savedValue}" min="0" max="255">
                <div class="widget-right">
                    <span class="real-value editable">[${savedValue}]</span>
                    <input class="real-input" type="number" min="0" max="255">
                    <span class="status"></span>
                </div>
            </div>
        `;

        this.byteSpan = this.el.querySelector('.real-value');
        this.byteInp  = this.el.querySelector('.real-input');
        this.statusEl = this.el.querySelector('.status');

        makeEditable(this.byteSpan, this.byteInp, v => {
            this.setFromByte(v);
        });

        this.setFromByte(savedValue);
        this.setSavedValue(savedValue);
    }

    setFromByte(v) {
        v = clamp(v);
        this.byteSpan.textContent = `[${v}]`;
        this.byteInp.value = v;
        this.setValue(v);
    }
}

/* =========================================================
 * STRING WIDGET
 * =======================================================*/
class StringWidget extends Widget {
    constructor(name = 'string', value = '', defaultValue = '') {
        super(value,defaultValue);

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>

                <input type="text" class="string-input" value="${value}">

                <div class="widget-right">
                    <span class="status ok"></span>
                </div>
            </div>
        `;
    }
}

/* =========================================================
 * SLIDE WIDGET  (já existente – mantido)
 * =======================================================*/
class SlideWidget extends Widget {
    constructor(name = 'slide', savedValue = 148, defaultValue=0) {
        super(savedValue,defaultValue);

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>

                <span class="real-value abs editable"></span>
                <input class="abs-input" type="number">

                <input class="slide-input" type="range" min="0" max="255">

                <div class="widget-right">
                    <span class="real-value editable"></span>
                    <input class="real-input" type="number">
                    <span class="status"></span>
                </div>
            </div>
        `;

        this.slider   = this.el.querySelector('.slide-input');
        this.byteSpan = this.el.querySelector('.real-value:not(.abs)');
        this.byteInp  = this.el.querySelector('.real-input');
        this.absSpan  = this.el.querySelector('.real-value.abs');
        this.absInp   = this.el.querySelector('.abs-input');
        this.statusEl = this.el.querySelector('.status');

        this.slider.oninput = () => this.setFromByte(this.slider.value);

        makeEditable(this.byteSpan, this.byteInp, v => this.setFromByte(v));
        makeEditable(this.absSpan, this.absInp, a => this.setFromAbstract(a));

        this.setFromByte(savedValue);
        this.setSavedValue(savedValue);
    }

    setFromByte(v) {
        v = clamp(v);
        this.slider.value = v;
        this.byteSpan.textContent = `[${v}]`;
        this.byteInp.value = v;
        this.absSpan.textContent = abstractValue(v);
        this.setValue(v);
    }

    setFromAbstract(a) {
        const v = Math.round((a - 860) / 5);
        this.setFromByte(v);
        this.absSpan.textContent = a;
    }
}

/* =========================================================
 * CHECK (BITMASK) WIDGET
 * =======================================================*/
class CheckWidget extends Widget {
    constructor(name = 'check', options = ['A', 'B', 'C', 'D'], savedValue = 0, defaultValue=0) {
        super(savedValue,defaultValue);

        this.options = options;

        this.el.innerHTML = `
            <div class="widget-row">
                <span class="widget-name">${name}</span>

                <div class="widget-right">
                    <span class="real-value editable">[${savedValue}]</span>
                    <input class="real-input" type="number" min="0" max="255">
                    <span class="status ok"></span>
                </div>
            </div>

            <div class="checkbox-group-vertical"></div>
        `;

        this.byteSpan = this.el.querySelector('.real-value');
        this.byteInp  = this.el.querySelector('.real-input');
        this.statusEl = this.el.querySelector('.status');
        this.group    = this.el.querySelector('.checkbox-group-vertical');

        options.forEach((opt, i) => {
            const label = document.createElement('label');
            const chk   = document.createElement('input');
            chk.type = 'checkbox';

            chk.onchange = () => this.updateFromChecks();

            label.append(chk, ' ', opt);
            this.group.appendChild(label);
        });

        makeEditable(this.byteSpan, this.byteInp, v => {
            this.setFromByte(v);
        });

        // 🔑 inicialização correta
        this.setFromByte(savedValue);
        this.setSavedValue(savedValue);
    }

    updateFromChecks() {
        let v = 0;
        [...this.group.querySelectorAll('input')].forEach((chk, i) => {
            if (chk.checked) v |= (1 << i);
        });
        this.setFromByte(v);
    }

    setFromByte(v) {
        v = clamp(v);

        this.byteSpan.textContent = `[${v}]`;
        this.byteInp.value = v;

        [...this.group.querySelectorAll('input')].forEach((chk, i) => {
            chk.checked = (v >> i) & 1;
        });

        // 🔑 ESSENCIAL
        this.setValue(v);
    }
}

