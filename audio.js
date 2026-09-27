/* ============================================================
   AUDIO ENGINE — генерируем хоррор-звуки программно
   ============================================================ */

class HorrorAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
        this.whisperNode = null;
        this.heartbeatInterval = null;
        this.heartbeatRate = 1000; // мс между ударами
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /* ===== Шёпот: отфильтрованный шум ===== */
    startWhisper() {
        if (!this.initialized) return;
        if (this.whisperNode) return;

        // Белый шум
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Полосовой фильтр для "шёпота"
        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1200;
        bandpass.Q.value = 8;

        // Модуляция частоты — имитация речи
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 3.5;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 400;
        lfo.connect(lfoGain);
        lfoGain.connect(bandpass.frequency);

        // Амплитудная модуляция
        const ampLfo = this.ctx.createOscillator();
        ampLfo.frequency.value = 2.2;
        const ampGain = this.ctx.createGain();
        ampGain.gain.value = 0.5;
        ampLfo.connect(ampGain);

        const whisperGain = this.ctx.createGain();
        whisperGain.gain.value = 0.08;

        noise.connect(bandpass);
        bandpass.connect(whisperGain);
        whisperGain.connect(this.masterGain);
        ampGain.connect(whisperGain.gain);

        noise.start();
        lfo.start();
        ampLfo.start();

        this.whisperNode = { noise, lfo, ampLfo, whisperGain };
    }

    stopWhisper() {
        if (this.whisperNode) {
            try {
                this.whisperNode.noise.stop();
                this.whisperNode.lfo.stop();
                this.whisperNode.ampLfo.stop();
            } catch (e) {}
            this.whisperNode = null;
        }
    }

    /* ===== Сердцебиение ===== */
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

    setHeartbeatRate(ms) {
        this.heartbeatRate = ms;
    }

    playHeartbeat() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Один "тук" — низкий синус с быстрым затуханием
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.35);

        // Второй удар (дубль) с задержкой
        setTimeout(() => {
            if (!this.initialized) return;
            const now2 = this.ctx.currentTime;
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(55, now2);
            osc2.frequency.exponentialRampToValueAtTime(25, now2 + 0.15);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0, now2);
            gain2.gain.linearRampToValueAtTime(0.4, now2 + 0.01);
            gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.25);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(now2);
            osc2.stop(now2 + 0.3);
        }, 200);
    }

    /* ===== Резкий "удар"/скример ===== */
    playStinger() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        // Высокочастотный визг
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 3000;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.7);

        // Шумовой удар
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.3;
        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
    }

    /* ===== Низкий гул (drone) ===== */
    startDrone() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;

        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 45;

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 47; // биения

        const gain = this.ctx.createGain();
        gain.gain.value = 0.15;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc1.start();
        osc2.start();

        this.droneNode = { osc1, osc2, gain };
    }

    stopDrone() {
        if (this.droneNode) {
            try {
                this.droneNode.osc1.stop();
                this.droneNode.osc2.stop();
            } catch (e) {}
            this.droneNode = null;
        }
    }

    /* ===== Финальный "взрыв" ===== */
    playFinale() {
        if (!this.initialized) return;
        this.playStinger();
        setTimeout(() => this.playStinger(), 300);
        setTimeout(() => this.playStinger(), 600);

        // Долгий низкий гул
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.1);
    }
}

const horrorAudio = new HorrorAudio();