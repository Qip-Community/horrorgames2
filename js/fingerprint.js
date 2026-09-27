class Fingerprint {
    constructor() {
        this.data = this.collect();
    }

    collect() {
        const ua = navigator.userAgent;
        return {
            browser: this.detectBrowser(ua),
            os: this.detectOS(ua),
            language: navigator.language,
            screen: `${screen.width}×${screen.height}`,
            viewport: `${innerWidth}×${innerHeight}`,
            cores: navigator.hardwareConcurrency || '—',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString('ru-RU'),
            touch: 'ontouchstart' in window,
            network: navigator.connection?.effectiveType || '—',
            battery: null,
            gpu: this.detectGPU(),
        };
    }

    detectBrowser(ua) {
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        return 'Неизвестный';
    }

    detectOS(ua) {
        if (/Windows/.test(ua)) return 'Windows';
        if (/Mac OS/.test(ua)) return 'macOS';
        if (/Android/.test(ua)) return 'Android';
        if (/iPhone|iPad/.test(ua)) return 'iOS';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Неизвестная';
    }

    detectGPU() {
        try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl');
            if (!gl) return '—';
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) return gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        } catch (e) {}
        return '—';
    }

    async initBattery() {
        if (!navigator.getBattery) return;
        try {
            const bat = await navigator.getBattery();
            this.data.battery = {
                level: Math.round(bat.level * 100),
                charging: bat.charging,
            };
        } catch (e) {}
    }

    getFacts() {
        const facts = [
            `Ты в ${this.data.timezone.split('/').pop()?.replace(/_/g, ' ')}`,
            `Твоё время: ${this.data.localTime}`,
            `Браузер: ${this.data.browser} · ${this.data.os}`,
            `Экран: ${this.data.screen}`,
            `Ядер CPU: ${this.data.cores}`,
            `Язык: ${this.data.language}`,
            `Сеть: ${this.data.network}`,
        ];
        if (this.data.battery) {
            facts.push(`Батарея: ${this.data.battery.level}%${this.data.battery.charging ? ' (заряжается)' : ''}`);
        }
        if (this.data.touch) facts.push('Ты держишь меня в руках');
        if (this.data.gpu !== '—') facts.push(`GPU: ${this.data.gpu.slice(0, 30)}`);
        return facts;
    }

    getRandomFact() {
        const facts = this.getFacts();
        return facts[Math.floor(Math.random() * facts.length)];
    }
}

const fingerprint = new Fingerprint();