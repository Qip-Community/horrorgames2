'use strict';

/* ============================================================
   QIP 2012 — FINAL HORROR EDITION
   ~2 часа геймплея, 5 актов, запись голоса, сохранения
   ============================================================ */

(function() {
    'use strict';

    // ==================== HELPERS ====================
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // ==================== SAVE SYSTEM ====================
    const SAVE_KEY = 'qip2012_save_v3';
    const DEFAULT_SAVE = {
        act: 1,
        scene: 0,
        inventory: [],
        achievements: [],
        deaths: 0,
        survived: 0,
        best: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        knownContacts: ['admin'],
        unlockedEntries: ['qip', 'admin'],
        gameTime: 0,
        sanity: 100,
        lastSave: 0,
        endings: [],
        secretsFound: []
    };

    function loadSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return { ...DEFAULT_SAVE };
            const data = JSON.parse(raw);
            return { ...DEFAULT_SAVE, ...data };
        } catch (e) { return { ...DEFAULT_SAVE }; }
    }

    function saveGame() {
        try {
            state.save.lastSave = Date.now();
            state.save.gameTime = state.gameTime;
            state.save.sanity = state.sanity;
            state.save.act = state.act;
            state.save.scene = state.sceneIndex;
            localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
        } catch (e) { /* ignore */ }
    }

    function clearSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    }

    const state = {
        save: loadSave(),
        gameStarted: false,
        currentUser: null,
        haunted: false,
        act: 1,
        sceneIndex: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        gameTime: 0,        // в секундах
        sanity: 100,
        dialogues: {},      // история диалогов по контакту
        openedApps: new Set(),
        unknownUnlocked: false,
        jumpscareTimer: null,
        activeQuiz: null,
        inventory: new Set(),
        micStream: null,
        recorder: null,
        recordedChunks: [],
        recordedAudio: null,
        recordedAudioURL: null,
        clockH: 22, clockM: 13, clockS: 0,
        timers: [],
        paused: false,
        eyesTimer: null,
        ambientTimer: null
    };

    // Восстановить из сохранения
    state.act = state.save.act || 1;
    state.sceneIndex = state.save.scene || 0;
    state.correctAnswers = state.save.correctAnswers || 0;
    state.totalQuestions = state.save.totalQuestions || 0;
    state.gameTime = state.save.gameTime || 0;
    state.sanity = state.save.sanity ?? 100;
    state.inventory = new Set(state.save.inventory || []);

    // ==================== DOM CACHE ====================
    const D = {
        bootScreen: $('boot-screen'),
        intro: $('intro'),
        startBtn: $('start-btn'),
        continueBtn: $('continue-btn'),
        micBtn: $('mic-btn'),
        micStatus: $('mic-status'),
        introStats: $('intro-stats'),
        hud: $('hud'),
        hudAct: $('hud-act'),
        hudObjective: $('hud-objective'),
        hudTimer: $('hud-timer'),
        sanityFill: $('sanity-fill'),
        hudEye: $('hud-eye'),
        hudInventory: $('hud-inventory'),
        desktop: $('desktop'),
        wallpaper: $('wallpaper'),
        qipWindow: $('qip-window'),
        contacts: $('contacts'),
        chatHeader: $('chat-header'),
        messages: $('messages'),
        messageInput: $('message-input'),
        sendBtn: $('send-btn'),
        taskbarItems: $('taskbar-items'),
        clock: $('clock'),
        glitchOverlay: $('glitch-overlay'),
        vignette: $('vignette'),
        flash: $('flash'),
        scanlines: $('scanlines'),
        bloodOverlay: $('blood-overlay'),
        jumpscare: $('jumpscare'),
        fadeOverlay: $('fade-overlay'),
        ending: $('ending'),
        endingTitle: $('ending-title'),
        endingText: $('ending-text'),
        endingStats: $('ending-stats'),
        restartBtn: $('restart-btn'),
        choice: $('choice'),
        choiceTitle: $('choice-title'),
        choiceText: $('choice-text'),
        choiceButtons: $('choice-buttons'),
        achievement: $('achievement'),
        achievementName: $('achievement-name'),
        notification: $('notification'),
        galleryGrid: $('gallery-grid'),
        notesText: $('notes-text'),
        browserContent: $('browser-content'),
        encyclopediaBody: $('encyclopedia-body'),
        imageTitle: $('image-title'),
        imageBody: $('image-body')
    };

    // ==================== AUDIO ENGINE ====================
    let audioCtx = null;
    let drone = null;
    let currentMusic = null;

    function initAudio() {
        if (audioCtx) return;
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    function resumeAudio() {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    function startDrone() {
        if (!audioCtx || drone) return;
        try {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc1.type = 'sine'; osc1.frequency.value = 55;
            osc2.type = 'sine'; osc2.frequency.value = 58;
            filter.type = 'lowpass'; filter.frequency.value = 200;
            gain.gain.value = 0.0001;
            osc1.connect(filter); osc2.connect(filter);
            filter.connect(gain); gain.connect(audioCtx.destination);
            osc1.start(); osc2.start();
            gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 3);
            drone = { osc1, osc2, gain, filter };
        } catch (e) {}
    }

    function setDroneIntensity(v) {
        if (!drone || !audioCtx) return;
        const target = clamp(v, 0.0001, 0.25);
        try {
            drone.gain.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 1);
            drone.osc1.frequency.linearRampToValueAtTime(55 + target * 800, audioCtx.currentTime + 2);
            drone.osc2.frequency.linearRampToValueAtTime(58 + target * 800, audioCtx.currentTime + 2);
        } catch (e) {}
    }

    function beep(freq, duration = 0.08, type = 'sine', volume = 0.05) {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = volume;
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + duration);
        } catch (e) {}
    }

    function scareSound() {
        if (!audioCtx) return;
        try {
            const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.2, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
            const noise = audioCtx.createBufferSource(); noise.buffer = buf;
            const ng = audioCtx.createGain(); ng.gain.value = 0.35;
            const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 400;
            noise.connect(f); f.connect(ng); ng.connect(audioCtx.destination);

            const osc = audioCtx.createOscillator();
            const og = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 1);
            og.gain.value = 0.3;
            og.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
            osc.connect(og); og.connect(audioCtx.destination);

            noise.start(); osc.start();
            noise.stop(audioCtx.currentTime + 1.2);
            osc.stop(audioCtx.currentTime + 1.2);
        } catch (e) {}
    }

    function whisperSound() {
        if (!audioCtx) return;
        try {
            const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * 0.3 * Math.sin(i * 0.0005);
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 5;
            const g = audioCtx.createGain(); g.gain.value = 0.08;
            src.connect(f); f.connect(g); g.connect(audioCtx.destination);
            src.start(); src.stop(audioCtx.currentTime + 0.8);
        } catch (e) {}
    }

    function messageSound() {
        beep(880, 0.06, 'sine', 0.04);
        setTimeout(() => beep(1200, 0.06, 'sine', 0.03), 40);
    }
    function successSound() {
        beep(660, 0.1, 'sine', 0.06);
        setTimeout(() => beep(880, 0.1, 'sine', 0.06), 90);
        setTimeout(() => beep(1320, 0.15, 'sine', 0.06), 180);
    }
    function errorSound() {
        beep(180, 0.15, 'sawtooth', 0.08);
        setTimeout(() => beep(120, 0.2, 'sawtooth', 0.08), 120);
    }
    function heartbeat() {
        beep(60, 0.1, 'sine', 0.15);
        setTimeout(() => beep(50, 0.12, 'sine', 0.12), 180);
    }

    // Музыка по актам (процедурная)
    function playMusicForAct(act) {
        if (!audioCtx) return;
        stopMusic();
        try {
            const notes = {
                1: [220, 233, 246, 220],
                2: [196, 208, 220, 196],
                3: [174, 185, 196, 174],
                4: [146, 155, 164, 146],
                5: [110, 116, 123, 110]
            }[act] || [220];
            let idx = 0;
            const playNote = () => {
                if (!audioCtx || currentMusic === null) return;
                try {
                    const osc = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = notes[idx % notes.length];
                    g.gain.value = 0.02;
                    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3.5);
                    osc.connect(g); g.connect(audioCtx.destination);
                    osc.start(); osc.stop(audioCtx.currentTime + 4);
                    idx++;
                } catch (e) {}
            };
            playNote();
            currentMusic = setInterval(playNote, 4000);
        } catch (e) {}
    }
    function stopMusic() {
        if (currentMusic) { clearInterval(currentMusic); currentMusic = null; }
    }

    // ==================== MICROPHONE ====================
    async function requestMic() {
        if (state.micStream) return true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.micStream = stream;
            D.micStatus.textContent = '✅ Микрофон подключён';
            D.micStatus.className = 'mic-status granted';
            return true;
        } catch (e) {
            D.micStatus.textContent = '❌ Доступ к микрофону запрещён';
            D.micStatus.className = 'mic-status denied';
            return false;
        }
    }

    async function recordVoice(durationMs = 800) {
        if (!state.micStream) return;
        try {
            const rec = new MediaRecorder(state.micStream);
            const chunks = [];
            rec.ondataavailable = e => chunks.push(e.data);
            rec.onstop = () => {
                try {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    state.recordedAudio = blob;
                    if (state.recordedAudioURL) URL.revokeObjectURL(state.recordedAudioURL);
                    state.recordedAudioURL = URL.createObjectURL(blob);
                } catch (e) {}
            };
            rec.start();
            setTimeout(() => { try { rec.stop(); } catch (e) {} }, durationMs);
            state.recorder = rec;
        } catch (e) {}
    }

    function playRecordedVoice() {
        if (!state.recordedAudioURL) return false;
        try {
            const audio = new Audio(state.recordedAudioURL);
            audio.volume = 0.8;
            audio.play().catch(() => {});
            return true;
        } catch (e) { return false; }
    }

    // ==================== FX ====================
    function flashScreen(color = 'white') {
        D.flash.classList.add('active');
        if (color === 'red') D.flash.classList.add('red');
        setTimeout(() => {
            D.flash.classList.remove('active');
            D.flash.classList.remove('red');
        }, 120);
    }
    function triggerGlitch(intensity = 1) {
        D.glitchOverlay.classList.add('active');
        setTimeout(() => D.glitchOverlay.classList.remove('active'), 300 + intensity * 200);
    }
    function showNotification(text, duration = 2500) {
        D.notification.textContent = text;
        D.notification.classList.remove('hidden');
        setTimeout(() => D.notification.classList.add('hidden'), duration);
    }
    function showAchievement(name) {
        if (state.save.achievements.includes(name)) return;
        state.save.achievements.push(name);
        saveGame();
        D.achievementName.textContent = name;
        D.achievement.classList.remove('hidden');
        successSound();
        setTimeout(() => D.achievement.classList.add('hidden'), 4000);
    }
    function addToInventory(item) {
        if (state.inventory.has(item)) return;
        state.inventory.add(item);
        state.save.inventory = [...state.inventory];
        saveGame();
        renderInventory();
        showNotification(`📦 Получен предмет: ${item}`);
    }
    function renderInventory() {
        D.hudInventory.innerHTML = '';
        state.inventory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'inv-item';
            div.textContent = item;
            D.hudInventory.appendChild(div);
        });
    }

    // ==================== HUD ====================
    function setAct(act) {
        state.act = act;
        state.save.act = act;
        saveGame();
        const actNames = {
            1: 'АКТ I — ПРОБУЖДЕНИЕ',
            2: 'АКТ II — СВЯЗЬ',
            3: 'АКТ III — ИСЧЕЗНОВЕНИЕ',
            4: 'АКТ IV — ОХОТА',
            5: 'АКТ V — ФИНАЛ'
        };
        D.hudAct.textContent = actNames[act] || '';
        playMusicForAct(act);
    }
    function setObjective(text) {
        D.hudObjective.textContent = 'Цель: ' + text;
    }
    function updateSanity(delta) {
        state.sanity = clamp(state.sanity + delta, 0, 100);
        D.sanityFill.style.width = state.sanity + '%';
        D.sanityFill.style.background = state.sanity > 60 ? '#0c4' :
            state.sanity > 30 ? 'linear-gradient(90deg,#fc0,#f80)' : '#c22';
        if (state.sanity < 30) {
            D.bloodOverlay.classList.add('active');
        } else {
            D.bloodOverlay.classList.remove('active');
        }
        if (state.sanity <= 0) {
            // смерть от безумия
            jumpscareEffect('sanity');
        }
    }
    function startGameTimer() {
        setInterval(() => {
            if (!state.gameStarted || state.paused) return;
            state.gameTime++;
            const h = Math.floor(state.gameTime / 3600);
            const m = Math.floor((state.gameTime % 3600) / 60);
            const s = state.gameTime % 60;
            D.hudTimer.textContent =
                `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            // Автосохранение каждые 30 сек
            if (state.gameTime % 30 === 0) saveGame();
        }, 1000);
    }

    // ==================== CLOCK ====================
    function startClock() {
        updateClock();
        setInterval(() => {
            state.clockS++;
            if (state.clockS >= 60) { state.clockS = 0; state.clockM++; }
            if (state.clockM >= 60) { state.clockM = 0; state.clockH++; }
            if (state.clockH >= 24) state.clockH = 0;
            updateClock();
        }, 1000);
    }
    function updateClock() {
        D.clock.textContent = `${String(state.clockH).padStart(2,'0')}:${String(state.clockM).padStart(2,'0')}`;
        // Но в акте 3+ часы сходят с ума
        if (state.act >= 3 && Math.random() < 0.1) {
            const rH = Math.floor(rand(0, 24));
            const rM = Math.floor(rand(0, 60));
            D.clock.textContent = `${String(rH).padStart(2,'0')}:${String(rM).padStart(2,'0')}`;
        }
    }

    // ==================== EYE (следящий глаз) ====================
    function startEye() {
        if (state.eyesTimer) return;
        state.eyesTimer = setInterval(() => {
            if (!state.gameStarted) return;
            if (state.act >= 2 && Math.random() < 0.3) {
                D.hudEye.classList.add('active');
                whisperSound();
                setTimeout(() => D.hudEye.classList.remove('active'), 2000 + Math.random() * 3000);
            }
        }, 15000);
    }

    // ==================== AMBIENT ====================
    function startAmbient() {
        if (state.ambientTimer) return;
        state.ambientTimer = setInterval(() => {
            if (!state.gameStarted || state.paused) return;
            const chance = 0.1 + state.act * 0.05;
            if (Math.random() < chance) {
                triggerGlitch();
                if (Math.random() < 0.5) whisperSound();
                if (Math.random() < 0.3) {
                    updateSanity(-1);
                    heartbeat();
                }
            }
        }, 5000);
    }

    // ==================== BOOT ====================
    function runBoot() {
        updateIntroStats();
        const hasSave = state.save.act > 1 || state.gameTime > 60;
        if (hasSave) D.continueBtn.classList.remove('hidden');

        setTimeout(() => {
            D.bootScreen.classList.add('fade-out');
            setTimeout(() => {
                D.bootScreen.classList.add('hidden');
                D.intro.classList.remove('hidden');
            }, 800);
        }, 3400);
    }
    function updateIntroStats() {
        const parts = [];
        if (state.save.deaths > 0) parts.push(`💀 Смертей: ${state.save.deaths}`);
        if (state.save.survived > 0) parts.push(`🟢 Спасений: ${state.save.survived}`);
        if (state.save.best > 0) parts.push(`🏆 Побед: ${state.save.best}`);
        if (state.save.act > 1) parts.push(`📖 Акт: ${state.save.act}`);
        D.introStats.textContent = parts.length ? parts.join(' · ') : '';
    }

    // ==================== START / CONTINUE ====================
    async function startGame(continueMode = false) {
        if (state.gameStarted) return;
        state.gameStarted = true;

        if (!continueMode) {
            // Новая игра
            state.save = { ...DEFAULT_SAVE, deaths: state.save.deaths, survived: state.save.survived, best: state.save.best };
            state.act = 1;
            state.sceneIndex = 0;
            state.correctAnswers = 0;
            state.totalQuestions = 0;
            state.gameTime = 0;
            state.sanity = 100;
            state.inventory = new Set();
        } else {
            // Продолжаем
            state.act = state.save.act || 1;
            state.sceneIndex = state.save.scene || 0;
            state.correctAnswers = state.save.correctAnswers || 0;
            state.totalQuestions = state.save.totalQuestions || 0;
            state.gameTime = state.save.gameTime || 0;
            state.sanity = state.save.sanity ?? 100;
            state.inventory = new Set(state.save.inventory || []);
        }

        initAudio();
        resumeAudio();
        await requestMic();

        D.intro.classList.add('fade-out');
        setTimeout(() => {
            D.intro.classList.add('hidden');
            D.desktop.classList.remove('hidden');
            D.hud.classList.remove('hidden');
            setTimeout(() => {
                D.qipWindow.classList.add('visible');
                openApp('qip-window');
            }, 200);
        }, 900);

        startDrone();
        startClock();
        startGameTimer();
        startEye();
        startAmbient();

        updateSanity(0);
        renderInventory();
        renderContacts();

        // Стартовый сценарий
        if (continueMode) {
            setAct(state.act);
            setObjective('Продолжить расследование');
            showNotification('💾 Игра загружена');
            setTimeout(() => runAct(state.act), 1000);
        } else {
            setAct(1);
            setTimeout(() => runAct(1), 500);
        }
    }

    // ==================== CONTACTS ====================
    const CONTACTS = {
        admin: { name: 'Администратор', avatar: '👤', status: 'в сети', locked: false },
        masha: { name: 'Маша', avatar: '💁', status: 'в сети', locked: false },
        pavel: { name: 'Павел', avatar: '🧑', status: 'в сети', locked: false },
        olga: { name: 'Ольга', avatar: '👩', status: 'не в сети', locked: true },
        unknown: { name: '???', avatar: '❓', status: 'не в сети', locked: true },
        kate: { name: 'Катя', avatar: '👧', status: 'в сети', locked: true },
        max: { name: 'Максим', avatar: '🧔', status: 'в сети', locked: true },
        dead: { name: 'УДАЛЁН', avatar: '💀', status: 'не существует', locked: true }
    };

    function renderContacts() {
        D.contacts.innerHTML = '';
        Object.entries(CONTACTS).forEach(([id, c]) => {
            if (!state.save.knownContacts.includes(id)) return;
            const div = document.createElement('div');
            div.className = 'contact' + (c.locked ? ' locked' : '');
            div.dataset.user = id;
            const statusClass = c.status === 'не в сети' ? 'offline' :
                c.status === 'не существует' ? 'online-red' :
                c.status === 'он в сети' ? 'online-red' : '';
            div.innerHTML = `
                <div class="avatar">${c.avatar}</div>
                <div class="info">
                    <div class="name">${c.name}</div>
                    <div class="status ${statusClass}">${c.status}</div>
                </div>
            `;
            div.addEventListener('click', () => openChat(id, div));
            D.contacts.appendChild(div);
        });
    }

    function unlockContact(id) {
        if (state.save.knownContacts.includes(id)) return;
        state.save.knownContacts.push(id);
        saveGame();
        renderContacts();
        showNotification(`👤 Новый контакт: ${CONTACTS[id].name}`);
    }

    function openChat(user, contactEl) {
        state.currentUser = user;
        $$('.contact').forEach(x => x.classList.remove('active'));
        if (contactEl) contactEl.classList.add('active');

        D.chatHeader.textContent = `Чат с ${CONTACTS[user].name}`;
        D.messages.innerHTML = '';
        D.messageInput.disabled = false;
        D.messageInput.placeholder = 'Введите сообщение...';
        D.sendBtn.disabled = false;

        setTimeout(() => { try { D.messageInput.focus(); } catch (e) {} }, 100);

        // Восстановить историю
        if (state.dialogues[user]) {
            state.dialogues[user].forEach(m => addMessage(m.text, m.type, false, false));
        } else {
            state.dialogues[user] = [];
        }
    }

    // ==================== MESSAGES ====================
    function addMessage(text, type = 'them', animate = true, sound = true) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        if (!animate) div.style.animation = 'none';
        div.textContent = text;
        D.messages.appendChild(div);
        D.messages.scrollTop = D.messages.scrollHeight;
        if (sound && type !== 'system') messageSound();

        // Сохранить в историю
        if (state.currentUser) {
            if (!state.dialogues[state.currentUser]) state.dialogues[state.currentUser] = [];
            state.dialogues[state.currentUser].push({ text, type });
        }
        return div;
    }

    function addImageMessage(dataURL, type = 'them') {
        const div = document.createElement('div');
        div.className = `message ${type} image-msg`;
        const img = document.createElement('img');
        img.src = dataURL;
        img.className = 'msg-img';
        div.appendChild(img);
        D.messages.appendChild(div);
        D.messages.scrollTop = D.messages.scrollHeight;
        messageSound();
    }

    // ==================== SEND MESSAGE ====================
    function sendMessage() {
        const text = D.messageInput.value.trim();
        if (!text || !state.currentUser) return;
        addMessage(text, 'me');
        D.messageInput.value = '';

        const user = state.currentUser;

        setTimeout(() => {
            const typing = document.createElement('div');
            typing.className = 'message typing';
            typing.textContent = 'печатает...';
            D.messages.appendChild(typing);
            D.messages.scrollTop = D.messages.scrollHeight;

            setTimeout(() => {
                typing.remove();
                // Реакция зависит от акта и контакта
                const reply = getReply(user, text);
                if (reply) {
                    addMessage(reply.text, reply.type);
                    if (reply.type === 'creepy') {
                        triggerGlitch();
                        whisperSound();
                        updateSanity(-2);
                    }
                }
            }, 1200);
        }, 400);
    }

    function getReply(user, text) {
        if (user === 'unknown') return { text: 'ты думаешь, что можешь со мной говорить?', type: 'creepy' };
        if (user === 'masha') return { text: 'он ближе... не пиши ему', type: 'creepy' };
        if (user === 'pavel') return { text: 'беги, пока можешь', type: 'creepy' };
        if (user === 'admin') return { text: 'Не пиши ему. ПРОШУ.', type: 'creepy' };
        if (state.act >= 3) return { text: 'я тебя вижу', type: 'creepy' };
        return null;
    }

    D.sendBtn.addEventListener('click', e => { e.preventDefault(); sendMessage(); });
    D.messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // ==================== ACT SCRIPTS ====================

    // Универсальная функция: проигрывает диалог из массива
    // {user, delay, text, type} — с задержкой от начала акта
    async function playScript(script) {
        const startTime = Date.now();
        const promises = script.map(async line => {
            const waitTime = line.delay - (Date.now() - startTime);
            if (waitTime > 0) await wait(waitTime);
            if (!state.gameStarted || state.paused) return;
            // Открыть чат с нужным контактом? Нет — просто добавить сообщение
            // (игрок сам может быть в другом чате; но логично переключить)
            if (line.switchTo && state.currentUser !== line.switchTo) {
                const c = document.querySelector(`[data-user="${line.switchTo}"]`);
                if (c) c.click();
            }
            if (line.unlockContact) unlockContact(line.unlockContact);
            if (line.addInventory) addToInventory(line.addInventory);
            if (line.achievement) showAchievement(line.achievement);
            if (line.sanity) updateSanity(line.sanity);
            if (line.setObjective) setObjective(line.setObjective);
            if (line.glitch) triggerGlitch(line.glitch);
            if (line.flash) flashScreen(line.flash);
            if (line.whisper) whisperSound();
            if (line.scare) scareSound();
            if (line.action) line.action();
            if (line.text) addMessage(line.text, line.type || 'them');
        });
        await Promise.all(promises);
    }

    // ==================== АКТ I ====================
    async function runAct(act) {
        switch (act) {
            case 1: return runAct1();
            case 2: return runAct2();
            case 3: return runAct3();
            case 4: return runAct4();
            case 5: return runAct5();
        }
    }

    async function runAct1() {
        setAct(1);
        setObjective('осмотреться и прочитать сообщения');
        state.save.knownContacts = ['admin', 'masha', 'pavel'];
        renderContacts();

        const script = [
            // Приветствие
            { user: 'admin', delay: 1000, switchTo: 'admin', text: 'Привет. Ты новый тут? Не заходи в чат с ником "???".', type: 'them' },
            { user: 'admin', delay: 4000, text: 'Серьёзно. Если увидишь его в сети — сразу закрывай QIP.', type: 'them' },
            { user: 'admin', delay: 7000, text: 'Он уже забрал 3 контакта. Маша следующая.', type: 'them' },
            { user: 'admin', delay: 11000, text: 'Посмотри в "Мои фото". Там есть IMG_2013.jpg. Не открывай, просто посмотри имя.', type: 'them' },
            { user: 'admin', delay: 15000, text: 'И прочитай notes.txt. Это важно.', type: 'them', setObjective: 'прочитать notes.txt' },

            // Маша пишет
            { user: 'masha', delay: 20000, switchTo: 'masha', text: 'приветик :) ты видел странные сообщения от ???', type: 'them' },
            { user: 'masha', delay: 24000, text: 'я зашла в его чат... и теперь у меня в комнате кто-то ходит', type: 'them' },
            { user: 'masha', delay: 28000, text: 'пожалуйста помоги мне', type: 'them' },

            // Павел пишет
            { user: 'pavel', delay: 33000, switchTo: 'pavel', text: 'Слушай, админ пропал.', type: 'them' },
            { user: 'pavel', delay: 37000, text: 'Вчера писал мне ночью. Говорил "он среди нас".', type: 'them' },
            { user: 'pavel', delay: 41000, text: 'Потом QIP сам закрылся. И статус админа стал "не в сети" навсегда.', type: 'them', unlockContact: 'olga' },

            // Возврат к админу
            { user: 'admin', delay: 46000, switchTo: 'admin', text: 'Ты читал notes.txt? Там про контакт "???".', type: 'them', setObjective: 'прочитать notes.txt и найти IMG_2013.jpg' },
            { user: 'admin', delay: 52000, text: 'И ещё: не вводи ничего в чат с ??? раньше времени.', type: 'them' },
            { user: 'admin', delay: 58000, text: 'Тестирование начнётся само. Вопросов будет много.', type: 'them' },

            // Небольшое ожидание и переход к акту 2
            { user: 'admin', delay: 65000, text: 'Ну что, готов? Начинаем.', type: 'them', action: () => {
                showNotification('⏭ АКТ I завершён. Готовься...');
                setTimeout(() => runAct2(), 4000);
            }}
        ];
        await playScript(script);
    }

    // ==================== АКТ II — ВОПРОСЫ ====================
    const QUIZ_ACTS = {
        2: [
            {
                question: 'Администратор: «Первое правило QIP: если незнакомец предлагает открыть файл — что делаешь?»',
                options: [
                    { key: '1', text: 'Открою, интересно же', correct: false },
                    { key: '2', text: 'Откажусь и заблокирую', correct: true }
                ],
                wrongReply: 'Ты уже открыл его... он внутри тебя.',
                correctReply: 'Умно. Ты можешь выжить.',
                wrongSanity: -15, correctSanity: 0
            },
            {
                question: 'Маша: «Он стучит в мою дверь. Что мне делать?»',
                options: [
                    { key: '1', text: 'Открой — может, это помощь', correct: false },
                    { key: '2', text: 'Не открывай и вызови помощь', correct: true }
                ],
                wrongReply: 'Она открыла. Я слышу её крик.',
                correctReply: 'Она закрылась. Но он уже внутри.',
                wrongSanity: -20, correctSanity: -5
            },
            {
                question: 'Голос: «Ты хочешь увидеть его лицо?»',
                options: [
                    { key: '1', text: 'Да, покажи себя', correct: false },
                    { key: '2', text: 'Нет, уйди', correct: true }
                ],
                wrongReply: 'Поздно. Он в твоём экране.',
                correctReply: 'Ты отверг его. Но он вернётся.',
                wrongSanity: -25, correctSanity: 0,
                onWrong: () => { triggerGlitch(2); flashScreen('red'); scareSound(); },
                onCorrect: () => { successSound(); }
            }
        ],
        3: [
            {
                question: '??? : «Катя тоже была любопытной. Хочешь знать, что с ней стало?»',
                options: [
                    { key: '1', text: 'Да, расскажи', correct: false },
                    { key: '2', text: 'Не хочу знать', correct: true }
                ],
                wrongReply: 'Она открыла мне дверь. Теперь она часть меня.',
                correctReply: 'Хорошо. Незнание — спасение.',
                wrongSanity: -20, correctSanity: -3,
                unlockContact: 'kate'
            },
            {
                question: 'Маша: «Я вижу тебя через веб-камеру. Скажи что-нибудь.»',
                options: [
                    { key: '1', text: 'Привет, я тут', correct: false },
                    { key: '2', text: 'Закрой камеру немедленно', correct: true }
                ],
                wrongReply: 'Теперь я знаю твоё лицо.',
                correctReply: 'Слишком поздно для меня, но не для тебя.',
                wrongSanity: -25, correctSanity: -8,
                onWrong: () => { recordVoice(1000); }  // записываем голос игрока!
            },
            {
                question: 'Павел: «Он предлагает мне удалить аккаунт. Что делать?»',
                options: [
                    { key: '1', text: 'Удаляй, это выход', correct: false },
                    { key: '2', text: 'Не удаляй, он этого и хочет', correct: true }
                ],
                wrongReply: 'Павел удалился. Я займу его место.',
                correctReply: 'Павел исчез со связи. Надеюсь, он жив.',
                wrongSanity: -18, correctSanity: -5,
                onWrong: () => {
                    // Павел пропадает из контактов
                    const p = document.querySelector('[data-user="pavel"]');
                    if (p) p.style.opacity = '0.3';
                }
            },
            {
                question: '??? : «Ты читал мой notes.txt? Хочешь прочитать настоящий?»',
                options: [
                    { key: '1', text: 'Да, покажи', correct: false },
                    { key: '2', text: 'Мне хватило первого', correct: true }
                ],
                wrongReply: 'Вот он. Теперь ты знаешь слишком много.',
                correctReply: 'Умно. Продолжай скрываться.',
                wrongSanity: -22, correctSanity: 0,
                onWrong: () => { addToInventory('📄 Настоящий notes.txt'); }
            }
        ],
        4: [
            {
                question: 'Админ (голос с помехами): «Я вижу тебя. Ты не один в комнате.»',
                options: [
                    { key: '1', text: 'Обернуться', correct: false },
                    { key: '2', text: 'Не двигаться', correct: true }
                ],
                wrongReply: 'Ты обернулся. Он был там.',
                correctReply: 'Хорошо. Ты не дал ему понять, что видишь.',
                wrongSanity: -30, correctSanity: -5,
                onWrong: () => { jumpscareQuick(); }
            },
            {
                question: 'Ольга: «Он уже убил троих. Хочешь остановить его?»',
                options: [
                    { key: '1', text: 'Да, скажи как', correct: false },
                    { key: '2', text: 'Нет, это не моё дело', correct: true }
                ],
                wrongReply: 'Теперь ты в списке. Ты следующий.',
                correctReply: 'Ты не в списке. Пока что.',
                wrongSanity: -20, correctSanity: 0,
                unlockContact: 'max'
            },
            {
                question: '??? : «Ты знаешь, что QIP больше не существует с 2013 года?»',
                options: [
                    { key: '1', text: 'Что?! Как я в нём?', correct: false },
                    { key: '2', text: 'Это не важно', correct: true }
                ],
                wrongReply: 'Ты в ловушке. Всегда был.',
                correctReply: 'Хорошо. Не задавай лишних вопросов.',
                wrongSanity: -25, correctSanity: -5,
                onWrong: () => { flashScreen('red'); triggerGlitch(2); }
            },
            {
                question: 'Максим: «Админ мёртв. Ты говоришь с ним через ???. Пойми это.»',
                options: [
                    { key: '1', text: 'Не верю тебе', correct: false },
                    { key: '2', text: 'Теперь понимаю', correct: true }
                ],
                wrongReply: 'Ты не хочешь понимать. Он покажет тебе.',
                correctReply: 'Хорошо. Ты готов к финалу.',
                wrongSanity: -28, correctSanity: -10,
                onWrong: () => { scareSound(); }
            }
        ],
        5: [
            {
                question: 'ФИНАЛЬНЫЙ ВОПРОС. ??? : «Ты — мой?»',
                options: [
                    { key: '1', text: 'Да, я твой', correct: false },
                    { key: '2', text: 'Нет. Я свободен.', correct: true }
                ],
                wrongReply: 'Ты мой. Ты всегда был моим. Добро пожаловать домой.',
                correctReply: 'Нет... НЕТ! Ты не можешь! ТЫ НЕ МОЖЕШЬ!!!',
                wrongSanity: -50, correctSanity: 20,
                onWrong: () => { setTimeout(jumpscareEffect, 2000); },
                onCorrect: () => { setTimeout(bestEnding, 3000); }
            }
        ]
    };

    async function runAct2() {
        setAct(2);
        setObjective('пройти тестирование (5 вопросов)');
        showNotification('⚡ АКТ II — Тестирование началось');

        await wait(2000);
        await runQuizSequence(QUIZ_ACTS[2]);

        // После теста
        showAchievement('Прошёл Акт II');
        await wait(3000);
        runAct3();
    }

    async function runAct3() {
        setAct(3);
        setObjective('разобраться в исчезновении контактов');
        showNotification('⚡ АКТ III — Контакты исчезают');

        unlockContact('olga');

        const script = [
            { user: 'admin', delay: 2000, switchTo: 'admin', text: 'Слушай... я не уверен, что это я.', type: 'creepy' },
            { user: 'admin', delay: 6000, text: 'Вчера я проснулся в 3:33. Мой QIP был открыт. Я писал тебе, но не помню.', type: 'creepy' },
            { user: 'admin', delay: 11000, text: 'Проверь мои фото. IMG_2013.jpg там не было раньше.', type: 'them' },
            { user: 'admin', delay: 16000, text: 'Проверь.', type: 'them', action: () => {
                // Активируем проклятое фото
                const img = document.querySelector('[data-img="5"]');
                if (img) img.classList.add('haunted-img');
            }},

            // Маша пропадает
            { user: 'masha', delay: 22000, switchTo: 'masha', text: 'Он здесь.', type: 'creepy' },
            { user: 'masha', delay: 24000, text: 'Он за моей спиной.', type: 'creepy', sanity: -10 },
            { user: 'masha', delay: 26000, text: 'ПРОЩАЙ', type: 'creepy', action: () => {
                // Маша пропадает
                const m = document.querySelector('[data-user="masha"]');
                if (m) {
                    const status = m.querySelector('.status');
                    status.textContent = 'не в сети';
                    status.classList.add('offline');
                    m.classList.add('locked');
                }
                showNotification('💀 Маша отключилась');
            }},

            { user: 'admin', delay: 32000, switchTo: 'admin', text: 'Маша пропала. Её аккаунт удалён.', type: 'them' },
            { user: 'admin', delay: 37000, text: 'Слушай, я должен тебе кое-что показать.', type: 'them' },
            { user: 'admin', delay: 42000, text: 'В QIP есть скрытая папка с файлами. Я не могу её открыть.', type: 'them', setObjective: 'изучить скрытые файлы' },
            { user: 'admin', delay: 48000, text: 'Ты можешь? Попробуй открыть последнюю фотку.', type: 'them' },
            { user: 'admin', delay: 53000, text: 'Осторожно. Что бы ты ни увидел — не кричи.', type: 'creepy', action: () => {
                // Автоматически открыть фото ???? если игрок сам не открыл через 30 сек — принудительно
                setTimeout(() => {
                    if (state.act < 4) {
                        openImage('5');
                    }
                }, 30000);
            }},
            { user: 'admin', delay: 60000, text: 'Ну что, готов к правде?', type: 'them', action: () => {
                showNotification('⏭ АКТ III завершён');
                setTimeout(() => runAct4(), 5000);
            }}
        ];
        await playScript(script);
    }

    async function runAct4() {
        setAct(4);
        setObjective('выжить. Он охотится.');
        showNotification('💀 АКТ IV — ОХОТА');
        unlockContact('max');

        const script = [
            { user: 'admin', delay: 2000, switchTo: 'admin', text: 'Я... не помню, что было последние 3 часа.', type: 'creepy' },
            { user: 'admin', delay: 6000, text: 'Мой статус меняется. Я вижу себя как "не существует".', type: 'creepy' },

            { user: 'max', delay: 12000, switchTo: 'max', text: 'Привет. Ты друг админа?', type: 'them' },
            { user: 'max', delay: 16000, text: 'Я вижу его QIP онлайн, но он не отвечает.', type: 'them' },
            { user: 'max', delay: 20000, text: 'Я был в его квартире час назад. Он сидит перед монитором и не двигается.', type: 'them' },
            { user: 'max', delay: 24000, text: 'И знаешь что? На его экране открыт чат с ТОБОЙ.', type: 'creepy' },

            { user: 'olga', delay: 30000, switchTo: 'olga', text: 'Я знаю, кто такой ???', type: 'them' },
            { user: 'olga', delay: 34000, text: 'Это не человек. Это то, что осталось от пользователей, которые не вышли из QIP в 2013.', type: 'them' },
            { user: 'olga', delay: 38000, text: 'Их души застряли в системе. И теперь они ищут компанию.', type: 'them' },
            { user: 'olga', delay: 42000, text: 'Ты можешь выйти. Но сначала должен пройти финальный тест.', type: 'them', addInventory: '🗝️ Ключ от QIP' },
            { user: 'olga', delay: 46000, text: 'Отвечай правильно на ВСЕ вопросы. Тогда ты свободен.', type: 'them' },

            { user: 'unknown', delay: 54000, switchTo: 'unknown', text: 'Ты готов?', type: 'creepy', action: () => {
                // Открыть ??? контакт
                unlockContact('unknown');
                const u = document.querySelector('[data-user="unknown"]');
                if (u) {
                    const status = u.querySelector('.status');
                    status.textContent = 'он в сети';
                    status.classList.add('online-red');
                    u.classList.remove('locked');
                }
                state.unknownUnlocked = true;
            }},
            { user: 'unknown', delay: 58000, text: 'Хорошо. Начнём.', type: 'creepy' },
            { user: 'unknown', delay: 60000, text: 'Но сначала — маленькая игра.', type: 'creepy', action: () => {
                // Несколько случайных глитчей
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => triggerGlitch(2), i * 800);
                    setTimeout(whisperSound, i * 800 + 200);
                }
                scareSound();
            }},
            { user: 'unknown', delay: 66000, text: 'Готов?', type: 'creepy', action: () => {
                showNotification('⏭ АКТ IV завершён');
                setTimeout(() => runAct5(), 5000);
            }}
        ];
        await playScript(script);
    }

    async function runAct5() {
        setAct(5);
        setObjective('пройти ФИНАЛЬНЫЙ тест и выжить');
        showNotification('🔥 АКТ V — ФИНАЛ');

        await wait(2000);
        await runQuizSequence(QUIZ_ACTS[5]);
    }

    // Универсальный запуск теста (вопрос за вопросом)
    async function runQuizSequence(questions) {
        for (let i = 0; i < questions.length; i++) {
            state.totalQuestions++;
            state.save.totalQuestions = state.totalQuestions;
            const q = questions[i];

            // Открыть чат с ??? если есть
            if (state.currentUser !== 'unknown' && state.unknownUnlocked) {
                const u = document.querySelector('[data-user="unknown"]');
                if (u) u.click();
            }

            await wait(500);
            addMessage(q.question, 'creepy');
            whisperSound();
            triggerGlitch();

            await wait(1000);
            const choice = await askChoice(q);

            if (choice) {
                // Правильный
                state.correctAnswers++;
                state.save.correctAnswers = state.correctAnswers;
                saveGame();
                addMessage(choice.text, 'me');
                await wait(800);
                addMessage(q.correctReply, 'them');
                if (q.correctSanity) updateSanity(q.correctSanity);
                if (q.onCorrect) q.onCorrect();
                successSound();
                if (q.unlockContact) unlockContact(q.unlockContact);
                if (q.addInventory) addToInventory(q.addInventory);
            } else {
                // Неправильный
                addMessage(q._clicked.text, 'me');
                await wait(800);
                addMessage(q.wrongReply, 'creepy');
                if (q.wrongSanity) updateSanity(q.wrongSanity);
                if (q.onWrong) q.onWrong();
                errorSound();
                triggerGlitch(2);
                flashScreen('red');
                if (q.unlockContact) unlockContact(q.unlockContact);
                if (q.addInventory) addToInventory(q.addInventory);
            }

            await wait(2200);
            addMessage('СИСТЕМА: Следующий вопрос...', 'system');
            await wait(1500);
        }

        // Все вопросы пройдены
        await wait(2000);
        addMessage('СИСТЕМА: Тестирование завершено.', 'system');

        await wait(1500);

        // Проверка финала
        const percent = state.correctAnswers / state.totalQuestions;
        if (state.totalQuestions >= 10 && percent === 1) {
            // Идеально — лучшая концовка
            bestEnding();
        } else if (percent >= 0.7) {
            // Хорошая концовка
            goodEnding();
        } else {
            // Плохая концовка
            await wait(2000);
            addMessage('??? : ты не прошёл проверку.', 'creepy');
            await wait(2500);
            addMessage('??? : добро пожаловать домой.', 'creepy');
            await wait(1500);
            jumpscareEffect();
        }
    }

    function askChoice(q) {
        return new Promise(resolve => {
            const container = document.createElement('div');
            container.className = 'chat-choice';
            const label = document.createElement('div');
            label.className = 'chat-choice-label';
            label.textContent = '▸ ВЫБЕРИ ОТВЕТ';
            container.appendChild(label);

            let resolved = false;

            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'chat-choice-btn';
                btn.type = 'button';
                btn.innerHTML = `<span class="key">${opt.key}</span><span>${opt.text}</span>`;
                btn.addEventListener('click', () => {
                    if (resolved) return;
                    resolved = true;
                    container.querySelectorAll('.chat-choice-btn').forEach(b => {
                        b.disabled = true;
                        b.style.cursor = 'default';
                    });
                    if (opt.correct) {
                        btn.classList.add('correct');
                        resolve(opt);
                    } else {
                        btn.classList.add('wrong');
                        q._clicked = opt;
                        resolve(null);
                    }
                });
                container.appendChild(btn);
            });

            D.messages.appendChild(container);
            D.messages.scrollTop = D.messages.scrollHeight;
            D.messageInput.disabled = true;
            D.sendBtn.disabled = true;

            // Горячие клавиши 1/2
            const keyHandler = e => {
                if (resolved) return;
                if (e.key === '1') {
                    const btn = container.querySelectorAll('.chat-choice-btn')[0];
                    if (btn) btn.click();
                } else if (e.key === '2') {
                    const btn = container.querySelectorAll('.chat-choice-btn')[1];
                    if (btn) btn.click();
                }
            };
            document.addEventListener('keydown', keyHandler);

            // После клика вернуть поле
            const origResolve = resolve;
            resolve = function(v) {
                document.removeEventListener('keydown', keyHandler);
                D.messageInput.disabled = false;
                D.sendBtn.disabled = false;
                origResolve(v);
            };
        });
    }

    // ==================== JUMPSCARE ====================
    async function jumpscareEffect(cause = 'normal') {
        if (!state.gameStarted) return;
        state.paused = true;

        // Записываем голос игрока
        await recordVoice(1000);

        scareSound();
        setTimeout(() => {
            // Воспроизводим записанный голос
            if (state.recordedAudioURL) playRecordedVoice();
        }, 300);

        flashScreen('red');
        D.jumpscare.classList.remove('hidden');

        // Усиливаем эффекты
        document.body.style.filter = 'invert(1) contrast(2)';

        setTimeout(() => {
            document.body.style.filter = '';
            D.jumpscare.classList.add('hidden');
            D.fadeOverlay.classList.add('active');

            setTimeout(() => {
                state.save.deaths++;
                saveGame();
                state.paused = false;
                showEnding('death', cause);
            }, 1500);
        }, 1200);
    }

    function jumpscareQuick() {
        scareSound();
        flashScreen('red');
        D.jumpscare.classList.remove('hidden');
        setTimeout(() => D.jumpscare.classList.add('hidden'), 600);
        updateSanity(-15);
    }

    // ==================== ENDINGS ====================
    function showEnding(type, cause) {
        clearSave();
        stopMusic();
        setDroneIntensity(0.01);

        const stats = `
            💀 Смертей: ${state.save.deaths} · 🟢 Спасений: ${state.save.survived} · 🏆 Побед: ${state.save.best}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Правильных ответов: ${state.correctAnswers}/${state.totalQuestions}
        `;

        D.ending.classList.remove('hidden');
        D.endingStats.innerHTML = stats;

        if (type === 'death') {
            D.endingTitle.textContent = 'ТЫ УМЕР';
            D.endingText.textContent = cause === 'sanity' ?
                'Твой рассудок не выдержал. Он забрал тебя.' :
                'QIP 2012 больше не существует. И ты теперь тоже.';
        }
    }

    function goodEnding() {
        clearSave();
        stopMusic();
        state.save.survived++;
        localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));

        D.endingTitle.textContent = 'ТЫ ВЫЖИЛ';
        D.endingTitle.style.color = '#0c4';
        D.endingText.textContent =
            `Ты ответил правильно на ${state.correctAnswers} из ${state.totalQuestions}. ` +
            `Он ушёл... пока что. Но ты знаешь, что он вернётся.`;
        D.endingStats.innerHTML = `
            🟢 Спасений: ${state.save.survived} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Результат: ${state.correctAnswers}/${state.totalQuestions}
        `;
        D.ending.classList.remove('hidden');
        D.ending.querySelector('h1').style.color = '#0c4';
    }

    function bestEnding() {
        clearSave();
        stopMusic();
        state.save.best++;
        localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
        successSound();

        D.endingTitle.textContent = '🏆 ТЫ ЕГО ПОБЕДИЛ';
        D.endingTitle.style.color = '#fc0';
        D.endingText.innerHTML =
            `Ты ответил правильно на ВСЕ ${state.totalQuestions} вопросов!<br><br>` +
            `Контакт "???" удалён из системы навсегда.<br>` +
            `Ты — первый, кто смог выйти из QIP живым.`;
        D.endingStats.innerHTML = `
            🏆 Побед: ${state.save.best} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Идеально: ${state.correctAnswers}/${state.totalQuestions}<br><br>
            🎖️ Открыто достижений: ${state.save.achievements.length}
        `;
        D.ending.classList.remove('hidden');
        D.ending.querySelector('h1').style.color = '#fc0';
        setTimeout(() => showAchievement('Легенда QIP'), 500);
    }

    function formatTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    // ==================== WINDOW MANAGER ====================
    function openApp(appId) {
        const w = $(appId);
        if (!w) return;
        w.style.display = 'flex';
        requestAnimationFrame(() => {
            w.classList.add('visible');
            w.classList.remove('minimized');
        });

        if (!state.openedApps.has(appId)) {
            state.openedApps.add(appId);
            const item = document.createElement('div');
            item.className = 'taskbar-item visible';
            item.dataset.target = appId;
            const titles = {
                'qip-window': '💬 QIP 2012',
                'gallery-window': '📷 Мои фото',
                'notes-window': '📝 Блокнот',
                'browser-window': '🌐 Internet',
                'encyclopedia-window': '📖 Справочник',
                'image-viewer': '🖼️ Просмотр'
            };
            item.textContent = titles[appId] || '📄 Окно';
            item.addEventListener('click', () => toggleApp(appId));
            D.taskbarItems.appendChild(item);
        }
    }

    function closeApp(appId) {
        const w = $(appId);
        if (!w) return;
        w.classList.remove('visible');
        setTimeout(() => { w.style.display = 'none'; }, 400);
    }

    function toggleApp(appId) {
        const w = $(appId);
        if (!w) return;
        if (w.classList.contains('visible') && !w.classList.contains('minimized')) {
            w.classList.add('minimized');
        } else {
            w.classList.remove('minimized');
            w.classList.add('visible');
        }
        resumeAudio();
    }

    // Обработчики кнопок окон
    document.addEventListener('click', e => {
        if (e.target.matches('.window-controls .close')) {
            const target = e.target.dataset.target;
            if (target === 'qip-window' && state.act >= 4) {
                addMessage('СИСТЕМА: Закрыть QIP невозможно.', 'system');
                triggerGlitch();
                errorSound();
                updateSanity(-5);
                return;
            }
            closeApp(target);
        }
        if (e.target.matches('.window-controls .min')) {
            const target = e.target.dataset.target;
            const w = $(target);
            if (w) w.classList.add('minimized');
        }
    });

    // ==================== ICONS ====================
    document.addEventListener('click', e => {
        const icon = e.target.closest('.desktop-icon');
        if (!icon) return;
        const id = icon.id;
        resumeAudio();
        if (id === 'icon-qip') openApp('qip-window');
        else if (id === 'icon-gallery') openApp('gallery-window');
        else if (id === 'icon-notes') openApp('notes-window');
        else if (id === 'icon-browser') openApp('browser-window');
        else if (id === 'icon-encyclopedia') openApp('encyclopedia-window');
        else if (id === 'icon-mine') showNotification('💣 Сапёр: все мины уже взорвались. Не сейчас.');
        else if (id === 'icon-recycle') {
            if (state.save.best > 0) showNotification('🗑️ Ты победил. Корзина пуста.');
            else {
                showNotification('🗑️ В корзине 4 удалённых контакта...');
                setTimeout(() => triggerGlitch(), 800);
            }
        }
    });

    // ==================== GALLERY ====================
    const IMAGES = {
        '1': { title: 'Закат.jpg', content: '🌆', haunted: false },
        '2': { title: 'Отпуск.jpg', content: '🏞️', haunted: false },
        '3': { title: 'Пёс.jpg', content: '🐕', haunted: false },
        '4': { title: 'ДР.jpg', content: '🎂', haunted: false },
        '5': {
            title: 'IMG_2013.jpg', content: '👁️', haunted: true,
            onOpen: () => {
                showAchievement('Нашёл его фото');
                updateSanity(-10);
                setTimeout(() => {
                    addMessage('СИСТЕМА: Обнаружено вложение IMG_2013.jpg', 'system');
                    if (state.currentUser) {
                        addMessage('??? : теперь ты видел меня.', 'creepy');
                    }
                    triggerGlitch();
                    setDroneIntensity(0.18);
                    scareSound();
                }, 500);
                addToInventory('📷 IMG_2013.jpg');
            }
        },
        '6': {
            title: '.jpg', content: '👁️', haunted: true,
            onOpen: () => {
                showAchievement('Не смотри на это');
                updateSanity(-20);
                setTimeout(() => jumpscareQuick(), 1500);
            }
        }
    };

    function renderGallery() {
        D.galleryGrid.innerHTML = '';
        Object.entries(IMAGES).forEach(([id, img]) => {
            const div = document.createElement('div');
            div.className = 'gallery-item' + (img.haunted ? ' haunted-img' : '');
            div.dataset.img = id;
            div.innerHTML = `${img.content}<div class="caption">${img.title}</div>`;
            div.addEventListener('click', () => openImage(id));
            D.galleryGrid.appendChild(div);
        });
    }

    function openImage(id) {
        const img = IMAGES[id];
        if (!img) return;
        D.imageTitle.textContent = img.title;
        D.imageBody.textContent = img.content;
        if (img.haunted) {
            D.imageBody.classList.add('haunted');
            whisperSound();
            triggerGlitch();
        } else {
            D.imageBody.classList.remove('haunted');
        }
        openApp('image-viewer');
        if (img.onOpen) img.onOpen();
    }

    // ==================== NOTES ====================
    const NOTES_CONTENT = `Если ты это читаешь — БЕГИ.

Я писал это 3 дня назад. Контакт "???" появился у меня в QIP после того, как я открыл .jpg файл из общей папки.

Он присылает сообщения ночью. Он знает, где я живу.

Вчера он прислал фото моей комнаты. С той стороны, где я не могу быть.

Не заходи в "Мои фото". Не открывай IMG_2013.jpg.

Если увидишь его в сети — закрывай QIP. Но помни: он уже в контактах.

                                - Админ

P.S. Если сможешь — выбери правильные ответы. Он проверяет тебя.
P.P.S. В финале — не отвечай "да". Никогда.`;

    // ==================== BROWSER ====================
    const BROWSER_PAGES = {
        'http://qip.ru': `
            <h1>QIP 2012 — Скачать</h1>
            <p>Последняя версия QIP 2012 доступна для загрузки.</p>
            <p><b>Внимание:</b> начиная с 2013 года серверы QIP не поддерживаются.</p>
            <p class="glitch-text">Он всё ещё работает. Где-то. Внутри.</p>
            <h2>Известные проблемы</h2>
            <p>— Контакт "???" не отображается в списке контактов.<br>
            — Сообщения от него приходят, даже когда программа закрыта.<br>
            — <span class="redacted">ДАННЫЕ УДАЛЕНЫ</span></p>
        `,
        'http://wiki/qip': `
            <h1>QIP 2012 — История</h1>
            <p>QIP (Quiet Internet Pager) — популярный мессенджер в России в 2008-2013 годах.</p>
            <h2>Происшествия</h2>
            <p>В 2013 году были зафиксированы случаи, когда пользователи QIP сообщали о странных контактах с ником "???"</p>
            <p>Все они впоследствии прекратили использовать интернет. Судьба их неизвестна.</p>
            <p class="glitch-text">Он всё ещё ищет.</p>
        `,
        'http://forum/qip': `
            <h1>Форум QIP — "Странный контакт ???"</h1>
            <p><b>User_Anon:</b> Кто-нибудь видел контакт ??? У меня появился вчера. Пишет странные вещи.</p>
            <p><b>Admin_X:</b> Не отвечай ему. Просто заблокируй.</p>
            <p><b>User_Anon:</b> Уже поздно. Он знает моё имя.</p>
            <p><b>Admin_X:</b> Тогда беги. <span class="redacted">Не выходи из дома ночью.</span></p>
            <p><b>System:</b> Тема закрыта. Пользователь User_Anon больше не заходил.</p>
        `
    };

    D.browserContent.innerHTML = BROWSER_PAGES['http://qip.ru'];

    // ==================== ENCYCLOPEDIA ====================
    const ENCYCLOPEDIA = [
        { id: 'qip', title: 'QIP 2012', text: 'Мессенджер, популярный в 2008-2013. Содержит скрытые функции.' },
        { id: 'admin', title: 'Администратор', text: 'Пользователь, первым столкнувшийся с контактом "???".' },
        { id: 'masha', title: 'Маша', text: 'Второй контакт, пропавший после общения с "???".' },
        { id: 'pavel', title: 'Павел', text: 'Третий контакт. Возможно, ещё жив.' },
        { id: 'olga', title: 'Ольга', text: 'Исследователь QIP. Знает природу "???".' },
        { id: 'unknown', title: '???', text: 'Не человек. Совокупность душ пользователей, не вышедших из QIP в 2013.' },
        { id: 'img2013', title: 'IMG_2013.jpg', text: 'Файл, содержащий изображение "???". Не открывать.' },
        { id: 'rules', title: 'Правила выживания', text: '1. Не открывать файлы. 2. Не отвечать на вопросы неправильно. 3. Не смотреть в глаза "???".' }
    ];

    function renderEncyclopedia() {
        D.encyclopediaBody.innerHTML = '';
        ENCYCLOPEDIA.forEach(entry => {
            const unlocked = state.save.unlockedEntries.includes(entry.id);
            const div = document.createElement('div');
            div.className = 'entry' + (unlocked ? '' : ' locked');
            div.innerHTML = `
                <div class="entry-title">${unlocked ? entry.title : '🔒 ???'}</div>
                <div>${unlocked ? entry.text : 'Не открыто. Продолжайте игру.'}</div>
            `;
            D.encyclopediaBody.appendChild(div);
        });
    }

    // ==================== CLOSE / UI EVENTS ====================
    D.startBtn.addEventListener('click', e => { e.preventDefault(); startGame(false); });
    D.startBtn.addEventListener('touchend', e => { e.preventDefault(); if (!state.gameStarted) startGame(false); }, { passive: false });

    D.continueBtn.addEventListener('click', e => { e.preventDefault(); startGame(true); });
    D.continueBtn.addEventListener('touchend', e => { e.preventDefault(); if (!state.gameStarted) startGame(true); }, { passive: false });

    D.micBtn.addEventListener('click', async () => {
        await requestMic();
    });

    D.restartBtn.addEventListener('click', () => {
        clearSave();
        location.reload();
    });

    // Escape — экстренный выход (хорошая концовка, только в акте 1-2)
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.gameStarted && !state.paused) {
            if (state.act <= 2 && state.totalQuestions === 0) {
                state.paused = true;
                state.save.survived++;
                saveGame();
                D.endingTitle.textContent = 'ТЫ УШЁЛ ВОВРЕМЯ';
                D.endingTitle.style.color = '#0c4';
                D.endingText.textContent = 'Ты закрыл QIP до того, как он достал тебя.';
                D.endingStats.innerHTML = `🟢 Спасений: ${state.save.survived}<br>⏱ Время: ${formatTime(state.gameTime)}`;
                D.ending.classList.remove('hidden');
                D.ending.querySelector('h1').style.color = '#0c4';
            } else {
                showNotification('❌ Выйти невозможно.');
                triggerGlitch();
                errorSound();
                updateSanity(-3);
            }
        }
    });

    // Автосохранение при закрытии
    window.addEventListener('beforeunload', () => {
        if (state.gameStarted && !state.paused) saveGame();
    });

    // ==================== INIT ====================
    function init() {
        renderContacts();
        renderGallery();
        D.notesText.value = NOTES_CONTENT;
        renderEncyclopedia();
        runBoot();
    }

    init();

    // Инициализация AudioContext при первом клике
    document.addEventListener('click', () => {
        initAudio();
        resumeAudio();
    }, { once: true });

})();