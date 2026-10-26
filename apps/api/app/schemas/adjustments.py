from pydantic import BaseModel, Field

# Hợp đồng thông số dùng chung — PHẢI khớp packages/shared/adjustments.schema.json
# và apps/web/lib/adjustments.ts (ADJUSTMENT_GROUPS, HSL_SPECS, SPLIT_TONE_SPECS).

HSL_COLORS = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"]
HSL_CHANNELS = ["Hue", "Sat", "Lum"]

ADJUSTMENT_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (-100, 100),
    "tint": (-100, 100),
    "exposure": (-5, 5),
    "contrast": (-100, 100),
    "highlights": (-100, 100),
    "shadows": (-100, 100),
    "whites": (-100, 100),
    "blacks": (-100, 100),
    "texture": (-100, 100),
    "clarity": (-100, 100),
    "dehaze": (-100, 100),
    "vibrance": (-100, 100),
    "saturation": (-100, 100),
    "sharpen": (0, 100),
    "noiseReduction": (0, 100),
    "colorNoiseReduction": (0, 100),
    "bloomIntensity": (0, 100),
    "fadeAmount": (0, 100),
    "splitShadowHue": (0, 360),
    "splitShadowSat": (0, 100),
    "splitMidtoneHue": (0, 360),
    "splitMidtoneSat": (0, 100),
    "splitHighlightHue": (0, 360),
    "splitHighlightSat": (0, 100),
    "splitBalance": (-100, 100),
    "splitBlend": (0, 100),
    "vignette": (-100, 100),
    "grain": (0, 100),
}
for _color in HSL_COLORS:
    for _ch in HSL_CHANNELS:
        ADJUSTMENT_BOUNDS[f"hsl{_color}{_ch}"] = (-100, 100)


class CurvePoint(BaseModel):
    x: float = Field(ge=0, le=255)
    y: float = Field(ge=0, le=255)


_IDENTITY_CURVE = [CurvePoint(x=0, y=0), CurvePoint(x=255, y=255)]


class Curves(BaseModel):
    rgb: list[CurvePoint] = Field(default_factory=lambda: list(_IDENTITY_CURVE))
    r: list[CurvePoint] = Field(default_factory=lambda: list(_IDENTITY_CURVE))
    g: list[CurvePoint] = Field(default_factory=lambda: list(_IDENTITY_CURVE))
    b: list[CurvePoint] = Field(default_factory=lambda: list(_IDENTITY_CURVE))


class Adjustments(BaseModel):
    temperature: float = Field(0, ge=-100, le=100)
    tint: float = Field(0, ge=-100, le=100)
    exposure: float = Field(0, ge=-5, le=5)
    contrast: float = Field(0, ge=-100, le=100)
    highlights: float = Field(0, ge=-100, le=100)
    shadows: float = Field(0, ge=-100, le=100)
    whites: float = Field(0, ge=-100, le=100)
    blacks: float = Field(0, ge=-100, le=100)
    texture: float = Field(0, ge=-100, le=100)
    clarity: float = Field(0, ge=-100, le=100)
    dehaze: float = Field(0, ge=-100, le=100)
    vibrance: float = Field(0, ge=-100, le=100)
    saturation: float = Field(0, ge=-100, le=100)
    sharpen: float = Field(0, ge=0, le=100)
    noiseReduction: float = Field(0, ge=0, le=100)
    colorNoiseReduction: float = Field(0, ge=0, le=100)
    bloomIntensity: float = Field(0, ge=0, le=100)
    fadeAmount: float = Field(0, ge=0, le=100)

    hslRedHue: float = Field(0, ge=-100, le=100)
    hslRedSat: float = Field(0, ge=-100, le=100)
    hslRedLum: float = Field(0, ge=-100, le=100)
    hslOrangeHue: float = Field(0, ge=-100, le=100)
    hslOrangeSat: float = Field(0, ge=-100, le=100)
    hslOrangeLum: float = Field(0, ge=-100, le=100)
    hslYellowHue: float = Field(0, ge=-100, le=100)
    hslYellowSat: float = Field(0, ge=-100, le=100)
    hslYellowLum: float = Field(0, ge=-100, le=100)
    hslGreenHue: float = Field(0, ge=-100, le=100)
    hslGreenSat: float = Field(0, ge=-100, le=100)
    hslGreenLum: float = Field(0, ge=-100, le=100)
    hslAquaHue: float = Field(0, ge=-100, le=100)
    hslAquaSat: float = Field(0, ge=-100, le=100)
    hslAquaLum: float = Field(0, ge=-100, le=100)
    hslBlueHue: float = Field(0, ge=-100, le=100)
    hslBlueSat: float = Field(0, ge=-100, le=100)
    hslBlueLum: float = Field(0, ge=-100, le=100)
    hslPurpleHue: float = Field(0, ge=-100, le=100)
    hslPurpleSat: float = Field(0, ge=-100, le=100)
    hslPurpleLum: float = Field(0, ge=-100, le=100)
    hslMagentaHue: float = Field(0, ge=-100, le=100)
    hslMagentaSat: float = Field(0, ge=-100, le=100)
    hslMagentaLum: float = Field(0, ge=-100, le=100)

    splitShadowHue: float = Field(0, ge=0, le=360)
    splitShadowSat: float = Field(0, ge=0, le=100)
    splitMidtoneHue: float = Field(0, ge=0, le=360)
    splitMidtoneSat: float = Field(0, ge=0, le=100)
    splitHighlightHue: float = Field(0, ge=0, le=360)
    splitHighlightSat: float = Field(0, ge=0, le=100)
    splitBalance: float = Field(0, ge=-100, le=100)
    splitBlend: float = Field(0, ge=0, le=100)

    vignette: float = Field(0, ge=-100, le=100)
    grain: float = Field(0, ge=0, le=100)

    curves: Curves = Field(default_factory=Curves)


def clamp_partial_adjustments(partial: dict) -> dict[str, float]:
    """Lọc + kẹp giá trị về đúng khoảng hợp lệ, bỏ key không hợp lệ (dùng cho output của AI).

    Lưu ý: AI Mentor KHÔNG được phép set "curves" trực tiếp (xem services/mentor/prompt.py) —
    key này bị bỏ qua có chủ đích ở đây, không phải thiếu sót.
    """
    out: dict[str, float] = {}
    for key, value in partial.items():
        bounds = ADJUSTMENT_BOUNDS.get(key)
        if bounds is None or not isinstance(value, (int, float)):
            continue
        lo, hi = bounds
        out[key] = float(min(hi, max(lo, value)))
    return out
