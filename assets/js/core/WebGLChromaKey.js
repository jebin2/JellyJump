/**
 * WebGL Chroma Key Helper
 * Handles GPU-accelerated background removal using WebGL shaders
 */
export class WebGLChromaKey {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.texture = null;
        this.width = 0;
        this.height = 0;
    }

    /**
     * Initialize WebGL context
     * @param {number} width 
     * @param {number} height 
     * @returns {boolean} Success
     */
    init(width, height) {
        this.width = width;
        this.height = height;

        // Create canvas (Offscreen if available)
        if (typeof OffscreenCanvas !== 'undefined') {
            this.canvas = new OffscreenCanvas(width, height);
        } else {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
        }

        // Get WebGL context
        this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
        if (!this.gl) {
            console.warn('[WebGLChromaKey] WebGL not supported');
            return false;
        }

        // Create Shaders
        const vertShader = this._createShader(this.gl.VERTEX_SHADER, this._getVertexShaderSource());
        const fragShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getFragmentShaderSource());

        if (!vertShader || !fragShader) return false;

        // Create Program
        this.program = this._createProgram(vertShader, fragShader);
        if (!this.program) return false;

        this.gl.useProgram(this.program);

        // Setup Buffers (Quad)
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        const texCoords = new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
        ]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

        const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.gl.enableVertexAttribArray(texCoordLocation);
        this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Create Texture
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        return true;
    }

    /**
     * Render frame with chroma key
     * @param {ImageBitmap|HTMLVideoElement|HTMLCanvasElement} source 
     * @param {Object} options - { colors, bgType, bgColor }
     * @returns {OffscreenCanvas|HTMLCanvasElement}
     */
    render(source, options) {
        const gl = this.gl;

        // Resize if needed
        if (this.width !== source.width || this.height !== source.height) {
            this.width = source.width;
            this.height = source.height;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            gl.viewport(0, 0, this.width, this.height);
        }

        // Upload Texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        // Set Uniforms
        const { colors, bgType, bgColor } = options;

        // Prepare key colors (max 5 supported by shader for now)
        const maxColors = 5;
        const keyColorsFlat = new Float32Array(maxColors * 3); // RGB
        const keyParamsFlat = new Float32Array(maxColors * 3); // Similarity, Smoothness, Spill

        colors.slice(0, maxColors).forEach((c, i) => {
            keyColorsFlat[i * 3] = c.r / 255;
            keyColorsFlat[i * 3 + 1] = c.g / 255;
            keyColorsFlat[i * 3 + 2] = c.b / 255;

            keyParamsFlat[i * 3] = (c.tolerance / 100) * 0.4; // Similarity
            keyParamsFlat[i * 3 + 1] = 0.08; // Smoothness
            keyParamsFlat[i * 3 + 2] = 0.1; // Spill
        });

        gl.uniform1i(gl.getUniformLocation(this.program, 'u_image'), 0);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_keyColors'), keyColorsFlat);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_keyParams'), keyParamsFlat);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_numColors'), Math.min(colors.length, maxColors));

        // Background Color
        let bgR = 0, bgG = 0, bgB = 0;
        if (bgType === 'custom') {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgColor);
            if (result) {
                bgR = parseInt(result[1], 16) / 255;
                bgG = parseInt(result[2], 16) / 255;
                bgB = parseInt(result[3], 16) / 255;
            }
        }
        gl.uniform3f(gl.getUniformLocation(this.program, 'u_bgColor'), bgR, bgG, bgB);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_useCustomBg'), bgType === 'custom' ? 1 : 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return this.canvas;
    }

    dispose() {
        if (this.gl) {
            this.gl.deleteProgram(this.program);
            this.gl.deleteTexture(this.texture);
            const ext = this.gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        }
        this.canvas = null;
        this.gl = null;
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('[WebGLChromaKey] Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vert, frag) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vert);
        this.gl.attachShader(program, frag);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('[WebGLChromaKey] Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    _getVertexShaderSource() {
        return `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
    }

    _getFragmentShaderSource() {
        return `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            
            // Arrays for multiple key colors (max 5)
            uniform vec3 u_keyColors[5]; 
            uniform vec3 u_keyParams[5]; // x=similarity, y=smoothness, z=spill
            uniform int u_numColors;

            uniform vec3 u_bgColor;
            uniform int u_useCustomBg;

            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                float finalAlpha = 1.0;
                vec3 finalColor = color.rgb;

                // Iterate through key colors
                for (int i = 0; i < 5; i++) {
                    if (i >= u_numColors) break;

                    vec3 keyColor = u_keyColors[i];
                    float similarity = u_keyParams[i].x;
                    float smoothness = u_keyParams[i].y;
                    float spill = u_keyParams[i].z;

                    // Calculate distance in RGB space
                    float dist = distance(color.rgb, keyColor);
                    // Normalize distance (approx max dist is sqrt(3) ~ 1.732)
                    float normalizedDist = dist / 1.732; 

                    float alpha = 1.0;
                    if (normalizedDist < similarity) {
                        alpha = 0.0;
                    } else if (normalizedDist < similarity + smoothness) {
                        alpha = (normalizedDist - similarity) / smoothness;
                    }

                    // Use the best match (lowest alpha)
                    if (alpha < finalAlpha) {
                        finalAlpha = alpha;

                        // Spill suppression
                        if (alpha < 1.0 && spill > 0.0) {
                            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                            float spillFactor = spill * (1.0 - normalizedDist);
                            if (spillFactor > 0.0) {
                                finalColor = mix(color.rgb, vec3(gray), spillFactor);
                            }
                        }
                    }
                }

                if (u_useCustomBg == 1) {
                    // Composite with custom background
                    vec3 outColor = mix(u_bgColor, finalColor, finalAlpha);
                    gl_FragColor = vec4(outColor, 1.0);
                } else {
                    // Transparent background
                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            }
        `;
    }
}
