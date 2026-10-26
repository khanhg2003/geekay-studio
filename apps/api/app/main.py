import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings

logger = logging.getLogger("geekay.api")

settings = get_settings()

app = FastAPI(title="Geekay Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_request_body_size(request: Request, call_next):
    """
    Chặn request quá khổ bằng Content-Length TRƯỚC KHI FastAPI parse multipart/JSON body.
    Việc kiểm tra bên trong route handler (vd. render.py) là quá muộn — lúc đó Starlette đã
    đọc/spool toàn bộ body rồi. Đây là lớp phòng vệ đầu tiên; route handler vẫn giữ kiểm tra
    lại độ dài thực tế để phòng trường hợp client không gửi Content-Length.
    """
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_upload_bytes:
        return JSONResponse(
            status_code=413,
            content={"detail": f"Request vượt quá giới hạn {settings.max_upload_mb}MB."},
        )
    return await call_next(request)


app.include_router(api_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Đã có lỗi không mong muốn xảy ra."})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
