/* ============================================================
   MAIN SCRIPT
   ============================================================ */

const state = {
    webcamStream: null,
    messageIndex: 0,
    startTime: 0,
    gameDuration: 60,
    remaining: 60,
    timerInterval: null,
    ended: false,

    faceDetectedCount: 0,
    faceLostCount: 0,
    threat: 0,
    emotions: {},
    factsShown: [],
    noCamera: false,

    chatMessagesSent: 0,
    chatCompleted: false,
    chatEndings: {},
};

const screens = {
    returning: document.getElementById('screen-returning'),
    intro: document.getElementById('screen-intro'),
    permission: document.getElementById('screen-permission'),
    game: document.getElementById('screen-game'),
    chat: document.getElementById('screen-chat'),
    end: document.getElementById('screen-end'),
};

const btnReturnStart = document.getElementById('btn-return-start');
const btnStart = document.getElementById('btn-start');
const btnAllow = document.getElementById('btn-allow');
const btnDeny = document.getElementById('btn-deny');
const btnRestart = document.getElementById('btn-restart');
const btnForget = document.getElementById('btn-forget');

const webcam = document.getElementById('webcam');
const webcamBg = document.getElementById('webcam-bg');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');
const timerFill = document.getElementById('timer-fill');
const faceCanvas = document.getElementById('face-canvas');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const factPopup = document.getElementById('fact-popup');
const returnInfo = document.getElementById('return-info');
const endTitle = document.getElementById('end-title');
const endSubtitle = document.getElementById('end-subtitle');
const endStats = document.getElementById('end-stats');
const endVideoWrap = document.getElementById('end-video-wrap');
const endVideo = document.getElementById('end-video');
const glCanvas = document.getElementById('gl-canvas');
const tabWarning = document.getElementById('tab-warning');

const hudObject = document.getElementById('hud-object');
const hudEmotion = document.getElementById('hud-emotion');
const hudSignal = document.getElementById('hud-signal');
const hudThreat = document.getElementById('hud-threat');
const hudWatchers = document.getElementById('hud-watchers');
const hudIp = document.getElementById('hud-ip');
const hudTime = document.getElementById('hud-time');
const hudBrowser = document.getElementById('hud-browser');

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

const emotionsRu = {
    happy: 'улыбаешься', sad: 'грустишь', angry: 'злишься',
    fearful: 'боишься', disgusted: 'испытываешь отвращение',
    surprised: 'удивлён', neutral: 'ничего не выражаешь',
};

function buildMessages() {
    const fp = fingerprint.data;
    return [
        { text: 'Я вижу тебя...', delay: 2000 },
        { text: `Ты в ${fp.timezone.split('/').pop()?.replace(/_/g, ' ')}`, delay: 2200 },
        { text: `Твой браузер: ${fp.browser}`, delay: 1800 },
        { text: 'Почему ты не улыбаешься?', delay: 2400, requireEmotion: 'not_happy' },
        { text: 'Я знаю, где ты живёшь.', delay: 2200 },
        { text: 'Не оглядывайся.', delay: 2000, stinger: true },
        { text: 'За твоей спиной что-то есть.', delay: 2400 },
        { text: 'Твоё лицо... такое знакомое.', delay: 2200, requireFace: true },
        { text: 'Я запомнил каждую чёрточку.', delay: 2000, requireFace: true },
        { text: 'Оно уже здесь.', delay: 1800, stinger: true },
        { text: 'Прощай.', delay: 2400 },
    ];
}

function typeMessage(text, callback, speed = 55) {
    messageEl.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
        messageEl.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (callback) setTimeout(callback, 2200);
        }
    }, speed);
}

function randomGlitch(intensity = 1) {
    document.body.classList.add('glitching');
    setTimeout(() => document.body.classList.remove('glitching'), 180 * intensity);
    glitchShader.setIntensity(intensity * 0.7);
    if (Math.random() > 0.7) {
        const flash = document.createElement('div');
        flash.style.cssText = `position:fixed;inset:0;background:#ff0000;opacity:${0.15 + intensity * 0.15};z-index:100;pointer-events:none;`;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 80);
    }
}

