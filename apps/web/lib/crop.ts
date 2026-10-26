/** Crop rect chuẩn hoá 0..1, tương đối với khung ảnh ĐÃ XOAY (rotation) của ảnh gốc. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AspectOption {
  id: string;
  label: string;
  /** null = Tự do (không khoá tỉ lệ); undefined-width/height = Gốc ảnh (theo đúng ảnh) */
  ratio: number | null;
}

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: "original", label: "Gốc ảnh", ratio: null },
  { id: "free", label: "Tự do", ratio: 0 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "5:4", label: "5:4", ratio: 5 / 4 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

/** Rect lớn nhất, canh giữa, đúng tỉ lệ `ratio` (w/h), nằm trong khung chuẩn hoá 0..1 x 0..1. */
export function centeredRectForRatio(ratio: number, boxW: number, boxH: number): CropRect {
  const boxRatio = boxW / boxH;
  let w: number, h: number;
  if (ratio >= boxRatio) {
    w = boxW;
    h = w / ratio;
  } else {
    h = boxH;
    w = h * ratio;
  }
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function isFullCrop(c: CropRect | null): boolean {
  if (!c) return true;
  return c.x < 1e-4 && c.y < 1e-4 && c.w > 0.9999 && c.h > 0.9999;
}

export function clampCropRect(c: CropRect): CropRect {
  const w = Math.min(1, Math.max(0.02, c.w));
  const h = Math.min(1, Math.max(0.02, c.h));
  const x = Math.min(1 - w, Math.max(0, c.x));
  const y = Math.min(1 - h, Math.max(0, c.y));
  return { x, y, w, h };
}

/**
 * Dựng canvas làm việc: xoay ảnh gốc theo `rotationDeg` (dương = thuận chiều kim đồng hồ, khớp quy
 * ước backend ở services/imaging/crop_transform.py), rồi cắt theo `crop` (chuẩn hoá 0..1 tương đối
 * với khung ảnh ĐÃ XOAY). Trả về canvas đã xoay (chưa cắt) nếu crop null/toàn khung.
 */
export function buildWorkingCanvas(img: HTMLImageElement, rotationDeg: number, crop: CropRect | null): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotW = Math.max(1, Math.round(w * cos + h * sin));
  const rotH = Math.max(1, Math.round(w * sin + h * cos));

  const rotated = document.createElement("canvas");
  rotated.width = rotW;
  rotated.height = rotH;
  const rctx = rotated.getContext("2d")!;
  rctx.imageSmoothingQuality = "high";
  rctx.translate(rotW / 2, rotH / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -w / 2, -h / 2);

  if (!crop || isFullCrop(crop)) return rotated;

  const sx = Math.round(crop.x * rotW);
  const sy = Math.round(crop.y * rotH);
  const sw = Math.max(1, Math.round(crop.w * rotW));
  const sh = Math.max(1, Math.round(crop.h * rotH));
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d")!.drawImage(rotated, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}
