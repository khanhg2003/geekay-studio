import numpy as np

# PHẢI khớp thuật toán với apps/web/lib/curve.ts (Hermite bậc 3 đơn điệu kiểu Fritsch–Carlson)
# để preview (GPU) và ảnh xuất full-res (CPU) cho cùng một kết quả tông màu.


def _monotonic_tangents(xs: list[float], ys: list[float]) -> list[float]:
    n = len(xs)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]

    m = [0.0] * n
    m[0] = d[0]
    m[-1] = d[-1]
    for i in range(1, n - 1):
        if (d[i - 1] <= 0) != (d[i] <= 0) or d[i - 1] == 0 or d[i] == 0:
            m[i] = 0.0
        else:
            m[i] = (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = 0.0
            m[i + 1] = 0.0
            continue
        a = m[i] / d[i]
        b = m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            t = 3 / np.sqrt(s)
            m[i] = t * a * d[i]
            m[i + 1] = t * b * d[i]
    return m


def _hermite(x: float, x0: float, x1: float, y0: float, y1: float, m0: float, m1: float) -> float:
    h = x1 - x0
    t = (x - x0) / h
    t2 = t * t
    t3 = t2 * t
    h00 = 2 * t3 - 3 * t2 + 1
    h10 = t3 - 2 * t2 + t
    h01 = -2 * t3 + 3 * t2
    h11 = t3 - t2
    return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1


def build_lut(points: list[dict]) -> np.ndarray:
    """points: [{"x":0-255,"y":0-255}, ...] -> float32[256] trong [0,255]."""
    pts = sorted(points, key=lambda p: p["x"])
    xs = [float(p["x"]) for p in pts]
    ys = [float(p["y"]) for p in pts]
    lut = np.empty(256, dtype=np.float32)
    if len(xs) < 2:
        return np.arange(256, dtype=np.float32)

    m = _monotonic_tangents(xs, ys)
    seg = 0
    for i in range(256):
        x = float(i)
        if x <= xs[0]:
            lut[i] = ys[0]
            continue
        if x >= xs[-1]:
            lut[i] = ys[-1]
            continue
        while seg < len(xs) - 2 and x > xs[seg + 1]:
            seg += 1
        lut[i] = _hermite(x, xs[seg], xs[seg + 1], ys[seg], ys[seg + 1], m[seg], m[seg + 1])
    return np.clip(lut, 0.0, 255.0)


def is_identity_points(points: list[dict]) -> bool:
    if len(points) != 2:
        return False
    pts = sorted(points, key=lambda p: p["x"])
    return pts[0]["x"] == 0 and pts[0]["y"] == 0 and pts[1]["x"] == 255 and pts[1]["y"] == 255
