export function rtttl_to_buf(data, options) {
    const {
        name = "rtttl_song",
        minFreq = 1,
        normalize = false,
        useUint8 = false,
        scaleF = 1,
        scaleT = 1,
        offsetMin = false
    } = options;

    let processed = data.map(n => ({ ...n }));

    let normFactor = 1;
    let offsetValue = 0;

    const warnings = {
        offsetClamp: false,
        overflow: false
    };

    const itemsMeta = [];

    // NORMALIZAÇÃO
    if (normalize) {
        const freqs = processed.map(n => n.freq).filter(f => f > 0);

        if (freqs.length > 0) {
            const minFreqIn = Math.min(...freqs);

            if (minFreq > minFreqIn) {
                normFactor = minFreq / minFreqIn;

                processed = processed.map(n => ({
                    freq: n.freq > 0 ? n.freq * normFactor : 0,
                    time: n.time
                }));
            }
        }
    }

    // OFFSET
    if (offsetMin) {
        const freqs = processed.map(n => n.freq).filter(f => f > 0);

        if (freqs.length > 0) {
            offsetValue = Math.max(minFreq - 1, 0);

            processed = processed.map(n => {
                if (n.freq > 0) {
                    const shifted = n.freq - offsetValue;

                    if (shifted < 1) {
                        warnings.offsetClamp = true;
                    }

                    return {
                        freq: Math.max(1, shifted),
                        time: n.time
                    };
                }
                return n;
            });
        }
    }

    // ARRAY FINAL
    const values = [];

    processed.forEach((n, i) => {

        let f = useUint8
            ? Math.round(n.freq / scaleF)
            : Math.round(n.freq);

        let t = useUint8
            ? Math.round(n.time / scaleT)
            : Math.round(n.time);

        let comment = null;

        if (useUint8 && (f > 255 || t > 255)) {
            warnings.overflow = true;
            comment = "warn overflow";
        }

        values.push(f, t);

        itemsMeta.push({
            index: i,
            freq: f,
            time: t,
            comment
        });
    });

    return {
        name,
        values,
        itemsMeta,
        meta: {
            useUint8,
            scaleF,
            scaleT,
            normalize,
            normFactor,
            offsetMin,
            offsetValue
        },
        warnings
    };
}


export function rtttl_to_fxesc_format(data) {

    const minFreq = 800;

    let factor = 1;

    let processed = data.map(n => ({ ...n }));

    let warn = 1;

    const scaleF = 32;
    const scaleT = 16;

    // NORMALIZAÇÃO e OFFSET
    const freqs = processed.map(n => n.freq).filter(f => f > 0);
    if (freqs.length > 0) {
        const minFreqIn = Math.min(...freqs);
        let use_norm = false;
        if(minFreq > minFreqIn) {
            use_norm = true;
            factor = minFreq / minFreqIn;
        }
        processed = processed.map(n => ({
            freq: (
                n.freq > 0 ?
                Math.max(n.freq * factor - minFreq + scaleF, scaleF) :
                0
            ),
            time: n.time
        }));
    }

    // ARRAY FINAL
    const values = [];

    processed.forEach((n, i) => {
        let f = Math.round(n.freq / scaleF);
        let t = Math.round(n.time / scaleT);
        if( (f > 255 || t > 255) ){
            f  = Math.min(f,255);
            t  = Math.min(t,255);
            warn = true;
        }
        values.push(f, t);
    });

    return {
        values,
        warn,
        factor
    };
}


