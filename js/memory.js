class Memory {
    constructor() {
        this.key = 'lollipop_memory_v4';
        this.data = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return this.default();
            return { ...this.default(), ...JSON.parse(raw) };
        } catch (e) { return this.default(); }
    }

    default() {
        return {
            visits: 0, firstVisit: null, lastVisit: null,
            totalTime: 0, maxThreat: 0,
            facesDetected: 0, faceLost: 0,
            endings: [], emotions: {},
            chatsCompleted: 0, lastChatPartner: null,
            playerMessages: [], names: [],
        };
    }

    save() {
        try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
    }

    registerVisit() {
        this.data.visits++;
        const now = Date.now();
        if (!this.data.firstVisit) this.data.firstVisit = now;
        this.data.lastVisit = now;
        this.save();
    }

    addTime(s) { this.data.totalTime += s; this.save(); }
    updateThreat(v) { if (v > this.data.maxThreat) { this.data.maxThreat = v; this.save(); } }
    addFaceDetected() { this.data.facesDetected++; this.save(); }
    addFaceLost() { this.data.faceLost++; this.save(); }

    addEmotion(e) {
        if (!e) return;
        this.data.emotions[e] = (this.data.emotions[e] || 0) + 1;
        this.save();
    }

    addEnding(id) {
        if (!this.data.endings.includes(id)) {
            this.data.endings.push(id);
            this.save();
        }
    }

    addPlayerMessage(msg) {
        if (!msg || msg.length < 2) return;
        this.data.playerMessages.push({ text: msg.slice(0, 100), time: Date.now() });
        if (this.data.playerMessages.length > 10) this.data.playerMessages.shift();
        this.save();
    }

    addName(name) {
        if (!name || name.length < 2 || name.length > 30) return;
        if (!this.data.names.includes(name)) {
            this.data.names.push(name);
            this.save();
        }
    }

    completeChat(partnerId) {
        this.data.chatsCompleted++;
        this.data.lastChatPartner = partnerId;
        this.save();
    }

    hasEnding(id) { return this.data.endings.includes(id); }
    isReturning() { return this.data.visits > 1; }

    getReturningMessage() {
        const days = this.data.lastVisit
            ? Math.floor((Date.now() - this.data.lastVisit) / (1000 * 60 * 60 * 24))
            : 0;
        const mins = Math.floor(this.data.totalTime / 60);

        let when = 'недавно';
        if (days === 0) when = 'совсем недавно';
        else if (days === 1) when = 'вчера';
        else if (days < 7) when = `${days} дней назад`;
        else when = `больше недели назад`;

        const topEmotion = Object.entries(this.data.emotions)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        const map = {
            happy: 'улыбался', sad: 'грустил', angry: 'злился',
            fearful: 'боялся', disgusted: 'был в отвращении',
            surprised: 'удивлялся', neutral: 'был без эмоций',
        };

        let lastMessage = '';
        if (this.data.playerMessages.length > 0) {
            const last = this.data.playerMessages[this.data.playerMessages.length - 1];
            lastMessage = `<br>Ты писал: <span class="red">«${last.text}»</span>`;
        }

        let nameLine = '';
        if (this.data.names.length > 0) {
            nameLine = `<br>Ты назвался: <span class="red">${this.data.names.join(', ')}</span>`;
        }

        return `
            Это твой визит <span class="red">№${this.data.visits}</span><br>
            В прошлый раз ты был ${when}.<br>
            Ты провёл здесь <span class="red">${mins} мин</span>.<br>
            ${topEmotion ? `Чаще всего ты ${map[topEmotion] || topEmotion}.` : ''}
            ${this.data.chatsCompleted > 0 ? `<br>Ты общался с <span class="red">${this.data.chatsCompleted}</span> из них.` : ''}
            ${lastMessage}
            ${nameLine}
            ${this.data.faceLost > 3 ? '<br>Ты часто отворачивался. Мне это не нравится.' : ''}
        `;
    }

    forget() {
        try { localStorage.removeItem(this.key); } catch (e) {}
        this.data = this.default();
    }
}

const memory = new Memory();