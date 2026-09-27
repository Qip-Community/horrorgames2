'use strict';
/* ============================================================
   QIP 2012 — FIXED EDITION
   ИСПРАВЛЕНО: дублирование сообщений при клике на контакты
   ============================================================ */

document.addEventListener('DOMContentLoaded', function() {
    console.log('[QIP] DOM loaded');

    // ==================== HELPERS ====================
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // ==================== SAVE ====================
    const SAVE_KEY = 'qip2012_save_v5';
    const DEFAULT_SAVE = {
        act: 1, scene: 0, inventory: [], achievements: [],
        deaths: 0, survived: 0, best: 0,
        correctAnswers: 0, totalQuestions: 0,
        knownContacts: ['admin'], unlockedEntries: ['qip', 'admin'],
        gameTime: 0, sanity: 100, endings: [], secretsFound: [],
        room: 'desk', unlockedRooms: ['desk'],
        playerName: '', lastSave: 0,
        dialoguePlayed: {}
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

    // ==================== STATE ====================
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
        recordedAudioURL: null,
        clockH: 22, clockM: 13, clockS: 0,
        currentRoom: 'desk',
        coopMode: false, coopCode: null, coopChannel: null,
        ambientTimer: null, eyesTimer: null,
        activeTimers: [],       // ВСЕ активные таймеры для отмены
        dialoguePlayed: {}      // Какие диалоги уже проиграны
    };

    state.act = state.save.act || 1;
    state.sceneIndex = state.save.scene || 0;
    state.correctAnswers = state.save.correctAnswers || 0;
    state.totalQuestions = state.save.totalQuestions || 0;
    state.gameTime = state.save.gameTime || 0;
    state.sanity = state.save.sanity ?? 100;
    state.inventory = new Set(state.save.inventory || []);
    state.currentRoom = state.save.room || 'desk';
    state.dialoguePlayed = state.save.dialoguePlayed || {};

    // ==================== DOM CACHE ====================
    const D = {
        bootScreen: $('boot-screen'), intro: $('intro'),
        startBtn: $('start-btn'), continueBtn: $('continue-btn'),
        coopBtn: $('coop-btn'), leaderboardBtn: $('leaderboard-btn'),
        micBtn: $('mic-btn'), installBtn: $('install-btn'),
        micStatus: $('mic-status'), introStats: $('intro-stats'),
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
        roomView: $('room-view'), roomContent: $('room-content'),
        roomExit: $('room-exit'),
        desktopIcons: $('desktop-icons')
    };

    // ==================== TIMER MANAGEMENT (ФИКС) ====================
    function registerTimer(id) {
        state.activeTimers.push(id);
        return id;
    }

    function cancelAllDialogueTimers() {
        state.activeTimers.forEach(id => {
            clearTimeout(id);
            clearInterval(id);
        });
        state.activeTimers = [];
    }

    // Обёртка для setTimeout с автоматической регистрацией
    function safeTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        registerTimer(id);
        return id;
    }

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
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            D.micStatus.textContent = '❌ Микрофон не поддерживается';
            D.micStatus.className = 'mic-status denied';
            return false;
        }
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
        renderDesktopIcons();
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
                D.intro.style.pointerEvents = 'auto';
                D.startBtn.disabled = false;
                console.log('[QIP] Intro показан');
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

    function cutSvgCRT() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><rect x="20" y="20" width="360" height="240" fill="#111" stroke="#333" stroke-width="2" rx="10"/><rect x="40" y="40" width="320" height="200" fill="#050" opacity="0.4"/><text x="200" y="150" fill="#0f0" font-family="monospace" font-size="20" text-anchor="middle">C:\\&gt;_</text><rect x="20" y="270" width="360" height="10" fill="#222" rx="3"/><text x="200" y="290" fill="#666" font-family="monospace" font-size="10" text-anchor="middle">Windows XP Professional</text></svg>`; }
    function cutSvgQIP() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#0a0a15"/><rect x="40" y="40" width="320" height="220" fill="#eef2f7" rx="6" stroke="#6a8ab0" stroke-width="2"/><rect x="40" y="40" width="320" height="24" fill="#3a6aa0" rx="6"/><text x="60" y="57" fill="#fff" font-family="sans-serif" font-size="12">💬 QIP 2012</text><rect x="50" y="70" width="80" height="180" fill="#dce6f0"/><rect x="140" y="70" width="210" height="180" fill="#f5f8fc"/></svg>`; }
    function cutSvgEye() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><ellipse cx="200" cy="150" rx="120" ry="70" fill="#1a0000" stroke="#440000" stroke-width="3"/><ellipse cx="200" cy="150" rx="110" ry="60" fill="#3a0000"/><circle cx="200" cy="150" r="45" fill="#0a0000"/><circle cx="200" cy="150" r="30" fill="#f00" opacity="0.7"><animate attributeName="r" values="28;32;28" dur="2s" repeatCount="indefinite"/></circle><circle cx="200" cy="150" r="12" fill="#000"/><circle cx="185" cy="135" r="4" fill="#fff" opacity="0.8"/></svg>`; }
    function cutSvgContact() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#0a0a15"/><rect x="100" y="100" width="200" height="100" fill="#1a0000" rx="6" stroke="#600" stroke-width="2"/><text x="200" y="140" fill="#f22" font-family="monospace" font-size="18" text-anchor="middle" font-weight="bold">???</text><text x="200" y="170" fill="#600" font-family="monospace" font-size="12" text-anchor="middle">добавил вас в контакты</text></svg>`; }
    function cutSvgDisappear() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><text x="200" y="120" fill="#666" font-family="sans-serif" font-size="14" text-anchor="middle">Маша</text><line x1="100" y1="145" x2="300" y2="145" stroke="#c22" stroke-width="3" stroke-dasharray="8 4"><animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite"/></line><text x="200" y="200" fill="#c22" font-family="monospace" font-size="14" text-anchor="middle" font-weight="bold">УДАЛЕНО</text></svg>`; }
    function cutSvgPhoto() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><rect x="120" y="80" width="160" height="140" fill="#1a0000" stroke="#600" stroke-width="3"/><text x="200" y="155" fill="#f22" font-family="monospace" font-size="60" text-anchor="middle">👁️</text><text x="200" y="240" fill="#600" font-family="monospace" font-size="11" text-anchor="middle">IMG_2013.jpg</text></svg>`; }
    function cutSvgHunter() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><path d="M 150 200 Q 200 100 250 200 Q 200 260 150 200" fill="#1a0000" stroke="#600" stroke-width="2"/><circle cx="180" cy="180" r="8" fill="#f00"><animate attributeName="r" values="7;10;7" dur="1s" repeatCount="indefinite"/></circle><circle cx="220" cy="180" r="8" fill="#f00"><animate attributeName="r" values="7;10;7" dur="1s" repeatCount="indefinite"/></circle><text x="200" y="280" fill="#600" font-family="monospace" font-size="12" text-anchor="middle">он вышел в сеть</text></svg>`; }
    function cutSvgFinal() { return `<svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect width="400" height="300" fill="#000"/><text x="200" y="150" fill="#f22" font-family="monospace" font-size="48" text-anchor="middle" font-weight="bold">?</text><text x="200" y="220" fill="#600" font-family="monospace" font-size="14" text-anchor="middle">последний вопрос</text></svg>`; }

    async function playCutscene(name) {
        const cs = CUTSCENES[name];
        if (!cs) return Promise.resolve();
        return new Promise(resolve => {
            D.cutscene.classList.remove('hidden');
            D.cutsceneScene.innerHTML = cs.scenes[0].svg;
            D.cutsceneText.textContent = cs.scenes[0].text;
            D.cutsceneProgress.style.width = '0%';

            const startTime = Date.now();
            let sceneIdx = 0;
            let resolved = false;
            let sceneTimer;

            const finish = () => {
                if (resolved) return;
                resolved = true;
                clearInterval(progressInterval);
                clearTimeout(sceneTimer);
                D.cutscene.classList.add('hidden');
                resolve();
            };

            D.cutsceneSkip.onclick = finish;
            D.cutsceneSkip.ontouchstart = (e) => { e.preventDefault(); finish(); };

            const progressInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                D.cutsceneProgress.style.width = Math.min(100, (elapsed / cs.duration) * 100) + '%';
            }, 100);

            const tick = () => {
                if (resolved) return;
                const elapsed = Date.now() - startTime;
                if (elapsed >= cs.duration) { finish(); return; }
                let newIdx = 0;
                for (let i = 0; i < cs.scenes.length; i++) {
                    if (elapsed >= cs.scenes[i].time) newIdx = i;
                }
                if (newIdx !== sceneIdx) {
                    sceneIdx = newIdx;
                    D.cutsceneScene.innerHTML = cs.scenes[sceneIdx].svg;
                    D.cutsceneText.textContent = cs.scenes[sceneIdx].text;
                }
                sceneTimer = setTimeout(tick, 100);
            };
            sceneTimer = setTimeout(tick, 100);
        });
    }

    // ==================== START ====================
    async function startGame(continueMode = false, coopJoin = null) {
        if (state.gameStarted) return;
        state.gameStarted = true;
        console.log('[QIP] startGame', { continueMode, coopJoin });

        if (!continueMode) {
            state.save = { ...DEFAULT_SAVE,
                deaths: state.save.deaths, survived: state.save.survived, best: state.save.best };
            state.act = 1; state.sceneIndex = 0;
            state.correctAnswers = 0; state.totalQuestions = 0;
            state.gameTime = 0; state.sanity = 100;
            state.inventory = new Set();
            state.dialoguePlayed = {};
        } else {
            state.act = state.save.act || 1;
            state.sceneIndex = state.save.scene || 0;
            state.correctAnswers = state.save.correctAnswers || 0;
            state.totalQuestions = state.save.totalQuestions || 0;
            state.gameTime = state.save.gameTime || 0;
            state.sanity = state.save.sanity ?? 100;
            state.inventory = new Set(state.save.inventory || []);
            state.currentRoom = state.save.room || 'desk';
            state.dialoguePlayed = state.save.dialoguePlayed || {};
        }

        initAudio();
        resumeAudio();
        await requestMic();

        D.intro.classList.add('fade-out');
        await wait(900);
        D.intro.classList.add('hidden');
        D.desktop.classList.remove('hidden');
        D.hud.classList.remove('hidden');

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

    // ==================== SVG АВАТАРЫ ====================
    function svgAvatar(type) {
        const svgs = {
            admin: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#9ab"/><circle cx="20" cy="15" r="7" fill="#567"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#567"/></svg>`,
            masha: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#f9c"/><circle cx="20" cy="15" r="7" fill="#c69"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#c69"/><circle cx="16" cy="14" r="1" fill="#000"/><circle cx="24" cy="14" r="1" fill="#000"/></svg>`,
            pavel: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#9cf"/><circle cx="20" cy="15" r="7" fill="#369"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#369"/></svg>`,
            unknown: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#200"/><text x="20" y="28" font-family="monospace" font-size="22" fill="#f22" text-anchor="middle" font-weight="bold">?</text></svg>`,
            olga: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#cba"/><circle cx="20" cy="15" r="7" fill="#865"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#865"/></svg>`,
            kate: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#fda"/><circle cx="20" cy="15" r="7" fill="#a75"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#a75"/></svg>`,
            max: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#aab"/><circle cx="20" cy="15" r="7" fill="#446"/><ellipse cx="20" cy="32" rx="12" ry="10" fill="#446"/></svg>`
        };
        return svgs[type] || svgs.admin;
    }

    // ==================== CONTACTS ====================
    const CONTACTS = {
        admin: { name: 'Администратор', svg: 'admin', status: 'в сети', locked: false },
        masha: { name: 'Маша', svg: 'masha', status: 'в сети', locked: false },
        pavel: { name: 'Павел', svg: 'pavel', status: 'в сети', locked: false },
        olga: { name: 'Ольга', svg: 'olga', status: 'не в сети', locked: true },
        unknown: { name: '???', svg: 'unknown', status: 'не в сети', locked: true },
        kate: { name: 'Катя', svg: 'kate', status: 'в сети', locked: true },
        max: { name: 'Максим', svg: 'max', status: 'в сети', locked: true }
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
                <div class="avatar">${svgAvatar(c.svg)}</div>
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

    // ==================== ФИКС: openChat без дублирования ====================
    function openChat(user, el) {
        // Если кликнули на тот же контакт — ничего не делаем
        if (state.currentUser === user) {
            console.log('[QIP] Уже в чате с', user);
            return;
        }

        // Отменяем ВСЕ таймеры старого диалога
        cancelAllDialogueTimers();

        state.currentUser = user;
        $$('.contact').forEach(x => x.classList.remove('active'));
        if (el) el.classList.add('active');
        D.chatHeader.textContent = `Чат с ${CONTACTS[user].name}`;
        D.messages.innerHTML = '';

        // Заблокировать ввод, если это закрытый контакт
        const isLocked = CONTACTS[user] && CONTACTS[user].locked;
        D.messageInput.disabled = isLocked;
        D.sendBtn.disabled = isLocked;
        D.messageInput.placeholder = isLocked ? 'Контакт недоступен...' : 'Введите сообщение...';

        setTimeout(() => { try { if (!isLocked) D.messageInput.focus(); } catch (e) {} }, 100);

        // Загружаем историю, ЕСЛИ ЕСТЬ
        if (state.dialogues[user] && state.dialogues[user].length > 0) {
            state.dialogues[user].forEach(m => addMessage(m.text, m.type, false, false, true));
            console.log('[QIP] История для', user, 'загружена:', state.dialogues[user].length, 'сообщений');
        } else {
            // Первый раз — создаём пустую историю
            state.dialogues[user] = [];
            console.log('[QIP] Первый вход в чат с', user);

            // Проиграть диалог ТОЛЬКО ОДИН РАЗ
            if (!state.dialoguePlayed[user]) {
                state.dialoguePlayed[user] = true;
                state.save.dialoguePlayed = state.dialoguePlayed;
                saveGame();
                // Небольшая задержка, чтобы анимация открытия окна завершилась
                safeTimeout(() => {
                    if (state.currentUser === user) {
                        playDialogue(user);
                    }
                }, 300);
            }
        }
    }

    // ==================== DIALOGUES (для контактов) ====================
    const DIALOGUES = {
        admin: [
            { delay: 800,  text: 'Привет. Ты новый тут? Не заходи в чат с ником "???".', type: 'them' },
            { delay: 2800, text: 'Серьёзно. Если увидишь его в сети — сразу закрывай QIP.', type: 'them' },
            { delay: 5200, text: 'Он уже забрал 3 моих контакта. Маша следующая.', type: 'them' },
            { delay: 7800, text: 'Я чувствую, как он смотрит через экран...', type: 'them' },
            { delay: 10500, text: 'Посмотри в "Мои фото". Там есть IMG_2013.jpg.', type: 'them' },
            { delay: 13000, text: 'И прочитай notes.txt. Это важно.', type: 'them' }
        ],
        masha: [
            { delay: 900,  text: 'приветик :) ты видел странные сообщения от ???', type: 'them' },
            { delay: 3000, text: 'я зашла в его чат... и теперь у меня в комнате кто-то ходит', type: 'them' },
            { delay: 5400, text: 'пожалуйста помоги мне', type: 'them' },
            { delay: 7800, text: 'он за дверью', type: 'creepy' },
            { delay: 10200, text: 'он смотрит на меня через экран', type: 'creepy' }
        ],
        pavel: [
            { delay: 1000, text: 'Слушай, админ пропал.', type: 'them' },
            { delay: 3000, text: 'Вчера писал мне ночью. Говорил "он среди нас".', type: 'them' },
            { delay: 5500, text: 'Потом QIP сам закрылся. И статус админа стал "не в сети".', type: 'them' },
            { delay: 8500, text: 'Ты можешь открыть его notes.txt?', type: 'them' }
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
        if (!script) {
            console.log('[QIP] Нет скрипта для', user);
            return;
        }
        console.log('[QIP] Проигрываем диалог для', user);

        script.forEach(line => {
            safeTimeout(() => {
                // Проверяем, что всё ещё в этом чате
                if (state.currentUser !== user) {
                    console.log('[QIP] Пропущено (не в чате):', line.text);
                    return;
                }
                addMessage(line.text, line.type);
                if (line.type === 'creepy') {
                    triggerGlitch();
                    whisperSound();
                }
            }, line.delay);
        });
    }

    // ==================== ФИКС: addMessage с защитой от дублей ====================
    function addMessage(text, type = 'them', animate = true, sound = true, fromHistory = false) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        if (!animate) div.style.animation = 'none';
        div.textContent = text;
        D.messages.appendChild(div);
        D.messages.scrollTop = D.messages.scrollHeight;
        if (sound && type !== 'system') messageSound();

        // Записываем в историю ТОЛЬКО новые сообщения (не при восстановлении)
        if (!fromHistory && state.currentUser) {
            if (!state.dialogues[state.currentUser]) state.dialogues[state.currentUser] = [];
            const hist = state.dialogues[state.currentUser];
            const last = hist[hist.length - 1];
            // Проверка на дубликат — только добавляем, если последнее отличается
            if (!last || last.text !== text || last.type !== type) {
                hist.push({ text, type });
            }
        }

        // Кооп
        if (state.coopMode && state.coopChannel && !fromHistory) {
            try {
                state.coopChannel.postMessage({ type: 'message', text, msgType: type, sender: 'other' });
            } catch (e) {}
        }
        return div;
    }

    // ==================== ФИКС: sendMessage без спама ====================
    function sendMessage() {
        const text = D.messageInput.value.trim();
        if (!text || !state.currentUser) return;

        const user = state.currentUser;
        if (CONTACTS[user] && CONTACTS[user].locked) {
            showNotification('❌ Контакт недоступен');
            return;
        }

        addMessage(text, 'me');
        D.messageInput.value = '';

        safeTimeout(() => {
            if (state.currentUser !== user) return;
            const typing = document.createElement('div');
            typing.className = 'message typing';
            typing.textContent = 'печатает...';
            D.messages.appendChild(typing);
            D.messages.scrollTop = D.messages.scrollHeight;

            safeTimeout(() => {
                if (typing.parentNode) typing.remove();
                if (state.currentUser !== user) return;
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

    // ==================== ФИКС: playScript с отменой таймеров ====================
    async function playScript(script) {
        // Отменяем все старые таймеры перед запуском нового скрипта
        cancelAllDialogueTimers();

        const t0 = Date.now();
        const promises = script.map(async line => {
            const waitTime = line.delay - (Date.now() - t0);
            if (waitTime > 0) {
                await new Promise(resolve => {
                    const id = setTimeout(resolve, waitTime);
                    registerTimer(id);
                });
            }
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
        setObjective('осмотреться');
        state.save.knownContacts = ['admin', 'masha', 'pavel'];
        renderContacts();
        const script = [
            { delay: 1000, switchTo: 'admin', text: 'Привет. Ты новый тут? Не заходи в чат с ником "???".', type: 'them' },
            { delay: 4000, text: 'Серьёзно. Если увидишь его в сети — сразу закрывай QIP.', type: 'them' },
            { delay: 7000, text: 'Он уже забрал 3 контакта. Маша следующая.', type: 'them' },
            { delay: 11000, text: 'Посмотри в "Мои фото". Там есть IMG_2013.jpg.', type: 'them' },
            { delay: 15000, text: 'И прочитай notes.txt.', type: 'them', setObjective: 'прочитать notes.txt' },
            { delay: 20000, switchTo: 'masha', text: 'приветик :) ты видел странные сообщения от ???', type: 'them' },
            { delay: 24000, text: 'я зашла в его чат... и теперь у меня в комнате кто-то ходит', type: 'them' },
            { delay: 28000, text: 'пожалуйста помоги мне', type: 'them' },
            { delay: 33000, switchTo: 'pavel', text: 'Слушай, админ пропал.', type: 'them' },
            { delay: 37000, text: 'Вчера писал мне ночью. Говорил "он среди нас".', type: 'them' },
            { delay: 41000, text: 'Потом QIP сам закрылся.', type: 'them', unlockContact: 'olga' },
            { delay: 46000, switchTo: 'admin', text: 'Ты читал notes.txt?', type: 'them', setObjective: 'прочитать notes.txt и найти IMG_2013.jpg' },
            { delay: 52000, text: 'Тестирование начнётся само.', type: 'them' },
            { delay: 58000, text: 'Ну что, готов?', type: 'them', action: async () => {
                showNotification('⏭ АКТ I завершён');
                await wait(2000);
                await playCutscene('act2');
                runAct2();
            }}
        ];
        await playScript(script);
    }

    const QUIZ_ACTS = {
        2: [
            { question: 'Администратор: «Незнакомец предлагает открыть файл — что делаешь?»',
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
            { question: 'Маша: «Я вижу тебя через веб-камеру.»',
              options: [
                  { key: '1', text: 'Привет, я тут', correct: false },
                  { key: '2', text: 'Закрой камеру немедленно', correct: true }
              ],
              wrongReply: 'Теперь я знаю твоё лицо.',
              correctReply: 'Слишком поздно для меня, но не для тебя.',
              wrongSanity: -25, correctSanity: -8,
              onWrong: () => { recordVoice(1000); } },
            { question: 'Павел: «Он предлагает мне удалить аккаунт.»',
              options: [
                  { key: '1', text: 'Удаляй, это выход', correct: false },
                  { key: '2', text: 'Не удаляй, он этого и хочет', correct: true }
              ],
              wrongReply: 'Павел удалился. Я займу его место.',
              correctReply: 'Павел исчез со связи.',
              wrongSanity: -18, correctSanity: -5 },
            { question: '??? : «Хочешь прочитать настоящий notes.txt?»',
              options: [
                  { key: '1', text: 'Да, покажи', correct: false },
                  { key: '2', text: 'Мне хватило первого', correct: true }
              ],
              wrongReply: 'Вот он. Теперь ты знаешь слишком много.',
              correctReply: 'Умно.',
              wrongSanity: -22, correctSanity: 0,
              onWrong: () => { addToInventory('📄 Настоящий notes.txt'); } }
        ],
        4: [
            { question: 'Админ (с помехами): «Я вижу тебя. Ты не один в комнате.»',
              options: [
                  { key: '1', text: 'Обернуться', correct: false },
                  { key: '2', text: 'Не двигаться', correct: true }
              ],
              wrongReply: 'Ты обернулся. Он был там.',
              correctReply: 'Хорошо.',
              wrongSanity: -30, correctSanity: -5,
              onWrong: () => { jumpscareQuick(); } },
            { question: 'Ольга: «Хочешь остановить его?»',
              options: [
                  { key: '1', text: 'Да, скажи как', correct: false },
                  { key: '2', text: 'Нет, это не моё дело', correct: true }
              ],
              wrongReply: 'Теперь ты в списке.',
              correctReply: 'Ты не в списке. Пока что.',
              wrongSanity: -20, correctSanity: 0, unlockContact: 'max' },
            { question: '??? : «QIP больше не существует с 2013 года. Ты знал?»',
              options: [
                  { key: '1', text: 'Как я в нём?', correct: false },
                  { key: '2', text: 'Это не важно', correct: true }
              ],
              wrongReply: 'Ты в ловушке. Всегда был.',
              correctReply: 'Хорошо.',
              wrongSanity: -25, correctSanity: -5,
              onWrong: () => { flashScreen('red'); triggerGlitch(2); } },
            { question: 'Максим: «Админ мёртв. Пойми это.»',
              options: [
                  { key: '1', text: 'Не верю тебе', correct: false },
                  { key: '2', text: 'Теперь понимаю', correct: true }
              ],
              wrongReply: 'Он покажет тебе.',
              correctReply: 'Хорошо. Ты готов.',
              wrongSanity: -28, correctSanity: -10,
              onWrong: () => { scareSound(); } }
        ],
        5: [
            { question: 'ФИНАЛЬНЫЙ ВОПРОС. ??? : «Ты — мой?»',
              options: [
                  { key: '1', text: 'Да, я твой', correct: false },
                  { key: '2', text: 'Нет. Я свободен.', correct: true }
              ],
              wrongReply: 'Ты мой. Всегда был.',
              correctReply: 'НЕТ! ТЫ НЕ МОЖЕШЬ!',
              wrongSanity: -50, correctSanity: 20,
              onWrong: () => { setTimeout(jumpscareEffect, 2000); },
              onCorrect: () => { setTimeout(bestEnding, 3000); } }
        ]
    };

    async function runAct2() {
        setAct(2);
        setObjective('пройти тест');
        showNotification('⚡ АКТ II');
        await wait(2000);
        await runQuizSequence(QUIZ_ACTS[2]);
        showAchievement('Прошёл Акт II');
        await wait(2000);
        await playCutscene('act3');
        runAct3();
    }

    async function runAct3() {
        setAct(3);
        setObjective('разобраться');
        showNotification('💀 АКТ III');
        unlockContact('olga');
        const script = [
            { delay: 2000, switchTo: 'admin', text: 'Слушай... я не уверен, что это я.', type: 'creepy' },
            { delay: 6000, text: 'Вчера я проснулся в 3:33.', type: 'creepy' },
            { delay: 11000, text: 'Проверь IMG_2013.jpg.', type: 'them' },
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
            { delay: 32000, switchTo: 'admin', text: 'Маша пропала.', type: 'them' },
            { delay: 37000, text: 'Слушай, я должен показать кое-что.', type: 'them' },
            { delay: 42000, text: 'В QIP есть скрытая папка.', type: 'them', setObjective: 'изучить файлы' },
            { delay: 48000, text: 'Открой последнюю фотку.', type: 'them' },
            { delay: 53000, text: 'Осторожно.', type: 'creepy', action: () => {
                setTimeout(() => { if (state.act < 4) openImage('5'); }, 30000);
            }},
            { delay: 60000, text: 'Готов к правде?', type: 'them', action: async () => {
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
        setObjective('выжить');
        showNotification('👁️ АКТ IV');
        unlockContact('max');
        const script = [
            { delay: 2000, switchTo: 'admin', text: 'Я... не помню, что было 3 часа.', type: 'creepy' },
            { delay: 6000, text: 'Мой статус меняется.', type: 'creepy' },
            { delay: 12000, switchTo: 'max', text: 'Привет.', type: 'them' },
            { delay: 16000, text: 'Я вижу его QIP онлайн.', type: 'them' },
            { delay: 20000, text: 'Я был у него. Он сидит перед монитором.', type: 'them' },
            { delay: 24000, text: 'На его экране открыт чат с ТОБОЙ.', type: 'creepy' },
            { delay: 30000, switchTo: 'olga', text: 'Я знаю, кто такой ???', type: 'them' },
            { delay: 34000, text: 'Это души тех, кто не вышел из QIP в 2013.', type: 'them' },
            { delay: 38000, text: 'Они ищут компанию.', type: 'them' },
            { delay: 42000, text: 'Ты можешь выйти. Пройди тест.', type: 'them', addInventory: '🗝️ Ключ от QIP' },
            { delay: 46000, text: 'Ответь правильно на ВСЁ.', type: 'them' },
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
            { delay: 58000, text: 'Хорошо.', type: 'creepy' },
            { delay: 60000, text: 'Маленькая игра.', type: 'creepy', action: () => {
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
        setObjective('финальный тест');
        showNotification('🔥 АКТ V');
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
                if (u && state.currentUser !== 'unknown') {
                    // Открываем чат с ??? через открытый метод
                    const isActive = u.classList.contains('active');
                    if (!isActive) u.click();
                }
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
            addMessage('??? : ты не прошёл.', 'creepy');
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

            const finalize = (v) => {
                if (resolved) return;
                resolved = true;
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
                'Твой рассудок не выдержал.' :
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
        D.endingText.textContent = `Ты ответил правильно на ${state.correctAnswers} из ${state.totalQuestions}.`;
        D.endingStats.innerHTML = `
            🟢 Спасений: ${state.save.survived} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время: ${formatTime(state.gameTime)}<br>
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
        D.endingText.innerHTML = `Ты ответил правильно на ВСЕ ${state.totalQuestions} вопросов!<br><br>Контакт "???" удалён навсегда.`;
        D.endingStats.innerHTML = `
            🏆 Побед: ${state.save.best} · 💀 Смертей: ${state.save.deaths}<br>
            ⏱ Время: ${formatTime(state.gameTime)}<br>
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
        desk: 'Ты в комнате перед компьютером.',
        kitchen: 'Кухня. Холодильник гудит.',
        hallway: 'Коридор. Свет выключен.',
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
        updateLocation(room);
        D.roomView.classList.remove('hidden');
        const icons = { kitchen: '🍳', hallway: '🚪', bathroom: '🚿', basement: '🕳️' };
        D.roomContent.innerHTML = `
            <div>${icons[room] || '❓'}</div>
            <div class="room-desc">${ROOM_DESCRIPTIONS[room] || ''}</div>
        `;
        if (room === 'bathroom') { whisperSound(); updateSanity(-3); }
        if (room === 'basement') { scareSound(); triggerGlitch(2); updateSanity(-10); }
    }

    D.roomExit.addEventListener('click', () => {
        D.roomView.classList.add('hidden');
        updateLocation('desk');
    });

    // ==================== DESKTOP ICONS ====================
    const DESKTOP_ICONS = [
        { id: 'icon-qip', img: '💬', label: 'QIP 2012', room: 'desk', action: () => openApp('qip-window') },
        { id: 'icon-gallery', img: '📷', label: 'Мои фото', room: 'desk', action: () => openApp('gallery-window') },
        { id: 'icon-notes', img: '📝', label: 'Блокнот', room: 'desk', action: () => openApp('notes-window') },
        { id: 'icon-browser', img: '🌐', label: 'Internet', room: 'desk', action: () => openApp('browser-window') },
        { id: 'icon-encyclopedia', img: '📖', label: 'Справочник', room: 'desk', action: () => openApp('encyclopedia-window') },
        { id: 'icon-mine', img: '💣', label: 'Сапёр', room: 'desk', action: () => showNotification('💣 Все мины уже взорвались.') },
        { id: 'icon-recycle', img: '🗑️', label: 'Корзина', room: 'desk', action: () => {
            if (state.save.best > 0) showNotification('🗑️ Ты победил.');
            else { showNotification('🗑️ В корзине 4 удалённых контакта...'); setTimeout(() => triggerGlitch(), 800); }
        }},
        { id: 'icon-fridge', img: '🧊', label: 'Холодильник', room: 'kitchen', action: () => {
            showNotification('🧊 Внутри записка: "он видит тебя"');
            addToInventory('📝 Записка');
            updateSanity(-5);
        }},
        { id: 'icon-mirror', img: '🪞', label: 'Зеркало', room: 'bathroom', action: () => {
            showNotification('🪞 Зеркало треснуло само.');
            triggerGlitch(2); scareSound(); updateSanity(-8);
        }},
        { id: 'icon-door', img: '🚪', label: 'Выход', room: 'hallway', action: () => {
            if (state.act >= 4) {
                showNotification('🚪 Дверь заперта.');
                scareSound(); updateSanity(-5);
            } else {
                showNotification('🚪 Ты вышел в коридор.');
                showRoom('hallway');
            }
        }}
    ];

    function renderDesktopIcons() {
        D.desktopIcons.innerHTML = '';
        DESKTOP_ICONS.forEach(icon => {
            const visible = icon.room === 'desk' || icon.room === state.currentRoom;
            if (!visible) return;
            const div = document.createElement('div');
            div.className = 'desktop-icon visible';
            div.id = icon.id;
            div.dataset.room = icon.room;
            div.innerHTML = `<div class="icon-img">${icon.img}</div><div class="icon-label">${icon.label}</div>`;
            div.addEventListener('click', () => { resumeAudio(); icon.action(); });
            D.desktopIcons.appendChild(div);
        });
    }

    // ==================== GALLERY ====================
    const IMAGES = {
        '1': { title: 'Закат.jpg', content: '🌆', haunted: false },
        '2': { title: 'Отпуск.jpg', content: '🏞️', haunted: false },
        '3': { title: 'Пёс.jpg', content: '🐕', haunted: false },
        '4': { title: 'ДР.jpg', content: '🎂', haunted: false },
        '5': { title: 'IMG_2013.jpg', content: '👁️', haunted: true,
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
            }},
        '6': { title: '.jpg', content: '👁️', haunted: true,
            onOpen: () => {
                showAchievement('Не смотри');
                updateSanity(-20);
                setTimeout(() => jumpscareQuick(), 1500);
            }}
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

    // ==================== NOTES / BROWSER / ENCYCLOPEDIA ====================
    const NOTES_CONTENT = `Если ты это читаешь — БЕГИ.

Контакт "???" появился у меня после открытия .jpg из общей папки.

Он присылает сообщения ночью. Он знает, где я живу.

Не заходи в "Мои фото". Не открывай IMG_2013.jpg.

P.S. В финале — не отвечай "да". Никогда.`;

    D.notesText.value = NOTES_CONTENT;

    D.browserContent.innerHTML = `
        <h1>QIP 2012 — Скачать</h1>
        <p>Последняя версия QIP 2012.</p>
        <p><b>Внимание:</b> с 2013 серверы не поддерживаются.</p>
        <p class="glitch-text">Он всё ещё работает. Внутри.</p>
    `;

    const ENCYCLOPEDIA = [
        { id: 'qip', title: 'QIP 2012', text: 'Мессенджер 2008-2013.' },
        { id: 'admin', title: 'Администратор', text: 'Первый, кто столкнулся с "???".' },
        { id: 'unknown', title: '???', text: 'Совокупность душ пользователей.' },
        { id: 'img2013', title: 'IMG_2013.jpg', text: 'Проклятый файл.' },
        { id: 'rules', title: 'Правила выживания', text: 'Не открывай. Не отвечай "да".' }
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
                    D.hudCoop.classList.remove('hidden');
                    D.coopList.innerHTML = `<div class="coop-player">Ты</div><div class="coop-player">${data.sender}</div>`;
                }
            };
            state.coopChannel.postMessage({ type: 'hello', sender: asCreator ? 'Создатель' : 'Игрок 2' });
        } catch (e) {
            showNotification('❌ Кооп не поддерживается');
        }
    }

    // ==================== LEADERBOARD ====================
    const LB_KEY = 'qip2012_leaderboard';
    const DEFAULT_LB = [
        { name: 'QIP_Master', time: 7200, correct: 12, total: 12, deaths: 0 },
        { name: 'Anon', time: 5400, correct: 10, total: 12, deaths: 2 },
        { name: 'Fearless', time: 3600, correct: 9, total: 12, deaths: 1 }
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
        list.push({ name, time, correct, total, deaths });
        list.sort((a, b) => {
            if (b.correct !== a.correct) return b.correct - a.correct;
            return a.time - b.time;
        });
        saveLeaderboard(list.slice(0, 20));
    }

    function renderLeaderboard() {
        const list = loadLeaderboard();
        D.leaderboardBody.innerHTML = '';
        const meName = state.save.playerName;
        list.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = 'lb-entry' + (entry.name === meName ? ' you' : '');
            const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            div.innerHTML = `
                <div class="rank ${rankCls}">#${i + 1}</div>
                <div class="name">${entry.name}</div>
                <div class="score">${entry.correct}/${entry.total} · ${formatTime(entry.time)} · 💀${entry.deaths}</div>
            `;
            D.leaderboardBody.appendChild(div);
        });
    }

    // ==================== КНОПКИ ====================
    function bindButton(btn, handler) {
        if (!btn) return;
        let touched = false;
        btn.addEventListener('touchend', e => {
            e.preventDefault();
            touched = true;
            handler(e);
            setTimeout(() => { touched = false; }, 500);
        }, { passive: false });
        btn.addEventListener('click', e => {
            if (touched) return;
            handler(e);
        });
    }

    bindButton(D.startBtn, (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[QIP] Клик по "НОВАЯ ИГРА"');
        if (!state.gameStarted) startGame(false);
    });

    bindButton(D.continueBtn, (e) => {
        e.preventDefault();
        if (!state.gameStarted) startGame(true);
    });

    bindButton(D.micBtn, async (e) => {
        e.preventDefault();
        await requestMic();
    });

    bindButton(D.leaderboardBtn, (e) => {
        e.preventDefault();
        renderLeaderboard();
        openApp('leaderboard-window');
    });

    bindButton(D.coopBtn, (e) => {
        e.preventDefault();
        D.coopCode.textContent = generateCoopCode();
        D.coopModal.classList.remove('hidden');
    });

    bindButton(D.coopCopy, () => {
        const code = D.coopCode.textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                D.coopCopy.textContent = '✅ Скопировано!';
                setTimeout(() => { D.coopCopy.textContent = '📋 Скопировать'; }, 2000);
            }).catch(() => {});
        }
    });

    bindButton(D.coopJoin, () => {
        const code = D.coopInput.value.trim().toUpperCase();
        if (code.length < 4) { showNotification('❌ Введи код'); return; }
        D.coopModal.classList.add('hidden');
        startGame(false, code);
    });

    bindButton(D.coopClose, () => D.coopModal.classList.add('hidden'));

    bindButton(D.leaderboardAfterBtn, () => {
        renderLeaderboard();
        D.ending.classList.add('hidden');
        openApp('leaderboard-window');
    });

    bindButton(D.saveScoreBtn, () => {
        const name = D.playerName.value.trim() || 'Аноним';
        state.save.playerName = name;
        saveGame();
        addToLeaderboard(name, state.gameTime, state.correctAnswers, state.totalQuestions, state.save.deaths);
        showNotification('🏆 Результат сохранён!');
        D.saveScoreBtn.disabled = true;
        D.saveScoreBtn.textContent = '✅ СОХРАНЕНО';
    });

    bindButton(D.restartBtn, () => { clearSave(); location.reload(); });
    bindButton(D.roomExit, () => {
        D.roomView.classList.add('hidden');
        updateLocation('desk');
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
                D.endingText.textContent = 'Ты закрыл QIP вовремя.';
                D.endingStats.innerHTML = `🟢 Спасений: ${state.save.survived}<br>⏱ Время: ${formatTime(state.gameTime)}`;
            } else {
                showNotification('❌ Выйти невозможно.');
                triggerGlitch();
                errorSound();
                updateSanity(-3);
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        if (state.gameStarted && !state.paused) saveGame();
    });

    // ==================== PWA ====================
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        D.installBtn.classList.remove('hidden');
    });

    bindButton(D.installBtn, async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
            D.installBtn.classList.add('hidden');
        }
        deferredPrompt = null;
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // ==================== INIT ====================
    function init() {
        renderContacts();
        renderGallery();
        renderEncyclopedia();
        renderDesktopIcons();
        runBoot();
        console.log('[QIP] Инициализация завершена');
    }

    init();

    document.addEventListener('click', () => {
        initAudio();
        resumeAudio();
    }, { once: true });

}); // конец DOMContentLoaded