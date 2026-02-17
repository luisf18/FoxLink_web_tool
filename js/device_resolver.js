
// cache simples
const deviceCache = {};
let registryCache = null;

// ==============================
// HEX normalizer
// ==============================

function deepHexToNumber(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deepHexToNumber);
    }

    if (obj && typeof obj === "object") {
        const result = {};
        for (const key in obj) {
            result[key] = deepHexToNumber(obj[key]);
        }
        return result;
    }

    if (typeof obj === "string" && obj.startsWith("0x")) {
        return parseInt(obj, 16);
    }

    return obj;
}

// ==============================
// Load registry
// ==============================

async function loadRegistry() {
    if (registryCache) return registryCache;

    const res = await fetch("./devices/registry.json");
    const raw = await res.json();

    registryCache = {};

    for (const key in raw) {
        const id = parseInt(key, 16);
        registryCache[id] = {
            ...raw[key],
            id
        };
    }

    console.log( "registryCache ", registryCache);

    return registryCache;
}

// ==============================
// Load device definition
// ==============================

async function loadDeviceDef(name) {
    if (deviceCache[name]) return deviceCache[name];

    const res = await fetch(`./devices/${name}/def.json`);
    const raw = await res.json();

    const normalized = deepHexToNumber(raw);

    deviceCache[name] = normalized;
    return normalized;
}


export async function resolveDeviceStructs(dev) {
    const structs = dev.struct;
    if (!structs) return;

    //function log(...a){
    //    console.log( "[struct]", ...a );
    //}

    for (let key in dev.param) {
        if (key.startsWith("_")) {
            const structName = key.substring(1);  // exemplo: "motor_1"
            const structParts = structName.split("_");
            const baseStructName = structParts[0]; // "motor"
            const instanceName = structParts[1];    // "1"

            //log( ` ${key} -> struct=${baseStructName} instance=${instanceName}` );

            const structDef = structs[baseStructName];
            if (!structDef) continue;

            //log( ` struct_${key} ->`, structDef );

            // pega addr_base da instancia (pode ser número ou objeto { addr: ... })
            let addr_base = dev.param[key];
            if (typeof addr_base === "object" && addr_base !== null) {
                addr_base = addr_base.addr;
            }

            if( addr_base == null || addr_base == undefined ) continue;

            //log( "addr_base", addr_base );

            const prefix = (structDef._prefix || `${baseStructName}_$_`).replace("$", instanceName);

            //log( "prefix=", prefix );

            // percorre cada campo do struct
            for (let field in structDef) {
                if (field === "_prefix") continue;

                const fieldDef = structDef[field];
                let newField = structuredClone( fieldDef );

                // calcula addr
                if ("offset" in fieldDef) {
                    const offset = Number(fieldDef.offset);
                    newField.addr = addr_base + offset;
                    delete newField.offset;
                }else{
                    continue;
                }

                // aplica prefix no wg.name
                if (newField.wg) {
                    //log(` struct_field=${field}: `,newField.wg.name);
                    newField.wg.name = (
                        newField.wg.name ?
                        prefix + newField.wg.name :
                        `${prefix}${field}`
                    );
                    //log(` struct_field=${field}: `,newField.wg.name);
                }

                // salva de volta no dev.param
                const paramKey = `${baseStructName}_${instanceName}_${field}`;
                dev.param[paramKey] = newField;
            }

            // remove a referência original do _motor_X
            delete dev.param[key];
        }
    }

    delete dev.struct;
}

export async function resolveDevice(info) {

    const id = info?.id ?? null;
    if (!id) return null;

    const firmwareVer = info?.fwv ?? 0;

    const registry = await loadRegistry();
    const reg = registry[id];
    if (!reg) return null;

    const def = await loadDeviceDef(reg.path);
    if (!def) return null;

    // pega todas as versões disponíveis
    const versions = Object.keys(def)
        .map(v => parseInt(v))
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);

    if (versions.length === 0) return null;

    // encontra maior versão <= firmware
    let result = structuredClone(def[versions[0]]);

    //console.log( `ver: `, versions.slice(1) );

    for (const v of versions.slice(1)) {
        //console.log( `ver: `, v, "/", firmwareVer );
        if (v <= firmwareVer){
            //console.log( `merge v[${v}]: `, def[v] );
            mergeDeep( result, def[v] );
        }else{
            break;
        }
    }

    if( !result.image ){
        result.image = `devices/${reg.path}/img.png`;
    }

    console.log( `result`, result );

    resolveDeviceStructs( result );

    return result;
}


// ==============================
// mergeDeep
// ==============================

export function mergeDeep(base, override) {
    for (const k in override) {
        const v = override[k];

        if (v === null) {
            delete base[k];
        }
        else if (typeof v === "object" && !Array.isArray(v)) {
            base[k] ??= {};
            mergeDeep(base[k], v);
        }
        else {
            base[k] = v;
        }
    }
}