function showFact(text, duration = 2500) {
    factPopup.textContent = text;
    factPopup.classList.add('show');
    setTimeout(() => factPopup.classList.remove('show'), duration);
}

function updateHUD() {
    hudThreat.textContent = `${Math.floor(state.threat)}%`;
    const filled = Math.max(1, 5 - Math.floor(state.threat / 25));
    hudSignal.textContent = '●'.repeat(filled) + '○'.repeat(5 - filled);
    hudObject.textContent = faceTracker.faceDetected ? 'ЗАХВАЧЕН' : (state.noCamera ? '—' : 'ПОТЕРЯН');
    if (faceTracker.lastEmotion) {
        hudEmotion.textContent = emotionsRu[faceTracker.lastEmotion]?.toUpperCase() || '—';
    }
    const watchers = Math.floor(state.threat / 10) + state.faceDetectedCount;
    hudWatchers.textContent = watchers;
}

function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.remaining--;
        const pct = Math.max(0, (state.remaining / state.gameDuration) * 100);
        timerFill.style.width = pct + '%';

        const timeThreat = Math.floor((1 - state.remaining / state.gameDuration) * 60);
        const faceThreat = state.faceDetectedCount * 3;
        const lostThreat = state.faceLostCount * 8;
        state.threat = Math.min(100, timeThreat + faceThreat + lostThreat);

        if (state.remaining < 30) horrorAudio.setHeartbeatRate(700);
        if (state.remaining < 15) horrorAudio.setHeartbeatRate(500);
        if (state.remaining < 5) horrorAudio.setHeartbeatRate(350);

        memory.updateThreat(state.threat);
        updateHUD();

        if (state.remaining <= 0) startChatPhase();
    }, 1000);
}

function startClock() {
    const tick = () => { hudTime.textContent = new Date().toLocaleTimeString('ru-RU'); };
    tick();
    setInterval(tick, 1000);
}

function runHorrorSequence() {
    const messages = buildMessages();

    const showNext = () => {
        if (state.ended) return;
        if (state.messageIndex >= messages.length) {
            startChatPhase();
            return;
        }
        const msg = messages[state.messageIndex];
        state.messageIndex++;

        if (msg.requireFace && !faceTracker.faceDetected) {
            statusEl.textContent = '> ПОКАЖИ ЛИЦО';
            setTimeout(showNext, 1500);
            return;
        }
        if (msg.requireEmotion === 'not_happy' && faceTracker.lastEmotion === 'happy') {
            showNext();
            return;
        }

        if (msg.stinger) {
            horrorAudio.playStinger();
            randomGlitch(2);
        } else {
            randomGlitch(1);
        }

        typeMessage(msg.text, () => {
            if (Math.random() > 0.6) {
                const fact = fingerprint.getRandomFact();
                if (!state.factsShown.includes(fact)) {
                    state.factsShown.push(fact);
                    showFact(fact);
                }
            }
            showNext();
        });
    };

    setTimeout(showNext, 1500);
}

function startChatPhase() {
    if (state.ended) return;
    clearInterval(state.timerInterval);
    faceTracker.stop();
    horrorAudio.stopHeartbeat();

    showScreen('chat');
    videoChat.start(state.webcamStream);

    videoChat.onComplete = () => {
        Object.assign(state, videoChat.getState());
        setTimeout(() => endGame(), 800);
    };
}

