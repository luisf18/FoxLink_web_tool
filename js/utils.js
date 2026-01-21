function clamp(v) {
    return Math.max(0, Math.min(255, v));
}

function abstractValue(byte) {
    return 5 * byte + 860;
}

function intResize( x, i, I, o, O ){
	if( i == I || x <= i ) return o;
    if( x >= I ) return O;
	return Math.floor( ((x-i)*(O-o))/(I-i) + o );
}

function intResizeClamp( x, i, I, o, O ){
	if( i == I || x <= i ) return o;
    if( x >= I ) return O;
	return Math.floor( ((x-i)*(O-o))/(I-i) + o );
}

function makeEditable(span, input, onCommit) {
    span.onclick = () => {
        const n = parseInt(span.textContent.replace(/\D/g, '')) || 0;
        input.value = n;
        span.style.display = 'none';
        input.style.display = 'inline-block';
        input.focus();
        input.select();
    };

    function commit() {
        let v = parseInt(input.value);
        if (isNaN(v)) v = 0;
        onCommit(v);
        input.style.display = 'none';
        span.style.display = 'inline';
    }

    input.onblur = commit;
    input.onkeydown = e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
            input.style.display = 'none';
            span.style.display = 'inline';
        }
    };
}

/* ==============================================
   Manipulação de Bytes
============================================== */

function stringToBytes(str, len) {
    const bytes = [];
    for (let i = 0; i < len-1; i++) {
        if (i < str.length) {
            bytes.push(str.charCodeAt(i) & 0xFF);
        } else {
            bytes.push(0x00);
        }
    }
    bytes[len-1] = 0;
    return bytes;
}

function numberToBytes(value, byteLength, signed, endian) {
    const buffer = new ArrayBuffer(byteLength);
    const view = new DataView(buffer);

    switch (byteLength) {
        case 1:
            signed ? view.setInt8(0, value) : view.setUint8(0, value);
            break;
        case 2:
            signed
                ? view.setInt16(0, value, endian === 'little')
                : view.setUint16(0, value, endian === 'little');
            break;
    }

    return Array.from(new Uint8Array(buffer));
}

function bytesToTypedValue(bytes, type = 'u8', littleEndian = true) {
    if (!Array.isArray(bytes) || bytes.length === 0)
        return null;

    // String
    if (type === 'str') {
        let out = '';

        for (const b of bytes) {
            if (b === 0x00) break;   // string C → termina no 0
            out += String.fromCharCode(b);
        }

        return out;
    }

    // Char (1 byte = 1 char)
    if (type === 'char') {
        const chars = bytes.map(b => String.fromCharCode(b));
        return chars.length === 1 ? chars[0] : chars;
    }

    // Numéricos
    const match = type.match(/^([ui])(\d+)$/);
    if (!match) return null;

    const signed   = match[1] === 'i';
    const bits     = parseInt(match[2], 10);
    const typeSize = bits / 8;

    if (![1, 2, 4].includes(typeSize))
        return null;

    if (bytes.length % typeSize !== 0)
        return null;

    const values = [];
    const buffer = new ArrayBuffer(typeSize);
    const view   = new DataView(buffer);

    for (let i = 0; i < bytes.length; i += typeSize) {
        
        for (let j = 0; j < typeSize; j++) {
            view.setUint8(j, bytes[i + j] & 0xFF);
        }

        let value;
        switch (typeSize) {
            case 1:
                value = signed
                    ? view.getInt8(0)
                    : view.getUint8(0);
                break;

            case 2:
                value = signed
                    ? view.getInt16(0, littleEndian)
                    : view.getUint16(0, littleEndian);
                break;

            case 4:
                value = signed
                    ? view.getInt32(0, littleEndian)
                    : view.getUint32(0, littleEndian);
                break;
        }

        values.push(value);
    }

    return values.length === 1 ? values[0] : values;
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}