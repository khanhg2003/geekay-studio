import type { Adjustments } from "./adjustments";
import type { HistogramData } from "@/stores/histogramStore";

/**
 * MOCK — dùng làm fallback trong lib/mentorApi.ts khi chưa cấu hình NEXT_PUBLIC_API_BASE_URL,
 * để vẫn demo được UI Mentor mà không cần chạy backend FastAPI + OpenAI thật.
 * Dựa trên histogram thật của ảnh để gợi ý có ý nghĩa thay vì trả về dữ liệu cố định.
 */
export async function mockMentorReply(
  message: string,
  hist: HistogramData | null,
  current: Adjustments,
): Promise<{ advice: string; adjustments?: Partial<Adjustments> }> {
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 700));

  let mean = 0.5, total = 0, lowClip = 0, highClip = 0;
  if (hist) {
    let sum = 0;
    for (let i = 0; i < 256; i++) { sum += hist.l[i] * i; total += hist.l[i]; }
    mean = total ? sum / total / 255 : 0.5;
    lowClip = total ? hist.l[0] / total : 0;
    highClip = total ? hist.l[255] / total : 0;
  }
  const q = message.toLowerCase();

  if (/da|skin|chân dung|người/.test(q)) {
    return {
      advice:
        "Tone da đang hơi lạnh và thiếu độ ấm ở vùng trung tính. Tôi đề xuất tăng nhẹ nhiệt độ màu, giảm bão hoà tổng thể một chút và hạ độ rõ nét để da mịn hơn mà không bị bệt.",
      adjustments: { temperature: current.temperature + 9, tint: current.tint + 3, clarity: -12, saturation: -6, vibrance: 8 },
    };
  }
  if (/mood|điện ảnh|cinematic|trầm/.test(q)) {
    return {
      advice:
        "Để có mood điện ảnh: kéo vùng sáng xuống để giữ chi tiết bầu trời, nâng điểm đen tạo cảm giác film, giảm bão hoà và thêm vignette nhẹ để dẫn mắt vào chủ thể.",
      adjustments: { highlights: -45, blacks: 18, contrast: 12, saturation: -15, temperature: -6, vignette: -22, grain: 14 },
    };
  }

  const evFix = Number(((0.46 - mean) * 3.2).toFixed(2));
  const parts: string[] = [];
  const adj: Partial<Adjustments> = {};
  if (Math.abs(evFix) > 0.12) {
    parts.push(`Độ sáng trung bình ở mức ${(mean * 100).toFixed(0)}% — ảnh đang ${evFix > 0 ? "thiếu" : "thừa"} sáng khoảng ${Math.abs(evFix).toFixed(1)} EV.`);
    adj.exposure = Number((current.exposure + evFix).toFixed(2));
  } else {
    parts.push("Phơi sáng tổng thể đã ổn.");
  }
  if (highClip > 0.002) { parts.push("Vùng sáng đang bị cháy, cần kéo Highlights xuống."); adj.highlights = -40; }
  else adj.highlights = -20;
  if (lowClip > 0.002) { parts.push("Vùng tối bị mất chi tiết."); adj.shadows = 30; }
  else adj.shadows = 18;
  parts.push("Ánh sáng giờ vàng nên tăng ấm nhẹ và độ rực để màu trời chuyển sắc mượt hơn, giữ bão hoà để tone da tự nhiên.");
  adj.temperature = current.temperature + 6;
  adj.vibrance = 14;
  adj.contrast = 10;

  return { advice: parts.join(" "), adjustments: adj };
}
