let ctx, osc, gain, playing = false;

function sleepInterruptible(ms, isPlaying) {
    return new Promise(resolve => {

        const start = Date.now();

        function check() {

            if (!isPlaying()) {
                return resolve(false); // interrompido
            }

            const elapsed = Date.now() - start;

            if (elapsed >= ms) {
                return resolve(true); // terminou normal
            }

            requestAnimationFrame(check);
        }

        check();
    });
}

export async function playAudio( music, onStep ) {

    ctx = new AudioContext();
    osc = ctx.createOscillator();
    gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    playing = true;

    for (let i = 0; i < music.length; i++) {

        if (!playing) break;

        const n = music[i];

        onStep?.(i);

        if (n.freq > 0) {
            osc.frequency.setValueAtTime(n.freq, ctx.currentTime);
            gain.gain.setValueAtTime(1, ctx.currentTime);
        } else {
            gain.gain.setValueAtTime(0, ctx.currentTime);
        }

        //await new Promise(r => setTimeout(r, n.time));
        const ok = await sleepInterruptible( n.time, () => playing );
        
        if(!ok) break;

    }

    stopAudio();
}

export function stopAudio() {
    playing = false;

    try { osc?.stop(); } catch {}
    try { ctx?.close(); } catch {}

    osc = null;
    ctx = null;
}

export function isPlaying() {
    return playing;
}



