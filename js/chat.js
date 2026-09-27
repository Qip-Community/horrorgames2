/* ============================================================
   CHAT — СКРИПТОВАННАЯ СЦЕНА
   4 "человека" не слышат тебя, потом появляется призрак
   ============================================================ */

class ScriptedChat {
    constructor() {
        this.subtitle = document.getElementById('vc-subtitle');
        this.thinking = document.getElementById('vc-thinking');
        this.timerEl = document.getElementById('vc-timer');
        this.nameEl = document.getElementById('vc-name');
        this.statusEl = document.getElementById('vc-status');
        this.micBar = document.getElementById('vc-mic-bar');
        this.micLevelFill = document.getElementById('vc-mic-level-fill');
        this.micStatus = document.getElementById('vc-mic-status');
        this.modeHint = document.getElementById('vc-mode-hint');
        this.selfVideo = document.getElementById('webcam-self');
        this.ghostBehind = document.getElementById('ghost-behind');
        this.cells = document.querySelectorAll('.ghost-canvas');
        this.input = document.getElementById('vc-input');
        this.sendBtn = document.getElementById('vc-send-btn');

        this.stream = null;
        this.rafId = null;
        this.voiceCtx = null;
        this.voiceStream = null;
        this.voiceRafId = null;
        this.voiceActive = false;

        this.sessionId = 0;
        this.completed = false;
        this.scriptTimers = [];
        this.callSeconds = 0;
        this._timer = null;
        this._subTimeout = null;

        this.playerMessagesSent = 0;
        this.chatEndings = {};
        this.onComplete = null;

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('vc-hangup').addEventListener('click', () => {
            if (this.completed) return;
            this.showSubtitle('Ты не можешь отключиться. Никто не может.', 3000);
            horrorAudio.playStinger();
        });

        document.getElementById('vc-mute').addEventListener('click', () => {
            document.getElementById('vc-mute').classList.toggle('vc-btn-active');
        });
        document.getElementById('vc-cam').addEventListener('click', () => {
            document.getElementById('vc-cam').classList.toggle('vc-btn-active');
        });

        this.input.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.handlePlayerMessage();
        });
        this.sendBtn.addEventListener('click', () => this.handlePlayerMessage());
    }

    /* Игрок что-то написал — просто показываем что никто не ответит */
    handlePlayerMessage() {
        const text = this.input.value.trim();
        if (!text || this.completed) return;
        this.input.value = '';
        this.playerMessagesSent++;
        memory.addPlayerMessage(text);

        this.showSubtitle('Ты: ' + text, 1500);
        setTimeout(() => {
            if (this.completed) return;
            this.showSubtitle('...', 1500);
        }, 1800);
        horrorAudio.playMessageBlip();
    }

    /* Микрофон — индикатор громкости */
    async startVoice() {
        try {
            this.voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            this.micStatus.textContent = 'Микрофон недоступен';
            this.modeHint.textContent = '📝 Пиши в поле ниже.';
            this.micBar.classList.add('unavailable');
            return;
        }

        try {
            this.voiceCtx = new (window.AudioContext || window.webkitAudioContext)();
            const src = this.voiceCtx.createMediaStreamSource(this.voiceStream);
            const analyser = this.voiceCtx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);

            const data = new Uint8Array(analyser.frequencyBinCount);
            this.voiceActive = true;

            const loop = () => {
                if (!this.voiceActive) return;
                analyser.getByteFrequencyData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) sum += data[i];
                const avg = sum / data.length;
                const percent = Math.min(100, (avg / 128) * 100 * 1.8);
                this.micLevelFill.style.width = percent + '%';
                if (percent > 12) this.micBar.classList.add('listening');
                else this.micBar.classList.remove('listening');
                this.voiceRafId = requestAnimationFrame(loop);
            };
            loop();

            this.micStatus.textContent = '🎤 Слушаю...';
            this.modeHint.textContent = '🎤 Говори — они слышат (но не отвечают).';
        } catch (e) {
            console.warn('Analyser error:', e);
        }
    }

    stopVoice() {
        this.voiceActive = false;
        if (this.voiceRafId) cancelAnimationFrame(this.voiceRafId);
        this.voiceRafId = null;
        if (this.voiceStream) {
            this.voiceStream.getTracks().forEach(t => t.stop());
            this.voiceStream = null;
        }
        if (this.voiceCtx) {
            try { this.voiceCtx.close(); } catch (e) {}
            this.voiceCtx = null;
        }
        this.micBar.classList.remove('listening');
        this.micLevelFill.style.width = '0%';
    }

    /* Рисуем кадры из камеры в 4 canvas */
    drawFrames() {
        if (!this.stream) return;

        const video = document.createElement('video');
        video.srcObject = this.stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.play().catch(() => {});

        // Инициализируем размеры canvas
        this.cells.forEach(canvas => {
            const parent = canvas.parentElement;
            canvas.width = parent.clientWidth || 400;
            canvas.height = parent.clientHeight || 300;
        });

        const draw = () => {
            if (!this.stream) return;
            if (video.readyState >= 2) {
                this.cells.forEach(canvas => {
                    const ctx = canvas.getContext('2d');
                    try {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    } catch (e) {}
                });
            }
            this.rafId = requestAnimationFrame(draw);
        };
        draw();
    }

    showSubtitle(text, duration, scream) {
        if (duration === undefined) duration = 3000;
        if (scream === undefined) scream = false;
        this.subtitle.classList.add('show');
        this.subtitle.classList.toggle('scream', scream);
        this.subtitle.textContent = text;

        clearTimeout(this._subTimeout);
        this._subTimeout = setTimeout(() => {
            this.subtitle.classList.remove('show', 'scream');
        }, duration);
    }

    showThinking(show) {
        if (show) this.thinking.classList.add('active');
        else this.thinking.classList.remove('active');
    }

    async start(webcamStream) {
        this.sessionId++;
        const sid = this.sessionId;
        this.completed = false;
        this.stream = webcamStream;
        this.playerMessagesSent = 0;
        this.chatEndings = {};
        this.callSeconds = 0;

        this.nameEl.textContent = '████████';
        this.statusEl.textContent = '4 участника';
        this.statusEl.style.color = '#00ff44';
        this.subtitle.textContent = '';
        this.subtitle.classList.remove('show', 'scream');
        this.thinking.classList.remove('active');
        this.ghostBehind.classList.remove('visible', 'angry');
        this.micBar.classList.remove('listening', 'unavailable');
        this.micStatus.textContent = 'Микрофон: проверка...';
        this.modeHint.textContent = '🎤 Говори — они слышат (но не отвечают).';
        this.input.value = '';

        // Подключаем камеру
        if (webcamStream) {
            this.selfVideo.srcObject = webcamStream;
            this.ghostBehind.srcObject = webcamStream;
            this.selfVideo.play().catch(() => {});
            this.ghostBehind.play().catch(() => {});
            this.drawFrames();
        }

        // Таймер
        clearInterval(this._timer);
        this._timer = setInterval(() => {
            if (this.completed) return;
            this.callSeconds++;
            const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
            const s = String(this.callSeconds % 60).padStart(2, '0');
            this.timerEl.textContent = m + ':' + s;
        }, 1000);

        // Микрофон
        this.startVoice();

        // Сценарий
        this.runScript();
    }

    runScript() {
        const sid = this.sessionId;

        const at = (ms, fn) => {
            const id = setTimeout(() => {
                if (this.sessionId !== sid || this.completed) return;
                fn();
            }, ms);
            this.scriptTimers.push(id);
        };

        // === ФАЗА 1: ТИШИНА ===
        at(1500, () => {
            this.showSubtitle('Они тебя видят. Но не слышат.', 3500);
        });

        at(6000, () => {
            this.showSubtitle('Скажи что-нибудь.', 2500);
        });

        // === ФАЗА 2: ОНИ ШЕПЧУТСЯ ===
        at(11000, () => {
            this.showThinking(true);
        });

        at(12500, () => {
            this.showThinking(false);
            this.showSubtitle('«Он ещё здесь...»', 2500);
            horrorAudio.playVoiceBubble();
        });

        at(16000, () => {
            this.showThinking(true);
        });

        at(17500, () => {
            this.showThinking(false);
            this.showSubtitle('«Он думает, что мы настоящие.»', 3000);
            horrorAudio.playVoiceBubble();
        });

        at(22000, () => {
            this.showSubtitle('«Скажи ему.»', 2500);
            horrorAudio.playVoiceBubble();
        });

        // === ФАЗА 3: ПЕРВЫЙ СКРИМЕР ===
        at(26500, () => {
            this.showSubtitle('«У меня больше нет лица.»', 3000, true);
            horrorAudio.playStinger();
            this.glitchAll();
        });

        // === ФАЗА 4: ПРИЗРАК ЗА СПИНОЙ ===
        at(32000, () => {
            this.showSubtitle('Кто-то стоит позади тебя.', 3500);
            this.ghostBehind.classList.add('visible');
            horrorAudio.setHeartbeatRate(600);
        });

        at(39000, () => {
            this.showSubtitle('Не оборачивайся.', 2500);
        });

        at(44000, () => {
            this.showSubtitle('«Он сзади. Он всегда был сзади.»', 3500);
            horrorAudio.playVoiceBubble();
        });

        // === ФАЗА 5: ПРИЗРАК ЗЛИТСЯ ===
        at(50000, () => {
            this.ghostBehind.classList.remove('visible');
            this.ghostBehind.classList.add('angry');
            this.showSubtitle('ОНО ЗДЕСЬ', 2000, true);
            horrorAudio.playStinger();
        });

        // === ФАЗА 6: ХОР ===
        at(55000, () => {
            this.showSubtitle('ОБЕРНИСЬ', 3000, true);
            horrorAudio.playFullScream();
            this.glitchAll();
        });

        // === ФАЗА 7: ФИНАЛ ===
        at(61000, () => {
            this.finish();
        });
    }

    glitchAll() {
        document.body.classList.add('glitching');

        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;background:#ff0000;z-index:200;pointer-events:none;opacity:0.7;';
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '0'; }, 400);
        setTimeout(() => flash.remove(), 1200);

        const main = document.querySelector('.videochat-main');
        let n = 0;
        const shake = setInterval(() => {
            if (n > 15 || !main) {
                clearInterval(shake);
                if (main) main.style.transform = '';
                return;
            }
            const dx = (Math.random() - 0.5) * 30;
            const dy = (Math.random() - 0.5) * 30;
            main.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
            n++;
        }, 40);

        setTimeout(() => {
            document.body.classList.remove('glitching');
        }, 600);
    }

    finish() {
        if (this.completed) return;
        this.completed = true;
        this.stopVoice();
        if (this.rafId) cancelAnimationFrame(this.rafId);
        clearInterval(this._timer);

        document.body.classList.add('glitching');
        horrorAudio.playFinale();

        const blood = document.createElement('div');
        blood.className = 'blood-overlay';
        document.body.appendChild(blood);
        requestAnimationFrame(() => blood.classList.add('active'));

        setTimeout(() => {
            document.body.classList.remove('glitching');
            if (this.onComplete) this.onComplete();
        }, 3000);
    }

    stop() {
        this.sessionId++;
        this.completed = true;
        this.scriptTimers.forEach(t => clearTimeout(t));
        this.scriptTimers = [];
        clearInterval(this._timer);
        this.stopVoice();
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.stream = null;
        this.ghostBehind.classList.remove('visible', 'angry');
        this.subtitle.classList.remove('show', 'scream');
        this.thinking.classList.remove('active');
    }

    getState() {
        return {
            chatMessagesSent: this.playerMessagesSent,
            chatCompleted: true,
            chatEndings: { revealed: true },
        };
    }
}

const videoChat = new ScriptedChat();