import type { Adjustments } from "./adjustments";
import type { CurvePoint } from "./curve";

export interface Preset {
  id: string;
  name: string;
  category: string;
  adjustments: Partial<Adjustments>;
}

const IDENTITY: CurvePoint[] = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
/** Helper dựng nhanh field "curves" cho preset — chỉ cần truyền đường cong RGB tổng, các kênh còn lại giữ mặc định. */
const rgbCurve = (points: CurvePoint[]): Adjustments["curves"] => ({
  rgb: points, r: [...IDENTITY], g: [...IDENTITY], b: [...IDENTITY],
});

export const SYSTEM_PRESETS: Preset[] = [
  { id: "film-portra", name: "Portra 400", category: "Film",
    adjustments: { temperature: 8, exposure: 0.2, contrast: -12, highlights: -25, shadows: 18, vibrance: 10, saturation: -8, grain: 18 } },
  { id: "film-gold", name: "Gold 200", category: "Film",
    adjustments: { temperature: 18, tint: 4, contrast: 8, highlights: -15, blacks: 10, vibrance: 15, grain: 22 } },
  { id: "film-cine", name: "Cine 800T", category: "Film",
    adjustments: { temperature: -22, tint: 6, contrast: 14, shadows: 10, blacks: -8, saturation: -10, vignette: -15, grain: 25 } },

  // --- Fuji Film Simulation — dựng từ HSL + Split Toning + Tone Curve, không chỉ WB/Tone đơn thuần
  { id: "fuji-velvia", name: "Fuji Velvia", category: "Fuji Film",
    adjustments: {
      contrast: 18, highlights: -15, shadows: 12, vibrance: 22, saturation: 8, clarity: 10,
      hslGreenSat: 22, hslGreenLum: -6, hslBlueSat: 25, hslBlueLum: -8, hslOrangeSat: 10,
      curves: rgbCurve([{ x: 0, y: 0 }, { x: 60, y: 48 }, { x: 190, y: 205 }, { x: 255, y: 255 }]),
    } },
  { id: "fuji-classic-chrome", name: "Fuji Classic Chrome", category: "Fuji Film",
    adjustments: {
      contrast: 12, saturation: -16, vibrance: -4, texture: 10, dehaze: 8,
      hslYellowSat: -18, hslOrangeSat: -12, hslGreenSat: -10,
      splitShadowHue: 100, splitShadowSat: 14, splitHighlightHue: 48, splitHighlightSat: 8, splitBalance: -5,
      curves: rgbCurve([{ x: 0, y: 18 }, { x: 128, y: 126 }, { x: 255, y: 244 }]),
    } },
  { id: "fuji-astia", name: "Fuji Astia (Mềm mại)", category: "Fuji Film",
    adjustments: {
      contrast: -8, highlights: -20, shadows: 16, vibrance: 12, saturation: -5,
      hslRedSat: -8, hslRedLum: 10, hslOrangeSat: -6, hslOrangeLum: 10,
      curves: rgbCurve([{ x: 0, y: 6 }, { x: 128, y: 132 }, { x: 255, y: 250 }]),
    } },
  { id: "fuji-provia", name: "Fuji Provia (Chuẩn)", category: "Fuji Film",
    adjustments: { contrast: 6, vibrance: 8, texture: 8 } },
  { id: "fuji-classic-neg", name: "Fuji Classic Neg — Điện ảnh", category: "Fuji Film",
    adjustments: {
      contrast: 10, saturation: -12, grain: 16,
      splitShadowHue: 195, splitShadowSat: 25, splitHighlightHue: 42, splitHighlightSat: 16, splitBalance: -10,
      curves: rgbCurve([{ x: 0, y: 20 }, { x: 128, y: 124 }, { x: 255, y: 248 }]),
    } },

  // --- Xu hướng
  { id: "trend-korean-glow", name: "Nắng ấm Hàn Quốc", category: "Xu hướng",
    adjustments: {
      temperature: 12, exposure: 0.2, highlights: -15, shadows: 20, vibrance: 8, saturation: -6,
      hslRedSat: -8, hslRedLum: 12, hslOrangeSat: -5, hslOrangeLum: 10, hslYellowLum: 6,
      vignette: -8, grain: 8,
      curves: rgbCurve([{ x: 0, y: 10 }, { x: 128, y: 134 }, { x: 255, y: 252 }]),
    } },
  { id: "trend-nostalgic", name: "Phim hoài niệm", category: "Xu hướng",
    adjustments: {
      contrast: -10, saturation: -10, highlights: -10, grain: 22,
      splitShadowHue: 220, splitShadowSat: 10, splitHighlightHue: 50, splitHighlightSat: 10,
      curves: rgbCurve([{ x: 0, y: 22 }, { x: 255, y: 238 }]),
    } },
  { id: "trend-moonlight", name: "Bạch Nguyệt Quang", category: "Xu hướng",
    adjustments: {
      contrast: -25, highlights: -10, shadows: 15, saturation: -8,
      bloomIntensity: 40, fadeAmount: 15,
      hslOrangeLum: 10, hslOrangeSat: -6,
      splitShadowHue: 210, splitShadowSat: 10, splitHighlightHue: 45, splitHighlightSat: 8,
    } },

  { id: "bw-classic", name: "Đen trắng cổ điển", category: "Đen trắng",
    adjustments: { saturation: -100, contrast: 20, clarity: 15, blacks: -10, grain: 15 } },
  { id: "bw-soft", name: "Đen trắng mềm", category: "Đen trắng",
    adjustments: { saturation: -100, contrast: -15, highlights: -20, shadows: 25, whites: -10 } },
  { id: "pt-clean", name: "Chân dung sáng", category: "Chân dung",
    adjustments: { exposure: 0.35, contrast: -6, highlights: -30, shadows: 20, clarity: -10, vibrance: 8 } },
  { id: "pt-moody", name: "Chân dung trầm", category: "Chân dung",
    adjustments: { exposure: -0.25, contrast: 18, highlights: -35, blacks: -15, saturation: -18, vignette: -25 } },
  { id: "ls-vivid", name: "Phong cảnh rực", category: "Phong cảnh",
    adjustments: { contrast: 15, highlights: -40, shadows: 30, clarity: 25, vibrance: 30 } },
  { id: "ls-matte", name: "Matte", category: "Phong cảnh",
    adjustments: { contrast: -20, blacks: 30, whites: -15, saturation: -12, temperature: 5 } },
];
