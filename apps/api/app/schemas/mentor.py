from pydantic import BaseModel

from app.schemas.adjustments import Adjustments


class HistogramSummary(BaseModel):
    """Thống kê histogram rút gọn gửi kèm để Mentor có thêm ngữ cảnh số liệu."""

    mean_luma: float | None = None
    low_clip_ratio: float | None = None
    high_clip_ratio: float | None = None


class MentorChatRequest(BaseModel):
    message: str
    adjustments: Adjustments
    image_base64: str | None = None
    """Ảnh preview (data URL hoặc base64 JPEG thuần) — nên resize nhỏ (~768px) trước khi gửi."""
    histogram: HistogramSummary | None = None


class MentorChatResponse(BaseModel):
    advice: str
    adjustments: dict[str, float] | None = None
