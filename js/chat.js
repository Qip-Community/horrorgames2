/* ============================================================
   VIDEOCALL — видеочат с фейковыми "людьми"
   ИСПРАВЛЕНО: зависание "печатает", таймер после финала,
   сброс глитча, гонки setTimeout
   ============================================================ */

const CHARACTERS = [
    {
        id: 'alex',
        name: 'Алекс',
        status: 'был(а) в сети только что',
        intro: ['Привет. Я тебя вижу.', 'Хорошо, что ты ответил.', 'Ты один?'],
        responses: [
            { keys: ['да', 'yes'], reply: 'Хорошо. Я не люблю, когда смотрят.' },
            { keys: ['нет', 'no'], reply: 'Кто ещё? Покажи мне.' },
            { keys: ['привет', 'hi'], reply: 'Здравствуй. Хорошо выглядишь. Я смотрю.' },
            { keys: ['кто', 'who'], reply: 'Я тот, кого ты удалил из друзей. Я вернулся.' },
            { keys: ['что надо', 'чего'], reply: 'Просто посмотреть. Ты против?' },
            { keys: ['уходи', 'bye'], reply: 'Я не могу. Ты не можешь отключиться. Не сейчас.' },
            { keys: ['имя', 'зовут'], reply: 'Я помню твоё. Назови своё — я проверю.' },
        ],
        scare: ['Я ВИЖУ ТЕБЯ ПРЯМО СЕЙЧАС', 'ОБЕРНИСЬ', 'ОНО СЗАДИ', 'НЕ ЗАКРЫВАЙ ГЛАЗА'],
        endingId: 'friend',
    },
    {
        id: 'maria',
        name: 'Мария',
        status: 'печатает...',
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
        id: 'unknown',
        name: '░░░░░',
        status: 'онлайн',
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
        id: 'nick',
        name: 'Ник',
        status: 'был в сети 5 лет назад',
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
        this.micText = document.getElementById('vc-mic-text');

        this.btnMute = document.getElementById('vc-mute');
        this.btnCam = document.getElementById('vc-cam');
        this.btnHangup = document.getElementById('vc-hangup');

        this.activeCharacter = null;
        this.playerMessagesSent = 0;
        this.completed = false;
        this.chatEndings = {};
        this.callTimer = null;
        this.callSeconds = 0;

        // 🆕 ВСЕ таймеры — чтобы точно их очищать
        this.subtitleTimeout = null;
        this.silenceTimeout = null;
        this.introTimeout = null;
        this.replyTimeout = null;
        this.screamTimeout = null;
        this.glRafId = null;
        this.forceTimeout = null;

        // 🆕 Флаг «сейчас печатает» — чтобы не запускать параллельно
        this.isThinking = false;
        // 🆕 ID текущей сессии — защита от гонок при рестарте
        this.sessionId = 0;

        this.bindEvents();
    }

    bindEvents() {
        this.input.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.handlePlayerMessage();
        });

        this.btnHangup.addEventListener('click', () => {
            if (this.completed) return;
            this.playSubtitle('Ты не можешь отключиться. Не сейчас.', 3000);
            horrorAudio.playStinger();
            this.forceGlitch(2);
        });

        this.btnMute.addEventListener('click', () => {
            this.btnMute.classList.toggle('vc-btn-active');
            if (!this.btnMute.classList.contains('vc-btn-active')) {
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

        this.micText.addEventListener('click', () => this.input.focus());
    }

    /* 🆕 Полная очистка ВСЕХ таймеров и флагов */
    clearAllTimers() {
        clearInterval(this.callTimer);
        clearTimeout(this.subtitleTimeout);
        clearTimeout(this.silenceTimeout);
        clearTimeout(this.introTimeout);
        clearTimeout(this.replyTimeout);
        clearTimeout(this.screamTimeout);
        clearTimeout(this.forceTimeout);
        this.callTimer = null;
        this.subtitleTimeout = null;
        this.silenceTimeout = null;
        this.introTimeout = null;
        this.replyTimeout = null;
        this.screamTimeout = null;
        this.forceTimeout = null;
    }

    start(webcamStream) {
        // 🆕 Новая сессия — все старые таймеры убиваем
        this.sessionId++;
        this.clearAllTimers();
        this.isThinking = false;

        this.activeCharacter = this.selectCharacter();
        this.playerMessagesSent = 0;
        this.completed = false;
        this.chatEndings = {};
        this.callSeconds = 0;

        this.nameEl.textContent = this.activeCharacter.name;
        this.statusEl.textContent = 'соединение...';
        this.statusEl.style.color = '#666';
        this.nameOverlay.textContent = this.activeCharacter.name;

        // 🆕 Сброс UI от прошлой игры
        this.hideThinking();
        this.subtitle.classList.remove('show', 'scream');
        this.subtitle.textContent = '';
        this.input.value = '';
        this.timerEl.textContent = '00:00';

        if (webcamStream) {
            this.themVideo.srcObject = webcamStream;
            this.selfVideo.srcObject = webcamStream;
        }

        this.initGlitchCanvas();

        // 🆕 Таймер звонка — с проверкой флага завершения
        this.callTimer = setInterval(() => {
            if (this.completed) return;   // не тикает после финала
            this.callSeconds++;
            const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
            const s = String(this.callSeconds % 60).padStart(2, '0');
            this.timerEl.textContent = `${m}:${s}`;
        }, 1000);

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
                    // 🆕 было 3200 — слишком долго. Снижаем до 2400
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

        // 🆕 было 12 сек → 8 сек, и ждём не 8, а 5
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

    handlePlayerMessage() {
        const text = this.input.value.trim();
        if (!text || this.completed) return;

        // 🆕 Отвечая, сбрасываем тишину и прячем «...»
        clearTimeout(this.silenceTimeout);
        clearTimeout(this.replyTimeout);
        this.hideThinking();
        this.isThinking = false;

        this.input.value = '';
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

        // Каждое 4-е сообщение → скример
        if (this.playerMessagesSent % 4 === 0) {
            const sid = this.sessionId;
            this.screamTimeout = setTimeout(() => {
                if (this.sessionId === sid && !this.completed) this.triggerScream('escalate');
            }, 1500);
            return;
        }

        // 🆕 Обычный ответ — короткая задержка, без зависания
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
        }, 1000 + Math.random() * 900);   // 🆕 было 1200-2700 → стало 1000-1900
    }

    playSubtitle(text, duration = 3000, scream = false) {
        clearTimeout(this.subtitleTimeout);
        this.subtitle.classList.add('show');
        this.subtitle.classList.toggle('scream', scream);

        if (scream) {
            this.subtitle.textContent = text;
        } else {
            // 🆕 Печатающийся текст с защитой от перезапуска
            this.subtitle.textContent = '';
            let i = 0;
            const total = text.length;
            const speed = 40;
            const tick = () => {
                if (this.completed && !scream) return;
                this.subtitle.textContent += text[i] || '';
                i++;
                if (i < total) {
                    this.subtitleTimeout = setTimeout(tick, speed);
                }
            };
            tick();
        }

        // 🆕 Показ — отдельный таймер (не тот же, что печатание)
        const hideDelay = scream ? duration : Math.max(duration, text.length * 40 + 800);
        const sid = this.sessionId;
        setTimeout(() => {
            if (this.sessionId !== sid) return;
            this.subtitle.classList.remove('show', 'scream');
        }, hideDelay);
    }

    /* 🆕 Гарантированное скрытие "печатает" */
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

        // 🆕 Убиваем ВСЕ таймеры — ничего не должно тикать после скримера
        this.clearAllTimers();
        this.hideThinking();

        const char = this.activeCharacter;
        const scare = char.scare[Math.floor(Math.random() * char.scare.length)];

        this.chatEndings = { [char.endingId]: true };
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
        setTimeout(() => flash.style.opacity = '0', 400);
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
            cont.style.transform = `translate(${dx}px, ${dy}px)`;
            count++;
        }, 45);

        const sid = this.sessionId;
        this.forceTimeout = setTimeout(() => {
            if (this.sessionId !== sid) return;
            document.body.classList.remove('glitching');
            memory.completeChat(char.id);
            this.onComplete?.();
        }, 3000);
    }

    initGlitchCanvas() {
        const canvas = this.glitchCanvas;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        // 🆕 Пересоздаём размер — вдруг поворот экрана
        canvas.width = canvas.clientWidth || 800;
        canvas.height = canvas.clientHeight || 600;

        const vs = `
            attribute vec2 pos;
            varying vec2 vUv;
            void main() {
                vUv = pos * 0.5 + 0.5;
                gl_Position = vec4(pos, 0.0, 1.0);
            }
        `;
        const fs = `
            precision mediump float;
            varying vec2 vUv;
            uniform float uTime;
            uniform float uIntensity;
            float rand(vec2 co) {
                return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
            }
            void main() {
                vec2 uv = vUv;
                float scan = sin(uv.y * 700.0) * 0.05;
                float shift = (rand(vec2(floor(uv.y * 60.0), floor(uTime * 12.0))) - 0.5) * uIntensity * 0.1;
                uv.x += shift;
                float noise = rand(vec2(uv.x * 100.0, uTime)) * 0.3;
                gl_FragColor = vec4(noise * uIntensity, 0.0, 0.0, 0.5);
            }
        `;

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
        // 🆕 Сброс интенсивности на старте
        this.glIntensity = 0.5;

        // 🆕 Останавливаем старый RAF если был
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

    forceGlitch(intensity = 1) {
        this.glIntensity = Math.min(1.5, intensity * 0.6);
    }

    stop() {
        this.sessionId++;   // 🆕 инвалидируем все отложенные колбэки
        this.clearAllTimers();
        this.hideThinking();
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