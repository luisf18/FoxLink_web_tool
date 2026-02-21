
// cache simples
export const deviceCache = {};
export let registryCache = null;

export async function fillDevicesChace(){
    await loadRegistry();
    // popula modelos
    for (const id in registryCache) {
        await loadDeviceDef(registryCache[id].path);
    }
}

// retorna { parent, key, value, path }
export function walkJson(obj, targetKey, callback, path = []) {
    if (obj === null || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {

        const currentPath = [...path, key];

        if (key === targetKey) {

            callback({
                parent: obj,
                key,
                value: obj[key],
                path: currentPath
            });

            continue; // prune
        }

        walkJson(obj[key], targetKey, callback, currentPath);
    }
}


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

export async function loadRegistry() {
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

    //console.log( "registryCache ", registryCache);

    return registryCache;
}

// ==============================
// Load device definition
// ==============================

export async function loadDeviceDef(name) {
    if (deviceCache[name]) return deviceCache[name];

    const res = await fetch(`./devices/${name}/def.json`);
    const raw = await res.json();

    const normalized = deepHexToNumber(raw);

    deviceCache[name] = normalized;
    return normalized;
}

export async function resolveDeviceStructs( input, structs = null ) {
    
    if( !input ) return;
    let root = null;
    let param = input;
    if( !structs ){
        root = input;
        param = root.param;
        if( !param ) return;
        structs = root.struct || {};
    }

    //function log(...a){
    //    console.log( "[struct]", ...a );
    //}

    const countStruct = {};

    for (let key in param) {

        if (key.startsWith(">")) {
            resolveDeviceStructs( param[key], structs );
        }else if (key.startsWith("_")) {
            
            const structParts = key.substring(1).split("_");
            const structName = structParts[0]; // "motor"

            countStruct[structName] = (countStruct[structName] ?? -1) + 1;

            const instanceName = (
                structParts[1] || (
                    root ?
                    `${countStruct[structName]}`:
                    ""
                )
            );

            //log( ` ${key} -> struct=${structName} instance=${instanceName} count: ${countStruct[structName]}` );

            // obtem o struct especifico e se falhar só deleta
            const structDef = structs[structName];
            let ok = false;

            // obtem o endereço base desse novo struct
            let addr_base;
            if (structDef) {
                const raw = param[key];
                if (typeof raw === "number") {
                    addr_base = raw;
                } else if (raw && typeof raw === "object" && typeof raw.addr === "number") {
                    addr_base = raw.addr;
                }
                ok = (typeof addr_base === "number");
            }

            // expande o struct em widgets
            if (ok){
                
                const paramPrefix = `${structName}_${instanceName}_`;
                const prefix = (
                    structDef["!prefix"] || (
                        root ?
                        `${structName}$ ` :
                        ""
                    )
                ).replace("$", instanceName);

                //log( "struct=", structName, " prefix=", prefix, " instanceName=", instanceName );

                // percorre cada campo do struct
                for (let field in structDef) {
                    if( field.startsWith('!') ) continue;

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

                    // aplica prefixo no wg.name
                    if (newField.wg) {
                        // salva nome original
                        //newField.wg["!name"] = newField.wg.name;
                        //newField.wg["!idx"] = countStruct[structName];
                        //log(` struct_field=${field}: `,newField.wg.name);
                        newField.wg.name = `${prefix}${newField.wg.name ?? field}`;

                        //log(` struct_field=${field}: `,newField.wg.name);
                        if( newField.wg.externalActions ){
                            console.log( "Widget-externalActions" );
                            walkJson( newField.wg.externalActions, "to", ({ parent, key, value, path }) => {
                                if (typeof value === "string")
                                    parent[key] = { widget: `${value}` };
                            });
                            walkJson( newField.wg.externalActions, "widget", ({ parent, key, value, path }) => {
                                parent[key] = `!${paramPrefix}${value}`;
                            });
                            //walkJson( newField.wg.externalActions, "to", ({ parent, key, value, path }) => {
                            //    if (typeof parent[key] === "string") {
                            //        parent[key] = { widget: `!${paramPrefix}${value}` };
                            //    }else if (value?.widget != null) {
                            //        value.widget = `!${paramPrefix}${value.widget}`;
                            //    }
                            //    console.log( "Encontrado em:", path.join("."), " value:", value );
                            //});
                        }
                    }

                    // salva de volta no dev.param
                    const paramKey = `${paramPrefix}${field}`;
                    param[paramKey] = newField;
                }
            }
            
            // remove a referência original do _<struct>_<name>
            delete param[key];
        }
        
    }

    if( root ){
        delete root.struct;
    }
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

    //console.log( `result`, result );

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
