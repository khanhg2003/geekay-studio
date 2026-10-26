import cv2
import numpy as np

from app.schemas.adjustments import Adjustments
from app.services.imaging.curve import build_lut

# Thứ tự bước PHẢI khớp với shader GPU ở apps/web/components/editor/Canvas/webgl/renderer.ts:
# Noise Reduction → WB → Exposure → Highlights/Shadows → Whites/Blacks → Fade → Tone Curve →
# Contrast → Texture → Clarity → Dehaze → HSL (8 dải màu) → Vibrance/Saturation →
# Color Grading (3 vùng) → Sharpen → Bloom → Vignette → Grain
#
# Đây là bản develop ảnh full-resolution dùng cho xuất file; preview trên canvas dùng ảnh proxy
# (cạnh dài tối đa PROXY_MAX_EDGE) để mượt khi kéo thanh trượt, nên hai ảnh có thể lệch vài giá trị
# pixel ở các phép toán phụ thuộc bán kính lấy mẫu — chấp nhận được vì mục tiêu là nhất quán về
# *thứ tự & công thức*, không phải khớp pixel-for-pixel giữa CPU/GPU. Công thức rgb2hsv/hsv2rgb/LUT
# đường cong đã được đối chiếu số học trực tiếp với bản GLSL (xem lịch sử audit), cho kết quả khớp
# tới sai số làm tròn float32.

LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# Bán kính lấy mẫu "clarity"/"texture" được định nghĩa tương đối với ảnh proxy preview.
# Ta giữ đúng tỉ lệ đó khi chạy trên ảnh full-res để hiệu ứng trông giống preview.
CLARITY_REF_EDGE = 2048
CLARITY_REF_RADIUS = 6
TEXTURE_REF_RADIUS = 2
NOISE_REF_RADIUS = 1.5
SHARPEN_REF_RADIUS = 1
BLOOM_REF_RADIUS = 8

# Thứ tự PHẢI khớp HSL_ORDER trong renderer.ts / HSL_COLORS trong apps/web/lib/adjustments.ts
HSL_BANDS = [
    ("Red", 0.0), ("Orange", 30.0), ("Yellow", 60.0), ("Green", 120.0),
    ("Aqua", 180.0), ("Blue", 220.0), ("Purple", 272.0), ("Magenta", 322.0),
]


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _luma(c: np.ndarray) -> np.ndarray:
    return c @ LUMA


def _rgb2hsv(c: np.ndarray) -> np.ndarray:
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    maxc = np.max(c, axis=-1)
    minc = np.min(c, axis=-1)
    v = maxc
    d = maxc - minc
    s = np.where(maxc > 1e-10, d / np.maximum(maxc, 1e-10), 0.0)
    dd = np.maximum(d, 1e-10)
    rc, gc, bc = (maxc - r) / dd, (maxc - g) / dd, (maxc - b) / dd
    h = np.zeros_like(v)
    h = np.where(maxc == r, bc - gc, h)
    h = np.where((maxc == g) & (maxc != r), 2.0 + rc - bc, h)
    h = np.where((maxc == b) & (maxc != r) & (maxc != g), 4.0 + gc - rc, h)
    h = np.where(d > 1e-10, (h / 6.0) % 1.0, 0.0)
    return np.stack([h, s, v], axis=-1)


def _hsv2rgb(c: np.ndarray) -> np.ndarray:
    h, s, v = c[..., 0], c[..., 1], c[..., 2]
    k = np.array([1.0, 2.0 / 3.0, 1.0 / 3.0], dtype=np.float32)
    hh = h[..., None] + k
    frac = hh - np.floor(hh)
    p = np.abs(frac * 6.0 - 3.0)
    ones = np.ones_like(p)
    return (ones * (1.0 - s[..., None]) + np.clip(p - 1.0, 0.0, 1.0) * s[..., None]) * v[..., None]


