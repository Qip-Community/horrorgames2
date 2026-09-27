class SpeechListener {
    constructor() {
        this.recognition = null;
        this.active = false;
        this.onResult = null;
        this.supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    init(lang = 'ru-RU') {
        if (!this.supported) return false;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SR();
        this.recognition.lang = lang;
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event) => {
            const last = event.results[event.results.length - 1];
            if (last.isFinal) {
                const text = last[0].transcript.trim();
                this.onResult?.(text);
            }
        };

        this.recognition.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                console.warn('Speech error:', e.error);
            }
        };

        this.recognition.onend = () => {
            if (this.active) {
                try { this.recognition.start(); } catch (e) {}
            }
        };

        return true;
    }

    start() {
        if (!this.recognition || this.active) return;
        this.active = true;
        try { this.recognition.start(); } catch (e) {}
    }

    stop() {
        if (!this.recognition) return;
        this.active = false;
        try { this.recognition.stop(); } catch (e) {}
    }
}

const speechListener = new SpeechListener();