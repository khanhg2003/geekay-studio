import json

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.adjustments import Adjustments
from app.services.imaging.codec import InvalidImageError, decode_image, encode_image
from app.services.imaging.pipeline import apply_develop

router = APIRouter()


@router.post("/render")
async def render_image(
    request: Request,
    file: UploadFile,
    adjustments: str = Form(...),
    format: str = Form("jpeg"),
    quality: int = Form(92),
    rotation: float = Form(0.0),
    crop: str | None = Form(None),
) -> Response:
    settings = get_settings()

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Ảnh vượt quá giới hạn {settings.max_upload_mb}MB.")

    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Ảnh vượt quá giới hạn {settings.max_upload_mb}MB.")
    if not data:
        raise HTTPException(status_code=400, detail="File ảnh trống.")

    try:
        adjustments_dict = json.loads(adjustments)
        a = Adjustments(**adjustments_dict)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail="Thông số chỉnh sửa không hợp lệ.") from exc

    if format.lower() not in ("jpeg", "jpg", "png"):
        raise HTTPException(status_code=400, detail=f"Định dạng xuất không được hỗ trợ: {format}")
    quality = min(100, max(1, quality))
    rotation = min(45.0, max(-45.0, rotation))

    crop_dict: dict | None = None
    if crop:
        try:
            crop_dict = json.loads(crop)
            if not isinstance(crop_dict, dict) or not all(k in crop_dict for k in ("x", "y", "w", "h")):
                raise ValueError("thiếu trường x/y/w/h")
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Thông số cắt ảnh không hợp lệ.") from exc

    try:
        arr = decode_image(data, max_edge=settings.max_render_edge, rotation=rotation, crop=crop_dict)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        developed = apply_develop(arr, a)
        out_bytes, media_type = encode_image(developed, fmt=format, quality=quality)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # lỗi xử lý ảnh không lường trước — không để lộ chi tiết nội bộ
        raise HTTPException(status_code=500, detail="Không thể xử lý ảnh. Vui lòng thử lại.") from exc

    ext = "jpg" if media_type == "image/jpeg" else "png"
    return Response(
        content=out_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="geekay_export.{ext}"'},
    )