def _hue_band_weight(hue_deg: np.ndarray, center_deg: float) -> np.ndarray:
    d = np.abs(hue_deg - center_deg)
    d = np.minimum(d, 360.0 - d)
    return np.maximum(0.0, np.cos(np.radians(d))) ** 3


def _apply_hsl(c: np.ndarray, a: Adjustments) -> np.ndarray:
    hsv = _rgb2hsv(np.clip(c, 0.0, 1.0))
    hue_deg = hsv[..., 0] * 360.0
    total_hue = np.zeros_like(hue_deg)
    total_sat = np.zeros_like(hue_deg)
    total_lum = np.zeros_like(hue_deg)
    for name, center in HSL_BANDS:
        w = _hue_band_weight(hue_deg, center)
        total_hue += w * (getattr(a, f"hsl{name}Hue") / 100.0)
        total_sat += w * (getattr(a, f"hsl{name}Sat") / 100.0)
        total_lum += w * (getattr(a, f"hsl{name}Lum") / 100.0)

    h = hsv[..., 0] + total_hue * (30.0 / 360.0)
    h = h - np.floor(h)
    s = np.clip(hsv[..., 1] * (1.0 + total_sat), 0.0, 1.0)
    v = np.clip(hsv[..., 2] + total_lum * 0.3, 0.0, 1.0)
    return _hsv2rgb(np.stack([h, s, v], axis=-1))


def _tri_weight(l: np.ndarray, center: float, width: float) -> np.ndarray:
    return np.maximum(0.0, 1.0 - np.abs(l - center) / width)


def _apply_split_tone(c: np.ndarray, a: Adjustments) -> np.ndarray:
    """Color Grading 3 vùng (tối/trung tính/sáng) — PHẢI khớp applySplitTone trong renderer.ts."""
    shadow_sat = a.splitShadowSat / 100.0
    midtone_sat = a.splitMidtoneSat / 100.0
    highlight_sat = a.splitHighlightSat / 100.0
    if shadow_sat < 1e-4 and midtone_sat < 1e-4 and highlight_sat < 1e-4:
        return c

    lum = _luma(c)
    width = 0.15 + (a.splitBlend / 100.0) * 0.45
    shift = (a.splitBalance / 100.0) * 0.2
    w_sh = _tri_weight(lum - shift, 0.0, width)
    w_hi = _tri_weight(lum - shift, 1.0, width)
    w_mid = _tri_weight(lum, 0.5, width)
    total = w_sh + w_hi + w_mid + 1e-5
    w_sh, w_hi, w_mid = (w_sh / total)[..., None], (w_hi / total)[..., None], (w_mid / total)[..., None]

    sh_tint = _hsv2rgb(np.array([a.splitShadowHue / 360.0, 1.0, 1.0], dtype=np.float32))
    mid_tint = _hsv2rgb(np.array([a.splitMidtoneHue / 360.0, 1.0, 1.0], dtype=np.float32))
    hi_tint = _hsv2rgb(np.array([a.splitHighlightHue / 360.0, 1.0, 1.0], dtype=np.float32))

    c = c + (c * sh_tint * 2.0 - c) * (w_sh * shadow_sat)
    c = c + (c * mid_tint * 2.0 - c) * (w_mid * midtone_sat)
    c = c + (c * hi_tint * 2.0 - c) * (w_hi * highlight_sat)
    return c


def _apply_curve_channel(channel: np.ndarray, points) -> np.ndarray:
    lut = build_lut([{"x": p.x, "y": p.y} for p in points])
    idx = np.clip(np.round(channel * 255.0), 0, 255).astype(np.int32)
    return lut[idx] / 255.0


def _apply_curves(c: np.ndarray, a: Adjustments) -> np.ndarray:
    curves = a.curves
    m_r = _apply_curve_channel(c[..., 0], curves.rgb)
    m_g = _apply_curve_channel(c[..., 1], curves.rgb)
    m_b = _apply_curve_channel(c[..., 2], curves.rgb)
    r = _apply_curve_channel(m_r, curves.r)
    g = _apply_curve_channel(m_g, curves.g)
    b = _apply_curve_channel(m_b, curves.b)
    return np.stack([r, g, b], axis=-1)


