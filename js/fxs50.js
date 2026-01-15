// ================================================
// Device: FX-S50
// ================================================

const FX_S50_REG = Object.freeze({
    cmd: {
        DEVICE_ID_L:        0x00,
        DEVICE_ID_H:        0x01,
        LOT_L:              0x02,
        LOT_H:              0x03,
        LOT_DATE_L:         0x04,
        LOT_DATE_H:         0x05,
        FOXWIRE_VERSION_ID: 0x06,
        FIRMWARE_ID:        0x07,
        FIRMWARE_VERSION:   0x08,
        REQUEST_WRITE:      0x09,
        MCU_RESET:          0x0A,
        MCU_VOLTAGE:        0x0B,
        MCU_TEMPERATURE:    0x0C,
        READ:               0x0D
    },
    cmd_write: {
        SAVE:               0x01,
        RESTORE:            0x02,
        RESTORE_KEPP_ADDR:  0x03
    },
    reg: {
        ADDR:          0x00,
        CTRL:          0x01,
        L_HZ:          0x02,
        L_DC:          0x03,
        F_TOP:         0x04,
        F_TRIG:        0x05,
        CTRL1:         0x06,
        CTRL2:         0x07,
        NAME:          0x08, // 16 bytes
        SCAN_COUNT:    0x18, // 24 em decimal
        SCAN_VALUE:    0x19, // 25 em decimal
        SCAN_DELAY:    0x1A, // 26 em decimal
        SCAN_PERIODE:  0x1B  // 27 em decimal
    }
});

class fxs50 extends FxDevice {
    constructor(addr) {
        super(addr, {
            name: "FxS50",
            model: "FX-S50",
            image: "https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png",
            REG: FX_S50_REG,
            graphOptions: {
                points: 60,
                autoScale: true,
                min: 0,
                max: 1,
                hideLegend: true,
                hideYAxis: true,
                variables: [
                    { name: "sensor", color: "blue" }
                ]
            },
            parameters: (self) => ({
                addr: {
                    addr: FX_S50_REG.reg.ADDR,
                    wg: new widget_int(self.id, "Addr", 0, 0, 31),
                    saved_value: addr
                },
                name: {
                    addr: FX_S50_REG.reg.NAME,
                    wg: new widget_string(self.id, "name", "FX-S50", 32),
                    saved_value: 0
                },
                CTRL1: {
                    addr: FX_S50_REG.reg.CTRL1,
                    wg: new widget_select(self.id, "Read mode", 0, {
                        Digital: 0,
                        Analog: 1
                    }),
                    saved_value: 0
                },
                led_hz: {
                    addr: FX_S50_REG.reg.L_HZ,
                    wg: new widget_int(self.id, "led_hz", 120, 0, 255),
                    saved_value: 0
                },
                led_brilho: {
                    addr: FX_S50_REG.reg.L_DC,
                    wg: new widget_int(self.id, "led_brilho", 50, 0, 200),
                    saved_value: 0
                },
                filter_size: {
                    addr: FX_S50_REG.reg.F_TOP,
                    wg: new widget_int(self.id, "filter_size", 5, 0, 255),
                    saved_value: 0
                },
                filter_trigger: {
                    addr: FX_S50_REG.reg.F_TRIG,
                    wg: new widget_int(self.id, "filter_trigger", 5, 0, 255),
                    saved_value: 0
                }
            })
        });
    }

    /* firmware antigo não possui CTRL1 */
    param_available(p) {
        if (this.firmwareVersion <= 1002) {
            return p !== "CTRL1";
        }
        return true;
    }

    async graph_add() {
        const x = await fx.command(this.Addr, this.REG.cmd.READ);
        if (!x.ok) return;
        this.grafico.addValue(0, x.value);
    }

}