async function startGame(withCamera) {
    state.messageIndex = 0;
    state.startTime = Date.now();
    state.remaining = state.gameDuration;
    state.ended = false;
    state.faceDetectedCount = 0;
    state.faceLostCount = 0;
    state.threat = 0;
    state.noCamera = !withCamera;

    horrorAudio.init();
    horrorAudio.resume();
    horrorAudio.startWhisper();
    horrorAudio.startHeartbeat();
    horrorAudio.startDrone();

    hudIp.textContent = 'IP: локально';
    hudBrowser.textContent = `${fingerprint.data.browser} · ${fingerprint.data.os}`;
    startClock();
    updateHUD();

    glitchShader.init(glCanvas);
    glitchShader.resize();
    window.addEventListener('resize', () => glitchShader.resize());

    showScreen('game');

    if (withCamera) {
        faceTracker.attach(webcamBg, faceCanvas);
        if (faceTracker.modelsLoaded) faceTracker.start();

        if (state.webcamStream) {
            videoRecorder.start(state.webcamStream, 3000);
        }

        faceTracker.onFaceLost = () => {
            state.faceLostCount++;
            memory.addFaceLost();
            statusEl.textContent = '> ПОТЕРЯ СИГНАЛА...';
            horrorAudio.playStinger();
            randomGlitch(2);
            if (state.faceLostCount >= 4) setTimeout(() => startChatPhase(), 1500);
        };

        faceTracker.onFaceFound = () => {
            state.faceDetectedCount++;
            memory.addFaceDetected();
            statusEl.textContent = `> ОБНАРУЖЕН: ${state.faceDetectedCount} раз`;
        };

        faceTracker.onEmotion = (emotion) => {
            state.emotions[emotion] = (state.emotions[emotion] || 0) + 1;
            memory.addEmotion(emotion);
            if (emotion === 'happy') {
                horrorAudio.playLaugh();
                showFact('Улыбка?.. Он не любит, когда улыбаются.', 2000);
                state.threat = Math.min(100, state.threat + 5);
            } else if (emotion === 'fearful') {
                horrorAudio.playStinger();
                randomGlitch(2);
                state.threat = Math.min(100, state.threat + 10);
            } else if (emotion === 'angry') {
                showFact('Гнев. Мне это нравится.', 2000);
                state.threat = Math.min(100, state.threat + 8);
            }
        };
    } else {
        webcamBg.style.display = 'none';
        faceCanvas.style.display = 'none';
    }

    startTimer();
    runHorrorSequence();
}

function endGame() {
    if (state.ended) return;
    state.ended = true;
    clearInterval(state.timerInterval);
    faceTracker.stop();

    const endState = {
        threat: state.threat,
        faceLost: state.faceLostCount,
        faceDetectedCount: state.faceDetectedCount,
        emotions: state.emotions,
        noCamera: state.noCamera,
        chatMessagesSent: state.chatMessagesSent,
        chatCompleted: state.chatCompleted,
        chatEndings: state.chatEndings,
    };
    const ending = EndingsManager.determine(endState);
    memory.addEnding(ending.id);
    memory.addTime(Math.floor((Date.now() - state.startTime) / 1000));

    if (ending.weight === 'good') horrorAudio.playResolution();
    else horrorAudio.playFinale();
    horrorAudio.stopAll();

    if (ending.weight === 'bad') {
        const blood = document.createElement('div');
        blood.className = 'blood-overlay';
        document.body.appendChild(blood);
        requestAnimationFrame(() => blood.classList.add('active'));
        setTimeout(() => {
            blood.classList.remove('active');
            setTimeout(() => blood.remove(), 1500);
        }, 4000);
    }

    endTitle.textContent = ending.title;
    endTitle.setAttribute('data-text', ending.title);
    endSubtitle.textContent = ending.subtitle;

    const url = videoRecorder.getUrl();
    if (url) {
        endVideo.src = url;
        endVideoWrap.classList.add('active');
    } else {
        endVideoWrap.classList.remove('active');
    }

    const seconds = Math.floor((Date.now() - state.startTime) / 1000);
    const topEmotion = Object.entries(state.emotions).sort((a, b) => b[1] - a[1])[0]?.[0];
    const emotionRu = emotionsRu[topEmotion] || '—';

    endStats.innerHTML = `
        <div>Концовка: <span class="red">${ending.id}</span></div>
        <div>⏱ Время: <span class="red">${seconds} сек</span></div>
        <div>👁 Лицо: <span class="red">${state.faceDetectedCount} раз</span></div>
        <div>💀 Потеря: <span class="red">${state.faceLostCount} раз</span></div>
        <div>🔥 Угроза: <span class="red">${state.threat}%</span></div>
        <div>💬 Сообщений в чате: <span class="red">${state.chatMessagesSent}</span></div>
        ${topEmotion ? `<div>💭 Ты ${emotionRu}</div>` : ''}
        <div>📊 Визитов: <span class="red">${memory.data.visits}</span></div>
        <div>🏁 Концовок: <span class="red">${memory.data.endings.length} / ${Object.keys(ENDINGS).length}</span></div>
    `;

    setTimeout(() => {
        showScreen('end');
        stopWebcam();
    }, 1200);
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
        });
        state.webcamStream = stream;
        webcam.srcObject = stream;
        webcamBg.srcObject = stream;
        return true;
    } catch (e) {
        console.warn('Камера недоступна:', e);
        return false;
    }
}

