import type { Adjustments } from "@/lib/adjustments";

/**
 * Pipeline "develop" chạy trên GPU. Thứ tự PHẢI khớp với backend Python (services/imaging/pipeline.py):
 * WB → Exposure → Highlights/Shadows → Whites/Blacks → Contrast → Clarity → Vibrance/Saturation → Vignette → Grain
 */
const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_texel;
uniform float u_split;      // < 0: tắt so sánh
uniform float u_temp, u_tint, u_exposure, u_contrast, u_highlights, u_shadows;
uniform float u_whites, u_blacks, u_clarity, u_vibrance, u_saturation, u_vignette, u_grain;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 develop(vec3 c, vec2 uv) {
  // --- Linear
  vec3 lin = pow(c, vec3(2.2));
  // White balance (nhân kênh trong không gian tuyến tính)
  lin *= vec3(1.0 + u_temp * 0.25, 1.0 - u_tint * 0.18, 1.0 - u_temp * 0.25);
  // Exposure (EV)
  lin *= exp2(u_exposure);
  c = pow(max(lin, 0.0), vec3(1.0 / 2.2));

  // --- Highlights / Shadows (mask theo độ sáng)
  float l = dot(c, LUMA);
  float hMask = smoothstep(0.45, 1.0, l);
  float sMask = 1.0 - smoothstep(0.0, 0.55, l);
  c += c * u_highlights * 0.45 * hMask;
  c += (1.0 - c) * u_shadows * 0.35 * sMask * (u_shadows > 0.0 ? 1.0 : 0.0);
  c += c * u_shadows * 0.5 * sMask * (u_shadows < 0.0 ? 1.0 : 0.0);

  // --- Whites / Blacks (levels)
  float bp = -u_blacks * 0.12;
  float wp = 1.0 - u_whites * 0.18;
  c = (c - bp) / max(wp - bp, 0.05);

  // --- Contrast (đường cong S quanh mid-grey)
  float k = u_contrast >= 0.0 ? 1.0 + u_contrast * 1.2 : 1.0 + u_contrast * 0.7;
  c = (c - 0.5) * k + 0.5;

  // --- Clarity (tương phản cục bộ: so với trung bình vùng lân cận)
  if (abs(u_clarity) > 0.001) {
    vec2 r = u_texel * 6.0;
    vec3 blur = (
      texture2D(u_image, uv + vec2( r.x, 0.0)).rgb + texture2D(u_image, uv - vec2( r.x, 0.0)).rgb +
      texture2D(u_image, uv + vec2(0.0,  r.y)).rgb + texture2D(u_image, uv - vec2(0.0,  r.y)).rgb +
      texture2D(u_image, uv + r).rgb + texture2D(u_image, uv - r).rgb +
      texture2D(u_image, uv + vec2(r.x, -r.y)).rgb + texture2D(u_image, uv - vec2(r.x, -r.y)).rgb
    ) / 8.0;
    float detail = dot(texture2D(u_image, uv).rgb - blur, LUMA);
    float midMask = 1.0 - abs(dot(c, LUMA) * 2.0 - 1.0);
    c += detail * u_clarity * 2.2 * midMask;
  }

  // --- Vibrance / Saturation
  float g = dot(c, LUMA);
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(g), c, 1.0 + u_vibrance * (1.0 - clamp(sat, 0.0, 1.0)) * 1.1);
  c = mix(vec3(dot(c, LUMA)), c, 1.0 + u_saturation);

  // --- Vignette
  float d = distance(uv, vec2(0.5)) * 1.414;
  float v = smoothstep(0.35, 1.05, d);
  c = u_vignette < 0.0 ? c * (1.0 + u_vignette * v) : mix(c, vec3(1.0), u_vignette * v * 0.8);

  // --- Grain
  if (u_grain > 0.001) {
    float n = hash(floor(uv / u_texel)) - 0.5;
    c += n * u_grain * 0.14 * (1.0 - abs(dot(c, LUMA) * 2.0 - 1.0) * 0.5);
  }
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec3 src = texture2D(u_image, v_uv).rgb;
  if (u_split >= 0.0 && v_uv.x < u_split) { gl_FragColor = vec4(src, 1.0); return; }
  gl_FragColor = vec4(develop(src, v_uv), 1.0);
}`;

const UNIFORMS = [
  "u_image", "u_texel", "u_split", "u_temp", "u_tint", "u_exposure", "u_contrast", "u_highlights",
  "u_shadows", "u_whites", "u_blacks", "u_clarity", "u_vibrance", "u_saturation", "u_vignette", "u_grain",
] as const;

/** Giới hạn cạnh dài của ảnh proxy để preview mượt */
export const PROXY_MAX_EDGE = 2048;

export class DevelopRenderer {
  private gl: WebGLRenderingContext;
  private loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private tex: WebGLTexture | null = null;
  width = 0;
  height = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error("WEBGL_UNSUPPORTED");
    this.gl = gl;

    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const u of UNIFORMS) this.loc[u] = gl.getUniformLocation(prog, u);
  }

  setImage(img: HTMLImageElement) {
    const gl = this.gl;
    const scale = Math.min(1, PROXY_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    this.width = Math.round(img.naturalWidth * scale);
    this.height = Math.round(img.naturalHeight * scale);

    // Hạ độ phân giải qua canvas 2D (chất lượng cao) trước khi upload texture
    const off = document.createElement("canvas");
    off.width = this.width;
    off.height = this.height;
    const ctx = off.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, this.width, this.height);

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    gl.viewport(0, 0, this.width, this.height);

    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
  }

  render(a: Adjustments, split: number | null) {
    if (!this.tex) return;
    const gl = this.gl;
    const l = this.loc;
    gl.uniform1i(l.u_image, 0);
    gl.uniform2f(l.u_texel, 1 / this.width, 1 / this.height);
    gl.uniform1f(l.u_split, split ?? -1);
    gl.uniform1f(l.u_temp, a.temperature / 100);
    gl.uniform1f(l.u_tint, a.tint / 100);
    gl.uniform1f(l.u_exposure, a.exposure);
    gl.uniform1f(l.u_contrast, a.contrast / 100);
    gl.uniform1f(l.u_highlights, a.highlights / 100);
    gl.uniform1f(l.u_shadows, a.shadows / 100);
    gl.uniform1f(l.u_whites, a.whites / 100);
    gl.uniform1f(l.u_blacks, a.blacks / 100);
    gl.uniform1f(l.u_clarity, a.clarity / 100);
    gl.uniform1f(l.u_vibrance, a.vibrance / 100);
    gl.uniform1f(l.u_saturation, a.saturation / 100);
    gl.uniform1f(l.u_vignette, a.vignette / 100);
    gl.uniform1f(l.u_grain, a.grain / 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Histogram RGB + Luma (256 bin) lấy mẫu thưa để rẻ */
  histogram(): { r: Uint32Array; g: Uint32Array; b: Uint32Array; l: Uint32Array } {
    const gl = this.gl;
    const px = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), lu = new Uint32Array(256);
    const stride = 4 * 7; // lấy 1/7 pixel
    for (let i = 0; i < px.length; i += stride) {
      r[px[i]]++; g[px[i + 1]]++; b[px[i + 2]]++;
      lu[(px[i] * 54 + px[i + 1] * 183 + px[i + 2] * 19) >> 8]++;
    }
    return { r, g, b, l: lu };
  }
}
