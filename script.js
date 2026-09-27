'use strict';
/* ============================================================
   QIP 2012 — LEGENDARY EDITION
   Видео-вставки, карта локаций, кооп, leaderboard
   ============================================================ */
(function() {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // ==================== SAVE ====================
    const SAVE_KEY = 'qip2012_save_v4';
    const DEFAULT_SAVE = {
        act: 1, scene: 0, inventory: [], achievements: [],
        deaths: 0, survived: 0, best: 0,
        correctAnswers: 0, totalQuestions: 0,
        knownContacts: ['admin'], unlockedEntries: ['qip', 'admin'],
        gameTime: 0, sanity: 100, endings: [], secretsFound: [],
        room: 'desk', unlockedRooms: ['desk'],
        playerName: '', lastSave: 0
    };

    function loadSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return { ...DEFAULT_SAVE };
            return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
        } catch (e) { return { ...DEFAULT_SAVE }; }
    }

    function saveGame() {
        if (!state.gameStarted) return;
        try {
            state.save.lastSave = Date.now();
            state.save.gameTime = state.gameTime;
            state.save.sanity = state.sanity;
            state.save.act = state.act;
            state.save.scene = state.sceneIndex;
            state.save.room = state.currentRoom;
            localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
        } catch (e) {}
    }

    function clearSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    }

    const state = {
        save: loadSave(),
        gameStarted: false, paused: false,
        currentUser: null, haunted: false,
        act: 1, sceneIndex: 0,
        correctAnswers: 0, totalQuestions: 0,
        gameTime: 0, sanity: 100,
        dialogues: {}, openedApps: new Set(),
        unknownUnlocked: false,
        inventory: new Set(), micStream: null,
        recordedAudioURL: null, recorder: null,
        clockH: 22, clockM: 13, clockS: 0,
        currentRoom: 'desk',
        coopMode: false, coopCode: null, coopChannel: null,
        ambientTimer: null, eyesTimer: null
    };

    // Восстановить
    state.act = state.save.act || 1;
    state.sceneIndex = state.save.scene || 0;
    state.correctAnswers = state.save.correctAnswers || 0;
    state.totalQuestions = state.save.totalQuestions || 0;
    state.gameTime = state.save.gameTime || 0;
    state.sanity = state.save.sanity ?? 100;
    state.inventory = new Set(state.save.inventory || []);
    state.currentRoom = state.save.room || 'desk';

    // ==================== DOM ====================
    const D = {
        bootScreen: $('boot-screen'), intro: $('intro'),
        startBtn: $('start-btn'), continueBtn: $('continue-btn'),
        coopBtn: $('coop-btn'), leaderboardBtn: $('leaderboard-btn'),
        micBtn: $('mic-btn'), micStatus: $('mic-status'),
        introStats: $('intro-stats'),
        cutscene: $('cutscene'), cutsceneScene: $('cutscene-scene'),
        cutsceneText: $('cutscene-text'), cutsceneSkip: $('cutscene-skip'),
        cutsceneProgress: $('cutscene-progress-fill'),
        hud: $('hud'), hudAct: $('hud-act'), hudObjective: $('hud-objective'),
        hudTimer: $('hud-timer'), hudLocation: $('hud-location'),
        sanityFill: $('sanity-fill'), hudEye: $('hud-eye'),
        hudInventory: $('hud-inventory'), hudCoop: $('hud-coop'),
        coopList: $('coop-list'),
        desktop: $('desktop'), wallpaper: $('wallpaper'),
        qipWindow: $('qip-window'), contacts: $('contacts'),
        chatHeader: $('chat-header'), messages: $('messages'),
        messageInput: $('message-input'), sendBtn: $('send-btn'),
        taskbarItems: $('taskbar-items'), clock: $('clock'),
        glitchOverlay: $('glitch-overlay'), vignette: $('vignette'),
        flash: $('flash'), scanlines: $('scanlines'),
        bloodOverlay: $('blood-overlay'), jumpscare: $('jumpscare'),
        fadeOverlay: $('fade-overlay'), ending: $('ending'),
        endingTitle: $('ending-title'), endingText: $('ending-text'),
        endingStats: $('ending-stats'), restartBtn: $('restart-btn'),
        leaderboardAfterBtn: $('leaderboard-after-btn'),
        endingNameInput: $('ending-name-input'),
        playerName: $('player-name'), saveScoreBtn: $('save-score-btn'),
        choice: $('choice'), choiceTitle: $('choice-title'),
        choiceText: $('choice-text'), choiceButtons: $('choice-buttons'),
        achievement: $('achievement'), achievementName: $('achievement-name'),
        notification: $('notification'),
        galleryGrid: $('gallery-grid'), notesText: $('notes-text'),
        browserContent: $('browser-content'),
        encyclopediaBody: $('encyclopedia-body'),
        imageTitle: $('image-title'), imageBody: $('image-body'),
        leaderboardBody: $('leaderboard-body'),
        coopModal: $('coop-modal'), coopCode: $('coop-code'),
        coopCopy: $('coop-copy'), coopInput: $('coop-input'),
        coopJoin: $('coop-join'), coopClose: $('coop-close'),
        leaderboardModal: $('leaderboard-modal'),
        leaderboardModalText: $('leaderboard-modal-text'),
        leaderboardClose: $('leaderboard-close'),
        roomView: $('room-view'), roomContent: $('room-content'),
        roomExit: $('room-exit'),
        mapView: $('map-view')
    };

    // ==================== AUDIO ====================
    let audioCtx = null, drone = null, musicInterval = null;

    function initAudio() {
        if (audioCtx) return;
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    function resumeAudio() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }

    function startDrone() {
        if (!audioCtx || drone) return;
        try {
            const o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
            const g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
            o1.type = 'sine'; o1.frequency.value = 55;
            o2.type = 'sine'; o2.frequency.value = 58;
            f.type = 'lowpass'; f.frequency.value = 200;
            g.gain.value = 0.0001;
            o1.connect(f); o2.connect(f); f.connect(g); g.connect(audioCtx.destination);
            o1.start(); o2.start();
            g.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 3);
            drone = { o1, o2, g, f };
        } catch (e) {}
    }

    function setDroneIntensity(v) {
        if (!drone || !audioCtx) return;
        const t = clamp(v, 0.0001, 0.25);
        try {
            drone.g.gain.linearRampToValueAtTime(t, audioCtx.currentTime + 1);
            drone.o1.frequency.linearRampToValueAtTime(55 + t * 800, audioCtx.currentTime + 2);
            drone.o2.frequency.linearRampToValueAtTime(58 + t * 800, audioCtx.currentTime + 2);
        } catch (e) {}
    }

    function beep(f, d = 0.08, t = 'sine', v = 0.05) {
        if (!audioCtx) return;
        try {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = t; o.frequency.value = f; g.gain.value = v;
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(); o.stop(audioCtx.currentTime + d);
        } catch (e) {}
    }

    function scareSound() {
        if (!audioCtx) return;
        try {
            const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.2, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
            const n = audioCtx.createBufferSource(); n.buffer = buf;
            const ng = audioCtx.createGain(); ng.gain.value = 0.35;
            const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 400;
            n.connect(f); f.connect(ng); ng.connect(audioCtx.destination);
            const o = audioCtx.createOscillator(), og = audioCtx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(1200, audioCtx.currentTime);
            o.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 1);
            og.gain.value = 0.3;
            og.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
            o.connect(og); og.connect(audioCtx.destination);
            n.start(); o.start();
            n.stop(audioCtx.currentTime + 1.2);
            o.stop(audioCtx.currentTime + 1.2);
        } catch (e) {}
    }

    function whisperSound() {
        if (!audioCtx) return;
        try {
            const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * 0.3 * Math.sin(i * 0.0005);
            const s = audioCtx.createBufferSource(); s.buffer = buf;
            const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 5;
            const g = audioCtx.createGain(); g.gain.value = 0.08;
            s.connect(f); f.connect(g); g.connect(audioCtx.destination);
            s.start(); s.stop(audioCtx.currentTime + 0.8);
        } catch (e) {}
    }

    function messageSound() { beep(880, 0.06, 'sine', 0.04); setTimeout(() => beep(1200, 0.06, 'sine', 0.03), 40); }
    function successSound() { beep(660, 0.1, 'sine', 0.06); setTimeout(() => beep(880, 0.1, 'sine', 0.06), 90); setTimeout(() => beep(1320, 0.15, 'sine', 0.06), 180); }
    function errorSound() { beep(180, 0.15, 'sawtooth', 0.08); setTimeout(() => beep(120, 0.2, 'sawtooth', 0.08), 120); }
    function heartbeat() { beep(60, 0.1, 'sine', 0.15); setTimeout(() => beep(50, 0.12, 'sine', 0.12), 180); }

    function playMusicForAct(act) {
        stopMusic();
        if (!audioCtx) return;
        const notes = {
            1: [220, 233, 246, 220], 2: [196, 208, 220, 196],
            3: [174, 185, 196, 174], 4: [146, 155, 164, 146],
            5: [110, 116, 123, 110]
        }[act] || [220];
        let idx = 0;
        const playNote = () => {
            if (!audioCtx || !musicInterval) return;
            try {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'triangle';
                o.frequency.value = notes[idx % notes.length];
                g.gain.value = 0.02;
                g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3.5);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(); o.stop(audioCtx.currentTime + 4);
                idx++;
            } catch (e) {}
        };
        playNote();
        musicInterval = setInterval(playNote, 4000);
    }
    function stopMusic() { if (musicInterval) { clearInterval(musicInterval); musicInterval = null; } }

    // ==================== MIC ====================
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

    async function recordVoice(ms = 800) {
        if (!state.micStream) return;
        try {
            const rec = new MediaRecorder(state.micStream);
            const chunks = [];
            rec.ondataavailable = e => chunks.push(e.data);
            rec.onstop = () => {
                try {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    if (state.recordedAudioURL) URL.revokeObjectURL(state.recordedAudioURL);
                    state.recordedAudioURL = URL.createObjectURL(blob);
                } catch (e) {}
            };
            rec.start();
            setTimeout(() => { try { rec.stop(); } catch (e) {} }, ms);
        } catch (e) {}
    }

    function playRecordedVoice() {
        if (!state.recordedAudioURL) return false;
        try {
            const a = new Audio(state.recordedAudioURL);
            a.volume = 0.9;
            a.play().catch(() => {});
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
        clearTimeout(state._notifTimer);
        state._notifTimer = setTimeout(() => D.notification.classList.add('hidden'), duration);
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
        const names = {
            1: 'АКТ I — ПРОБУЖДЕНИЕ', 2: 'АКТ II — СВЯЗЬ',
            3: 'АКТ III — ИСЧЕЗНОВЕНИЕ', 4: 'АКТ IV — ОХОТА',
            5: 'АКТ V — ФИНАЛ'
        };
        D.hudAct.textContent = names[act] || '';
        playMusicForAct(act);
    }
    function setObjective(text) { D.hudObjective.textContent = 'Цель: ' + text; }
    function updateLocation(loc) {
        state.currentRoom = loc;
        const names = { desk: '🖥️ Комната', kitchen: '🍳 Кухня', hallway: '🚪 Коридор', bathroom: '🚿 Ванная', basement: '🔒 Подвал' };
        D.hudLocation.textContent = '📍 ' + (names[loc] || loc);
        $$('.map-room').forEach(el => {
            el.classList.toggle('active', el.dataset.room === loc);
        });
        D.wallpaper.className = '';
        if (loc !== 'desk') D.wallpaper.classList.add('room-' + loc);
    }
    function updateSanity(delta) {
        state.sanity = clamp(state.sanity + delta, 0, 100);
        D.sanityFill.style.width = state.sanity + '%';
        D.sanityFill.style.background = state.sanity > 60 ? '#0c4' :
            state.sanity > 30 ? 'linear-gradient(90deg,#fc0,#f80)' : '#c22';
        if (state.sanity < 30) D.bloodOverlay.classList.add('active');
        else D.bloodOverlay.classList.remove('active');
        if (state.sanity <= 0 && state.gameStarted && !state.paused) jumpscareEffect('sanity');
    }
    function startGameTimer() {
        setInterval(() => {
            if (!state.gameStarted || state.paused) return;
            state.gameTime++;
            const h = Math.floor(state.gameTime / 3600);
            const m = Math.floor((state.gameTime % 3600) / 60);
            const s = state.gameTime % 60;
            D.hudTimer.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            if (state.gameTime % 30 === 0) saveGame();
        }, 1000);
    }
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
        if (state.act >= 3 && Math.random() < 0.1) {
            D.clock.textContent = `${String(Math.floor(rand(0,24))).padStart(2,'0')}:${String(Math.floor(rand(0,60))).padStart(2,'0')}`;
        }
    }
    function startEye() {
        if (state.eyesTimer) return;
        state.eyesTimer = setInterval(() => {
            if (!state.gameStarted || state.paused) return;
            if (state.act >= 2 && Math.random() < 0.3) {
                D.hudEye.classList.add('active');
                whisperSound();
                setTimeout(() => D.hudEye.classList.remove('active'), 2000 + Math.random() * 3000);
            }
        }, 15000);
    }
    function startAmbient() {
        if (state.ambientTimer) return;
        state.ambientTimer = setInterval(() => {
            if (!state.gameStarted || state.paused) return;
            const chance = 0.1 + state.act * 0.05;
            if (Math.random() < chance) {
                triggerGlitch();
                if (Math.random() < 0.5) whisperSound();
                if (Math.random() < 0.3) { updateSanity(-1); heartbeat(); }
            }
        }, 5000);
    }

    // ==================== BOOT ====================
    function updateIntroStats() {
        const p = [];
        if (state.save.deaths > 0) p.push(`💀 Смертей: ${state.save.deaths}`);
        if (state.save.survived > 0) p.push(`🟢 Спасений: ${state.save.survived}`);
        if (state.save.best > 0) p.push(`🏆 Побед: ${state.save.best}`);
        if (state.save.act > 1) p.push(`📖 Акт: ${state.save.act}`);
        D.introStats.textContent = p.length ? p.join(' · ') : '';
    }

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

    // ==================== CUTSCENE ====================
    const CUTSCENES = {
        intro: {
            duration: 8000,
            scenes: [
                { time: 0,    svg: cutSvgCRT(), text: 'Windows XP... 2012 год...' },
                { time: 2500, svg: cutSvgQIP(), text: 'QIP 2012. Твой любимый мессенджер.' },
                { time: 5500, svg: cutSvgEye(), text: 'Ты давно не заходил в него...' }
            ]
        },
        act2: {
            duration: 6000,
            scenes: [
                { time: 0,    svg: cutSvgContact(), text: 'Кто-то добавил тебя в контакты.' },
                { time: 3000, svg: cutSvgEye(), text: 'Контакт без имени. Без фото. Без статуса.' }
            ]
        },
        act3: {
            duration: 7000,
            scenes: [
                { time: 0,    svg: cutSvgDisappear(), text: 'Маша отключилась...' },
                { time: 3000, svg: cutSvgPhoto(), text: 'IMG_2013.jpg содержит то, что не должно существовать.' }
            ]
        },
        act4: {
            duration: 8000,
            scenes: [
                { time: 0,    svg: cutSvgHunter(), text: 'Он вышел из чата в реальный мир.' },
                { time: 4000, svg: cutSvgEye(), text: 'Теперь он охотится за тобой.' }
            ]
        },
        act5: {
            duration: 7000,
            scenes: [
                { time: 0,    svg: cutSvgFinal(), text: 'Последний вопрос.' },
                { time: 3500, svg: cutSvgEye(), text: 'Ответь правильно — и ты свободен.' }
            ]
        }
    };

    function cutSvgCRT() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <rect x="20" y="20" width="360" height="240" fill="#111" stroke="#333" stroke-width="2" rx="10"/>
            <rect x="40" y="40" width="320" height="200" fill="#050" opacity="0.4"/>
            <text x="200" y="150" fill="#0f0" font-family="monospace" font-size="20" text-anchor="middle">C:\\&gt;_</text>
            <rect x="20" y="270" width="360" height="10" fill="#222" rx="3"/>
            <text x="200" y="290" fill="#666" font-family="monospace" font-size="10" text-anchor="middle">Windows XP Professional</text>
        </svg>`;
    }
    function cutSvgQIP() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#0a0a15"/>
            <rect x="40" y="40" width="320" height="220" fill="#eef2f7" rx="6" stroke="#6a8ab0" stroke-width="2"/>
            <rect x="40" y="40" width="320" height="24" fill="#3a6aa0" rx="6"/>
            <text x="60" y="57" fill="#fff" font-family="sans-serif" font-size="12">💬 QIP 2012</text>
            <rect x="50" y="70" width="80" height="180" fill="#dce6f0"/>
            <rect x="140" y="70" width="210" height="180" fill="#f5f8fc"/>
            <circle cx="90" cy="90" r="10" fill="#9ab"/>
            <text x="90" y="120" fill="#234" font-family="sans-serif" font-size="10" text-anchor="middle">Admin</text>
        </svg>`;
    }
    function cutSvgEye() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <ellipse cx="200" cy="150" rx="120" ry="70" fill="#1a0000" stroke="#440000" stroke-width="3"/>
            <ellipse cx="200" cy="150" rx="110" ry="60" fill="#3a0000"/>
            <circle cx="200" cy="150" r="45" fill="#0a0000"/>
            <circle cx="200" cy="150" r="30" fill="#f00" opacity="0.7">
                <animate attributeName="r" values="28;32;28" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="200" cy="150" r="12" fill="#000"/>
            <circle cx="185" cy="135" r="4" fill="#fff" opacity="0.8"/>
            <ellipse cx="100" cy="150" rx="20" ry="40" fill="#000" opacity="0.5"/>
            <ellipse cx="300" cy="150" rx="20" ry="40" fill="#000" opacity="0.5"/>
        </svg>`;
    }
    function cutSvgContact() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#0a0a15"/>
            <rect x="100" y="100" width="200" height="100" fill="#1a0000" rx="6" stroke="#600" stroke-width="2"/>
            <text x="200" y="140" fill="#f22" font-family="monospace" font-size="18" text-anchor="middle" font-weight="bold">???</text>
            <text x="200" y="170" fill="#600" font-family="monospace" font-size="12" text-anchor="middle">добавил вас в контакты</text>
        </svg>`;
    }
    function cutSvgDisappear() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <text x="200" y="120" fill="#666" font-family="sans-serif" font-size="14" text-anchor="middle">Маша</text>
            <text x="200" y="160" fill="#888" font-family="sans-serif" font-size="14" text-anchor="middle">в сети</text>
            <line x1="100" y1="145" x2="300" y2="145" stroke="#c22" stroke-width="3" stroke-dasharray="8 4">
                <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite"/>
            </line>
            <text x="200" y="200" fill="#c22" font-family="monospace" font-size="14" text-anchor="middle" font-weight="bold">УДАЛЕНО</text>
        </svg>`;
    }
    function cutSvgPhoto() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <rect x="120" y="80" width="160" height="140" fill="#1a0000" stroke="#600" stroke-width="3"/>
            <text x="200" y="155" fill="#f22" font-family="monospace" font-size="60" text-anchor="middle">👁️</text>
            <text x="200" y="240" fill="#600" font-family="monospace" font-size="11" text-anchor="middle">IMG_2013.jpg</text>
        </svg>`;
    }
    function cutSvgHunter() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <path d="M 150 200 Q 200 100 250 200 Q 200 260 150 200" fill="#1a0000" stroke="#600" stroke-width="2"/>
            <circle cx="180" cy="180" r="8" fill="#f00">
                <animate attributeName="r" values="7;10;7" dur="1s" repeatCount="indefinite"/>
            </circle>
            <circle cx="220" cy="180" r="8" fill="#f00">
                <animate attributeName="r" values="7;10;7" dur="1s" repeatCount="indefinite"/>
            </circle>
            <text x="200" y="280" fill="#600" font-family="monospace" font-size="12" text-anchor="middle">он вышел в сеть</text>
        </svg>`;
    }
    function cutSvgFinal() {
        return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="400" height="300" fill="#000"/>
            <text x="200" y="150" fill="#f22" font-family="monospace" font-size="48" text-anchor="middle" font-weight="bold">?</text>
            <text x="200" y="220" fill="#600" font-family="monospace" font-size="14" text-anchor="middle">последний вопрос</text>
        </svg>`;
    }

    async function playCutscene(name) {
        const cs = CUTSCENES[name];
        if (!cs) return Promise.resolve();
        return new Promise(resolve => {
            D.cutscene.classList.remove('hidden');
            D.cutsceneScene.innerHTML = '';
            D.cutsceneText.textContent = '';
            D.cutsceneProgress.style.width = '0%';

            const startTime = Date.now();
            let sceneIdx = 0;
            let skipped = false;

            const skip = () => {
                skipped = true;
                D.cutscene.classList.add('hidden');
                resolve();
            };
            D.cutsceneSkip.onclick = skip;

            const progressInterval = setInterval(() => {
                if (skipped) return;
                const elapsed = Date.now() - startTime;
                D.cutsceneProgress.style.width = Math.min(100, (elapsed / cs.duration) * 100) + '%';
            }, 100);

            const checkScene = () => {
                if (skipped) return;
                const elapsed = Date.now() - startTime;
                if (elapsed >= cs.duration) {
                    clearInterval(progressInterval);
                    clearTimeout(sceneTimer);
                    skip();
                    return;
                }
                // Определить текущую сцену
                let newIdx = 0;
                for (let i = 0; i < cs.scenes.length; i++) {
                    if (elapsed >= cs.scenes[i].time) newIdx = i;
                }
                if (newIdx !== sceneIdx) {
                    sceneIdx = newIdx;
                    const s = cs.scenes[sceneIdx];
                    D.cutsceneScene.innerHTML = s.svg;
                    D.cutsceneText.textContent = s.text;
                }
                sceneTimer = setTimeout(checkScene, 100);
            };
            let sceneTimer = setTimeout(checkScene, 100);

            // Первая сцена
            D.cutsceneScene.innerHTML = cs.scenes[0].svg;
            D.cutsceneText.textContent = cs.scenes[0].text;
            sceneIdx = 0;
            checkScene();
        });
    }

    // ==================== START ====================
    async function startGame(continueMode = false, coopJoin = null) {
        if (state.gameStarted) return;
        state.gameStarted = true;

        if (!continueMode) {
            state.save = { ...DEFAULT_SAVE,
                deaths: state.save.deaths, survived: state.save.survived, best: state.save.best };
            state.act = 1; state.sceneIndex = 0;
            state.correctAnswers = 0; state.totalQuestions = 0;
            state.gameTime = 0; state.sanity = 100;
            state.inventory = new Set();
        } else {
            state.act = state.save.act || 1;
            state.sceneIndex = state.save.scene || 0;
            state.correctAnswers = state.save.correctAnswers || 0;
            state.totalQuestions = state.save.totalQuestions || 0;
            state.gameTime = state.save.gameTime || 0;
            state.sanity = state.save.sanity ?? 100;
            state.inventory = new Set(state.save.inventory || []);
            state.currentRoom = state.save.room || 'desk';
        }

        initAudio();
        resumeAudio();
        await requestMic();

        D.intro.classList.add('fade-out');
        await wait(900);
        D.intro.classList.add('hidden');
        D.desktop.classList.remove('hidden');
        D.hud.classList.remove('hidden');

        // Cutscene intro
        if (!continueMode) await playCutscene('intro');

        D.qipWindow.classList.add('visible');
        openApp('qip-window');

        startDrone();
        startClock();
        startGameTimer();
        startEye();
        startAmbient();

        updateSanity(0);
        renderInventory();
        renderContacts();
        updateLocation(state.currentRoom);

        if (continueMode) {
            setAct(state.act);
            setObjective('Продолжить расследование');
            showNotification('💾 Игра загружена');
            setTimeout(() => runAct(state.act), 1000);
        } else {
            setAct(1);
            setTimeout(() => runAct(1), 500);
        }

        if (coopJoin) initCoop(coopJoin, false);
    }

    // ==================== CONTACTS ====================
    const CONTACTS = {
        admin: { name: 'Администратор', avatar: '👤', status: 'в сети', locked: false },
        masha: { name: 'Маша', avatar: '💁', status: 'в сети', locked: false },
        pavel: { name: 'Павел', avatar: '🧑', status: 'в сети', locked: false },
        olga: { name: 'Ольга', avatar: '👩', status: 'не в сети', locked: true },
        unknown: { name: '???', avatar: '❓', status: 'не в сети', locked: true },
        kate: { name: 'Катя', avatar: '👧', status: 'в сети', locked: true },
        max: { name: 'Максим', avatar: '🧔', status: 'в сети', locked: true }
    };

    function renderContacts() {
        D.contacts.innerHTML = '';
        Object.entries(CONTACTS).forEach(([id, c]) => {
            if (!state.save.knownContacts.includes(id)) return;
            const div = document.createElement('div');
            div.className = 'contact' + (c.locked ? ' locked' : '');
            div.dataset.user = id;
            const statusClass = c.status === 'не в сети' ? 'offline' :
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

    function openChat(user, el) {
        state.currentUser = user;
        $$('.contact').forEach(x => x.classList.remove('active'));
        if (el) el.classList.add('active');
        D.chatHeader.textContent = `Чат с ${CONTACTS[user].name}`;
        D.messages.innerHTML = '';
        D.messageInput.disabled = false;
        D.sendBtn.disabled = false;
        setTimeout(() => { try { D.messageInput.focus(); } catch (e) {} }, 100);
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
        if (state.currentUser) {
            if (!state.dialogues[state.currentUser]) state.dialogues[state.currentUser] = [];
            state.dialogues[state.currentUser].push({ text, type });
        }
        if (state.coopMode && state.coopChannel) {
            // Отправить через BroadcastChannel
            try {
                state.coopChannel.postMessage({ type: 'message', text, msgType: type, sender: 'other' });
            } catch (e) {}
        }
        return div;
    }

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
                const reply = getReply(user);
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

    function getReply(user) {
        if (user === 'unknown') return { text: 'ты думаешь, что можешь со мной говорить?', type: 'creepy' };
        if (user === 'masha') return { text: 'он ближе...', type: 'creepy' };
        if (user === 'pavel') return { text: 'беги, пока можешь', type: 'creepy' };
        if (user === 'admin') return { text: 'Не пиши ему. ПРОШУ.', type: 'creepy' };
        if (state.act >= 3) return { text: 'я тебя вижу', type: 'creepy' };
        return null;
    }

    D.sendBtn.addEventListener('click', e => { e.preventDefault(); sendMessage(); });
    D.messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // ==================== SCRIPTS ====================
    async function playScript(script) {
        const t0 = Date.now();
        const promises = script.map(async line => {
            const waitTime = line.delay - (Date.now() - t0);
            if (waitTime > 0) await wait(waitTime);
            if (!state.gameStarted || state.paused) return;
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

    // ==================== ACTS ====================
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
            { delay: 1000, switchTo: 'admin', text: 'Привет. Ты новый тут? Не заходи в чат с ником "???".', type: 'them' },
            { delay: 4000, text: 'Серьёзно. Если увидишь его в сети — сразу закрывай QIP.', type: 'them' },
            { delay: 7000, text: 'Он уже забрал 3 контакта. Маша следующая.', type: 'them' },
            { delay: 11000, text: 'Посмотри в "Мои фото". Там есть IMG_2013.jpg.', type: 'them' },
            { delay: 15000, text: 'И прочитай notes.txt. Это важно.', type: 'them', setObjective: 'прочитать notes.txt' },
            { delay: 20000, switchTo: 'masha', text: 'приветик :) ты видел странные сообщения от ???', type: 'them' },
            { delay: 24000, text: 'я зашла в его чат... и теперь у меня в комнате кто-то ходит', type: 'them' },
            { delay: 28000, text: 'пожалуйста помоги мне', type: 'them' },
            { delay: 33000, switchTo: 'pavel', text: 'Слушай, админ пропал.', type: 'them' },
            { delay: 37000, text: 'Вчера писал мне ночью. Говорил "он среди нас".', type: 'them' },
            { delay: 41000, text: 'Потом QIP сам закрылся. И статус админа стал "не в сети" навсегда.', type: 'them', unlockContact: 'olga' },
            { delay: 46000, switchTo: 'admin', text: 'Ты читал notes.txt? Там про контакт "???".', type: 'them', setObjective: 'прочитать notes.txt и найти IMG_2013.jpg' },
            { delay: 52000, text: 'Тестирование начнётся само. Вопросов будет много.', type: 'them' },
            { delay: 58000, text: 'Ну что, готов? Начинаем.', type: 'them', action: async () => {
                showNotification('⏭ АКТ I завершён');
                await wait(2000);
                await playCutscene('act2');
                runAct2();
            }}
        ];
        await playScript(script);
    }

    // ==================== QUIZZES ====================
    const QUIZ_ACTS = {
        2: [
            { question: 'Администратор: «Первое правило: незнакомец предлагает открыть файл — что делаешь?»',
              options: [
                  { key: '1', text: 'Открою, интересно же', correct: false },
                  { key: '2', text: 'Откажусь и заблокирую', correct: true }
              ],
              wrongReply: 'Ты уже открыл его... он внутри тебя.',
              correctReply: 'Умно. Ты можешь выжить.',
              wrongSanity: -15, correctSanity: 0 },
            { question: 'Маша: «Он стучит в мою дверь. Что мне делать?»',
              options: [
                  { key: '1', text: 'Открой — может, это помощь', correct: false },
                  { key: '2', text: 'Не открывай и вызови помощь', correct: true }
              ],
              wrongReply: 'Она открыла. Я слышу её крик.',
              correctReply: 'Она закрылась. Но он уже внутри.',
              wrongSanity: -20, correctSanity: -5 },
            { question: 'Голос: «Ты хочешь увидеть его лицо?»',
              options: [
                  { key: '1', text: 'Да, покажи себя', correct: false },
                  { key: '2', text: 'Нет, уйди', correct: true }
              ],
              wrongReply: 'Поздно. Он в твоём экране.',
              correctReply: 'Ты отверг его. Но он вернётся.',
              wrongSanity: -25, correctSanity: 0,
              onWrong: () => { triggerGlitch(2); flashScreen('red'); scareSound(); },
              onCorrect: () => { successSound(); } }
        ],
        3: [
            { question: '??? : «Катя тоже была любопытной. Хочешь знать, что с ней стало?»',
              options: [
                  { key: '1', text: 'Да, расскажи', correct: false },
                  { key: '2', text: 'Не хочу знать', correct: true }
              ],
              wrongReply: 'Она открыла мне дверь. Теперь она часть меня.',
              correctReply: 'Хорошо. Незнание — спасение.',
              wrongSanity: -20, correctSanity: -3, unlockContact: 'kate' },
            { question: 'Маша: «Я вижу тебя через веб-камеру. Скажи что-нибудь.»',
              options: [
                  { key: '1', text: 'Привет, я тут', correct: false },
                  { key: '2', text: 'Закрой камеру немедленно', correct: true }
              ],
              wrongReply: 'Теперь я знаю твоё лицо.',
              correctReply: 'Слишком поздно для меня, но не для тебя.',
              wrongSanity: -25, correctSanity: -8,
              onWrong: () => { recordVoice(1000); } },
            { question: 'Павел: «Он предлагает мне удалить аккаунт. Что делать?»',
              options: [
                  { key: '1', text: 'Удаляй, это выход', correct: false },
                  { key: '2', text: 'Не удаляй, он этого и хочет', correct: true }
              ],
              wrongReply: 'Павел удалился. Я займу его место.',
              correctReply: 'Павел исчез со связи. Надеюсь, он жив.',
              wrongSanity: -18, correctSanity: -5 },
            { question: '??? : «Ты читал мой notes.txt? Хочешь прочитать настоящий?»',
              options: [
                  { key: '1', text: 'Да, покажи', correct: false },
                  { key: '2', text: 'Мне хватило первого', correct: true }
              ],
              wrongReply: 'Вот он. Теперь ты знаешь слишком много.',
              correctReply: 'Умно. Продолжай скрываться.',
              wrongSanity: -22, correctSanity: 0,
              onWrong: () => { addToInventory('📄 Настоящий notes.txt'); } }
        ],
        4: [
            { question: 'Админ (голос с помехами): «Я вижу тебя. Ты не один в комнате.»',
              options: [
                  { key: '1', text: 'Обернуться', correct: false },
                  { key: '2', text: 'Не двигаться', correct: true }
              ],
              wrongReply: 'Ты обернулся. Он был там.',
              correctReply: 'Хорошо. Ты не дал ему понять, что видишь.',
              wrongSanity: -30, correctSanity: -5,
              onWrong: () => { jumpscareQuick(); } },
            { question: 'Ольга: «Он уже убил троих. Хочешь остановить его?»',
              options: [
                  { key: '1', text: 'Да, скажи как', correct: false },
                  { key: '2', text: 'Нет, это не моё дело', correct: true }
              ],
              wrongReply: 'Теперь ты в списке. Ты следующий.',
              correctReply: 'Ты не в списке. Пока что.',
              wrongSanity: -20, correctSanity: 0, unlockContact: 'max' },
            { question: '??? : «Ты знаешь, что QIP больше не существует с 2013 года?»',
              options: [
                  { key: '1', text: 'Что?! Как я в нём?', correct: false },
                  { key: '2', text: 'Это не важно', correct: true }
              ],
              wrongReply: 'Ты в ловушке. Всегда был.',
              correctReply: 'Хорошо. Не задавай лишних вопросов.',
              wrongSanity: -25, correctSanity: -5,
              onWrong: () => { flashScreen('red'); triggerGlitch(2); } },
            { question: 'Максим: «Админ мёртв. Ты говоришь с ним через ???. Пойми это.»',
              options: [
                  { key: '1', text: 'Не верю тебе', correct: false },
                  { key: '2', text: 'Теперь понимаю', correct: true }
              ],
              wrongReply: 'Ты не хочешь понимать. Он покажет тебе.',
              correctReply: 'Хорошо. Ты готов к финалу.',
              wrongSanity: -28, correctSanity: -10,
              onWrong: () => { scareSound(); } }
        ],
        5: [
            { question: 'ФИНАЛЬНЫЙ ВОПРОС. ??? : «Ты — мой?»',
              options: [
                  { key: '1', text: 'Да, я твой', correct: false },
                  { key: '2', text: 'Нет. Я свободен.', correct: true }
              ],
              wrongReply: 'Ты мой. Ты всегда был моим. Добро пожаловать домой.',
              correctReply: 'Нет... НЕТ! Ты не можешь! ТЫ НЕ МОЖЕШЬ!!!',
              wrongSanity: -50, correctSanity: 20,
              onWrong: () => { setTimeout(jumpscareEffect, 2000); },
              onCorrect: () => { setTimeout(bestEnding, 3000); } }
        ]
    };

    async function runAct2() {
        setAct(2);
        setObjective('пройти тестирование');
        showNotification('⚡ АКТ II — Тестирование началось');
        await wait(2000);
        await runQuizSequence(QUIZ_ACTS[2]);
        showAchievement('Прошёл Акт II');
        await wait(2000);
        await playCutscene('act3');
        runAct3();
    }

    async function runAct3() {
        setAct(3);
        setObjective('разобраться в исчезновении контактов');
        showNotification('💀 АКТ III — Контакты исчезают');
        unlockContact('olga');

        const script = [
            { delay: 2000, switchTo: 'admin', text: 'Слушай... я не уверен, что это я.', type: 'creepy' },
            { delay: 6000, text: 'Вчера я проснулся в 3:33. Мой QIP был открыт. Я писал тебе, но не помню.', type: 'creepy' },
            { delay: 11000, text: 'Проверь мои фото. IMG_2013.jpg там не было раньше.', type: 'them' },
            { delay: 16000, text: 'Проверь.', type: 'them', action: () => {
                const img = document.querySelector('[data-img="5"]');
                if (img) img.classList.add('haunted-img');
            }},
            { delay: 22000, switchTo: 'masha', text: 'Он здесь.', type: 'creepy' },
            { delay: 24000, text: 'Он за моей спиной.', type: 'creepy', sanity: -10 },
            { delay: 26000, text: 'ПРОЩАЙ', type: 'creepy', action: () => {
                const m = document.querySelector('[data-user="masha"]');
                if (m) {
                    const s = m.querySelector('.status');
                    s.textContent = 'не в сети';
                    s.classList.add('offline');
                    m.classList.add('locked');
                }
                showNotification('💀 Маша отключилась');
            }},
            { delay: 32000, switchTo: 'admin', text: 'Маша пропала. Её аккаунт удалён.', type: 'them' },
            { delay: 37000, text: 'Слушай, я должен тебе кое-что показать.', type: 'them' },
            { delay: 42000, text: 'В QIP есть скрытая папка с файлами. Я не могу её открыть.', type: 'them', setObjective: 'изучить скрытые файлы' },
            { delay: 48000, text: 'Ты можешь? Попробуй открыть последнюю фотку.', type: 'them' },
            { delay: 53000, text: 'Осторожно. Что бы ты ни увидел — не кричи.', type: 'creepy', action: () => {
                setTimeout(() => { if (state.act < 4) openImage('5'); }, 30000);
            }},
            { delay: 60000, text: 'Ну что, готов к правде?', type: 'them', action: async () => {
                showNotification('⏭ АКТ III завершён');
                await wait(2000);
                await playCutscene('act4');
                runAct4();
            }}
        ];
        await playScript(script);
    }

    async function runAct4() {
        setAct(4);
        setObjective('выжить. Он охотится.');
        showNotification('👁️ АКТ IV — ОХОТА');
        unlockContact('max');

        const script = [
            { delay: 2000, switchTo: 'admin', text: 'Я... не помню, что было последние 3 часа.', type: 'creepy' },
            { delay: 6000, text: 'Мой статус меняется. Я вижу себя как "не существует".', type: 'creepy' },
            { delay: 12000, switchTo: 'max', text: 'Привет. Ты друг админа?', type: 'them' },
            { delay: 16000, text: 'Я вижу его QIP онлайн, но он не отвечает.', type: 'them' },
            { delay: 20000, text: 'Я был в его квартире час назад. Он сидит перед монитором и не двигается.', type: 'them' },
            { delay: 24000, text: 'И знаешь что? На его экране открыт чат с ТОБОЙ.', type: 'creepy' },
            { delay: 30000, switchTo: 'olga', text: 'Я знаю, кто такой ???', type: 'them' },
            { delay: 34000, text: 'Это не человек. Это то, что осталось от пользователей, которые не вышли из QIP в 2013.', type: 'them' },
            { delay: 38000, text: 'Их души застряли в системе. И теперь они ищут компанию.', type: 'them' },
            { delay: 42000, text: 'Ты можешь выйти. Но сначала должен пройти финальный тест.', type: 'them', addInventory: '🗝️ Ключ от QIP' },
            { delay: 46000, text: 'Отвечай правильно на ВСЕ вопросы. Тогда ты свободен.', type: 'them' },
            { delay: 54000, switchTo: 'unknown', text: 'Ты готов?', type: 'creepy', action: () => {
                unlockContact('unknown');
                const u = document.querySelector('[data-user="unknown"]');
                if (u) {
                    const s = u.querySelector('.status');
                    s.textContent = 'он в сети';
                    s.classList.add('online-red');
                    u.classList.remove('locked');
                }
                state.unknownUnlocked = true;
            }},
            { delay: 58000, text: 'Хорошо. Начнём.', type: 'creepy' },
            { delay: 60000, text: 'Но сначала — маленькая игра.', type: 'creepy', action: () => {
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => triggerGlitch(2), i * 800);
                    setTimeout(whisperSound, i * 800 + 200);
                }
                scareSound();
            }},
            { delay: 66000, text: 'Готов?', type: 'creepy', action: async () => {
                showNotification('⏭ АКТ IV завершён');
                await wait(2000);
                await playCutscene('act5');
                runAct5();
            }}
        ];
        await playScript(script);
    }

    async function runAct5() {
        setAct(5);
        setObjective('пройти ФИНАЛЬНЫЙ тест');
        showNotification('🔥 АКТ V — ФИНАЛ');
        await wait(2000);
        await runQuizSequence(QUIZ_ACTS[5]);
    }

    async function runQuizSequence(questions) {
        for (let i = 0; i < questions.length; i++) {
            state.totalQuestions++;
            state.save.totalQuestions = state.totalQuestions;
            const q = questions[i];

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

        await wait(2000);
        addMessage('СИСТЕМА: Тестирование завершено.', 'system');
        await wait(1500);

        const percent = state.correctAnswers / state.totalQuestions;
        if (state.totalQuestions >= 10 && percent === 1) bestEnding();
        else if (percent >= 0.7) goodEnding();
        else {
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
            let resolvedValue = null;
            const finalize = (v) => {
                if (resolved) return;
                resolved = true;
                resolvedValue = v;
                document.removeEventListener('keydown', keyHandler);
                D.messageInput.disabled = false;
                D.sendBtn.disabled = false;
                resolve(v);
            };

            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'chat-choice-btn';
                btn.type = 'button';
                btn.innerHTML = `<span class="key">${opt.key}</span><span>${opt.text}</span>`;
                btn.addEventListener('click', () => {
                    if (resolved) return;
                    container.querySelectorAll('.chat-choice-btn').forEach(b => {
                        b.disabled = true;
                        b.style.cursor = 'default';
                    });
                    if (opt.correct) {
                        btn.classList.add('correct');
                        finalize(opt);
                    } else {
                        btn.classList.add('wrong');
                        q._clicked = opt;
                        finalize(null);
                    }
                });
                container.appendChild(btn);
            });

            D.messages.appendChild(container);
            D.messages.scrollTop = D.messages.scrollHeight;
            D.messageInput.disabled = true;
            D.sendBtn.disabled = true;

            const keyHandler = e => {
                if (resolved) return;
                if (e.key === '1' || e.key === '2') {
                    const idx = e.key === '1' ? 0 : 1;
                    const btns = container.querySelectorAll('.chat-choice-btn');
                    if (btns[idx]) btns[idx].click();
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }

    // ==================== JUMPSCARE ====================
    async function jumpscareEffect(cause = 'normal') {
        if (!state.gameStarted) return;
        state.paused = true;
        await recordVoice(1000);
        scareSound();
        setTimeout(() => { if (state.recordedAudioURL) playRecordedVoice(); }, 300);
        flashScreen('red');
        D.jumpscare.classList.remove('hidden');
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
        stopMusic();
        setDroneIntensity(0.01);
        D.ending.classList.remove('hidden');
        D.endingNameInput.style.display = 'flex';
        D.endingStats.innerHTML = `
            💀 Смертей: ${state.save.deaths} · 🟢 Спасений: ${state.save.survived} · 🏆 Побед: ${state.save.best}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Правильных: ${state.correctAnswers}/${state.totalQuestions}<br>
            🎖️ Достижений: ${state.save.achievements.length}
        `;
        if (type === 'death') {
            D.endingTitle.textContent = 'ТЫ УМЕР';
            D.endingText.textContent = cause === 'sanity' ?
                'Твой рассудок не выдержал. Он забрал тебя.' :
                'QIP 2012 больше не существует. И ты теперь тоже.';
        }
    }

    function goodEnding() {
        stopMusic();
        state.save.survived++;
        saveGame();
        D.ending.classList.remove('hidden');
        D.endingNameInput.style.display = 'flex';
        D.endingTitle.textContent = 'ТЫ ВЫЖИЛ';
        D.endingText.textContent = `Ты ответил правильно на ${state.correctAnswers} из ${state.totalQuestions}. Он ушёл... пока что.`;
        D.endingStats.innerHTML = `
            🟢 Спасений: ${state.save.survived} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Результат: ${state.correctAnswers}/${state.totalQuestions}
        `;
        D.ending.querySelector('h1').style.color = '#0c4';
    }

    function bestEnding() {
        stopMusic();
        state.save.best++;
        saveGame();
        successSound();
        D.ending.classList.remove('hidden');
        D.endingNameInput.style.display = 'flex';
        D.endingTitle.textContent = '🏆 ТЫ ЕГО ПОБЕДИЛ';
        D.endingTitle.style.color = '#fc0';
        D.endingText.innerHTML = `Ты ответил правильно на ВСЕ ${state.totalQuestions} вопросов!<br><br>Контакт "???" удалён из системы навсегда.`;
        D.endingStats.innerHTML = `
            🏆 Побед: ${state.save.best} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время игры: ${formatTime(state.gameTime)}<br>
            📊 Идеально: ${state.correctAnswers}/${state.totalQuestions}<br>
            🎖️ Достижений: ${state.save.achievements.length}
        `;
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
                'qip-window': '💬 QIP 2012', 'gallery-window': '📷 Фото',
                'notes-window': '📝 Блокнот', 'browser-window': '🌐 Internet',
                'encyclopedia-window': '📖 Справочник', 'image-viewer': '🖼️ Просмотр',
                'leaderboard-window': '🏆 Лидерборд'
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
            const w = $(e.target.dataset.target);
            if (w) w.classList.add('minimized');
        }
    });

    // ==================== LOCATIONS ====================
    const ROOM_DESCRIPTIONS = {
        desk: 'Ты в комнате перед компьютером. Свет мигает.',
        kitchen: 'Кухня. Холодильник гудит. Что-то шевелится за столом.',
        hallway: 'Коридор. Свет выключен. Дверь закрыта.',
        bathroom: 'Ванная. Зеркало отражает не тебя.',
        basement: 'Подвал. Темнота смотрит на тебя.'
    };

    document.querySelectorAll('.map-room').forEach(el => {
        el.addEventListener('click', () => {
            const room = el.dataset.room;
            if (el.classList.contains('locked')) {
                showNotification('🔒 Локация заблокирована');
                return;
            }
            if (room === 'desk') {
                D.roomView.classList.add('hidden');
                updateLocation('desk');
                return;
            }
            showRoom(room);
        });
    });

    function showRoom(room) {
        if (room === 'basement' && !state.save.unlockedRooms.includes('basement')) {
            showNotification('🔒 Подвал закрыт');
            return;
        }
        updateLocation(room);
        D.roomView.classList.remove('hidden');
        const icons = {
            kitchen: '🍳', hallway: '🚪', bathroom: '🚿', basement: '🕳️'
        };
        D.roomContent.innerHTML = `
            <div>${icons[room] || '❓'}</div>
            <div class="room-desc">${ROOM_DESCRIPTIONS[room] || ''}</div>
        `;
        if (room === 'bathroom') {
            whisperSound();
            updateSanity(-3);
        }
        if (room === 'basement') {
            scareSound();
            triggerGlitch(2);
            updateSanity(-10);
        }
    }

    D.roomExit.addEventListener('click', () => {
        D.roomView.classList.add('hidden');
        updateLocation('desk');
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
        else if (id === 'icon-mine') showNotification('💣 Сапёр: все мины уже взорвались.');
        else if (id === 'icon-recycle') {
            if (state.save.best > 0) showNotification('🗑️ Ты победил. Корзина пуста.');
            else { showNotification('🗑️ В корзине 4 удалённых контакта...'); setTimeout(() => triggerGlitch(), 800); }
        } else if (id === 'icon-fridge') {
            showNotification('🧊 Холодильник открыт. Внутри записка: "он видит тебя"');
            addToInventory('📝 Записка из холодильника');
            updateSanity(-5);
        } else if (id === 'icon-mirror') {
            showNotification('🪞 Зеркало треснуло само.');
            triggerGlitch(2);
            scareSound();
            updateSanity(-8);
        } else if (id === 'icon-door') {
            if (state.act >= 4) {
                showNotification('🚪 Дверь заперта. Он не выпустит тебя.');
                scareSound();
                updateSanity(-5);
            } else {
                showNotification('🚪 Ты вышел в коридор.');
                showRoom('hallway');
            }
        }
    });

    // Показать иконки текущей комнаты
    function updateIconsVisibility() {
        $$('.desktop-icon').forEach(el => {
            const room = el.dataset.room || 'desk';
            if (room === state.currentRoom || (state.currentRoom === 'desk' && room === 'desk')) {
                el.classList.add('visible');
            } else if (room === 'desk' && state.currentRoom === 'desk') {
                el.classList.add('visible');
            } else {
                el.classList.remove('visible');
            }
        });
    }

    // Переопределим updateLocation для иконок
    const _origUpdateLocation = updateLocation;
    updateLocation = function(loc) {
        _origUpdateLocation(loc);
        updateIconsVisibility();
    };

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
                    if (state.currentUser) addMessage('??? : теперь ты видел меня.', 'creepy');
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
        `,
        'http://wiki/qip': `
            <h1>QIP 2012 — История</h1>
            <p>QIP — популярный мессенджер в России в 2008-2013 годах.</p>
            <h2>Происшествия</h2>
            <p>В 2013 году были зафиксированы случаи странных контактов с ником "???".</p>
            <p>Все они впоследствии прекратили использовать интернет.</p>
            <p class="glitch-text">Он всё ещё ищет.</p>
        `
    };

    D.browserContent.innerHTML = BROWSER_PAGES['http://qip.ru'];

    // ==================== ENCYCLOPEDIA ====================
    const ENCYCLOPEDIA = [
        { id: 'qip', title: 'QIP 2012', text: 'Мессенджер, популярный в 2008-2013.' },
        { id: 'admin', title: 'Администратор', text: 'Первый, кто столкнулся с контактом "???".' },
        { id: 'masha', title: 'Маша', text: 'Второй контакт, пропавший после общения с "???".' },
        { id: 'pavel', title: 'Павел', text: 'Третий контакт.' },
        { id: 'olga', title: 'Ольга', text: 'Исследователь QIP.' },
        { id: 'unknown', title: '???', text: 'Не человек. Совокупность душ пользователей.' },
        { id: 'img2013', title: 'IMG_2013.jpg', text: 'Проклятый файл.' },
        { id: 'rules', title: 'Правила выживания', text: '1. Не открывать файлы. 2. Не отвечать неправильно.' }
    ];

    function renderEncyclopedia() {
        D.encyclopediaBody.innerHTML = '';
        ENCYCLOPEDIA.forEach(entry => {
            const unlocked = state.save.unlockedEntries.includes(entry.id);
            const div = document.createElement('div');
            div.className = 'entry' + (unlocked ? '' : ' locked');
            div.innerHTML = `<div class="entry-title">${unlocked ? entry.title : '🔒 ???'}</div><div>${unlocked ? entry.text : 'Не открыто.'}</div>`;
            D.encyclopediaBody.appendChild(div);
        });
    }

    // ==================== COOP ====================
    function generateCoopCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    function initCoop(code, asCreator) {
        state.coopMode = true;
        state.coopCode = code;
        try {
            state.coopChannel = new BroadcastChannel('qip2012_coop_' + code);
            state.coopChannel.onmessage = e => {
                const data = e.data;
                if (data.type === 'message') {
                    const div = document.createElement('div');
                    div.className = `message ${data.msgType === 'me' ? 'coop-other' : 'them'}`;
                    div.textContent = `[${data.sender}] ${data.text}`;
                    D.messages.appendChild(div);
                    D.messages.scrollTop = D.messages.scrollHeight;
                } else if (data.type === 'hello') {
                    const div = document.createElement('div');
                    div.className = 'message system';
                    div.textContent = `👥 Игрок ${data.sender} присоединился`;
                    D.messages.appendChild(div);
                    D.hudCoop.classList.remove('hidden');
                    D.coopList.innerHTML = `<div class="coop-player">Ты</div><div class="coop-player">${data.sender}</div>`;
                }
            };
            if (asCreator) {
                state.coopChannel.postMessage({ type: 'hello', sender: 'Создатель' });
            } else {
                state.coopChannel.postMessage({ type: 'hello', sender: 'Игрок 2' });
            }
        } catch (e) {
            showNotification('❌ Кооп-режим не поддерживается');
        }
    }

    D.coopBtn.addEventListener('click', () => {
        const code = generateCoopCode();
        D.coopCode.textContent = code;
        D.coopModal.classList.remove('hidden');
    });

    D.coopCopy.addEventListener('click', () => {
        const code = D.coopCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            D.coopCopy.textContent = '✅ Скопировано!';
            setTimeout(() => { D.coopCopy.textContent = '📋 Скопировать'; }, 2000);
        }).catch(() => {
            D.coopCopy.textContent = '⚠️ Не удалось';
        });
    });

    D.coopJoin.addEventListener('click', () => {
        const code = D.coopInput.value.trim().toUpperCase();
        if (code.length < 4) {
            showNotification('❌ Введи код');
            return;
        }
        D.coopModal.classList.add('hidden');
        startGame(false, code);
    });

    D.coopClose.addEventListener('click', () => D.coopModal.classList.add('hidden'));

    // ==================== LEADERBOARD ====================
    const LB_KEY = 'qip2012_leaderboard';
    const DEFAULT_LB = [
        { name: 'QIP_Master', time: 7200, correct: 12, total: 12, deaths: 0 },
        { name: 'Anon', time: 5400, correct: 10, total: 12, deaths: 2 },
        { name: 'Fearless', time: 3600, correct: 9, total: 12, deaths: 1 },
        { name: 'Пользователь', time: 2400, correct: 7, total: 12, deaths: 3 },
        { name: 'Новичок', time: 1200, correct: 4, total: 12, deaths: 5 }
    ];

    function loadLeaderboard() {
        try {
            const raw = localStorage.getItem(LB_KEY);
            if (!raw) return [...DEFAULT_LB];
            return JSON.parse(raw);
        } catch (e) { return [...DEFAULT_LB]; }
    }

    function saveLeaderboard(list) {
        try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function addToLeaderboard(name, time, correct, total, deaths) {
        const list = loadLeaderboard();
        list.push({ name, time, correct, total, deaths, you: true });
        list.sort((a, b) => {
            if (b.correct !== a.correct) return b.correct - a.correct;
            return a.time - b.time;
        });
        const trimmed = list.slice(0, 20);
        saveLeaderboard(trimmed);
    }

    function renderLeaderboard() {
        const list = loadLeaderboard();
        D.leaderboardBody.innerHTML = '';
        const meName = state.save.playerName;
        list.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = 'lb-entry' + (entry.you && entry.name === meName ? ' you' : '');
            const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            div.innerHTML = `
                <div class="rank ${rankCls}">#${i + 1}</div>
                <div class="name">${entry.name}</div>
                <div class="score">${entry.correct}/${entry.total} · ${formatTime(entry.time)} · 💀${entry.deaths}</div>
            `;
            D.leaderboardBody.appendChild(div);
        });
    }

    D.leaderboardBtn.addEventListener('click', () => {
        renderLeaderboard();
        openApp('leaderboard-window');
    });

    D.leaderboardAfterBtn.addEventListener('click', () => {
        renderLeaderboard();
        D.ending.classList.add('hidden');
        openApp('leaderboard-window');
    });

    D.saveScoreBtn.addEventListener('click', () => {
        const name = D.playerName.value.trim() || 'Аноним';
        state.save.playerName = name;
        state.save.saveScoreName = name;
        saveGame();
        addToLeaderboard(name, state.gameTime, state.correctAnswers, state.totalQuestions, state.save.deaths);
        showNotification('🏆 Результат сохранён!');
        D.saveScoreBtn.disabled = true;
        D.saveScoreBtn.textContent = '✅ СОХРАНЕНО';
    });

    // ==================== RESTART ====================
    D.restartBtn.addEventListener('click', () => {
        clearSave();
        location.reload();
    });

    // ==================== ESCAPE ====================
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.gameStarted && !state.paused) {
            if (state.act <= 2 && state.totalQuestions === 0) {
                state.paused = true;
                state.save.survived++;
                saveGame();
                D.ending.classList.remove('hidden');
                D.endingNameInput.style.display = 'flex';
                D.endingTitle.textContent = 'ТЫ УШЁЛ ВОВРЕМЯ';
                D.endingTitle.style.color = '#0c4';
                D.endingText.textContent = 'Ты закрыл QIP до того, как он достал тебя.';
                D.endingStats.innerHTML = `🟢 Спасений: ${state.save.survived}<br>⏱ Время: ${formatTime(state.gameTime)}`;
            } else {
                showNotification('❌ Выйти невозможно.');
                triggerGlitch();
                errorSound();
                updateSanity(-3);
            }
        }
    });

    // ==================== AUTOSAVE ====================
    window.addEventListener('beforeunload', () => {
        if (state.gameStarted && !state.paused) saveGame();
    });

    // ==================== MIC BTN ====================
    D.micBtn.addEventListener('click', async () => {
        await requestMic();
    });

    // ==================== INIT ====================
    function init() {
        renderContacts();
        renderGallery();
        renderEncyclopedia();
        D.notesText.value = NOTES_CONTENT;
        updateIconsVisibility();
        runBoot();
    }

    init();

    document.addEventListener('click', () => {
        initAudio();
        resumeAudio();
    }, { once: true });

})();