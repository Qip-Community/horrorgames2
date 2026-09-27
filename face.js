/* ============================================================
   FACE TRACKER — face-api.js + Canvas отрисовка
   ============================================================ */

class FaceTracker {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.detectionInterval = null;
        this.faceDetected = false;
        this.faceBox = null;
        this.faceCount = 0;
        this.eyeBlink = 0;
        this.lastDetection = null;
        this.modelsLoaded = false;
        this.onFaceLost = null;
        this.onFaceFound = null;
        this.faceLostCounter = 0;
    }

    async loadModels(onProgress) {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
        try {
            if (onProgress) onProgress(0.1);
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            if (onProgress) onProgress(0.5);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
            if (onProgress) onProgress(1.0);
            this.modelsLoaded = true;
            return true;
        } catch (err) {
            console.warn('Не удалось загрузить модели лиц:', err);
            return false;
        }
    }

    attach(videoEl, canvasEl) {
        this.video = videoEl;
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        if (!this.modelsLoaded || !this.video) return;
        this.stop();
        this.detectionInterval = setInterval(() => this.detect(), 150);
    }

    stop() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async detect() {
        if (!this.video || this.video.readyState < 2) return;
        try {
            const result = await faceapi
                .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                .withFaceLandmarks(true);

            if (result) {
                const wasDetected = this.faceDetected;
                this.faceDetected = true;
                this.faceLostCounter = 0;
                this.lastDetection = result;
                this.faceCount++;
                if (!wasDetected && this.onFaceFound) this.onFaceFound(this.faceCount);
            } else {
                this.faceDetected = false;
                this.faceLostCounter++;
                if (this.faceLostCounter === 5 && this.onFaceLost) {
                    this.onFaceLost();
                }
            }
            this.draw();
        } catch (err) {
            // тихо игнорируем
        }
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.lastDetection) return;

        const videoW = this.video.videoWidth;
        const videoH = this.video.videoHeight;
        if (!videoW || !videoH) return;

        const scaleX = this.canvas.width / videoW;
        const scaleY = this.canvas.height / videoH;
        const scale = Math.max(scaleX, scaleY);
        const offsetX = (this.canvas.width - videoW * scale) / 2;
        const offsetY = (this.canvas.height - videoH * scale) / 2;

        // Видео зеркалится через CSS scaleX(-1), значит координаты лиц надо отражать
        const { box } = this.lastDetection.detection;
        const x = this.canvas.width - (offsetX + (box.x + box.width) * scale);
        const y = offsetY + box.y * scale;
        const w = box.width * scale;
        const h = box.height * scale;

        // Красная рамка с уголками
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 15;

        const corner = Math.min(w, h) * 0.2;
        this.ctx.beginPath();
        // Левый верх
        this.ctx.moveTo(x, y + corner); this.ctx.lineTo(x, y); this.ctx.lineTo(x + corner, y);
        // Правый верх
        this.ctx.moveTo(x + w - corner, y); this.ctx.lineTo(x + w, y); this.ctx.lineTo(x + w, y + corner);
        // Правый низ
        this.ctx.moveTo(x + w, y + h - corner); this.ctx.lineTo(x + w, y + h); this.ctx.lineTo(x + w - corner, y + h);
        // Левый низ
        this.ctx.moveTo(x + corner, y + h); this.ctx.lineTo(x, y + h); this.ctx.lineTo(x, y + h - corner);
        this.ctx.stroke();

        // Метка
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 14px Courier New';
        this.ctx.fillText('ОБЪЕКТ ОБНАРУЖЕН', x, y - 8);

        // Точки landmarks (глаза, нос, рот)
        const landmarks = this.lastDetection.landmarks;
        if (landmarks) {
            const pts = landmarks.positions;
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            pts.forEach(p => {
                const px = this.canvas.width - (offsetX + p.x * scale);
                const py = offsetY + p.y * scale;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }
}

const faceTracker = new FaceTracker();