function stopWebcam() {
    if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(t => t.stop());
        state.webcamStream = null;
    }
}

async function loadModelsWithUI() {
    loader.classList.add('active');
    loaderText.textContent = 'Загрузка моделей распознавания...';
    const ok = await faceTracker.loadModels(p => {
        loaderFill.style.width = (p * 100) + '%';
    });
    loader.classList.remove('active');
    return ok;
}

btnReturnStart.addEventListener('click', () => {
    horrorAudio.init();
    horrorAudio.resume();
    showScreen('permission');
});

btnStart.addEventListener('click', async () => {
    horrorAudio.init();
    horrorAudio.resume();
    await loadModelsWithUI();
    await fingerprint.initBattery();

    if (speechListener.supported) {
        speechListener.init('ru-RU');
        speechListener.onResult = (text) => {
            if (/нажимать|не нажимай|стоп|хватит/i.test(text)) {
                horrorAudio.playFullScream();
                randomGlitch(3);
            }
        };
    }
    showScreen('permission');
});

btnAllow.addEventListener('click', async () => {
    horrorAudio.resume();
    const ok = await startWebcam();
    startGame(ok);
});

btnDeny.addEventListener('click', () => {
    horrorAudio.resume();
    startGame(false);
});

btnRestart.addEventListener('click', () => { resetGame(); showScreen('intro'); });
btnForget.addEventListener('click', () => { memory.forget(); resetGame(); showScreen('intro'); });

function resetGame() {
    state.ended = true;
    clearInterval(state.timerInterval);
    faceTracker.stop();
    videoChat.stop();
    horrorAudio.stopAll();
    glitchShader.stop();
    stopWebcam();
    videoRecorder.cleanup();
    webcamBg.style.display = '';
    faceCanvas.style.display = '';
    timerFill.style.width = '100%';
    statusEl.textContent = '';
    messageEl.textContent = '';
    factPopup.classList.remove('show');
    endVideoWrap.classList.remove('active');
}

let tabHiddenCount = 0;
document.addEventListener('visibilitychange', () => {
    if (document.hidden && screens.game.classList.contains('active') && !state.ended) {
        tabHiddenCount++;
        if (tabHiddenCount >= 1) {
            tabWarning.classList.add('active');
            setTimeout(() => tabWarning.classList.remove('active'), 2500);
        }
        if (tabHiddenCount >= 3) {
            horrorAudio.playFullScream();
            randomGlitch(3);
        }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (screens.game.classList.contains('active') && !state.ended) {
        e.preventDefault();
        e.returnValue = 'Оно всё ещё смотрит...';
    }
});

document.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('load', () => {
    memory.registerVisit();
    if (memory.isReturning()) {
        returnInfo.innerHTML = memory.getReturningMessage();
        showScreen('returning');
    }
});