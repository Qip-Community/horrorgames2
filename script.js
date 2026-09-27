// ====== Состояние ======
const state = {
    webcamStream: null,
    messageIndex: 0,
};

// ====== Элементы ======
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

// ====== Переключение экранов ======
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ====== Сообщения для "хоррора" ======
const messages = [
    "Я вижу тебя...",
    "Ты давно не двигался.",
    "Почему ты не улыбаешься?",
    "Я знаю, где ты живёшь.",
    "Не оглядывайся.",
    "За твоей спиной что-то есть.",
    "Оно уже здесь.",
    "Прощай.",
];

// ====== Эффект печати текста ======
function typeMessage(text, callback) {
    messageEl.textContent = '';
    let i = 0;
    const speed = 60;
    const interval = setInterval(() => {
        messageEl.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (callback) setTimeout(callback, 2000);
        }
    }, speed);
}

// ====== Основной хоррор-цикл ======
function runHorrorSequence() {
    const showNext = () => {
        if (state.messageIndex >= messages.length) {
            setTimeout(() => {
                showScreen('end');
                stopWebcam();
            }, 2000);
            return;
        }

        const msg = messages[state.messageIndex];
        state.messageIndex++;

        // Случайные эффекты
        randomGlitch();

        typeMessage(msg, showNext);
    };

    setTimeout(showNext, 1500);
}

// ====== Глитч-эффект ======
function randomGlitch() {
    document.body.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
    setTimeout(() => {
        document.body.style.transform = '';
    }, 100);

    // Красная вспышка
    if (Math.random() > 0.6) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; inset: 0; background: #ff0000;
            opacity: 0.3; z-index: 100; pointer-events: none;
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 80);
    }
}

// ====== Работа с камерой ======
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
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

// ====== Обработчики ======
btnStart.addEventListener('click', () => {
    showScreen('permission');
});

btnAllow.addEventListener('click', async () => {
    const ok = await startWebcam();
    if (!ok) {
        // Если камера недоступна — всё равно идём дальше (просто без видео)
        console.log('Играем без камеры');
    }
    showScreen('game');
    state.messageIndex = 0;
    runHorrorSequence();
});

btnDeny.addEventListener('click', () => {
    // Отказ тоже ведёт к хоррору — ты уже не можешь уйти
    showScreen('game');
    state.messageIndex = 0;
    // Тут без видео — просто чёрный экран с сообщениями
    webcamBg.style.display = 'none';
    runHorrorSequence();
});

btnRestart.addEventListener('click', () => {
    state.messageIndex = 0;
    stopWebcam();
    webcamBg.style.display = '';
    showScreen('intro');
});

// ====== Дополнительный "глаз" через canvas (по желанию) ======
// Можно добавить отрисовку следящего зрачка поверх видео.
// Пока оставим простой вариант.

// ====== Защита от "выхода" ======
window.addEventListener('beforeunload', (e) => {
    if (screens.game.classList.contains('active')) {
        e.preventDefault();
        e.returnValue = '';
    }
});