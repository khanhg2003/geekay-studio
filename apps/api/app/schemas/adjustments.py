from pydantic import BaseModel, Field

# Hợp đồng thông số dùng chung — PHẢI khớp packages/shared/adjustments.schema.json
# và apps/web/lib/adjustments.ts (ADJUSTMENT_GROUPS).

ADJUSTMENT_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (-100, 100),
    "tint": (-100, 100),
    "exposure": (-5, 5),
    "contrast": (-100, 100),
    "highlights": (-100, 100),
    "shadows": (-100, 100),
    "whites": (-100, 100),
    "blacks": (-100, 100),
    "clarity": (-100, 100),
    "vibrance": (-100, 100),
    "saturation": (-100, 100),
    "vignette": (-100, 100),
    "grain": (0, 100),
}


class Adjustments(BaseModel):
    temperature: float = Field(0, ge=-100, le=100)
    tint: float = Field(0, ge=-100, le=100)
    exposure: float = Field(0, ge=-5, le=5)
    contrast: float = Field(0, ge=-100, le=100)
    highlights: float = Field(0, ge=-100, le=100)
    shadows: float = Field(0, ge=-100, le=100)
    whites: float = Field(0, ge=-100, le=100)
    blacks: float = Field(0, ge=-100, le=100)
    clarity: float = Field(0, ge=-100, le=100)
    vibrance: float = Field(0, ge=-100, le=100)
    saturation: float = Field(0, ge=-100, le=100)
    vignette: float = Field(0, ge=-100, le=100)
    grain: float = Field(0, ge=0, le=100)


def clamp_partial_adjustments(partial: dict) -> dict[str, float]:
    """Lọc + kẹp giá trị về đúng khoảng hợp lệ, bỏ key không hợp lệ (dùng cho output của AI)."""
    out: dict[str, float] = {}
    for key, value in partial.items():
        bounds = ADJUSTMENT_BOUNDS.get(key)
        if bounds is None or not isinstance(value, (int, float)):
            continue
        lo, hi = bounds
        out[key] = float(min(hi, max(lo, value)))
    return out
