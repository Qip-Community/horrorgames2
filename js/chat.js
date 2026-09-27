/* ============================================================
   VIDEOCALL v5 — голос + текст, гибридный режим
   ============================================================ */

const CHARACTERS = [
    {
        id: 'alex', name: 'Алекс', status: 'был(а) в сети только что',
        intro: ['Привет. Я тебя вижу.', 'Хорошо, что ты ответил.', 'Ты один?'],
        responses: [
            { keys: ['да', 'yes'], reply: 'Хорошо. Я не люблю, когда смотрят.' },
            { keys: ['нет', 'no'], reply: 'Кто ещё? Покажи мне.' },
            { keys: ['привет', 'hi', 'здравствуй'], reply: 'Здравствуй. Хорошо выглядишь. Я смотрю.' },
            { keys: ['кто', 'who'], reply: 'Я тот, кого ты удалил из друзей. Я вернулся.' },
            { keys: ['что надо', 'чего'], reply: 'Просто посмотреть. Ты против?' },
            { keys: ['уходи', 'bye'], reply: 'Я не могу. Ты не можешь отключиться. Не сейчас.' },
            { keys: ['имя', 'зовут'], reply: 'Я помню твоё. Назови своё — я проверю.' },
        ],
        scare: ['Я ВИЖУ ТЕБЯ ПРЯМО СЕЙЧАС', 'ОБЕРНИСЬ', 'ОНО СЗАДИ', 'НЕ ЗАКРЫВАЙ ГЛАЗА'],
        endingId: 'friend',
    },
    {
        id: 'maria', name: 'Мария', status: 'печатает...',
        intro: ['Наконец-то.', 'Я так долго ждала тебя.', 'Почему ты удалил меня?'],
        responses: [
            { keys: ['привет', 'hi'], reply: 'Я ждала тебя. Ты знал это.' },
            { keys: ['кто ты', 'кто'], reply: 'Ты не помнишь? Я была у тебя дома. Вчера.' },
            { keys: ['помню', 'знаю'], reply: 'Лжец. Ты не помнишь.' },
            { keys: ['уходи', 'прочь'], reply: 'Я внутри камеры. Внутри тебя. Я не уйду.' },
            { keys: ['люблю', 'love'], reply: 'Тогда почему ты отвернулся? Я видела.' },
            { keys: ['страшно', 'боюсь'], reply: 'Правильно.' },
        ],
        scare: ['ТВОЙ ПУЛЬС УСКОРИЛСЯ', 'НЕ СМОТРИ ЗА СПИНУ', 'Я УЖЕ ЗДЕСЬ', 'Я СЛЫШУ ТВОЙ ВЫДОХ'],
        endingId: 'obsessed',
    },
    {
        id: 'unknown', name: '░░░░░', status: 'онлайн',
        intro: ['...', 'Ты меня видишь?', 'Я тебя — да.'],
        responses: [
            { keys: ['?', 'что'], reply: '░░░░░░░░░░░░' },
            { keys: ['кто'], reply: 'У меня нет имени. Только твоё.' },
            { keys: ['привет'], reply: 'Не называй меня. Я не помню.' },
            { keys: ['помогу', 'help'], reply: 'Ты уже помог. Ты разрешил камеру.' },
            { keys: ['уйди', 'bye'], reply: 'Меня нет. Как я могу уйти?' },
        ],
        scare: ['ПРОСНИСЬ', 'ЗА ТОБОЙ', 'ЭТО НЕ ИГРА', 'Я ЗНАЮ ГДЕ ТЫ'],
        endingId: 'revealed',
    },
    {
        id: 'nick', name: 'Ник', status: 'был в сети 5 лет назад',
        intro: ['Ты думал, меня нет.', 'Но я здесь.', 'Я всегда был здесь.'],
        responses: [
            { keys: ['жив', 'живой'], reply: 'Сложный вопрос. Сложный ответ.' },
            { keys: ['привет'], reply: 'Привет. Извини, что давно не писал. Мне не давали.' },
            { keys: ['где ты'], reply: 'Я в комнате, которую ты видишь на экране.' },
            { keys: ['боюсь', 'страшно'], reply: 'И правильно.' },
            { keys: ['помоги', 'help'], reply: 'Помочь? Я и есть то, от чего ты бежишь.' },
        ],
        scare: ['Я ОТКРЫВАЮ ДВЕРЬ', 'УЖЕ ПОЗДНО', 'ОНО ЗДЕСЬ', 'Я ВИЖУ КАЖДЫЙ ТВОЙ ВДОХ'],
        endingId: 'betrayed',
    },
];

