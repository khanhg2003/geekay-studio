import io

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.services.imaging.crop_transform import apply_crop_rotation


class InvalidImageError(ValueError):
    pass


def decode_image(data: bytes, max_edge: int, rotation: float = 0.0, crop: dict | None = None) -> np.ndarray:
    """Giải mã bytes -> numpy float32 RGB [0,1], tự xoay theo EXIF, áp Cắt & Xoay thủ công (nếu có)
    rồi hạ kích thước nếu vượt max_edge."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Image.DecompressionBombError as exc:
        # File nhỏ nhưng khai báo số pixel khổng lồ (decompression bomb) — Pillow tự chặn,
        # ta chỉ chuyển thành lỗi 400 thay vì để lọt thành 500 không rõ nguyên nhân.
        raise InvalidImageError("Ảnh có kích thước pixel quá lớn so với dung lượng, bị từ chối vì lý do an toàn.") from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("Không đọc được ảnh — file có thể bị hỏng hoặc không đúng định dạng.") from exc

    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")

    if rotation or crop is not None:
        img = apply_crop_rotation(img, rotation, crop)

    longest = max(img.width, img.height)
    if longest > max_edge:
        scale = max_edge / longest
        new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
        img = img.resize(new_size, Image.LANCZOS)

    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr


def encode_image(arr: np.ndarray, fmt: str = "jpeg", quality: int = 92) -> tuple[bytes, str]:
    """Mã hoá numpy float32 RGB [0,1] -> bytes. Trả về (bytes, media_type)."""
    clipped = np.clip(arr, 0.0, 1.0)
    u8 = (clipped * 255.0 + 0.5).astype(np.uint8)
    img = Image.fromarray(u8, mode="RGB")

    buf = io.BytesIO()
    fmt_lower = fmt.lower()
    if fmt_lower in ("jpeg", "jpg"):
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        media_type = "image/jpeg"
    elif fmt_lower == "png":
        img.save(buf, format="PNG", optimize=True)
        media_type = "image/png"
    else:
        raise InvalidImageError(f"Định dạng xuất không được hỗ trợ: {fmt}")

    return buf.getvalue(), media_type
