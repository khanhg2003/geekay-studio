export interface CurvePoint {
  x: number; // 0–255
  y: number; // 0–255
}
export type CurveChannel = "rgb" | "r" | "g" | "b";
export interface Curves {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
}

export const IDENTITY_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export const DEFAULT_CURVES: Curves = {
  rgb: [...IDENTITY_CURVE],
  r: [...IDENTITY_CURVE],
  g: [...IDENTITY_CURVE],
  b: [...IDENTITY_CURVE],
};

/**
 * Nội suy Hermite bậc 3 đơn điệu (thuật toán Fritsch–Carlson / kiểu PCHIP) — không bị "overshoot"
 * (vọt lố) giữa các điểm như Catmull-Rom thường, tránh tạo vùng tối/sáng ảo không mong muốn trên
 * đường cong tông màu. PHẢI khớp triển khai Python ở services/imaging/curve.py.
 */
function monotonicTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] <= 0) !== (d[i] <= 0) || d[i - 1] === 0 || d[i] === 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

function hermite(x: number, x0: number, x1: number, y0: number, y1: number, m0: number, m1: number): number {
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
}

export function evalCurve(points: CurvePoint[], x: number): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) return x;
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);
  const m = monotonicTangents(xs, ys);
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) return hermite(x, xs[i], xs[i + 1], ys[i], ys[i + 1], m[i], m[i + 1]);
  }
  return x;
}

export function buildLUT(points: CurvePoint[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(evalCurve(points, i));
  return lut;
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  if (points.length !== 2) return false;
  const [a, b] = [...points].sort((p, q) => p.x - q.x);
  return a.x === 0 && a.y === 0 && b.x === 255 && b.y === 255;
}

export function isDefaultCurves(c: Curves): boolean {
  return isIdentityCurve(c.rgb) && isIdentityCurve(c.r) && isIdentityCurve(c.g) && isIdentityCurve(c.b);
}

function sanitizeCurvePoints(points: CurvePoint[] | undefined): CurvePoint[] {
  if (!Array.isArray(points) || points.length < 2) return [...IDENTITY_CURVE];
  return points.map((p) => ({
    x: Math.min(255, Math.max(0, Math.round(p.x))),
    y: Math.min(255, Math.max(0, Math.round(p.y))),
  }));
}

/** Kẹp/chuẩn hoá dữ liệu curve đến từ nguồn không tin cậy (preset, AI...) trước khi đưa vào state. */
export function sanitizeCurves(c: Partial<Curves> | undefined): Curves {
  return {
    rgb: sanitizeCurvePoints(c?.rgb),
    r: sanitizeCurvePoints(c?.r),
    g: sanitizeCurvePoints(c?.g),
    b: sanitizeCurvePoints(c?.b),
  };
}
