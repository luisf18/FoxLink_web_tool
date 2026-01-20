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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}