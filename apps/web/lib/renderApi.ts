import type { Adjustments } from "./adjustments";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const RENDER_TIMEOUT_MS = 60_000;

export function isRenderApiConfigured() {
  return Boolean(API_BASE);
}

/** Gửi ảnh gốc + thông số tới backend để xử lý full-resolution (Pillow/OpenCV), trả về Blob đã xử lý. */
export async function renderFullRes(file: File, adjustments: Adjustments): Promise<Blob> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL chưa được cấu hình.");

  const form = new FormData();
  form.append("file", file);
  form.append("adjustments", JSON.stringify(adjustments));
  form.append("format", "jpeg");
  form.append("quality", "95");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/v1/render`, { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `Xuất ảnh lỗi (${res.status}).`);
    }
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}
