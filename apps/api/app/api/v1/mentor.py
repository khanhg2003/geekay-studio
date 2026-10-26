from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.mentor import MentorChatRequest, MentorChatResponse
from app.services.mentor.client import (
    MentorConfigError,
    MentorTimeoutError,
    MentorUpstreamError,
    call_colorist,
)

router = APIRouter()


@router.post("/mentor/chat", response_model=MentorChatResponse)
async def mentor_chat(req: MentorChatRequest) -> MentorChatResponse:
    settings = get_settings()
    try:
        return await call_colorist(req, settings)
    except MentorTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except MentorConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except MentorUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
