from PIL import Image

# PHẢI khớp quy ước xoay/cắt phía frontend ở apps/web/lib/crop.ts (buildWorkingCanvas):
# rotation dương = xoay THUẬN CHIỀU kim đồng hồ; crop {x,y,w,h} chuẩn hoá 0..1, tương đối với
# khung ảnh ĐÃ XOAY (không phải ảnh gốc chưa xoay).


def apply_crop_rotation(img: Image.Image, rotation: float, crop: dict | None) -> Image.Image:
    """rotation: độ, dương = thuận chiều kim đồng hồ. crop: {"x","y","w","h"} chuẩn hoá 0..1 hoặc None."""
    if abs(rotation) > 0.01:
        # PIL.Image.rotate quay NGƯỢC chiều kim đồng hồ với góc dương -> đảo dấu để khớp quy ước trên.
        img = img.rotate(-rotation, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0))

    if crop is None:
        return img

    w, h = img.size
    x = max(0, min(w - 1, round(crop["x"] * w)))
    y = max(0, min(h - 1, round(crop["y"] * h)))
    cw = max(1, min(w - x, round(crop["w"] * w)))
    ch = max(1, min(h - y, round(crop["h"] * h)))
    return img.crop((x, y, x + cw, y + ch))
