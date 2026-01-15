// ================================================
// Device: IR_KEY
// ================================================

const IRKEY_REG = Object.freeze({
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
        ADDR:           0x00,
        FX_CTRL:        0x01,
        CTRL:           0x02,
        PROTOCOL_ST:    0x03,
        BTN_CTRL:       0x04,
        COLOR_PREPARE:  0x05, // 4bytes
        COLOR_ON:       0x09, // 4bytes
        COLOR_STOP:     0x0D, // 4bytes
        PROTOCOL_SERVO: 0x0E,
        COLOR_SERVO:    0x0F, // 4bytes
        COLOR_ROBOT:    0x13, // 4bytes ??
        PROTOCOL_STG:   0x17,
        STRATEGY_DELAY: 0x18, // 2bytes
        STRATEGIES:     0x19, // N bytes
        NAME:             47, // 16 bytes
    }
});


class IrKey extends FxDevice {
    constructor(addr) {
        super(addr, {
            name: "IrKey",
            model: "IrKey",
            image: "devices/IrKey.png",
            graph_mode: "analog",
            REG: IRKEY_REG,
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
                addr: { addr: FX_BASE.reg.ADDR, wg: new widget_int(self.id,"Addr",0,0,31), saved_value: self.Addr },
                name: { addr: IRKEY_REG.reg.NAME, wg: new widget_string(self.id,"name","IrKey",32), saved_value: 0 },
                CTRL: { addr: IRKEY_REG.reg.CTRL, wg: new widget_select(self.id,"log",1,{"Enable":2,"Disable":0}), saved_value: 0 },
                PROTOCOL_ST: { addr: IRKEY_REG.reg.PROTOCOL_ST, wg: new widget_select(self.id,"Start Protocols",1,{"SONY":1,"SONY and SAMSUNG":3}), saved_value: 1 }
            })
        });
    }
}