/* ============================================================
    DeviceTree - Insira Aqui as Informações dos Dispositivos
=============================================================== */

export const deviceRegistry = {
    0x001: { name: "FX_S50", type: "sensor" },
    0x020: { name: "IR_KEY", type: "sensor" }
    //0x200: { name: "BESC8p", type: "ESC brushed" }
};

export const deviceDefs = {
    FX_S50: {
        base: {
            model: "FX-S50",
            image: "https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png",
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
                "name": {
                    addr: 0x08,
                    wg: {
                        name: "Name",
                        type: "string",
                        defaultValue: "FX-S50",
                        outputLen: 16
                    }
                },
                "Mode": {
                    addr: 0x06,
                    wg: {
                        name: "Mode", type: "select",
                        defaultValue: 0, // digital
                        selOptions:{
                            "Digital": 0,
                            "Analog": 1
                        }
                    }
                },
                "ledFreq": {
                    addr: 0x02,
                    wg: {
                        name: "EmitterFreq", type: "slide",
                        defaultValue: 120,
                    }
                },
                "ledPower": {
                    addr: 0x03,
                    wg: {
                        name: "Led Power", type: "slide",
                        defaultValue: 30,
                        limit: [0,100]
                    }
                },
                "FilterTop": {
                    addr: 0x04,
                    wg: {
                        name: "Filter Size",
                        defaultValue: 15
                    }
                },
                "FilterTh": { // threshold
                    addr: 0x05,
                    wg: {
                        name: "Filter Th.",
                        defaultValue: 6
                    }
                }
            }
        }
    },

    IR_KEY: {
        base: {
            model: "IrKey",
            image: "devices/IrKey.png",
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
                "name": {
                    addr: 47,
                    wg: { name: "Name", type: "string", defaultValue: "IrKey", outputLen: 16 }
                },
                "startProtocols": {
                    addr: 0x03,
                    wg: {
                        name: "Start Protocols",
                        type: "select",
                        defaultValue: 1, // digital
                        selOptions:{
                            "SONY":1,
                            "SONY and SAMSUNG":3
                        }
                    }
                },
                "CTRL":{
                    addr: 0x02,
                    wg: {
                        name: "Options",
                        type: "check",
                        defaultValue: 0, // digital
                        checkOptions: ["Log enable"]
                    }
                }
            }
        }
    },

    DEMO: {
        base: {
            model: "IR_KEY",
            image: "https://raw.githubusercontent.com/luisf18/FXDevices/refs/heads/main/Sensor_FXS50/imagens/vista_isometrica.png",
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
                "addr": {
                    addr: 0,
                    wg: { name: "Addr", limit: [0,31] }
                },
                "name": {
                    addr: 2,
                    wg: { name: "Name", type: "string", defaultValue: "Sensor", savedValue: "FX-S50", outputLen: 16 }
                },
                "color": {
                    addr: 3,
                    wg: { name: "Channel 1", type: "slide", abstract: [1000, 2000], abstractLimit: [1500, 1800], defaultValue: 200 }
                },
                "CTRL2": {
                    addr: 5,
                    wg: { name: "CTRL2", type: "check", defaultValue: 1, checkOptions: ["Samsung","Sony","NEC"] }
                }
            }
        },

        versions: {
            1: {
                param: {
                    "name": { wg: { defaultValue: "abacates" } }, // override
                    CTRL2: null,                        // REMOVE
                }
            },

            2: {
                param:{
                    "color": null,  // REMOVE
                }
            }
        }
    }
};
