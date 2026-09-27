class GlitchShader {
    constructor() {
        this.gl = null;
        this.canvas = null;
        this.program = null;
        this.startTime = 0;
        this.intensity = 0.5;
        this.rafId = null;
    }

    init(canvas) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl');
        if (!gl) return false;
        this.gl = gl;

        const vs = `
            attribute vec2 pos;
            varying vec2 vUv;
            void main() {
                vUv = pos * 0.5 + 0.5;
                gl_Position = vec4(pos, 0.0, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            varying vec2 vUv;
            uniform float uTime;
            uniform float uIntensity;

            float rand(vec2 co) {
                return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vec2 uv = vUv;
                float scan = sin(uv.y * 800.0) * 0.03;
                float shift = (rand(vec2(floor(uv.y * 80.0), floor(uTime * 10.0))) - 0.5) * uIntensity * 0.15;
                uv.x += shift;
                float r = rand(vec2(uv.y * 50.0, uTime)) * 0.01;
                gl_FragColor = vec4(
                    0.5 + scan + r + shift * 2.0,
                    0.0, 0.0,
                    0.4 + uIntensity * 0.2
                );
            }
        `;

        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        };

        const vsObj = compile(gl.VERTEX_SHADER, vs);
        const fsObj = compile(gl.FRAGMENT_SHADER, fs);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vsObj);
        gl.attachShader(this.program, fsObj);
        gl.linkProgram(this.program);
        gl.useProgram(this.program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW);

        const pos = gl.getAttribLocation(this.program, 'pos');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

        this.uTime = gl.getUniformLocation(this.program, 'uTime');
        this.uIntensity = gl.getUniformLocation(this.program, 'uIntensity');

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        this.startTime = performance.now();
        this.loop();
        return true;
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

    loop = () => {
        if (!this.gl) return;
        const t = (performance.now() - this.startTime) / 1000;
        this.gl.uniform1f(this.uTime, t);
        this.gl.uniform1f(this.uIntensity, this.intensity);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        this.rafId = requestAnimationFrame(this.loop);
    };

    stop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
}

const glitchShader = new GlitchShader();