
class MultiLineGraph {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.config  = config;

        this.width  = canvas.width;
        this.height = canvas.height;
        this.points = config.points || 50;

        this.hideLegend = config.hideLegend || false;
        this.hideYAxis  = config.hideYAxis || false;

        this.autoScale = config.autoScale ?? true;
        this.minValue  = config.min ?? 0;
        this.maxValue  = config.max ?? 1;

        this.margin_y = 35;
        this.margin_x = this.hideYAxis ? 10 : 50;
        this.marginRight = 10;

        this.legendHeight = this.hideLegend ? 0 : 25;
        this.topOffset = this.margin_y + this.legendHeight;
        this.bottomOffset = this.margin_y;

        this.yExponent = 0;
        this.useExponent = true; // pode virar config depois

        // Unidade e fonte
        this.unit = config.unit || "";
        this.font = {
            family: config.font?.family || "Arial",
            size: config.font?.size || 14,
            color: config.font?.color || "#000"
        };

        this.variables = config.variables || [];
        this.data = [];

        this.yTicks = 2;

        this.yBarColor =  config.yBarColor || "#a94900d3";

        this.resize();

        this.clear();
    }

    clear(){
        for (let i = 0; i < this.variables.length; i++) {
            this.data[i] = new Array(this.points).fill(0);
        }
    }

    /* ==============================
       Ajusta resolução
    ============================== */
    resize(){

        const rect = this.canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;

        if( this.width == rect.width && this.height == rect.heigh ){
            return;
        }
        
        this.width  = rect.width;
        this.height = rect.height;
        //this.canvas.width  = this.width  * dpr;
        //this.canvas.height = this.height * dpr;
        //this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        //this.computeLayout();

        const base = Math.min(this.width, this.height);

        this.font.size = Math.max(12, base * 0.035);

        this.margin_y = this.font.size*0.5;
        this.margin_x = this.hideYAxis ? 10 : this.font.size*3.5;
        this.marginRight = 10;

        this.legendHeight = this.hideLegend ? 0 : this.font.size*2.5;
        this.topOffset = this.margin_y + this.legendHeight;
        this.bottomOffset = this.margin_y;

        //this.margin_x.left   = this.fontSize * 3.5;
        //this.margin.right  = 10;
        //this.margin.top    = this.fontSize * 2;
        //this.margin.bottom = this.fontSize * 2.5;

        //this.yTicks = Math.max(2, Math.floor(this.height / 80));

        this.yTicks = (
            this.config.yTicks ||
            Math.max( 
                2,
                2*Math.floor(
                    (this.height-this.topOffset-this.bottomOffset)/80
                )
            )
        );
    }


    /* ==============================
       CONFIGURAÇÕES
    ============================== */

    setScale(min, max) {
        this.autoScale = false;
        this.minValue = min;
        this.maxValue = max;
    }

    setAutoScale(enable = true) {
        this.autoScale = enable;
    }

    setUnit(unit) {
        this.unit = unit;
    }

    setFont(fontConfig = {}) {
        this.font.family = fontConfig.family || this.font.family;
        this.font.size   = fontConfig.size   || this.font.size;
        this.font.color  = fontConfig.color  || this.font.color;
    }

    /* ==============================
       ...
    ============================== */

    valueToY(value, min, max) {
        return this.topOffset +
            (this.height - this.bottomOffset - this.topOffset) *
            (1 - (value - min) / (max - min));
    }


    /* ==============================
       DADOS
    ============================== */

    addValue(variableIndex, value) {
        if (!this.data[variableIndex]) return;
        this.data[variableIndex].shift();
        this.data[variableIndex].push(Number(value));
    }

    /* ==============================
       DESENHO
    ============================== */

    update() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        let min = this.minValue;
        let max = this.maxValue;

        if (this.autoScale) {
            ({ min, max } = this.calculateAutoScale());
        }

        this.drawZeroLine(min, max);
        this.drawLimits(min, max);
        this.drawLines(min, max);
        this.drawYAxis(min, max);
        this.drawLegend();
    }

    calculateAutoScale() {
        let min = Infinity;
        let max = -Infinity;

        for (let v = 0; v < this.data.length; v++) {
            for (let i = 0; i < this.data[v].length; i++) {
                min = Math.min(min, this.data[v][i]);
                max = Math.max(max, this.data[v][i]);
            }
        }

        if (min === max){
            min -= 1;
            max += 1;
        }
        return { min, max };
    }

    /* ==============================
       EIXO Y
    ============================== */

    drawLine( x0, y0, xf, yf, color, dash = [] ) {
        this.ctx.strokeStyle = color;
        this.ctx.setLineDash(dash);
        this.ctx.beginPath();
        this.ctx.moveTo(x0,y0);
        this.ctx.lineTo(xf,yf);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    calculateYAxisExponent(min, max) {
        const maxAbs = Math.max(Math.abs(min), Math.abs(max));

        if (maxAbs === 0) return 0;

        const exp = Math.floor(Math.log10(maxAbs));

        return exp;

        // Só usa se passar de 4 casas
        //return Math.abs(exp) >= 4 ? exp : 0;
    }

    formatYAxisValue(value) {
        if (value === 0) return "0";

        const scaled = value / Math.pow(10, this.yExponent);

        return scaled.toFixed(2);
    }

    drawYAxis(min, max) {

        const ctx = this.ctx;

        if(this.hideYAxis){
            // Imprime a escala do eixo y

            let rect_w =  (this.font.size+1)*3.2;

            this.ctx.fillStyle = this.yBarColor;
            this.ctx.fillRect(
                this.margin_x, this.topOffset,
                rect_w,
                this.height-this.topOffset-this.bottomOffset
            );

            //ctx.textAlign = "left";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = `${this.font.size+1}px ${this.font.family}`;
            ctx.fillStyle = "#ffffffff";
            ctx.fillText(
                max.toFixed(2),
                //this.margin_x + 5,
                this.margin_x + rect_w/2,
                this.topOffset + 12
            );
            ctx.fillText(
                min.toFixed(2),
                this.margin_x + rect_w/2,
                this.height - this.bottomOffset - 22
            );
            return;
        }

        ctx.font = `${this.font.size}px ${this.font.family}`;
        ctx.fillStyle = this.font.color;
        ctx.strokeStyle = "#000";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        // Linha do eixo Y
        ctx.beginPath();
        ctx.moveTo(this.margin_x, this.topOffset);
        ctx.lineTo(this.margin_x, this.height - this.bottomOffset);
        ctx.stroke();

        let exp_notation = false;
        let draw_zero = true;

        if( Math.abs(max) >= 1e2 || Math.abs(min) >= 1e2 ){
            exp_notation = true;
        //}
        //if (this.useExponent) {
            this.yExponent = this.calculateYAxisExponent(min, max);
        } else {
            this.yExponent = 0;
        }

        // Ticks e valores
        for (let i = 0; i <= this.yTicks; i++) {
            const value = min + (i / this.yTicks) * (max - min);
            const y = this.valueToY(value, min, max);

            ctx.beginPath();
            ctx.moveTo(this.margin_x - 5, y);
            ctx.lineTo(this.margin_x, y);
            ctx.stroke();

            //ctx.fillText(
            //    exp_notation ? value.toExponential(1) : value.toFixed(2),
            //    this.margin - 7,
            //    y
            //);

            if( value.toFixed(2) == 0 ){
                draw_zero = false;
            }

            ctx.fillText(
                this.formatYAxisValue(value),
                this.margin_x - 7,
                y
            );
        }

        // Tick especial do ZERO
        if( draw_zero && min < 0 && max > 0 ) {
            const yZero = this.valueToY(0, min, max);
            ctx.strokeStyle = "#2c2c2cff";
            ctx.beginPath();
            ctx.moveTo(this.margin_x - 10, yZero);
            ctx.lineTo(this.margin_x, yZero);
            ctx.stroke();
            //ctx.fillText(
            //    "0",
            //    this.margin - 9,
            //    yZero
            //);
        }

        // Unidade
        if (this.unit) {
            ctx.save();
            ctx.translate(12, this.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = "center";
            ctx.fillText(this.unit, 0, 0);
            ctx.restore();
        }

        // Imprime a escala do eixo y
        if (this.yExponent !== 0) {
            ctx.save();
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = `${this.font.size - 2}px ${this.font.family}`;
            ctx.fillText(
                `1e${this.yExponent > 0 ? "+" : ""}${this.yExponent}`,
                this.margin_x + 4,
                this.margin_x - 16
            );
            ctx.restore();
        }

    }

    drawZeroLine(min, max) {
        if (min > 0 || max < 0) return;

        const yZero = this.valueToY(0, min, max);
        
        this.drawLine(
            this.margin_x, yZero,
            this.width-this.marginRight, yZero,
            "#888",
            [6,4]
        );
    }

    drawLimits(min, max) {
        
        const yMin = this.valueToY(min, min, max);
        const yMax = this.valueToY(max, min, max);

        this.drawLine(
            this.margin_x, yMin,
            this.width-this.marginRight, yMin,
            "lightgray",
            [5,5]
        );

        this.drawLine(
            this.margin_x, yMax,
            this.width-this.marginRight, yMax,
            "lightgray",
            [5,5]
        );

    }

    // desenha a curva
    drawLines(min, max) {
        for (let v = 0; v < this.data.length; v++) {
            const color = this.variables[v].color || "blue";

            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5;

            for (let i = 0; i < this.data[v].length; i++) {
                const x = this.margin_x +
                    (i / (this.points - 1)) * (this.width - this.margin_x - this.marginRight);
                const y = this.valueToY(this.data[v][i], min, max);

                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }

            this.ctx.stroke();
        }
    }


    drawLegend() {

        if( this.hideLegend ) return;
        
        const y = this.margin_y;

        this.ctx.font = `${this.font.size}px ${this.font.family}`;
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";
        this.ctx.lineWidth = 2;

        let total_length = 0;
        let lable_space = 50;
        
        for (let v = 0; v < this.variables.length; v++) {
            total_length += this.ctx.measureText(
                this.variables[v].name || `Var ${v}`
            ).width + lable_space;
        }

        let x = (this.width - total_length)/2;

        for (let v = 0; v < this.variables.length; v++) {

            const color = this.variables[v].color || "blue";
            const name  = this.variables[v].name || `Var ${v}`;

            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y-9, 15, 15);

            // Texto
            this.ctx.fillStyle = this.font.color;
            this.ctx.fillText(name, x+19, y);

            x += this.ctx.measureText(name).width + lable_space;
        }
    }


}
