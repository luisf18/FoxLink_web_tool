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
