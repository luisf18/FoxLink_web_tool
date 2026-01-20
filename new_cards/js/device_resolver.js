import { deviceRegistry, deviceDefs } from "./devices2.js";

export function resolveDevice(id, version = 0) {
    const reg = deviceRegistry[id];
    if (!reg) throw "Unknown device ID";

    const def = deviceDefs[reg.name.replace('-', '_')];
    if (!def) throw "No definition";

    const result = structuredClone(def.base);

    for (let v = 1; v <= version; v++) {
        if (def.versions?.[v]) {
            mergeDeep(result, def.versions[v]);
        }
    }

    return result;
}

export function mergeDeep(base, override) {
    for (const k in override) {
        const v = override[k];

        if (v === null) {
            delete base[k];
        } else if (typeof v === 'object' && !Array.isArray(v)) {
            base[k] ??= {};
            mergeDeep(base[k], v);
        } else {
            base[k] = v;
        }
    }
}
