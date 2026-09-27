class HorrorAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
        this.whisperNode = null;
        this.droneNode = null;
        this.heartbeatInterval = null;
        this.heartbeatRate = 1000;
    }

    init() {
        if (this.initialized) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
    setVolume(v) { if (this.masterGain) this.masterGain.gain.value = v; }

    startWhisper() {
        if (!this.initialized || this.whisperNode) return;
        const bs = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf; noise.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 8;
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 3.5;
        const lg = this.ctx.createGain(); lg.gain.value = 400;
        lfo.connect(lg); lg.connect(bp.frequency);
        const ampLfo = this.ctx.createOscillator(); ampLfo.frequency.value = 2.2;
        const ampG = this.ctx.createGain(); ampG.gain.value = 0.5;
        ampLfo.connect(ampG);
        const wg = this.ctx.createGain(); wg.gain.value = 0.09;
        noise.connect(bp); bp.connect(wg); wg.connect(this.masterGain);
        ampG.connect(wg.gain);
        noise.start(); lfo.start(); ampLfo.start();
        this.whisperNode = { noise, lfo, ampLfo };
    }

    stopWhisper() {
        if (!this.whisperNode) return;
        try {
            this.whisperNode.noise.stop();
            this.whisperNode.lfo.stop();
            this.whisperNode.ampLfo.stop();
        } catch (e) {}
        this.whisperNode = null;
    }

    startHeartbeat() {
        if (!this.initialized || this.heartbeatInterval) return;
        const beat = () => {
            this.playHeartbeat();
            this.heartbeatInterval = setTimeout(beat, this.heartbeatRate);
        };
        beat();
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearTimeout(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    setHeartbeatRate(ms) { this.heartbeatRate = ms; }

    playHeartbeat() {
        if (!this.initialized) return;
        const play = (freq, vol, dur, delay) => {
            setTimeout(() => {
                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t);
                osc.frequency.exponentialRampToValueAtTime(25, t + dur);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(vol, t + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.connect(g); g.connect(this.masterGain);
                osc.start(t); osc.stop(t + dur + 0.05);
            }, delay);
        };
        play(60, 0.6, 0.3, 0);
        play(55, 0.4, 0.25, 200);
    }

    playStinger() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 3000;
        osc.connect(f); f.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + 0.7);
        const bs = this.ctx.sampleRate * 0.5;
        const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bs);
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const ng = this.ctx.createGain(); ng.gain.value = 0.3;
        noise.connect(ng); ng.connect(this.masterGain);
        noise.start(now);
    }

    startDrone() {
        if (!this.initialized || this.droneNode) return;
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine'; osc1.frequency.value = 45;
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine'; osc2.frequency.value = 47;
        const g = this.ctx.createGain(); g.gain.value = 0.15;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 200;
        osc1.connect(f); osc2.connect(f);
        f.connect(g); g.connect(this.masterGain);
        osc1.start(); osc2.start();
        this.droneNode = { osc1, osc2 };
    }

    stopDrone() {
        if (!this.droneNode) return;
        try { this.droneNode.osc1.stop(); this.droneNode.osc2.stop(); } catch (e) {}
        this.droneNode = null;
    }

    playLaugh() {
        if (!this.initialized) return;
        const base = 180 + Math.random() * 60;
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(base - i * 5, t);
                osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.08);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.15, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                const f = this.ctx.createBiquadFilter();
                f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 4;
                osc.connect(f); f.connect(g); g.connect(this.masterGain);
                osc.start(t); osc.stop(t + 0.15);
            }, i * 130 + Math.random() * 20);
        }
    }

    playMessageBlip(isScary = false) {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = isScary ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(isScary ? 400 : 800, t);
        osc.frequency.exponentialRampToValueAtTime(isScary ? 80 : 400, t + 0.15);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(t); osc.stop(t + 0.2);
    }

    playVoiceBubble() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120 + Math.random() * 60, t);
        for (let i = 0; i < 6; i++) {
            osc.frequency.setValueAtTime(100 + Math.random() * 80, t + i * 0.08);
        }
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 6;
        osc.connect(f); f.connect(g); g.connect(this.masterGain);
        osc.start(t); osc.stop(t + 0.65);
    }

    playFullScream() {
        if (!this.initialized) return;
        this.playStinger();
        setTimeout(() => this.playStinger(), 100);
        setTimeout(() => this.playLaugh(), 200);
        setTimeout(() => {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
            osc.frequency.exponentialRampToValueAtTime(100, t + 1);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.6, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            osc.connect(g); g.connect(this.masterGain);
            osc.start(t); osc.stop(t + 1.3);
        }, 300);
    }

    playFinale() {
        if (!this.initialized) return;
        this.playStinger();
        setTimeout(() => this.playStinger(), 300);
        setTimeout(() => this.playStinger(), 600);
        setTimeout(() => this.playLaugh(), 900);
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 3);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 3);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + 3.1);
    }

    playResolution() {
        if (!this.initialized) return;
        [220, 330, 440].forEach((freq, i) => {
            setTimeout(() => {
                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                osc.type = 'sine'; osc.frequency.value = freq;
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.15, t + 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
                osc.connect(g); g.connect(this.masterGain);
                osc.start(t); osc.stop(t + 1.6);
            }, i * 200);
        });
    }

    stopAll() {
        this.stopWhisper();
        this.stopHeartbeat();
        this.stopDrone();
    }
}

const horrorAudio = new HorrorAudio();