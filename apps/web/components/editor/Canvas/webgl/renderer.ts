import type { Adjustments } from "@/lib/adjustments";
import { buildLUT } from "@/lib/curve";

/**
 * Pipeline "develop" chạy trên GPU. Thứ tự PHẢI khớp với backend Python (services/imaging/pipeline.py):
 * Noise Reduction → WB → Exposure → Highlights/Shadows → Whites/Blacks → Fade → Tone Curve →
 * Contrast → Texture → Clarity → Dehaze → HSL (8 dải màu) → Vibrance/Saturation →
 * Color Grading (3 vùng) → Sharpen → Bloom → Vignette → Grain
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
uniform sampler2D u_curveLUT;
uniform vec2 u_texel;
uniform float u_split;      // < 0: tắt so sánh
uniform float u_temp, u_tint, u_exposure, u_contrast, u_highlights, u_shadows;
uniform float u_whites, u_blacks, u_texture, u_clarity, u_dehaze, u_vibrance, u_saturation, u_vignette, u_grain;
uniform float u_sharpen, u_noiseReduction, u_colorNoiseReduction;
uniform float u_bloomIntensity, u_fadeAmount;
uniform vec3 u_hsl[8]; // (hueShift -1..1, satDelta -1..1, lumDelta -1..1): Đỏ,Cam,Vàng,Lục,NgọcLam,Lam,Tím,HồngCánhSen
uniform float u_splitShadowHue, u_splitShadowSat, u_splitMidtoneHue, u_splitMidtoneSat;
uniform float u_splitHighlightHue, u_splitHighlightSat, u_splitBalance, u_splitBlend;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/** Áp dụng đường cong tông màu qua LUT 256x1: kênh R = master, G/B/A = từng kênh R/G/B riêng. */
vec3 applyCurve(vec3 c) {
  vec3 m;
  m.r = texture2D(u_curveLUT, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r;
  m.g = texture2D(u_curveLUT, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).r;
  m.b = texture2D(u_curveLUT, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).r;
  vec3 o;
  o.r = texture2D(u_curveLUT, vec2((m.r * 255.0 + 0.5) / 256.0, 0.5)).g;
  o.g = texture2D(u_curveLUT, vec2((m.g * 255.0 + 0.5) / 256.0, 0.5)).b;
  o.b = texture2D(u_curveLUT, vec2((m.b * 255.0 + 0.5) / 256.0, 0.5)).a;
  return o;
}

float hueBandWeight(float hueDeg, float centerDeg) {
  float d = abs(hueDeg - centerDeg);
  d = min(d, 360.0 - d);
  return pow(max(0.0, cos(d * 0.0174533)), 3.0);
}

/** HSL theo 8 dải màu (kiểu Lightroom Color Mixer) — mỗi dải lân cận góp trọng số mượt. */
vec3 applyHsl(vec3 c) {
  vec3 hsv = rgb2hsv(c);
  float hueDeg = hsv.x * 360.0;
  float totalHue = 0.0, totalSat = 0.0, totalLum = 0.0, w;
  w = hueBandWeight(hueDeg, 0.0);   totalHue += w * u_hsl[0].x; totalSat += w * u_hsl[0].y; totalLum += w * u_hsl[0].z;
  w = hueBandWeight(hueDeg, 30.0);  totalHue += w * u_hsl[1].x; totalSat += w * u_hsl[1].y; totalLum += w * u_hsl[1].z;
  w = hueBandWeight(hueDeg, 60.0);  totalHue += w * u_hsl[2].x; totalSat += w * u_hsl[2].y; totalLum += w * u_hsl[2].z;
  w = hueBandWeight(hueDeg, 120.0); totalHue += w * u_hsl[3].x; totalSat += w * u_hsl[3].y; totalLum += w * u_hsl[3].z;
  w = hueBandWeight(hueDeg, 180.0); totalHue += w * u_hsl[4].x; totalSat += w * u_hsl[4].y; totalLum += w * u_hsl[4].z;
  w = hueBandWeight(hueDeg, 220.0); totalHue += w * u_hsl[5].x; totalSat += w * u_hsl[5].y; totalLum += w * u_hsl[5].z;
  w = hueBandWeight(hueDeg, 272.0); totalHue += w * u_hsl[6].x; totalSat += w * u_hsl[6].y; totalLum += w * u_hsl[6].z;
  w = hueBandWeight(hueDeg, 322.0); totalHue += w * u_hsl[7].x; totalSat += w * u_hsl[7].y; totalLum += w * u_hsl[7].z;

  hsv.x = fract(hsv.x + totalHue * (30.0 / 360.0));
  hsv.y = clamp(hsv.y * (1.0 + totalSat), 0.0, 1.0);
  hsv.z = clamp(hsv.z + totalLum * 0.3, 0.0, 1.0);
  return hsv2rgb(hsv);
}

float triWeight(float l, float center, float width) {
  return max(0.0, 1.0 - abs(l - center) / width);
}

/** Color Grading 3 vùng (tối/trung tính/sáng) kiểu Lightroom — mỗi vùng là 1 trọng số tam giác
    chuẩn hoá theo độ sáng pixel, u_splitBlend nới độ chồng lấn, u_splitBalance lệch điểm tối/sáng. */
vec3 applySplitTone(vec3 c) {
  float lum = dot(c, LUMA);
  float width = mix(0.15, 0.6, u_splitBlend);
  float shift = u_splitBalance * 0.2;
  float wSh = triWeight(lum - shift, 0.0, width);
  float wHi = triWeight(lum - shift, 1.0, width);
  float wMid = triWeight(lum, 0.5, width);
  float total = wSh + wHi + wMid + 1.0e-5;
  wSh /= total; wHi /= total; wMid /= total;

  vec3 shTint = hsv2rgb(vec3(u_splitShadowHue, 1.0, 1.0));
  vec3 midTint = hsv2rgb(vec3(u_splitMidtoneHue, 1.0, 1.0));
  vec3 hiTint = hsv2rgb(vec3(u_splitHighlightHue, 1.0, 1.0));

  c = mix(c, c * shTint * 2.0, wSh * u_splitShadowSat);
  c = mix(c, c * midTint * 2.0, wMid * u_splitMidtoneSat);
  c = mix(c, c * hiTint * 2.0, wHi * u_splitHighlightSat);
  return c;
}

vec3 develop(vec3 c, vec2 uv) {
  // --- Noise Reduction (áp trước cùng, trên dữ liệu gần-raw, giống pipeline máy ảnh thật)
  if (u_noiseReduction > 0.001 || u_colorNoiseReduction > 0.001) {
    vec2 rn = u_texel * 1.5;
    vec3 blurN = (
      texture2D(u_image, uv + vec2(rn.x, 0.0)).rgb + texture2D(u_image, uv - vec2(rn.x, 0.0)).rgb +
      texture2D(u_image, uv + vec2(0.0, rn.y)).rgb + texture2D(u_image, uv - vec2(0.0, rn.y)).rgb +
      c
    ) / 5.0;
    if (u_colorNoiseReduction > 0.001) {
      // Chỉ làm mượt thành phần màu (chroma), giữ nguyên luma gốc để không mất chi tiết sáng/tối
      float lOrig = dot(c, LUMA);
      vec3 chromaFixed = blurN - dot(blurN, LUMA) + lOrig;
      c = mix(c, chromaFixed, u_colorNoiseReduction * 0.9);
    }
    if (u_noiseReduction > 0.001) c = mix(c, blurN, u_noiseReduction * 0.55);
  }

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

  // --- Fade (nâng điểm đen + ép nhẹ điểm trắng cùng lúc — chất phim/matte/sương mù, 1 núm điều
  // khiển thay vì phải chỉnh tay Tone Curve, để AI Mentor điều khiển trực tiếp được)
  if (u_fadeAmount > 0.001) {
    float lift = u_fadeAmount * 0.22;
    float compress = u_fadeAmount * 0.12;
    c = c * (1.0 - lift - compress) + lift;
  }

  // --- Tone Curve (áp trước Contrast để Contrast vẫn "cảm" đúng trên baseline đã lên curve)
  c = applyCurve(clamp(c, 0.0, 1.0));

  // --- Contrast (đường cong S quanh mid-grey)
  float k = u_contrast >= 0.0 ? 1.0 + u_contrast * 1.2 : 1.0 + u_contrast * 0.7;
  c = (c - 0.5) * k + 0.5;

  // --- Texture (chi tiết tần số cao, bán kính nhỏ hơn Clarity, không có midMask)
  if (abs(u_texture) > 0.001) {
    vec2 rt = u_texel * 2.0;
    vec3 blurT = (
      texture2D(u_image, uv + vec2(rt.x, 0.0)).rgb + texture2D(u_image, uv - vec2(rt.x, 0.0)).rgb +
      texture2D(u_image, uv + vec2(0.0, rt.y)).rgb + texture2D(u_image, uv - vec2(0.0, rt.y)).rgb
    ) / 4.0;
    float detailT = dot(texture2D(u_image, uv).rgb - blurT, LUMA);
    c += detailT * u_texture * 1.6;
  }

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

  // --- Dehaze (xấp xỉ: trừ/thêm lớp "sương mù" ước lượng rồi giãn lại dải tương phản)
  if (abs(u_dehaze) > 0.001) {
    vec3 haze = vec3(0.86, 0.88, 0.9);
    if (u_dehaze > 0.0) c = (c - haze * u_dehaze * 0.4) / max(1.0 - u_dehaze * 0.4, 0.2);
    else c = mix(c, haze, -u_dehaze * 0.35);
  }

  // --- HSL theo dải màu
  c = applyHsl(clamp(c, 0.0, 1.0));

  // --- Vibrance / Saturation
  float g = dot(c, LUMA);
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(g), c, 1.0 + u_vibrance * (1.0 - clamp(sat, 0.0, 1.0)) * 1.1);
  c = mix(vec3(dot(c, LUMA)), c, 1.0 + u_saturation);

  // --- Split Toning
  c = applySplitTone(clamp(c, 0.0, 1.0));

  // --- Sharpen (unsharp mask nhẹ dựa trên chi tiết tần số cao của ảnh gốc)
  if (u_sharpen > 0.001) {
    vec2 rs = u_texel;
    vec3 blurS = (
      texture2D(u_image, uv + vec2(rs.x, 0.0)).rgb + texture2D(u_image, uv - vec2(rs.x, 0.0)).rgb +
      texture2D(u_image, uv + vec2(0.0, rs.y)).rgb + texture2D(u_image, uv - vec2(0.0, rs.y)).rgb
    ) / 4.0;
    float detailS = dot(texture2D(u_image, uv).rgb - blurS, LUMA);
    c += detailS * u_sharpen * 1.4;
  }

  // --- Bloom (phát sáng mềm quanh vùng ĐỦ SÁNG — viền tóc ngược sáng, highlight da, bokeh nền).
  // Chỉ kích hoạt khi độ sáng vùng lân cận vượt ngưỡng 0.6 — nhờ vậy nền tối/gai góc (thân cây, cỏ
  // trong bóng) tự nhiên không bị ảnh hưởng mà không cần model phân vùng (AI segmentation) riêng.
  if (u_bloomIntensity > 0.001) {
    vec2 rb = u_texel * 8.0;
    vec3 blurB = (
      texture2D(u_image, uv + vec2(rb.x, 0.0)).rgb + texture2D(u_image, uv - vec2(rb.x, 0.0)).rgb +
      texture2D(u_image, uv + vec2(0.0, rb.y)).rgb + texture2D(u_image, uv - vec2(0.0, rb.y)).rgb +
      texture2D(u_image, uv + rb).rgb + texture2D(u_image, uv - rb).rgb +
      texture2D(u_image, uv + vec2(rb.x, -rb.y)).rgb + texture2D(u_image, uv - vec2(rb.x, -rb.y)).rgb
    ) / 8.0;
    float lumaB = dot(blurB, LUMA);
    float bright = clamp((lumaB - 0.6) / 0.4, 0.0, 1.0);
    vec3 glow = blurB * bright;
    c = 1.0 - (1.0 - c) * (1.0 - glow * u_bloomIntensity); // screen blend — chỉ làm sáng, không đục màu
  }

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

const SCALAR_UNIFORMS = [
  "u_image", "u_curveLUT", "u_texel", "u_split", "u_temp", "u_tint", "u_exposure", "u_contrast",
  "u_highlights", "u_shadows", "u_whites", "u_blacks", "u_texture", "u_clarity", "u_dehaze",
  "u_vibrance", "u_saturation", "u_vignette", "u_grain",
  "u_sharpen", "u_noiseReduction", "u_colorNoiseReduction", "u_bloomIntensity", "u_fadeAmount",
  "u_splitShadowHue", "u_splitShadowSat", "u_splitMidtoneHue", "u_splitMidtoneSat",
  "u_splitHighlightHue", "u_splitHighlightSat", "u_splitBalance", "u_splitBlend",
] as const;

/** Thứ tự PHẢI khớp HSL_COLORS trong apps/web/lib/adjustments.ts */
const HSL_ORDER = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;

/** Giới hạn cạnh dài của ảnh proxy để preview mượt */
export const PROXY_MAX_EDGE = 2048;

export class DevelopRenderer {
  private gl: WebGLRenderingContext;
  private loc = {} as Record<(typeof SCALAR_UNIFORMS)[number], WebGLUniformLocation | null>;
  private locHsl: (WebGLUniformLocation | null)[] = [];
  private tex: WebGLTexture | null = null;
  private curveTex: WebGLTexture;
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

    for (const u of SCALAR_UNIFORMS) this.loc[u] = gl.getUniformLocation(prog, u);
    for (let i = 0; i < 8; i++) this.locHsl.push(gl.getUniformLocation(prog, `u_hsl[${i}]`));

    // Texture LUT đường cong — khởi tạo identity để shader luôn có texture hợp lệ để sample
    this.curveTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.uploadIdentityCurve();
  }

  private uploadIdentityCurve() {
    const gl = this.gl;
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      data[i * 4] = i; data[i * 4 + 1] = i; data[i * 4 + 2] = i; data[i * 4 + 3] = i;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  /** Dựng lại texture LUT 256x1 từ 4 đường cong (master + R/G/B) — chỉ gọi khi curves thay đổi. */
  setCurves(curves: Adjustments["curves"]) {
    const master = buildLUT(curves.rgb);
    const r = buildLUT(curves.r);
    const g = buildLUT(curves.g);
    const b = buildLUT(curves.b);
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      data[i * 4] = master[i]; data[i * 4 + 1] = r[i]; data[i * 4 + 2] = g[i]; data[i * 4 + 3] = b[i];
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  /** `img` có thể là ảnh gốc, hoặc canvas đã xoay/cắt (xem lib/crop.ts buildWorkingCanvas). */
  setImage(img: HTMLImageElement | HTMLCanvasElement) {
    const gl = this.gl;
    const srcW = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
    const srcH = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
    const scale = Math.min(1, PROXY_MAX_EDGE / Math.max(srcW, srcH));
    this.width = Math.round(srcW * scale);
    this.height = Math.round(srcH * scale);

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
    gl.activeTexture(gl.TEXTURE0);
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

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(l.u_image, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.uniform1i(l.u_curveLUT, 1);

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
    gl.uniform1f(l.u_texture, a.texture / 100);
    gl.uniform1f(l.u_clarity, a.clarity / 100);
    gl.uniform1f(l.u_dehaze, a.dehaze / 100);
    gl.uniform1f(l.u_vibrance, a.vibrance / 100);
    gl.uniform1f(l.u_saturation, a.saturation / 100);
    gl.uniform1f(l.u_vignette, a.vignette / 100);
    gl.uniform1f(l.u_grain, a.grain / 100);
    gl.uniform1f(l.u_sharpen, a.sharpen / 100);
    gl.uniform1f(l.u_noiseReduction, a.noiseReduction / 100);
    gl.uniform1f(l.u_colorNoiseReduction, a.colorNoiseReduction / 100);
    gl.uniform1f(l.u_bloomIntensity, a.bloomIntensity / 100);
    gl.uniform1f(l.u_fadeAmount, a.fadeAmount / 100);

    gl.uniform1f(l.u_splitShadowHue, a.splitShadowHue / 360);
    gl.uniform1f(l.u_splitShadowSat, a.splitShadowSat / 100);
    gl.uniform1f(l.u_splitMidtoneHue, a.splitMidtoneHue / 360);
    gl.uniform1f(l.u_splitMidtoneSat, a.splitMidtoneSat / 100);
    gl.uniform1f(l.u_splitHighlightHue, a.splitHighlightHue / 360);
    gl.uniform1f(l.u_splitHighlightSat, a.splitHighlightSat / 100);
    gl.uniform1f(l.u_splitBalance, a.splitBalance / 100);
    gl.uniform1f(l.u_splitBlend, a.splitBlend / 100);

    HSL_ORDER.forEach((color, i) => {
      const cap = color[0].toUpperCase() + color.slice(1);
      const hue = (a as unknown as Record<string, number>)[`hsl${cap}Hue`] / 100;
      const sat = (a as unknown as Record<string, number>)[`hsl${cap}Sat`] / 100;
      const lum = (a as unknown as Record<string, number>)[`hsl${cap}Lum`] / 100;
      gl.uniform3f(this.locHsl[i], hue, sat, lum);
    });

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
