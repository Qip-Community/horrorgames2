/* ============================================================
   MAIN GAME LOGIC
   ============================================================ */

const state = {
    webcamStream: null,
    messageIndex: 0,
    startTime: 0,
    faceDetectedCount: 0,
    faceLostCount: 0,
    timeOnScreen: 0,
    timerInterval: null,
    gameDuration: 60, // секунд
    remaining: 60,
    ended: false,
};

const screens = {
    intro: document.getElementById('screen-intro'),
    permission: document.getElementById('screen-permission'),
    game: document.getElementById('screen-game'),
    end: document.getElementById('screen-end'),
};

const btnStart = document.getElementById('btn-start');
const btnAllow = document.getElementById('btn-allow');
const btnDeny = document.getElementById('btn-deny');
const btnRestart = document.getElementById('btn-restart');
const webcam = document.getElementById('webcam');
const webcamBg = document.getElementById('webcam-bg');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');
const timerFill = document.getElementById('timer-fill');
const endStats = document.getElementById('end-stats');
const faceCanvas = document.getElementById('face-canvas');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');

/* ===== Переключение экранов ===== */
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

/* ===== Сообщения ===== */
const messages = [
    { text: "Я вижу тебя...", minFace: false },
    { text: "Ты давно не двигался.", minFace: false },
    { text: "Почему ты не улыбаешься?", minFace: true },
    { text: "Я знаю, где ты живёшь.", minFace: false },
    { text: "Не оглядывайся.", minFace: false },
    { text: "За твоей спиной что-то есть.", minFace: false },
    { text: "Твоё лицо... такое знакомое.", minFace: true },
    { text: "Я запомнил каждую чёрточку.", minFace: true },
    { text: "Оно уже здесь.", minFace: false },
    { text: "Прощай.", minFace: false },
];

/* ===== Эффект печати ===== */
function typeMessage(text, callback) {
    messageEl.textContent = '';
    let i = 0;
    const speed = 55;
    const interval = setInterval(() => {
        messageEl.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (callback) setTimeout(callback, 2200);
        }
    }, speed);
}

/* ===== Глитч ===== */
function randomGlitch() {
    document.body.classList.add('glitching');
    setTimeout(() => document.body.classList.remove('glitching'), 180);

    if (Math.random() > 0.7) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; inset: 0; background: #ff0000;
            opacity: 0.25; z-index: 100; pointer-events: none;
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 80);
    }
}

/* ===== Основной цикл ===== */
function runHorrorSequence() {
    const showNext = () => {
        if (state.ended) return;
        if (state.messageIndex >= messages.length) {
            endGame();
            return;
        }

        const msg = messages[state.messageIndex];
        state.messageIndex++;

        // Скример-звук на определённых сообщениях
        if (state.messageIndex === 5 || state.messageIndex === 9) {
            horrorAudio.playStinger();
            randomGlitch();
        } else {
            randomGlitch();
        }

        // Если нужно лицо — покажем статус
        if (msg.minFace && !faceTracker.faceDetected) {
            statusEl.textContent = '> ПОКАЖИ ЛИЦО В КАМЕРУ';
        } else {
            statusEl.textContent = '';
        }

        typeMessage(msg.text, showNext);
    };

    setTimeout(showNext, 1500);
}

