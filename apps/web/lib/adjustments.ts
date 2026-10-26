export type AdjustmentKey =
  | "temperature" | "tint"
  | "exposure" | "contrast" | "highlights" | "shadows" | "whites" | "blacks"
  | "clarity" | "vibrance" | "saturation"
  | "vignette" | "grain";

export type Adjustments = Record<AdjustmentKey, number>;

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  temperature: 0, tint: 0,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  clarity: 0, vibrance: 0, saturation: 0,
  vignette: 0, grain: 0,
};

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
    label: "Màu sắc",
    items: [
      { key: "clarity", label: "Độ rõ nét", min: -100, max: 100, step: 1 },
      { key: "vibrance", label: "Độ rực", min: -100, max: 100, step: 1 },
      { key: "saturation", label: "Bão hoà", min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: "effects",
    label: "Hiệu ứng",
    items: [
      { key: "vignette", label: "Làm tối viền", min: -100, max: 100, step: 1 },
      { key: "grain", label: "Hạt film", min: 0, max: 100, step: 1 },
    ],
  },
];

export const SPEC_BY_KEY = Object.fromEntries(
  ADJUSTMENT_GROUPS.flatMap((g) => g.items).map((s) => [s.key, s]),
) as Record<AdjustmentKey, AdjustmentSpec>;

export function clampAdjustments(partial: Partial<Adjustments>): Partial<Adjustments> {
  const out: Partial<Adjustments> = {};
  for (const [k, v] of Object.entries(partial)) {
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
  return (Object.keys(DEFAULT_ADJUSTMENTS) as AdjustmentKey[]).every((k) => a[k] === 0);
}
