// ================================================
// CARDS
// ================================================

class widget{
    constructor(device_id, name, defaultValue) {
        //this.addr = addr;
        this.name = name;
        this.defaultValue = defaultValue;
        this.currentValue = defaultValue;
        this.inputValue = defaultValue;
        this.type = 'none';
        this.div = null;
        //this.value_change = false;
    }
    trim(a){
        //console.log("[*] trim -> ", a.value );
        //console.log(a);
        if(a.value<0) a.value = 0;
        else if(a.value>255) a.value = 255;
    }
    html(){
    }
    display(){
        //this.parameters[param].display( container.querySelector(`#param_${param}`) );
    }
    value(){
        return null;
    }
}

class widget_int extends widget{
    constructor(device_id, name, defaultValue, Min, Max ) {
        super(device_id, name, defaultValue);
        this.type = "int";
        this.min = Min;
        this.max = Max;
        this.input = null;
        this.trim_callback = null;
        this.status = null;
    }
    html(){
        this.div = document.createElement("label");
        this.div.innerText = `${this.name}: `;
        this.input = document.createElement("input");
        this.input.type = "number";
        this.input.id = `param_${this.name}`;
        this.input.value = this.currentValue;
        // Passando apenas o valor do input
        //input.onblur = () => this.trim(input.value);
        //input.onblur = () => this.trim(this.div.querySelector("input"));
        this.input.onblur = () => this.trim(this.input);
        this.div.appendChild(this.input);

        //<div class="wg-status"></div>
        this.status = document.createElement("div");
        this.status.className = "wg-status";
        this.div.appendChild(this.status);

        return this.div;
        //return
        //`<label>${this.name}: 
        //    <input type="number" id="param_${this.name}" value="${this.currentValue}" onblur="${this.trim()}(this)">
        //</label>`;
    }
    value(){
        return this.input.value;
    }
    trim(){
        this.input.value = this.trim_num(this.input.value);
        if( this.trim_callback ){
            this.trim_callback(this);
        }
    }
    trim_num(x) {
        x = parseInt(x) || this.min; // Converte para inteiro e evita NaN
        if (x < this.min) x = this.min;
        else if (x > this.max) x = this.max;
        return x;
    }
    display(x){
        this.input.value = this.trim_num(x);
    }
}

class widget_string extends widget{
    constructor(device_id, name, defaultValue, len ) {
        super(device_id, name, defaultValue);
        this.type = "string";
        this.len = len;
    }
    trim(a){}
    html(){
        const label = document.createElement("label");
        label.innerText = `${this.name}: `;
        const input = document.createElement("input");
        input.type = "text";
        input.id = `param_${this.name}`;
        input.value = this.currentValue;
        input.maxLength=this.len;
        // Passando apenas o valor do input
        //input.onblur = () => this.trim(input.value);
        //input.onblur = () => this.trim(label.querySelector("input"));
        label.appendChild(input);
        return label;
    }
    display(x){}

    value(){
        return this.input.value;
    }
}

class widget_select extends widget {
    constructor(device_id, name, defaultValue, options) {
        super(device_id, name, defaultValue);
        this.type = "select";
        this.options = options;
        this.select = null;
    }

    html() {
        this.div = document.createElement("label");
        this.div.innerText = `${this.name}: `;

        this.select = document.createElement("select");
        this.select.id = `param_${this.name}`;

        for( const option in this.options ){
            const opt = document.createElement("option");
            opt.value = option;
            opt.innerText = option;
            if (option === this.defaultValue) {
                opt.selected = true;
            }
            this.select.appendChild(opt);
        }

        this.select.onchange = () => {
            this.currentValue = this.select.value;
            console.log(this.value());
        };

        this.div.appendChild(this.select);

        this.status = document.createElement("div");
        this.status.className = "wg-status";
        this.div.appendChild(this.status);
        
        return this.div;
    }

    value() {
        return this.options[this.select.value];
    }

    display(x) {
        for( const option in this.options ){
            if( this.options[option] == x ) {
                console.log("option:",option);
                this.select.value = option;
                this.currentValue = x;
                return;
            }
        }
        this.select.value = x;
    }
}


class devices_card {
    constructor( Addr ) {
        this.Addr = Addr;
        this.deviceId = null;
        this.foxWireVersion = null;
        this.firmwareVersion = null;
        this.lote = null;
    }
}




