"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHistogram } from "@/stores/histogramStore";

const H = 72;

export function Histogram() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useHistogram((s) => s.data);
  const [boxW, setBoxW] = useState(256);
  // Mặc định 1 để khớp HTML do server render — đọc devicePixelRatio thật trong effect (chỉ chạy ở
  // client) để tránh lệch giữa server/client gây cảnh báo hydration mismatch trên thuộc tính width.
  const [dpr, setDpr] = useState(1);

  // Canvas phải khớp (box width × devicePixelRatio) thực tế — nếu không trình duyệt sẽ phóng
  // to canvas 256px cố định bằng CSS và làm mờ đường histogram trên panel rộng hơn.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    setDpr(window.devicePixelRatio || 1);
    const ro = new ResizeObserver(([e]) => setBoxW(Math.max(1, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(1, Math.round(boxW * dpr));
  const pxH = Math.round(H * dpr);

  useEffect(() => {
    const c = ref.current;
    if (!c || !data) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, pxH);
    // Vẽ trong hệ toạ độ logic 256×H cố định rồi scale ra đúng kích thước pixel thật của canvas
    // (box width × devicePixelRatio) — tránh bị trình duyệt phóng to bằng CSS làm mờ nét.
    ctx.save();
    ctx.scale(W / 256, pxH / H);

    // Bỏ qua bin 0 và 255 khi chuẩn hoá để clipping không làm dẹt biểu đồ
    let peak = 1;
    for (const ch of [data.r, data.g, data.b]) for (let i = 1; i < 255; i++) peak = Math.max(peak, ch[i]);

    const draw = (ch: Uint32Array, color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) ctx.lineTo(i, H - Math.min(1, Math.sqrt(ch[i] / peak)) * (H - 2));
      ctx.lineTo(256, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.globalCompositeOperation = "lighter";
    draw(data.r, "rgba(220,80,80,0.55)");
    draw(data.g, "rgba(90,190,110,0.5)");
    draw(data.b, "rgba(80,130,230,0.55)");
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }, [data, W, pxH]);

  const clipLo = data ? data.l[0] > 0 : false;
  const clipHi = data ? data.l[255] > 0 : false;

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-md border border-line bg-black/40">
      <canvas ref={ref} width={W} height={pxH} className="block h-[72px] w-full" />
      <span className={`absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${clipLo ? "bg-sky-400" : "bg-white/10"}`} title="Cắt vùng tối" />
      <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${clipHi ? "bg-rose-400" : "bg-white/10"}`} title="Cắt vùng sáng" />
    </div>
  );
}
