'use strict';

/* ============================================================
   QIP 2012 — HORROR GAME
   Полностью рабочий скрипт: звуки генерируются через WebAudio,
   никаких внешних ресурсов не требуется.
   ============================================================ */

(function() {
    // ====== DOM ======
    const $ = id => document.getElementById(id);
    const bootScreen = $('boot-screen');
    const intro = $('intro');
    const startBtn = $('start-btn');
    const desktop = $('desktop');
    const qipWindow = $('qip-window');
    const qipClose = $('qip-close');
    const qipHeader = $('qip-header');
    const contactsEl = $('contacts');
    const contacts = document.querySelectorAll('.contact');
    const chatHeader = $('chat-header');
    const messages = $('messages');
    const messageInput = $('message-input');
    const sendBtn = $('send-btn');
    const glitchOverlay = $('glitch-overlay');
    const vignette = $('vignette');
    const flash = $('flash');
    const jumpscare = $('jumpscare');
    const fadeOverlay = $('fade-overlay');
    const ending = $('ending');
    const goodEnding = $('good-ending');
    const choice = $('choice');
    const clockEl = $('clock');
    const iconQip = $('icon-qip');
    const taskbarQip = $('taskbar-qip');
    const restartBtn = $('restart-btn');
    const restartBtn2 = $('restart-btn-2');
    const choiceYes = $('choice-yes');
    const choiceNo = $('choice-no');

    // ====== STATE ======
    const state = {
        gameStarted: false,
        currentUser: null,
        haunted: false,
        choiceMade: false,
        dialogs: {},
        knownContacts: new Set(),
        deaths: parseInt(localStorage.getItem('qip_deaths') || '0', 10),
        survived: parseInt(localStorage.getItem('qip_survived') || '0', 10)
    };

    // ====== AUDIO ENGINE (WebAudio — без внешних файлов) ======
    let audioCtx = null;

    function initAudio() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext не поддерживается');
        }
    }

    function resumeAudio() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Фоновый гул (drone)
    let droneNodes = null;

    function startDrone() {
        if (!audioCtx || droneNodes) return;
        try {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc1.type = 'sine';
            osc1.frequency.value = 55;
            osc2.type = 'sine';
            osc2.frequency.value = 58;

            filter.type = 'lowpass';
            filter.frequency.value = 200;

            gain.gain.value = 0.0001;

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            osc1.start();
            osc2.start();

            // Плавное появление
            gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 3);

            droneNodes = { osc1, osc2, gain };
        } catch (e) { /* ignore */ }
    }

    function setDroneIntensity(value) {
        if (!droneNodes || !audioCtx) return;
        const target = Math.max(0.0001, value);
        droneNodes.gain.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 1);
        droneNodes.osc1.frequency.linearRampToValueAtTime(55 + value * 200, audioCtx.currentTime + 2);
        droneNodes.osc2.frequency.linearRampToValueAtTime(58 + value * 200, audioCtx.currentTime + 2);
    }

    // Короткий звук-эффект
    function beep(freq, duration = 0.08, type = 'sine', volume = 0.05) {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = volume;
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) { /* ignore */ }
    }

    function scareSound() {
        if (!audioCtx) return;
        try {
            // Шум + резкий тон
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.2, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = noiseBuffer;

            const noiseGain = audioCtx.createGain();
            noiseGain.gain.value = 0.35;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 400;

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);

            // Резкий тон
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 1);
            oscGain.gain.value = 0.3;
            oscGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
            osc.connect(oscGain);
            oscGain.connect(audioCtx.destination);

            noise.start();
            osc.start();
            noise.stop(audioCtx.currentTime + 1.2);
            osc.stop(audioCtx.currentTime + 1.2);
        } catch (e) { /* ignore */ }
    }

    function whisperSound() {
        if (!audioCtx) return;
        try {
            const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.3 * Math.sin(i * 0.0005);
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800;
            filter.Q.value = 5;
            const gain = audioCtx.createGain();
            gain.gain.value = 0.08;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            src.start();
            src.stop(audioCtx.currentTime + 0.8);
        } catch (e) { /* ignore */ }
    }

    function messageSound() {
        beep(880, 0.06, 'sine', 0.04);
        setTimeout(() => beep(1200, 0.06, 'sine', 0.03), 40);
    }

    // ====== BOOT SEQUENCE ======
    function runBoot() {
        setTimeout(() => {
            bootScreen.classList.add('fade-out');
            setTimeout(() => {
                bootScreen.classList.add('hidden');
                intro.classList.remove('hidden');
            }, 800);
        }, 3400);
    }

    // ====== START GAME ======
    function startGame() {
        if (state.gameStarted) return;
        state.gameStarted = true;

        initAudio();
        resumeAudio();

        intro.classList.add('fade-out');
        setTimeout(() => {
            intro.classList.add('hidden');
            desktop.classList.remove('hidden');
            setTimeout(() => {
                qipWindow.classList.add('visible');
            }, 200);
        }, 900);

        startDrone();
        startClockTicking();
        playDialogue('admin');

        // График ужаса
        setTimeout(() => setDroneIntensity(0.06), 6000);
        setTimeout(() => {
            triggerGlitch();
            whisperSound();
        }, 12000);
        setTimeout(() => setDroneIntensity(0.09), 15000);
        setTimeout(unlockUnknown, 20000);
        setTimeout(() => {
            // Авто-выбор ???
            if (!state.choiceMade && !state.haunted) {
                showChoice();
            }
        }, 26000);
    }

    // ====== CHOICE DIALOG ======
    function showChoice() {
        if (state.choiceMade) return;
        choice.classList.remove('hidden');
        // Пульсирующий звук
        let count = 0;
        const iv = setInterval(() => {
            beep(300, 0.15, 'square', 0.04);
            count++;
            if (count > 3 || state.choiceMade) clearInterval(iv);
        }, 500);
    }

    function chooseYes() {
        if (state.choiceMade) return;
        state.choiceMade = true;
        choice.classList.add('hidden');
        state.haunted = true;

        // Переключить на ???
        const unknown = document.querySelector('[data-user="unknown"]');
        unknown.classList.add('haunted');
        setTimeout(() => unknown.classList.remove('haunted'), 500);

        unknown.click();

        setDroneIntensity(0.15);
        triggerGlitch();

        // Через 10 секунд — jumpscare
        setTimeout(jumpscareEffect, 12000);
    }

    function chooseNo() {
        if (state.choiceMade) return;
        state.choiceMade = true;
        choice.classList.add('hidden');

        // Попытка закрыть QIP
        addMessage('СИСТЕМА: QIP не отвечает...', 'system');
        addMessage('СИСТЕМА: Процесс не может быть завершён.', 'system');
        setTimeout(() => {
            addMessage('??? : ты не закроешь меня.', 'creepy');
            triggerGlitch();
            scareSound();
        }, 2500);

        // Всё равно джампскейр через 15 сек
        setDroneIntensity(0.12);
        setTimeout(jumpscareEffect, 15000);
    }

    // ====== JUMPSCARE ======
    function jumpscareEffect() {
        if (!state.gameStarted) return;

        scareSound();
        flashScreen();
        jumpscare.classList.remove('hidden');

        // Тряска тела
        document.body.style.animation = 'none';

        // Проверяем "выжил ли" игрок — если он сделал good choice и успел закрыть до этого
        setTimeout(() => {
            jumpscare.classList.add('hidden');
            fadeOverlay.classList.add('active');

            setTimeout(() => {
                state.deaths++;
                localStorage.setItem('qip_deaths', state.deaths);
                showEnding();
            }, 1500);
        }, 900);
    }

    function showEnding() {
        document.getElementById('ending-text').textContent =
            `QIP 2012 больше не работает. Ты пытался выйти ${state.deaths} раз(а).`;
        ending.classList.remove('hidden');
    }

    function showGoodEnding() {
        state.survived++;
        localStorage.setItem('qip_survived', state.survived);
        fadeOverlay.classList.add('active');
        setTimeout(() => {
            document.getElementById('good-text').textContent =
                `Ты закрыл QIP вовремя. Это твоё ${state.survived}-е спасение.`;
            goodEnding.classList.remove('hidden');
        }, 1200);
    }

    // ====== FLASH / GLITCH ======
    function flashScreen() {
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 120);
    }

    function triggerGlitch(intensity = 1) {
        glitchOverlay.classList.add('active');
        setTimeout(() => glitchOverlay.classList.remove('active'), 300 + intensity * 200);
    }

    // ====== CONTACTS ======
    contacts.forEach(c => {
        c.addEventListener('click', () => {
            if (!state.gameStarted) return;
            const user = c.dataset.user;

            if (user === 'unknown' && !state.haunted && !state.choiceMade) {
                // Игрок сам кликнул на ??? до выбора
                state.choiceMade = true;
                state.haunted = true;
                showChoiceDirect(() => {
                    openChat(user, c);
                    setTimeout(jumpscareEffect, 10000);
                });
                return;
            }

            if (user === 'unknown') {
                state.haunted = true;
            }

            openChat(user, c);
        });
    });

    function showChoiceDirect(onYes) {
        choice.classList.remove('hidden');
        // Временно подменяем обработчики
        const handlerYes = () => {
            choice.classList.add('hidden');
            choiceYes.removeEventListener('click', handlerYes);
            choiceNo.removeEventListener('click', handlerNo);
            chooseYesRouted(onYes);
        };
        const handlerNo = () => {
            choice.classList.add('hidden');
            choiceYes.removeEventListener('click', handlerYes);
            choiceNo.removeEventListener('click', handlerNo);
            chooseNo();
        };
        choiceYes.addEventListener('click', handlerYes);
        choiceNo.addEventListener('click', handlerNo);
    }

    function chooseYesRouted(cb) {
        setDroneIntensity(0.15);
        triggerGlitch();
        beep(120, 0.4, 'sawtooth', 0.08);
        if (cb) cb();
    }

    function openChat(user, contactEl) {
        state.currentUser = user;
        contacts.forEach(x => x.classList.remove('active'));
        if (contactEl) contactEl.classList.add('active');

        const name = contactEl ? contactEl.querySelector('.name').textContent : user;
        chatHeader.textContent = `Чат с ${name}`;
        messages.innerHTML = '';
        messageInput.disabled = false;
        messageInput.placeholder = 'Введите сообщение...';
        sendBtn.disabled = false;

        // Небольшая задержка для мобильных
        setTimeout(() => messageInput.focus(), 100);

        // Если диалог уже проигран — просто показать историю
        if (state.dialogs[user]) {
            state.dialogs[user].forEach(m => addMessage(m.text, m.type, false));
        } else {
            playDialogue(user);
        }
    }

    // ====== DIALOGUES ======
    const DIALOGUES = {
        admin: [
            { delay: 800,  text: 'Привет. Ты новый тут? Не заходи в чат с ником "???".', type: 'them' },
            { delay: 2800, text: 'Серьёзно. Если увидишь его в сети — сразу закрывай QIP.', type: 'them' },
            { delay: 5200, text: 'Он уже забрал 3 моих контакта. Маша следующая.', type: 'them' },
            { delay: 7800, text: 'Я чувствую, как он смотрит через экран...', type: 'them' },
            { delay: 10500, text: 'НЕ ОТКРЫВАЙ. НЕ ОТКРЫВАЙ. НЕ ОТКРЫВАЙ.', type: 'creepy' },
            { delay: 13000, text: 'он уже здесь', type: 'creepy' }
        ],
        masha: [
            { delay: 900,  text: 'приветик :) ты видел странные сообщения от ???', type: 'them' },
            { delay: 3000, text: 'я зашла в его чат... и теперь у меня в комнате кто-то ходит', type: 'them' },
            { delay: 5400, text: 'пожалуйста помоги мне', type: 'them' },
            { delay: 7800, text: 'он за дверью', type: 'creepy' },
            { delay: 10200, text: 'он смотрит на меня через экран', type: 'creepy' },
            { delay: 12600, text: 'ПОМОГИ', type: 'creepy' }
        ],
        unknown: [
            { delay: 400,  text: 'ты меня видишь?', type: 'creepy' },
            { delay: 2200, text: 'я вижу тебя. вижу твою комнату.', type: 'creepy' },
            { delay: 4200, text: 'обернись.', type: 'creepy' },
            { delay: 6000, text: 'СЛИШКОМ ПОЗДНО.', type: 'creepy' }
        ]
    };

    function playDialogue(user) {
        const script = DIALOGUES[user];
        if (!script) return;

        if (!state.dialogs[user]) state.dialogs[user] = [];

        script.forEach(line => {
            setTimeout(() => {
                if (state.currentUser !== user) {
                    // сохраняем на будущее
                    state.dialogs[user].push(line);
                    return;
                }
                addMessage(line.text, line.type);
                state.dialogs[user].push(line);
                if (line.type === 'creepy') {
                    triggerGlitch();
                    whisperSound();
                }
            }, line.delay);
        });
    }

    function addMessage(text, type = 'them', animate = true) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        if (!animate) div.style.animation = 'none';
        div.textContent = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        if (animate && type !== 'system') messageSound();
    }

    // ====== SEND MESSAGE ======
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !state.currentUser) return;
        addMessage(text, 'me');
        messageInput.value = '';

        const user = state.currentUser;

        // Показать "печатает..."
        setTimeout(() => {
            const typing = document.createElement('div');
            typing.className = 'message typing';
            typing.textContent = 'печатает...';
            messages.appendChild(typing);
            messages.scrollTop = messages.scrollHeight;

            setTimeout(() => {
                typing.remove();
                let reply;
                if (user === 'unknown') {
                    reply = { text: 'ты думаешь, что можешь со мной говорить?', type: 'creepy' };
                } else if (user === 'masha') {
                    reply = { text: 'он ближе...', type: 'creepy' };
                } else {
                    reply = { text: 'Не пиши ему. ПРОШУ.', type: 'creepy' };
                }
                addMessage(reply.text, reply.type);
                if (reply.type === 'creepy') triggerGlitch();
            }, 1200);
        }, 400);
    }

    sendBtn.addEventListener('click', e => {
        e.preventDefault();
        sendMessage();
    });
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // ====== UNLOCK UNKNOWN ======
    function unlockUnknown() {
        const unknown = document.querySelector('[data-user="unknown"]');
        if (!unknown) return;
        unknown.classList.remove('locked');
        const status = unknown.querySelector('.status');
        status.textContent = 'в сети';
        status.classList.remove('offline');
        status.classList.add('online-red');
        addMessage('СИСТЕМА: Контакт "???" теперь в сети.', 'system');
        triggerGlitch();
        whisperSound();
    }

    // ====== CLOCK ======
    let clockH = 22, clockM = 13, clockS = 0;
    function startClockTicking() {
        updateClock();
        setInterval(() => {
            clockS++;
            if (clockS >= 60) { clockS = 0; clockM++; }
            if (clockM >= 60) { clockM = 0; clockH++; }
            if (clockH >= 24) clockH = 0;
            updateClock();
        }, 1000);
    }

    function updateClock() {
        clockEl.textContent =
            `${String(clockH).padStart(2,'0')}:${String(clockM).padStart(2,'0')}`;
    }

    // ====== RANDOM AMBIENT GLITCHES ======
    setInterval(() => {
        if (!state.gameStarted) return;
        if (Math.random() < 0.12) {
            triggerGlitch();
            if (Math.random() < 0.4) whisperSound();
        }
    }, 6000);

    // ====== UI EVENTS ======
    startBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        startGame();
    });

    // Дублирующий обработчик на touch для мобильных
    startBtn.addEventListener('touchend', e => {
        e.preventDefault();
        if (!state.gameStarted) startGame();
    }, { passive: false });

    qipClose.addEventListener('click', () => {
        if (!state.haunted) {
            qipWindow.classList.add('minimized');
            addMessageSafe('СИСТЕМА: Вы свернули QIP.', 'system');
        } else {
            addMessageSafe('СИСТЕМА: Закрыть процесс невозможно.', 'system');
            triggerGlitch();
        }
    });

    iconQip.addEventListener('click', () => {
        qipWindow.classList.toggle('minimized');
        resumeAudio();
    });

    taskbarQip.addEventListener('click', () => {
        qipWindow.classList.toggle('minimized');
        resumeAudio();
    });

    function addMessageSafe(text, type) {
        // Показать сообщение в любом случае, даже если чат "закрыт"
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.textContent = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    // Горячая клавиша Escape — попытка выйти
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.gameStarted) {
            if (!state.choiceMade) {
                // Игрок пытается выйти до выбора — "хорошая" концовка
                state.choiceMade = true;
                state.survived++;
                localStorage.setItem('qip_survived', state.survived);
                showGoodEnding();
            } else if (state.haunted) {
                addMessageSafe('СИСТЕМА: Невозможно выйти.', 'system');
                triggerGlitch();
            }
        }
    });

    // Restart
    restartBtn.addEventListener('click', () => {
        ending.classList.add('hidden');
        resetGame();
    });
    restartBtn2.addEventListener('click', () => {
        goodEnding.classList.add('hidden');
        resetGame();
    });

    function resetGame() {
        location.reload();
    }

    // ====== CHOICE ======
    choiceYes.addEventListener('click', chooseYes);
    choiceNo.addEventListener('click', chooseNo);

    // ====== VIGNETTE (постепенно усиливается) ======
    setTimeout(() => {
        if (state.gameStarted) vignette.classList.add('active');
    }, 8000);

    // ====== INIT ======
    runBoot();

    // Принудительное резюмирование аудио при первом клике где угодно
    document.addEventListener('click', () => {
        initAudio();
        resumeAudio();
    }, { once: true });

})();