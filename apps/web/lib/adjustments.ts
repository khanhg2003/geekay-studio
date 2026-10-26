import { DEFAULT_CURVES, isDefaultCurves, sanitizeCurves, type Curves } from "./curve";

export const HSL_COLORS = [
  { key: "red", label: "Đỏ", swatch: "#e5484d" },
  { key: "orange", label: "Cam", swatch: "#f76b15" },
  { key: "yellow", label: "Vàng", swatch: "#f5d90a" },
  { key: "green", label: "Lục", swatch: "#46a758" },
  { key: "aqua", label: "Ngọc lam", swatch: "#12a594" },
  { key: "blue", label: "Lam", swatch: "#0091ff" },
  { key: "purple", label: "Tím", swatch: "#8e4ec6" },
  { key: "magenta", label: "Hồng cánh sen", swatch: "#d6409f" },
] as const;

export type HslColorKey = (typeof HSL_COLORS)[number]["key"];
export type HslChannel = "Hue" | "Sat" | "Lum";
export type HslKey = `hsl${Capitalize<HslColorKey>}${HslChannel}`;

const cap = (s: string) => (s[0].toUpperCase() + s.slice(1)) as string;
export const hslKey = (color: HslColorKey, ch: HslChannel): HslKey => `hsl${cap(color)}${ch}` as HslKey;

export type AdjustmentKey =
  | "temperature" | "tint"
  | "exposure" | "contrast" | "highlights" | "shadows" | "whites" | "blacks"
  | "texture" | "clarity" | "dehaze" | "vibrance" | "saturation"
  | "sharpen" | "noiseReduction" | "colorNoiseReduction"
  | "bloomIntensity" | "fadeAmount"
  | HslKey
  | "splitShadowHue" | "splitShadowSat" | "splitMidtoneHue" | "splitMidtoneSat"
  | "splitHighlightHue" | "splitHighlightSat" | "splitBalance" | "splitBlend"
  | "vignette" | "grain";

export type Adjustments = Record<AdjustmentKey, number> & { curves: Curves };

export interface AdjustmentSpec {
  key: AdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Số chữ số thập phân khi hiển thị */
  precision?: number;
  /** Track màu (WB) */
  track?: string;
}

export interface AdjustmentGroup {
  id: string;
  label: string;
  items: AdjustmentSpec[];
}