const CORRUPTED_LINES = [
    'Твой IP-адрес записан.',
    'Я знаю твоё имя.',
    'Камера всё ещё включена.',
    'Ты не один в комнате.',
    'Оно смотрит.',
    'Мы все смотрим.',
    'Твой микрофон включён.',
    'Твоё окно открыто.',
];

class VoiceInput {
    constructor() {
        this.recognition = null;
        this.stream = null;
        this.audioCtx = null;
        this.analyser = null;
        this.rafId = null;
        this.active = false;
        this.supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.onResult = null;
        this.onLevel = null;
        this.onStart = null;
        this.onEnd = null;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e) {
            console.warn('Микрофон недоступен:', e);
            return { ok: false, reason: 'no-mic' };
        }

        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioCtx.createMediaStreamSource(this.stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            this._startLevelLoop();
        } catch (e) {
            console.warn('Analyser не создан:', e);
        }

        if (this.supported) {
            try {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SR();
                this.recognition.lang = 'ru-RU';
                this.recognition.continuous = true;
                this.recognition.interimResults = false;
                this.recognition.maxAlternatives = 1;

                this.recognition.onresult = (event) => {
                    const last = event.results[event.results.length - 1];
                    if (last.isFinal) {
                        const text = last[0].transcript.trim();
                        if (text) this.onResult?.(text);
                    }
                };
                this.recognition.onerror = (e) => {
                    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                        console.warn('Распознавание речи запрещено');
                        this.active = false;
                    }
                };
                this.recognition.onend = () => {
                    if (this.active) {
                        try { this.recognition.start(); } catch (e) {}
                    }
                };

                this.active = true;
                this.recognition.start();
                this.onStart?.();
                return { ok: true, hasSpeechRecognition: true };
            } catch (e) {
                console.warn('SpeechRecognition не запустился:', e);
                return { ok: true, hasSpeechRecognition: false };
            }
        }

        return { ok: true, hasSpeechRecognition: false };
    }

    _startLevelLoop() {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        const loop = () => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;
            const percent = Math.min(100, (avg / 128) * 100 * 1.8);
            this.onLevel?.(percent);
            this.rafId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        this.active = false;
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
            this.recognition = null;
        }
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch (e) {}
            this.audioCtx = null;
        }
        this.analyser = null;
        this.onEnd?.();
    }
}

const voiceInput = new VoiceInput();

class VideoChat {
    constructor() {
        this.nameEl = document.getElementById('vc-name');
        this.statusEl = document.getElementById('vc-status');
        this.timerEl = document.getElementById('vc-timer');
        this.themVideo = document.getElementById('webcam-them');
        this.selfVideo = document.getElementById('webcam-self');
        this.glitchCanvas = document.getElementById('vc-glitch-canvas');
        this.thinking = document.getElementById('vc-thinking');
        this.subtitle = document.getElementById('vc-subtitle');
        this.nameOverlay = document.getElementById('vc-name-overlay');

        this.input = document.getElementById('vc-input');
        this.sendBtn = document.getElementById('vc-send-btn');
        this.micBar = document.getElementById('vc-mic-bar');
        this.micLevelFill = document.getElementById('vc-mic-level-fill');
        this.micStatus = document.getElementById('vc-mic-status');
        this.modeHint = document.getElementById('vc-mode-hint');

        this.btnMute = document.getElementById('vc-mute');
        this.btnCam = document.getElementById('vc-cam');
        this.btnHangup = document.getElementById('vc-hangup');

        this.activeCharacter = null;
        this.playerMessagesSent = 0;
        this.completed = false;
        this.chatEndings = {};
        this.callTimer = null;
        this.callSeconds = 0;

        this.subtitleTimeout = null;
        this.subtitleHideTimeout = null;
        this.subtitleTickTimeout = null;
        this.silenceTimeout = null;
        this.introTimeout = null;
        this.replyTimeout = null;
        this.screamTimeout = null;
        this.forceTimeout = null;
        this.glRafId = null;

        this.isThinking = false;
        this.sessionId = 0;
        this.voiceEnabled = false;

        this.bindEvents();
    }

