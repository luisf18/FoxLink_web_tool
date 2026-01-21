// ================================================
// Device: FX-S50
// ================================================

const FX_ESC8P_REG = Object.freeze({
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
        //CTRL:          0x01,
        //HZ:            0x02,
        MIX:           0x03,
        NAME:          0x47, // 16 bytes
    }
});

// brushed ESCs 8p
class besc8p extends FxDevice {
    constructor(addr) {
        super(addr, {
            name: "ESC 2x1.5A",
            model: "ESC brushed duplo",
            image: "devices/besc8p.png",
            REG: FX_ESC8P_REG,
            /*
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
            */
            parameters: (self) => ({
                addr: {
                    addr: self.REG.reg.ADDR,
                    wg: new widget_int(self.id, "Addr", 0, 0, 31),
                    saved_value: addr
                },
                name: {
                    addr: self.REG.reg.NAME,
                    wg: new widget_string(self.id, "name", "ESC 2x1.5A", 32),
                    saved_value: 0
                },
                //hz: {
                //    addr: self.REG.reg.HZ,
                //    wg: new widget_int(self.id, "pwm freq.", 120, 0, 255),
                //    saved_value: 22
                //},
                mix: {
                    addr: self.REG.reg.MIX,
                    wg: new widget_select(self.id, "Mix", 0, {
                        "no mix": 0,
                        "mix": 1
                    }),
                    saved_value: 1
                }
            })
        });
    }

}
