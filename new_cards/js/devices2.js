export const deviceRegistry = {
    0x001: { name: "FX_S50", type: "sensor" },
    0x020: { name: "IR_KEY", type: "sensor" },
    0x200: { name: "BESC8p", type: "ESC brushed" }
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
                "addr": {
                    addr: 0,
                    wg: { name: "Addr", limit: [0,31] }
                },
                "name": {
                    addr: 2,
                    wg: { name: "Name", type: "string", defaultValue: "Sensor", savedValue: "FX-S50", outputLen: 16 }
                },
                "kp": {
                    addr: 3,
                    wg: { name: "Kp", limit: [-1000, 1000], outputType: 'i16', defaultValue: 150 }
                },
                "Channel 1": {
                    addr: 3,
                    wg: { name: "Channel 1", type: "slide", abstract: [1000, 2000], abstractLimit: [1500, 1800], defaultValue: 200 }
                },
                "CTRL1": {
                    addr: 4,
                    wg: { name: "CTRL1", type: "check", defaultValue: 10, checkOptions: ["Analog","Fixed Frequency","Clock On"] }
                },
                "CTRL2": {
                    addr: 5,
                    wg: { name: "CTRL2", type: "check", defaultValue: 1, checkOptions: ["Analog","Fixed Frequency","Clock On"] }
                },
                "Mode": {
                    addr: 6,
                    wg: {
                        name: "Mode", type: "select",
                        defaultValue: 10,
                        selOptions:{
                            "Analog": 10,
                            "Digital": 12
                        }
                    }
                }
            }
        },

        versions: {
            1: {
                param: {
                    kp: { wg: { defaultValue: 200 } }, // override
                    "CTRL2": null,                        // REMOVE
                }
            },

            2: {
                param: {
                    "CTRL1": null,  // REMOVE
                    "Channel 1": { wg: { defaultValue: 80 } }, // override
                },
                graphOptions: {
                    autoScale: false
                }
            }
        }
    },

    IR_KEY: {
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