def apply_develop(image: np.ndarray, a: Adjustments) -> np.ndarray:
    """
    image: float32 HxWx3, giá trị trong [0, 1], kênh RGB.
    Trả về: float32 HxWx3 trong [0, 1].
    """
    src = image
    c = image.astype(np.float32, copy=True)
    h, w = c.shape[:2]

    temp = a.temperature / 100.0
    tint = a.tint / 100.0
    exposure = a.exposure
    contrast = a.contrast / 100.0
    highlights = a.highlights / 100.0
    shadows = a.shadows / 100.0
    whites = a.whites / 100.0
    blacks = a.blacks / 100.0
    texture = a.texture / 100.0
    clarity = a.clarity / 100.0
    dehaze = a.dehaze / 100.0
    vibrance = a.vibrance / 100.0
    saturation = a.saturation / 100.0
    vignette = a.vignette / 100.0
    grain = a.grain / 100.0
    sharpen = a.sharpen / 100.0
    noise_reduction = a.noiseReduction / 100.0
    color_noise_reduction = a.colorNoiseReduction / 100.0
    bloom_intensity = a.bloomIntensity / 100.0
    fade_amount = a.fadeAmount / 100.0

    # --- Noise Reduction (áp trước cùng, trên dữ liệu gần-raw, giống pipeline máy ảnh thật)
    if noise_reduction > 0.001 or color_noise_reduction > 0.001:
        radius = max(1, round(NOISE_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur_n = cv2.blur(src, (ksize, ksize))
        if color_noise_reduction > 0.001:
            l_orig = _luma(c)[..., None]
            chroma_fixed = blur_n - _luma(blur_n)[..., None] + l_orig
            c = c + (chroma_fixed - c) * color_noise_reduction * 0.9
        if noise_reduction > 0.001:
            c = c + (blur_n - c) * noise_reduction * 0.55

    # --- Cân bằng trắng + Phơi sáng (không gian tuyến tính)
    lin = np.power(np.clip(c, 0.0, None), 2.2)
    wb = np.array([1.0 + temp * 0.25, 1.0 - tint * 0.18, 1.0 - temp * 0.25], dtype=np.float32)
    lin = lin * wb
    lin = lin * float(2.0**exposure)
    c = np.power(np.clip(lin, 0.0, None), 1.0 / 2.2)

    # --- Highlights / Shadows (mask theo độ sáng)
    l = _luma(c)
    h_mask = _smoothstep(0.45, 1.0, l)[..., None]
    s_mask = (1.0 - _smoothstep(0.0, 0.55, l))[..., None]
    c = c + c * highlights * 0.45 * h_mask
    if shadows > 0:
        c = c + (1.0 - c) * shadows * 0.35 * s_mask
    elif shadows < 0:
        c = c + c * shadows * 0.5 * s_mask

    # --- Whites / Blacks (levels)
    bp = -blacks * 0.12
    wp = 1.0 - whites * 0.18
    c = (c - bp) / max(wp - bp, 0.05)

    # --- Fade (nâng điểm đen + ép nhẹ điểm trắng — 1 núm cho AI Mentor điều khiển trực tiếp thay
    # vì phải chỉnh tay Tone Curve, PHẢI khớp renderer.ts)
    if fade_amount > 0.001:
        lift = fade_amount * 0.22
        compress = fade_amount * 0.12
        c = c * (1.0 - lift - compress) + lift

    # --- Tone Curve
    c = _apply_curves(np.clip(c, 0.0, 1.0), a)

    # --- Contrast (đường cong S quanh mid-grey)
    k = 1.0 + contrast * 1.2 if contrast >= 0 else 1.0 + contrast * 0.7
    c = (c - 0.5) * k + 0.5

    # --- Texture (chi tiết tần số cao, bán kính nhỏ hơn Clarity, không có midMask)
    if abs(texture) > 0.001:
        radius = max(1, round(TEXTURE_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur_t = cv2.blur(src, (ksize, ksize))
        detail_t = _luma(src - blur_t)[..., None]
        c = c + detail_t * texture * 1.6

    # --- Clarity (tương phản cục bộ so với ảnh gốc được làm mờ)
    if abs(clarity) > 0.001:
        radius = max(1, round(CLARITY_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur = cv2.blur(src, (ksize, ksize))
        detail = _luma(src - blur)[..., None]
        mid_mask = (1.0 - np.abs(l * 2.0 - 1.0))[..., None]
        c = c + detail * clarity * 2.2 * mid_mask

    # --- Dehaze (xấp xỉ: trừ/thêm lớp "sương mù" ước lượng rồi giãn lại dải tương phản)
    if abs(dehaze) > 0.001:
        haze = np.array([0.86, 0.88, 0.9], dtype=np.float32)
        if dehaze > 0:
            c = (c - haze * dehaze * 0.4) / max(1.0 - dehaze * 0.4, 0.2)
        else:
            c = c + (haze - c) * (-dehaze * 0.35)

    # --- HSL theo dải màu
    c = _apply_hsl(c, a)

    # --- Vibrance / Saturation
    g = _luma(c)[..., None]
    sat = c.max(axis=-1, keepdims=True) - c.min(axis=-1, keepdims=True)
    factor = 1.0 + vibrance * (1.0 - np.clip(sat, 0.0, 1.0)) * 1.1
    c = g + (c - g) * factor

    g2 = _luma(c)[..., None]
    c = g2 + (c - g2) * (1.0 + saturation)

    # --- Split Toning
    c = _apply_split_tone(np.clip(c, 0.0, 1.0), a)

    # --- Sharpen (unsharp mask nhẹ dựa trên chi tiết tần số cao của ảnh gốc)
    if abs(sharpen) > 0.001:
        radius = max(1, round(SHARPEN_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur_s = cv2.blur(src, (ksize, ksize))
        detail_s = _luma(src - blur_s)[..., None]
        c = c + detail_s * sharpen * 1.4

    # --- Bloom (phát sáng mềm quanh vùng ĐỦ SÁNG — chỉ kích hoạt khi luma vùng lân cận vượt 0.6,
    # nhờ đó nền tối/gai góc không bị ảnh hưởng mà không cần model phân vùng, PHẢI khớp renderer.ts)
    if bloom_intensity > 0.001:
        radius = max(1, round(BLOOM_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur_b = cv2.blur(src, (ksize, ksize))
        luma_b = _luma(blur_b)
        bright = np.clip((luma_b - 0.6) / 0.4, 0.0, 1.0)[..., None]
        glow = blur_b * bright
        c = 1.0 - (1.0 - c) * (1.0 - glow * bloom_intensity)

    # --- Vignette
    yy, xx = np.indices((h, w), dtype=np.float32)
    uvx = (xx + 0.5) / w
    uvy = (yy + 0.5) / h
    d = np.sqrt((uvx - 0.5) ** 2 + (uvy - 0.5) ** 2) * 1.41421356
    v = _smoothstep(0.35, 1.05, d)[..., None]
    if vignette < 0:
        c = c * (1.0 + vignette * v)
    else:
        t = vignette * v * 0.8
        c = c + t * (1.0 - c)

    # --- Grain
    if grain > 0.001:
        n = (np.random.default_rng().random((h, w), dtype=np.float32) - 0.5)[..., None]
        l_final = _luma(c)[..., None]
        c = c + n * grain * 0.14 * (1.0 - np.abs(l_final * 2.0 - 1.0) * 0.5)

    return np.clip(c, 0.0, 1.0)
