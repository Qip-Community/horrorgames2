class FaceTracker {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.detectionInterval = null;
        this.faceDetected = false;
        this.lastDetection = null;
        this.modelsLoaded = false;
        this.onFaceLost = null;
        this.onFaceFound = null;
        this.onEmotion = null;
        this.faceLostCounter = 0;
        this.lastEmotion = null;
        this.emotionHistory = [];
    }

    async loadModels(onProgress) {
        const URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
        try {
            onProgress?.(0.1);
            await faceapi.nets.tinyFaceDetector.loadFromUri(URL);
            onProgress?.(0.4);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(URL);
            onProgress?.(0.7);
            await faceapi.nets.faceExpressionNet.loadFromUri(URL);
            onProgress?.(1);
            this.modelsLoaded = true;
            return true;
        } catch (e) {
            console.warn('Model load failed:', e);
            return false;
        }
    }

    attach(videoEl, canvasEl) {
        this.video = videoEl;
        this.canvas = canvasEl;
        if (!canvasEl) return;
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
        this.detectionInterval = setInterval(() => this.detect(), 180);
    }

    stop() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async detect() {
        if (!this.video || this.video.readyState < 2) return;
        try {
            const result = await faceapi
                .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224, scoreThreshold: 0.4,
                }))
                .withFaceLandmarks(true)
                .withFaceExpressions();

            if (result) {
                const was = this.faceDetected;
                this.faceDetected = true;
                this.faceLostCounter = 0;
                this.lastDetection = result;
                if (!was) this.onFaceFound?.();

                if (result.expressions) {
                    const top = Object.entries(result.expressions)
                        .sort((a, b) => b[1] - a[1])[0];
                    if (top && top[1] > 0.5) {
                        this.emotionHistory.push(top[0]);
                        if (this.emotionHistory.length > 5) this.emotionHistory.shift();
                        const counts = {};
                        this.emotionHistory.forEach(e => counts[e] = (counts[e] || 0) + 1);
                        const smoothed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                        if (smoothed !== this.lastEmotion) {
                            this.lastEmotion = smoothed;
                            this.onEmotion?.(smoothed);
                        }
                    }
                }
            } else {
                this.faceDetected = false;
                this.faceLostCounter++;
                if (this.faceLostCounter === 5) this.onFaceLost?.();
            }
            this.draw();
        } catch (e) {}
    }

    draw() {
        if (!this.ctx || !this.lastDetection || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        if (!vw || !vh) return;

        const sx = this.canvas.width / vw;
        const sy = this.canvas.height / vh;
        const scale = Math.max(sx, sy);
        const ox = (this.canvas.width - vw * scale) / 2;
        const oy = (this.canvas.height - vh * scale) / 2;

        const { box } = this.lastDetection.detection;
        const x = this.canvas.width - (ox + (box.x + box.width) * scale);
        const y = oy + box.y * scale;
        const w = box.width * scale;
        const h = box.height * scale;

        const colors = {
            happy: '#00ff88', sad: '#4488ff', angry: '#ff2222',
            fearful: '#ff00ff', disgusted: '#88ff00',
            surprised: '#ffff00', neutral: '#ff2222',
        };
        const color = colors[this.lastEmotion] || '#ff2222';

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 15;

        const c = Math.min(w, h) * 0.2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + c); this.ctx.lineTo(x, y); this.ctx.lineTo(x + c, y);
        this.ctx.moveTo(x + w - c, y); this.ctx.lineTo(x + w, y); this.ctx.lineTo(x + w, y + c);
        this.ctx.moveTo(x + w, y + h - c); this.ctx.lineTo(x + w, y + h); this.ctx.lineTo(x + w - c, y + h);
        this.ctx.moveTo(x + c, y + h); this.ctx.lineTo(x, y + h); this.ctx.lineTo(x, y + h - c);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 14px Courier New';
        const ru = { happy: 'УЛЫБКА', sad: 'ГРУСТЬ', angry: 'ГНЕВ', fearful: 'СТРАХ',
            disgusted: 'ОТВРАЩЕНИЕ', surprised: 'УДИВЛЕНИЕ', neutral: 'НЕЙТРАЛЬНО' };
        this.ctx.fillText(`● ${ru[this.lastEmotion] || 'ОБЪЕКТ'}`, x, y - 8);

        const lm = this.lastDetection.landmarks;
        if (lm) {
            this.ctx.fillStyle = color + '99';
            lm.positions.forEach(p => {
                const px = this.canvas.width - (ox + p.x * scale);
                const py = oy + p.y * scale;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }
}

const faceTracker = new FaceTracker();