/* ===== Старт игры ===== */
async function startGame(withCamera) {
    state.messageIndex = 0;
    state.startTime = Date.now();
    state.remaining = state.gameDuration;
    state.ended = false;
    state.faceDetectedCount = 0;
    state.faceLostCount = 0;

    // Инициализируем аудио после пользовательского действия
    horrorAudio.init();
    horrorAudio.resume();
    horrorAudio.startWhisper();
    horrorAudio.startHeartbeat();
    horrorAudio.startDrone();

    showScreen('game');

    if (withCamera) {
        faceTracker.attach(webcamBg, faceCanvas);
        if (faceTracker.modelsLoaded) faceTracker.start();

        faceTracker.onFaceLost = () => {
            state.faceLostCount++;
            statusEl.textContent = '> ПОТЕРЯ СИГНАЛА...';
            horrorAudio.playStinger();
            randomGlitch();
            if (state.faceLostCount >= 3) {
                // Ускоренный финал
                setTimeout(() => endGame(), 1500);
            }
        };
        faceTracker.onFaceFound = (count) => {
            state.faceDetectedCount = count;
            statusEl.textContent = `> ОБНАРУЖЕН: ${count} раз`;
        };
    } else {
        webcamBg.style.display = 'none';
        faceCanvas.style.display = 'none';
    }

    // Таймер
    state.timerInterval = setInterval(() => {
        state.remaining--;
        state.timeOnScreen = Math.floor((Date.now() - state.startTime) / 1000);
        const pct = Math.max(0, (state.remaining / state.gameDuration) * 100);
        timerFill.style.width = pct + '%';

        // Ускорение сердцебиения
        if (state.remaining < 30) horrorAudio.setHeartbeatRate(700);
        if (state.remaining < 15) horrorAudio.setHeartbeatRate(500);
        if (state.remaining < 5) horrorAudio.setHeartbeatRate(350);

        if (state.remaining <= 0) {
            endGame();
        }
    }, 1000);

    runHorrorSequence();
}

/* ===== Финал ===== */
function endGame() {
    if (state.ended) return;
    state.ended = true;
    clearInterval(state.timerInterval);
    faceTracker.stop();
    horrorAudio.stopWhisper();
    horrorAudio.stopHeartbeat();
    horrorAudio.playFinale();

    // Кровавый оверлей
    const blood = document.createElement('div');
    blood.className = 'blood-overlay';
    document.body.appendChild(blood);
    requestAnimationFrame(() => blood.classList.add('active'));

    // Статистика
    const seconds = state.timeOnScreen || Math.floor((Date.now() - state.startTime) / 1000);
    endStats.innerHTML = `
        ⏱ Ты был(а) на экране: <span class="red">${seconds} сек</span><br>
        👁 Лицо обнаружено: <span class="red">${state.faceDetectedCount} раз</span><br>
        💀 Потеря сигнала: <span class="red">${state.faceLostCount} раз</span><br>
        📍 IP-адрес записан: <span class="red">да</span><br>
        🎥 Видео сохранено: <span class="red">нет (шутка)</span>
    `;

    setTimeout(() => {
        showScreen('end');
        stopWebcam();
        setTimeout(() => {
            blood.classList.remove('active');
            setTimeout(() => blood.remove(), 1000);
        }, 3000);
    }, 1200);
}

/* ===== Вебкамера ===== */
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
        });
        state.webcamStream = stream;
        webcam.srcObject = stream;
        webcamBg.srcObject = stream;
        return true;
    } catch (err) {
        console.warn('Камера недоступна:', err);
        return false;
    }
}

function stopWebcam() {
    if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(t => t.stop());
        state.webcamStream = null;
    }
}

/* ===== Загрузка моделей ===== */
async function loadModelsWithUI() {
    loader.classList.add('active');
    const ok = await faceTracker.loadModels((p) => {
        loaderFill.style.width = (p * 100) + '%';
    });
    loader.classList.remove('active');
    return ok;
}

/* ===== Обработчики ===== */
btnStart.addEventListener('click', async () => {
    // Инициализируем аудио при первом клике
    horrorAudio.init();
    horrorAudio.resume();
    await loadModelsWithUI();
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

btnRestart.addEventListener('click', () => {
    state.ended = true;
    clearInterval(state.timerInterval);
    faceTracker.stop();
    horrorAudio.stopWhisper();
    horrorAudio.stopHeartbeat();
    horrorAudio.stopDrone();
    stopWebcam();
    webcamBg.style.display = '';
    faceCanvas.style.display = '';
    timerFill.style.width = '100%';
    statusEl.textContent = '';
    messageEl.textContent = '';
    showScreen('intro');
});

/* ===== Защита от закрытия ===== */
window.addEventListener('beforeunload', (e) => {
    if (screens.game.classList.contains('active') && !state.ended) {
        e.preventDefault();
        e.returnValue = 'Оно всё ещё смотрит...';
    }
});

/* ===== Запрет контекстного меню ===== */
document.addEventListener('contextmenu', e => e.preventDefault());