    bindEvents() {
        this.input.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.handlePlayerMessage();
        });
        this.sendBtn.addEventListener('click', () => this.handlePlayerMessage());

        this.btnHangup.addEventListener('click', () => {
            if (this.completed) return;
            this.playSubtitle('Ты не можешь отключиться. Не сейчас.', 3000);
            horrorAudio.playStinger();
            this.forceGlitch(2);
        });

        this.btnMute.addEventListener('click', () => {
            this.btnMute.classList.toggle('vc-btn-active');
            const active = this.btnMute.classList.contains('vc-btn-active');

            if (active && !this.voiceEnabled) {
                this.enableVoice();
            } else if (!active && this.voiceEnabled) {
                this.disableVoice();
                this.playSubtitle('Теперь я не слышу тебя. Но вижу.', 2500);
            }
        });

        this.btnCam.addEventListener('click', () => {
            this.btnCam.classList.toggle('vc-btn-active');
            if (!this.btnCam.classList.contains('vc-btn-active')) {
                this.playSubtitle('Ты выключил камеру. Я всё равно вижу.', 2500);
                horrorAudio.playStinger();
            }
        });
    }

    async enableVoice() {
        this.micStatus.textContent = 'Микрофон: подключение...';

        voiceInput.onResult = (text) => this.handleVoiceInput(text);
        voiceInput.onLevel = (percent) => {
            this.micLevelFill.style.width = percent + '%';
            if (percent > 15 && !this.isThinking && !this.completed) {
                this.thinking.classList.add('active');
            } else if (percent <= 15 && !this.isThinking && !this.completed) {
                this.thinking.classList.remove('active');
            }
        };

        const result = await voiceInput.start();

        if (!result.ok) {
            this.voiceEnabled = false;
            this.btnMute.classList.remove('vc-btn-active');
            this.micBar.classList.add('unavailable');
            this.micStatus.textContent = 'Микрофон: нет доступа';
            this.modeHint.textContent = '📝 Пиши в поле ниже — я слушаю другим способом.';
            return;
        }

        this.voiceEnabled = true;
        this.micBar.classList.add('listening');
        this.micBar.classList.remove('unavailable');

        if (result.hasSpeechRecognition) {
            this.micStatus.textContent = '🎤 Слушаю тебя';
            this.modeHint.textContent = '🎤 Говори — я слышу. Или пиши.';
        } else {
            this.micStatus.textContent = '🎤 Микрофон есть, распознавание не поддерживается';
            this.modeHint.textContent = '📝 Пиши — браузер не умеет слушать.';
        }
    }

    disableVoice() {
        voiceInput.stop();
        this.voiceEnabled = false;
        this.micBar.classList.remove('listening');
        this.micLevelFill.style.width = '0%';
        this.micStatus.textContent = 'Микрофон: выключен';
        this.modeHint.textContent = '📝 Пиши в поле ниже.';
        this.thinking.classList.remove('active');
    }

    handleVoiceInput(text) {
        if (this.completed) return;
        this.playSubtitle('Ты: ' + text, 1800);
        horrorAudio.playMessageBlip();
        this.processPlayerText(text);
    }

    handlePlayerMessage() {
        const text = this.input.value.trim();
        if (!text || this.completed) return;
        this.input.value = '';
        horrorAudio.playMessageBlip();
        this.processPlayerText(text);
    }

    processPlayerText(text) {
        if (this.completed) return;

        clearTimeout(this.silenceTimeout);
        clearTimeout(this.replyTimeout);
        this.hideThinking();
        this.isThinking = false;

        this.playerMessagesSent++;
        memory.addPlayerMessage(text);

        const nameMatch = text.match(/(?:меня зовут|я\s+—\s+|я\s+)([А-ЯЁA-Z][а-яёa-z]+)/i);
        if (nameMatch) memory.addName(nameMatch[1]);

        const screamTriggers = ['убей', 'смерть', 'die', 'kill', 'ненавижу', 'заткнись', 'fuck'];
        if (screamTriggers.some(w => text.toLowerCase().includes(w))) {
            this.playSubtitle('...', 500);
            const sid = this.sessionId;
            this.screamTimeout = setTimeout(() => {
                if (this.sessionId === sid && !this.completed) this.triggerScream('betrayed');
            }, 800);
            return;
        }

        if (/трубк|пока|прощай|bye/i.test(text)) {
            this.playSubtitle('Ты не можешь уйти. Я уже здесь.', 3000);
            horrorAudio.playVoiceBubble();
            this.startSilenceTimer();
            return;
        }

        const char = this.activeCharacter;
        let reply = null;
        for (const r of char.responses) {
            if (r.keys.some(k => text.toLowerCase().includes(k))) {
                reply = r.reply;
                break;
            }
        }

        if (!reply) {
            if (Math.random() > 0.5) {
                reply = CORRUPTED_LINES[Math.floor(Math.random() * CORRUPTED_LINES.length)];
            } else {
                reply = char.responses[Math.floor(Math.random() * char.responses.length)].reply;
            }
        }

        if (this.playerMessagesSent % 4 === 0) {
            const sid = this.sessionId;
            this.screamTimeout = setTimeout(() => {
                if (this.sessionId === sid && !this.completed) this.triggerScream('escalate');
            }, 1500);
            return;
        }

        this.showThinking();
        this.isThinking = true;
        const sid = this.sessionId;

        this.replyTimeout = setTimeout(() => {
            if (this.sessionId !== sid || this.completed) return;
            this.hideThinking();
            this.isThinking = false;
            this.playSubtitle(reply, 3500);
            horrorAudio.playVoiceBubble();
            this.startSilenceTimer();
        }, 1000 + Math.random() * 900);
    }

    clearAllTimers() {
        clearInterval(this.callTimer);
        clearTimeout(this.subtitleTimeout);
        clearTimeout(this.subtitleHideTimeout);
        clearTimeout(this.subtitleTickTimeout);
        clearTimeout(this.silenceTimeout);
        clearTimeout(this.introTimeout);
        clearTimeout(this.replyTimeout);
        clearTimeout(this.screamTimeout);
        clearTimeout(this.forceTimeout);
        this.callTimer = null;
        this.subtitleTimeout = null;
        this.subtitleHideTimeout = null;
        this.subtitleTickTimeout = null;
        this.silenceTimeout = null;
        this.introTimeout = null;
        this.replyTimeout = null;
        this.screamTimeout = null;
        this.forceTimeout = null;
    }

    async start(webcamStream) {
        this.sessionId++;
        this.clearAllTimers();
        this.isThinking = false;

        this.activeCharacter = this.selectCharacter();
        this.playerMessagesSent = 0;
        this.completed = false;
        this.chatEndings = {};
        this.callSeconds = 0;
        this.voiceEnabled = false;

        this.nameEl.textContent = this.activeCharacter.name;
        this.statusEl.textContent = 'соединение...';
        this.statusEl.style.color = '#666';
        this.nameOverlay.textContent = this.activeCharacter.name;

        this.hideThinking();
        this.subtitle.classList.remove('show', 'scream');
        this.subtitle.textContent = '';
        this.input.value = '';
        this.timerEl.textContent = '00:00';
        this.micLevelFill.style.width = '0%';
        this.micBar.classList.remove('listening', 'unavailable');
        this.micStatus.textContent = 'Микрофон: проверка...';
        this.modeHint.textContent = '🎤 Говори — я слушаю. Или пиши.';

        if (webcamStream) {
            this.themVideo.srcObject = webcamStream;
            this.selfVideo.srcObject = webcamStream;
            Promise.all([
                this.themVideo.play().catch(() => {}),
                this.selfVideo.play().catch(() => {}),
            ]);
        }

        this.initGlitchCanvas();

        this.callTimer = setInterval(() => {
            if (this.completed) return;
            this.callSeconds++;
            const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
            const s = String(this.callSeconds % 60).padStart(2, '0');
            this.timerEl.textContent = m + ':' + s;
        }, 1000);

        this.enableVoice();

        const sid = this.sessionId;
        this.introTimeout = setTimeout(() => {
            if (this.sessionId !== sid || this.completed) return;
            this.statusEl.textContent = this.activeCharacter.status;
            this.statusEl.style.color = '#00ff44';
            this.characterIntro();
        }, 2000);
    }

    selectCharacter() {
        if (memory.data.lastChatPartner) {
            const prev = CHARACTERS.find(c => c.id === memory.data.lastChatPartner);
            if (prev && Math.random() > 0.5) return prev;
        }
        const unseen = CHARACTERS.filter(c => !memory.data.endings.includes(c.endingId));
        const pool = unseen.length ? unseen : CHARACTERS;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    characterIntro() {
        const intro = this.activeCharacter.intro;
        const sid = this.sessionId;
        let i = 0;

        const next = () => {
            if (this.sessionId !== sid || this.completed) return;
            if (i >= intro.length) {
                this.startSilenceTimer();
                return;
            }

            this.showThinking();
            const delay = 1500 + Math.random() * 800;

            this.introTimeout = setTimeout(() => {
                if (this.sessionId !== sid || this.completed) return;
                this.hideThinking();
                this.playSubtitle(intro[i], 3000);
                horrorAudio.playVoiceBubble();
                i++;
                if (i < intro.length) {
                    this.introTimeout = setTimeout(next, 2400);
                } else {
                    this.startSilenceTimer();
                }
            }, delay);
        };
        next();
    }

    startSilenceTimer() {
        clearTimeout(this.silenceTimeout);
        if (this.completed) return;
        const sid = this.sessionId;

        this.silenceTimeout = setTimeout(() => {
            if (this.sessionId !== sid || this.completed) return;
            if (this.playerMessagesSent === 0) {
                this.playSubtitle('Ты молчишь. Я не люблю тишину.', 3000);
                horrorAudio.playVoiceBubble();

                this.silenceTimeout = setTimeout(() => {
                    if (this.sessionId !== sid || this.completed) return;
                    if (this.playerMessagesSent === 0) {
                        this.triggerScream('silent');
                    }
                }, 5000);
            }
        }, 8000);
    }

    playSubtitle(text, duration, scream) {
        if (duration === undefined) duration = 3000;
        if (scream === undefined) scream = false;

        clearTimeout(this.subtitleTimeout);
        clearTimeout(this.subtitleHideTimeout);
        clearTimeout(this.subtitleTickTimeout);

        this.subtitle.classList.add('show');
        this.subtitle.classList.toggle('scream', scream);

        if (scream) {
            this.subtitle.textContent = text;
        } else {
            this.subtitle.textContent = '';
            const total = text.length;
            const speed = 40;
            let i = 0;
            const sid = this.sessionId;

            const tick = () => {
                if (this.sessionId !== sid) return;
                this.subtitle.textContent += text[i] || '';
                i++;
                if (i < total) {
                    this.subtitleTickTimeout = setTimeout(tick, speed);
                }
            };
            tick();
        }

        const hideDelay = scream
            ? duration
            : Math.max(duration, text.length * 40 + 1200);

        const sid = this.sessionId;
        this.subtitleHideTimeout = setTimeout(() => {
            if (this.sessionId !== sid) return;
            this.subtitle.classList.remove('show', 'scream');
        }, hideDelay);
    }

    showThinking() {
        this.isThinking = true;
        this.thinking.classList.add('active');
    }

    hideThinking() {
        this.isThinking = false;
        this.thinking.classList.remove('active');
    }

    triggerScream(type) {
        if (this.completed) return;
        this.completed = true;

        this.clearAllTimers();
        this.hideThinking();

        if (this.voiceEnabled) {
            voiceInput.stop();
            this.voiceEnabled = false;
            this.micBar.classList.remove('listening');
            this.micLevelFill.style.width = '0%';
            this.micStatus.textContent = 'Микрофон: отключён';
        }

        const char = this.activeCharacter;
        const scare = char.scare[Math.floor(Math.random() * char.scare.length)];

        this.chatEndings = {};
        this.chatEndings[char.endingId] = true;
        if (type === 'betrayed') this.chatEndings.betrayed = true;
        if (type === 'silent') this.chatEndings.silent = true;
        if (this.playerMessagesSent >= 15) this.chatEndings.obsessed = true;

        this.playSubtitle(scare, 2500, true);
        horrorAudio.playFullScream();

        document.body.classList.add('glitching');
        this.forceGlitch(3);

        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;background:#ff0000;z-index:200;pointer-events:none;opacity:0.75;';
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '0'; }, 400);
        setTimeout(() => flash.remove(), 1200);

        const cont = document.querySelector('.videochat-container');
        let count = 0;
        const shakeInterval = setInterval(() => {
            if (count > 20 || !cont) {
                clearInterval(shakeInterval);
                if (cont) cont.style.transform = '';
                return;
            }
            const dx = (Math.random() - 0.5) * 25;
            const dy = (Math.random() - 0.5) * 25;
            cont.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
            count++;
        }, 45);

        const sid = this.sessionId;
        this.forceTimeout = setTimeout(() => {
            if (this.sessionId !== sid) return;
            document.body.classList.remove('glitching');
            memory.completeChat(char.id);
            if (this.onComplete) this.onComplete();
        }, 3000);
    }

    initGlitchCanvas() {
        const canvas = this.glitchCanvas;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        canvas.width = canvas.clientWidth || 800;
        canvas.height = canvas.clientHeight || 600;

        const vs = 'attribute vec2 pos; varying vec2 vUv; void main() { vUv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }';
        const fs = 'precision mediump float; varying vec2 vUv; uniform float uTime; uniform float uIntensity;' +
            'float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }' +
            'void main() {' +
            '  vec2 uv = vUv;' +
            '  float scan = sin(uv.y * 700.0) * 0.05;' +
            '  float shift = (rand(vec2(floor(uv.y * 60.0), floor(uTime * 12.0))) - 0.5) * uIntensity * 0.1;' +
            '  uv.x += shift;' +
            '  float noise = rand(vec2(uv.x * 100.0, uTime)) * 0.3;' +
            '  gl_FragColor = vec4(noise * uIntensity, 0.0, 0.0, 0.5);' +
            '}';

        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        };

        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(program);
        gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW);

        const pos = gl.getAttribLocation(program, 'pos');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(program, 'uTime');
        const uIntensity = gl.getUniformLocation(program, 'uIntensity');

        this.gl = gl;
        this.glIntensity = 0.5;

        if (this.glRafId) cancelAnimationFrame(this.glRafId);

        const startTime = performance.now();
        const loop = () => {
            if (!this.gl) return;
            if (this.completed && !document.body.classList.contains('glitching')) {
                this.glIntensity = Math.max(0, this.glIntensity - 0.01);
            }
            const t = (performance.now() - startTime) / 1000;
            gl.uniform1f(uTime, t);
            gl.uniform1f(uIntensity, this.glIntensity);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            this.glRafId = requestAnimationFrame(loop);
        };
        loop();
    }

    forceGlitch(intensity) {
        if (intensity === undefined) intensity = 1;
        this.glIntensity = Math.min(1.5, intensity * 0.6);
    }

    stop() {
        this.sessionId++;
        this.clearAllTimers();
        this.hideThinking();
        if (this.voiceEnabled) {
            voiceInput.stop();
            this.voiceEnabled = false;
        }
        if (this.glRafId) cancelAnimationFrame(this.glRafId);
        this.glRafId = null;
        this.gl = null;
    }

    getState() {
        return {
            chatMessagesSent: this.playerMessagesSent,
            chatCompleted: this.completed,
            chatEndings: this.chatEndings,
        };
    }
}

const videoChat = new VideoChat();