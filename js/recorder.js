class VideoRecorder {
    constructor() {
        this.recorder = null;
        this.chunks = [];
        this.blobUrl = null;
    }

    start(stream, durationMs = 3000) {
        if (!stream || !window.MediaRecorder) return;
        try {
            this.chunks = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';
            this.recorder = new MediaRecorder(stream, { mimeType });
            this.recorder.ondataavailable = e => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };
            this.recorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
                this.blobUrl = URL.createObjectURL(blob);
            };
            this.recorder.start();
            setTimeout(() => {
                if (this.recorder?.state === 'recording') this.recorder.stop();
            }, durationMs);
        } catch (e) {
            console.warn('Recorder error:', e);
        }
    }

    getUrl() { return this.blobUrl; }

    cleanup() {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
    }
}

const videoRecorder = new VideoRecorder();