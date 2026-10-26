import cv2
import numpy as np

from app.schemas.adjustments import Adjustments

# Thứ tự bước PHẢI khớp với shader GPU ở apps/web/components/editor/Canvas/webgl/renderer.ts:
# WB → Exposure → Highlights/Shadows → Whites/Blacks → Contrast → Clarity → Vibrance/Saturation → Vignette → Grain
#
# Đây là bản develop ảnh full-resolution dùng cho xuất file; preview trên canvas dùng ảnh proxy
# (cạnh dài tối đa PROXY_MAX_EDGE) để mượt khi kéo thanh trượt, nên hai ảnh có thể lệch vài giá trị
# pixel ở các phép toán phụ thuộc bán kính lấy mẫu (xem CLARITY_REF_EDGE bên dưới) — chấp nhận được
# vì mục tiêu là nhất quán về *thứ tự & công thức*, không phải khớp pixel-for-pixel giữa CPU/GPU.

LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# Bán kính lấy mẫu "clarity" (6 texel) được định nghĩa tương đối với ảnh proxy preview.
# Ta giữ đúng tỉ lệ đó khi chạy trên ảnh full-res để hiệu ứng trông giống preview.
CLARITY_REF_EDGE = 2048
CLARITY_REF_RADIUS = 6


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _luma(c: np.ndarray) -> np.ndarray:
    return c @ LUMA


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
    clarity = a.clarity / 100.0
    vibrance = a.vibrance / 100.0
    saturation = a.saturation / 100.0
    vignette = a.vignette / 100.0
    grain = a.grain / 100.0

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

    # --- Contrast (đường cong S quanh mid-grey)
    k = 1.0 + contrast * 1.2 if contrast >= 0 else 1.0 + contrast * 0.7
    c = (c - 0.5) * k + 0.5

    # --- Clarity (tương phản cục bộ so với ảnh gốc được làm mờ)
    if abs(clarity) > 0.001:
        radius = max(1, round(CLARITY_REF_RADIUS * max(w, h) / CLARITY_REF_EDGE))
        ksize = radius * 2 + 1
        blur = cv2.blur(src, (ksize, ksize))
        detail = _luma(src - blur)[..., None]
        mid_mask = (1.0 - np.abs(l * 2.0 - 1.0))[..., None]
        c = c + detail * clarity * 2.2 * mid_mask

    # --- Vibrance / Saturation
    g = _luma(c)[..., None]
    sat = c.max(axis=-1, keepdims=True) - c.min(axis=-1, keepdims=True)
    factor = 1.0 + vibrance * (1.0 - np.clip(sat, 0.0, 1.0)) * 1.1
    c = g + (c - g) * factor

    g2 = _luma(c)[..., None]
    c = g2 + (c - g2) * (1.0 + saturation)

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
