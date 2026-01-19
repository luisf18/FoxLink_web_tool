// ====================================================
// Fox Devices
// Depende de FoxWire
// ====================================================
class FxDevice extends Card {
    constructor(id, addr, container, options) {
        super(id);

        // Endereço
        this.addr = addr;

        this.container = container;

        // Identificação do modelo/versão
        this.image = options.image;
        this.model = options.model;
        this.firmwareVersion = 0;
        this.lot = 0;
        this.REG = options.REG || FX_BASE;

        // Parametros
        this.param = options.param || {};

        // Gráfico
        this.graphOptions = options.graphOptions ?? null;
        this.grafico      = null;

        this.html();
    }

    async html() {
        
        const card = document.createElement("div");
        this.card = card;
        card.className = "card";

        card.id = `device_${this.id}"`;

        card.innerHTML = `
            <div class="card-header">
                <img class="device-img" src="${this.image}" alt="${this.model}">

                <div class="device-info">
                    <div class="device-title">
                        ${this.model} [${this.id}]
                    </div>
                    <div class="device-meta">
                        Firmware: V${Math.floor(this.firmwareVersion / 1000)}.${this.firmwareVersion % 1000} |
                        Lote: ${this.lot}
                    </div>
                </div>
            </div>

            <div class="card-body"></div>

            <div class="card-footer">
                
                ${this.graphOptions ? `
                    <!-- Gráfico -->
                    <div class="chart-container">
                        <canvas id="grafico"></canvas>
                        <div class="chart-labels">Leitura em tempo real</div>
                    </div>` : ""
                }
                
                <div class="card-footer-buttons">
                    <button data-action="read" id="btn_read">Read</button>
                    <button data-action="apply" id="btn_apply">Apply</button>
                    <button data-action="save" id="btn_save">Save</button>
                    <button data-action="default" id="btn_default">Default</button>
                    <button data-action="reset" id="btn_reset">Reset</button>
                </div>

            </div>
        `;

        this.graph_init();

        this.card.querySelector("#btn_read")?.addEventListener("click", () => this.grafico.resize());
        this.card.querySelector("#btn_apply")?.addEventListener("click", () => {this.grafico.addValue(0,10); this.grafico.update();} );


        const card_body = card.querySelector(".card-body");
        for (const p in this.param) {
            if (this.param_available(p)) {
                console.log( this.param[p].wg.el );
                card_body.appendChild(this.param[p].wg.el);
            }
        }
        //this.bind_buttons();
        //this.graph_init();

        this.container.appendChild(card);
    }

    graph_init() {
        this.canvas = this.card.querySelector("#grafico");
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;

        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width  = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        const ctx = this.canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.grafico = new MultiLineGraph(
            this.canvas,
            this.graphOptions || {}
        );
    }

    async get_basic_info(){
        const fw = fx.getFirmwareVersion(this.addr);
        const lot = fx.getLot(this.addr);
        if( fw.ok ) this.firmwareVersion = fw.value;
        if( lot.ok ) this.lot = lot.date;
        //this.foxWireVersion
    }

    param_available(p) {
        return true;
    }

}

// FXS50
class fxs50 extends FxDevice {
    constructor(id, addr, container) {
        super( id, addr, container, {
            model: "FX-S50",
            image: "https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png",
            //REG: FX_S50_REG,
            graphOptions: {
                points: 60,
                autoScale: true,
                min: 0,
                max: 1,
                hideLegend: true,
                hideYAxis: true,
                variables: [ { name: "read", color: "orange" } ]
            },
            param: {
                addr: {
                    addr: 0, //FX_S50_REG.reg.ADDR,
                    wg: new IntWidget("Addr", addr),
                },
                name: {
                    addr: 1, //FX_S50_REG.reg.NAME,
                    wg: new StringWidget("Name", "FX-S50"),
                    saved_value: 0
                },
                CTRL1: {
                    addr: 2, //FX_S50_REG.reg.CTRL1,
                    wg: new CheckWidget("Read mode", ['Analog','Limit Frequency'], 0, 0),
                    saved_value: 0
                },
                CTRL2: {
                    addr: 2, //FX_S50_REG.reg.CTRL1,
                    wg: new SlideWidget("CTRL2", 10, 0, 0),
                    saved_value: 0
                }
            }
        });
    }
}