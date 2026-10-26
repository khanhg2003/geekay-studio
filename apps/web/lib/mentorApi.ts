import type { Adjustments } from "./adjustments";
import type { HistogramData } from "@/stores/histogramStore";
import { mockMentorReply } from "./mentorMock";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const MENTOR_TIMEOUT_MS = 35_000;
/** Cạnh dài tối đa của ảnh preview gửi cho GPT-4o Vision — đủ để phân tích, đỡ tốn token. */
const SNAPSHOT_MAX_EDGE = 896;

export interface MentorReply {
  advice: string;
  adjustments?: Partial<Adjustments>;
}

function histogramSummary(hist: HistogramData | null) {
  if (!hist) return undefined;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist.l[i] * i;
    total += hist.l[i];
  }
  if (!total) return undefined;
  return {
    mean_luma: sum / total / 255,
    low_clip_ratio: hist.l[0] / total,
    high_clip_ratio: hist.l[255] / total,
  };
}

/** Thu nhỏ canvas hiện tại thành JPEG base64 (không kèm tiền tố data:) để gửi cho AI Mentor. */
function snapshotCanvas(canvas: HTMLCanvasElement | null): string | undefined {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return undefined;
  const scale = Math.min(1, SNAPSHOT_MAX_EDGE / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(canvas, 0, 0, w, h);
  const dataUrl = off.toDataURL("image/jpeg", 0.82);
  return dataUrl.split(",")[1];
}

export async function askMentor(
  message: string,
  hist: HistogramData | null,
  current: Adjustments,
  canvas: HTMLCanvasElement | null,
): Promise<MentorReply> {
  if (!API_BASE) {
    // Chưa cấu hình backend — dùng mock cục bộ để vẫn demo được UI.
    return mockMentorReply(message, hist, current);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MENTOR_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/v1/mentor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        adjustments: current,
        image_base64: snapshotCanvas(canvas),
        histogram: histogramSummary(hist),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `Mentor AI lỗi (${res.status}).`);
    }

    const data = (await res.json()) as { advice: string; adjustments?: Partial<Adjustments> | null };
    return { advice: data.advice, adjustments: data.adjustments ?? undefined };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Mentor AI phản hồi quá lâu, vui lòng thử lại.");
    }
    throw err instanceof Error ? err : new Error("Không thể kết nối tới Mentor AI.");
  } finally {
    clearTimeout(timer);
  }
}
