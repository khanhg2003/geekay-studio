import asyncio
import json
from functools import lru_cache

from openai import APIError, AsyncOpenAI, AuthenticationError

from app.core.config import Settings
from app.schemas.adjustments import clamp_partial_adjustments
from app.schemas.mentor import MentorChatRequest, MentorChatResponse
from app.services.mentor.prompt import SYSTEM_PROMPT


@lru_cache
def _get_client(api_key: str) -> AsyncOpenAI:
    # Cache theo api_key (tối đa 1 giá trị thực tế) để tái sử dụng connection pool của httpx
    # thay vì tạo mới AsyncOpenAI (và cả httpx.AsyncClient bên trong) ở mỗi request.
    return AsyncOpenAI(api_key=api_key)


class MentorConfigError(RuntimeError):
    """OpenAI API key chưa được cấu hình phía server."""


class MentorUpstreamError(RuntimeError):
    """Lỗi khi gọi OpenAI (mạng, rate-limit, phản hồi lỗi...)."""


class MentorTimeoutError(RuntimeError):
    """OpenAI phản hồi quá lâu."""


def _build_user_content(req: MentorChatRequest) -> list[dict]:
    context = {
        "current_adjustments": req.adjustments.model_dump(),
    }
    if req.histogram:
        context["histogram"] = req.histogram.model_dump(exclude_none=True)

    content: list[dict] = [
        {
            "type": "text",
            "text": f"Ngữ cảnh (JSON): {json.dumps(context, ensure_ascii=False)}\n\nCâu hỏi: {req.message}",
        }
    ]
    if req.image_base64:
        url = req.image_base64 if req.image_base64.startswith("data:") else f"data:image/jpeg;base64,{req.image_base64}"
        content.append({"type": "image_url", "image_url": {"url": url}})
    return content


async def call_colorist(req: MentorChatRequest, settings: Settings) -> MentorChatResponse:
    if not settings.openai_api_key:
        raise MentorConfigError("OPENAI_API_KEY chưa được cấu hình trên server.")

    client = _get_client(settings.openai_api_key)

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.openai_model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": _build_user_content(req)},
                ],
                max_tokens=600,
                temperature=0.4,
            ),
            timeout=settings.mentor_timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        raise MentorTimeoutError("Mentor AI phản hồi quá lâu, vui lòng thử lại.") from exc
    except AuthenticationError as exc:
        raise MentorConfigError("OpenAI API Key không hợp lệ.") from exc
    except APIError as exc:
        raise MentorUpstreamError(f"Lỗi từ OpenAI: {exc}") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Mentor không tuân thủ JSON — vẫn trả lời bằng văn bản thô thay vì crash
        return MentorChatResponse(advice=raw.strip() or "Mentor tạm thời không có phản hồi hợp lệ.", adjustments=None)

    advice = str(parsed.get("advice") or "").strip() or "Mentor không có nhận xét thêm."
    adjustments = clamp_partial_adjustments(parsed.get("adjustments") or {})
    return MentorChatResponse(advice=advice, adjustments=adjustments or None)