export function rtttl_to_freq_and_time(rtttl) {

    const NOTE_FREQ = {
        c: 261.63, 'c#': 277.18,
        d: 293.66, 'd#': 311.13,
        e: 329.63,
        f: 349.23, 'f#': 369.99,
        g: 392.00, 'g#': 415.30,
        a: 440.00, 'a#': 466.16,
        b: 493.88
    };

    const parts = rtttl.split(':');
    if (parts.length < 3) return [];

    // defaults RTTTL
    let duration = 4;
    let octave = 6;
    let bpm = 63;

    // parse config
    parts[1].split(',').forEach(p => {
        let [k, v] = p.split('=');
        if (!v) return;

        if (k === 'd') duration = parseInt(v);
        if (k === 'o') octave = parseInt(v);
        if (k === 'b') bpm = parseInt(v);
    });

    const wholeNote = (60 / bpm) * 4; // duração de semibreve

    const result = [];

    parts[2].split(',').forEach(raw => {

        raw = raw.trim().toLowerCase();

        // regex robusta RTTTL
        const match = raw.match(/^(\d+)?([a-gp])(#?)(\d)?(\.?)$/);

        if (!match) return;

        let [
            _,
            durStr,
            note,
            sharp,
            octStr,
            dot
        ] = match;

        let dur = durStr ? parseInt(durStr) : duration;
        let oct = octStr ? parseInt(octStr) : octave;
        let dotted = dot === '.';

        if (sharp) note += '#';

        // tempo
        let time = wholeNote / dur;
        if (dotted) time *= 1.5;

        // frequência
        let freq = 0;

        if (note !== 'p') {
            const base = NOTE_FREQ[note];
            if (base) {
                freq = base * Math.pow(2, oct - 4);
            }
        }

        result.push({
            freq,
            time: time * 1000 // ms
        });
    });

    return result;
}

export function fxesc_format_to_freq_time( buf, withHeader = false ){
    const buf_size = buf.length;
    let start_idx = 0;
    const result = [];
    if( withHeader ){
        if( (buf_size < 2) || (buf[0] == 0xFF) || (buf_size<(buf[1]+2)) ) return result;
        start_idx = 2;
    }
    const len = 2*( withHeader ? buf[1] : buf_size );
    for( let i=0; i<len; i+=2 ){
        const freq = ( buf[i+start_idx] ? (buf[i+start_idx]<<5)+(800-32) : 0 );
        const time = (buf[i+1+start_idx]<<4);
        result.push( { freq, time } );
    }
    return result;
}

// Converter de volta
const NOTE_TABLE = [
    { name: "c",  freq: 261.63 },
    { name: "c#", freq: 277.18 },
    { name: "d",  freq: 293.66 },
    { name: "d#", freq: 311.13 },
    { name: "e",  freq: 329.63 },
    { name: "f",  freq: 349.23 },
    { name: "f#", freq: 369.99 },
    { name: "g",  freq: 392.00 },
    { name: "g#", freq: 415.30 },
    { name: "a",  freq: 440.00 },
    { name: "a#", freq: 466.16 },
    { name: "b",  freq: 493.88 }
];

function freqToNote(freq) {
    if (freq <= 0) return { note: "p", octave: 0 };

    let best = null;
    let minErr = Infinity;

    for (let oct = 3; oct <= 7; oct++) {
        for (let n of NOTE_TABLE) {
            const f = n.freq * Math.pow(2, oct - 4);
            const err = Math.abs(f - freq);

            if (err < minErr) {
                minErr = err;
                best = { note: n.name, octave: oct };
            }
        }
    }

    return best;
}

function estimateBPM(data) {

    const times = data
        .map(n => n.time)
        .filter(t => t > 0);

    if (times.length === 0) return 120;

    const minTime = Math.min(...times);

    // assume menor valor = menor nota (tipo 1/16)
    const quarter = minTime * 4;

    const bpm = Math.round(60000 / quarter);

    return Math.max(40, Math.min(240, bpm)); // clamp
}

function estimateBaseDuration(data, bpm) {

    const whole = (60 / bpm) * 4 * 1000;

    const durations = [1, 2, 4, 8, 16, 32];

    let best = 4;
    let bestErr = Infinity;

    for (let d of durations) {

        let errSum = 0;

        for (let n of data) {
            const expected = whole / d;
            errSum += Math.abs(expected - n.time);
        }

        if (errSum < bestErr) {
            bestErr = errSum;
            best = d;
        }
    }

    return best;
}

export function freqTimeToRTTTL(data, name = "music") {

    const bpm = estimateBPM(data);
    const baseDur = estimateBaseDuration(data, bpm);

    const whole = (60 / bpm) * 4 * 1000;

    const notes = data.map(n => {

        // duração relativa
        let dur = whole / n.time;

        // aproxima para valores válidos
        const allowed = [1,2,4,8,16,32];
        let bestDur = allowed[0];
        let minErr = Infinity;

        for (let d of allowed) {
            const err = Math.abs(d - dur);
            if (err < minErr) {
                minErr = err;
                bestDur = d;
            }
        }

        // dotted?
        let dotted = false;
        const dottedTime = (whole / bestDur) * 1.5;

        if (Math.abs(dottedTime - n.time) < Math.abs((whole / bestDur) - n.time)) {
            dotted = true;
        }

        // nota
        const { note, octave } = freqToNote(n.freq);

        if (note === "p") {
            return `${bestDur}p${dotted ? "." : ""}`;
        }

        return `${bestDur}${note}${octave}${dotted ? "." : ""}`;
    });

    return `${name}:d=${baseDur},o=5,b=${bpm}:${notes.join(",")}`;
}
