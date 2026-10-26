import type { Adjustments } from "./adjustments";

export interface Preset {
  id: string;
  name: string;
  category: string;
  adjustments: Partial<Adjustments>;
}

export const SYSTEM_PRESETS: Preset[] = [
  { id: "film-portra", name: "Portra 400", category: "Film",
    adjustments: { temperature: 8, exposure: 0.2, contrast: -12, highlights: -25, shadows: 18, vibrance: 10, saturation: -8, grain: 18 } },
  { id: "film-gold", name: "Gold 200", category: "Film",
    adjustments: { temperature: 18, tint: 4, contrast: 8, highlights: -15, blacks: 10, vibrance: 15, grain: 22 } },
  { id: "film-cine", name: "Cine 800T", category: "Film",
    adjustments: { temperature: -22, tint: 6, contrast: 14, shadows: 10, blacks: -8, saturation: -10, vignette: -15, grain: 25 } },
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