export const ADJUSTMENT_GROUPS: AdjustmentGroup[] = [
  {
    id: "wb",
    label: "Cân bằng trắng",
    items: [
      { key: "temperature", label: "Nhiệt độ", min: -100, max: 100, step: 1,
        track: "linear-gradient(90deg,#3b6fb6,#8a8a8a,#d8a443)" },
      { key: "tint", label: "Sắc độ", min: -100, max: 100, step: 1,
        track: "linear-gradient(90deg,#4f9a5a,#8a8a8a,#b45aa8)" },
    ],
  },
  {
    id: "light",
    label: "Ánh sáng",
    items: [
      { key: "exposure", label: "Phơi sáng", min: -5, max: 5, step: 0.01, precision: 2 },
      { key: "contrast", label: "Tương phản", min: -100, max: 100, step: 1 },
      { key: "highlights", label: "Vùng sáng", min: -100, max: 100, step: 1 },
      { key: "shadows", label: "Vùng tối", min: -100, max: 100, step: 1 },
      { key: "whites", label: "Điểm trắng", min: -100, max: 100, step: 1 },
      { key: "blacks", label: "Điểm đen", min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: "presence",
    label: "Chi tiết & Màu sắc",
    items: [
      { key: "texture", label: "Kết cấu", min: -100, max: 100, step: 1 },
      { key: "clarity", label: "Độ rõ nét", min: -100, max: 100, step: 1 },
      { key: "dehaze", label: "Khử sương mù", min: -100, max: 100, step: 1 },
      { key: "vibrance", label: "Độ rực", min: -100, max: 100, step: 1 },
      { key: "saturation", label: "Bão hoà", min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: "detail",
    label: "Chi tiết",
    items: [
      { key: "sharpen", label: "Độ sắc nét", min: 0, max: 100, step: 1 },
      { key: "noiseReduction", label: "Giảm nhiễu hạt", min: 0, max: 100, step: 1 },
      { key: "colorNoiseReduction", label: "Giảm nhiễu màu", min: 0, max: 100, step: 1 },
    ],
  },
  {
    id: "effects",
    label: "Hiệu ứng",
    items: [
      { key: "bloomIntensity", label: "Phát sáng (Bloom)", min: 0, max: 100, step: 1 },
      { key: "fadeAmount", label: "Phai màu (Fade)", min: 0, max: 100, step: 1 },
      { key: "vignette", label: "Làm tối viền", min: -100, max: 100, step: 1 },
      { key: "grain", label: "Hạt film", min: 0, max: 100, step: 1 },
    ],
  },
];

/** Dùng cho panel HSL riêng (không nằm trong ADJUSTMENT_GROUPS vì cần UI chọn dải màu). */
export const HSL_SPECS: AdjustmentSpec[] = HSL_COLORS.flatMap(({ key, label }) => [
  { key: hslKey(key, "Hue"), label: `${label} · Tông`, min: -100, max: 100, step: 1 },
  { key: hslKey(key, "Sat"), label: `${label} · Bão hoà`, min: -100, max: 100, step: 1 },
  { key: hslKey(key, "Lum"), label: `${label} · Độ sáng`, min: -100, max: 100, step: 1 },
]);

/** Dùng cho panel Color Grading riêng (3 vòng tròn chọn màu, không phải slider đơn thuần). */
export const SPLIT_TONE_SPECS: AdjustmentSpec[] = [
  { key: "splitShadowHue", label: "Tông vùng tối", min: 0, max: 360, step: 1 },
  { key: "splitShadowSat", label: "Bão hoà vùng tối", min: 0, max: 100, step: 1 },
  { key: "splitMidtoneHue", label: "Tông vùng trung tính", min: 0, max: 360, step: 1 },
  { key: "splitMidtoneSat", label: "Bão hoà vùng trung tính", min: 0, max: 100, step: 1 },
  { key: "splitHighlightHue", label: "Tông vùng sáng", min: 0, max: 360, step: 1 },
  { key: "splitHighlightSat", label: "Bão hoà vùng sáng", min: 0, max: 100, step: 1 },
  { key: "splitBalance", label: "Cân bằng", min: -100, max: 100, step: 1 },
  { key: "splitBlend", label: "Kết hợp", min: 0, max: 100, step: 1 },
];

const HSL_DEFAULTS = Object.fromEntries(HSL_SPECS.map((s) => [s.key, 0])) as Record<HslKey, number>;

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  temperature: 0, tint: 0,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  texture: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0,
  sharpen: 0, noiseReduction: 0, colorNoiseReduction: 0,
  bloomIntensity: 0, fadeAmount: 0,
  ...HSL_DEFAULTS,
  splitShadowHue: 0, splitShadowSat: 0, splitMidtoneHue: 0, splitMidtoneSat: 0,
  splitHighlightHue: 0, splitHighlightSat: 0, splitBalance: 0, splitBlend: 0,
  vignette: 0, grain: 0,
  curves: { ...DEFAULT_CURVES, rgb: [...DEFAULT_CURVES.rgb], r: [...DEFAULT_CURVES.r], g: [...DEFAULT_CURVES.g], b: [...DEFAULT_CURVES.b] },
};

/** Danh sách đầy đủ các khoá số (không gồm "curves") — dùng để lặp/so sánh an toàn thay vì Object.keys. */
export const ADJUSTMENT_KEYS: AdjustmentKey[] = [
  ...ADJUSTMENT_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
  ...HSL_SPECS.map((s) => s.key),
  ...SPLIT_TONE_SPECS.map((s) => s.key),
];

export const SPEC_BY_KEY = Object.fromEntries(
  [...ADJUSTMENT_GROUPS.flatMap((g) => g.items), ...HSL_SPECS, ...SPLIT_TONE_SPECS].map((s) => [s.key, s]),
) as Record<AdjustmentKey, AdjustmentSpec>;

export function clampAdjustments(partial: Partial<Adjustments>): Partial<Adjustments> {
  const out: Partial<Adjustments> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (k === "curves") {
      out.curves = sanitizeCurves(v as Curves);
      continue;
    }
    const spec = SPEC_BY_KEY[k as AdjustmentKey];
    if (!spec || typeof v !== "number" || Number.isNaN(v)) continue;
    out[k as AdjustmentKey] = Math.min(spec.max, Math.max(spec.min, v));
  }
  return out;
}

export function formatValue(key: AdjustmentKey, v: number): string {
  const p = SPEC_BY_KEY[key].precision ?? 0;
  const s = v.toFixed(p);
  return v > 0 ? `+${s}` : s === (-0).toFixed(p) ? (0).toFixed(p) : s;
}

export function isDefault(a: Adjustments) {
  return ADJUSTMENT_KEYS.every((k) => a[k] === DEFAULT_ADJUSTMENTS[k]) && isDefaultCurves(a.curves);
}
