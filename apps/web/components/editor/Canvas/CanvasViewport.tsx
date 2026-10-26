"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DevelopRenderer } from "./webgl/renderer";
import { useEditor, useEffectiveAdjustments } from "@/stores/editorStore";
import { useHistogram } from "@/stores/histogramStore";

const PAD = 32;

export function CanvasViewport() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DevelopRenderer | null>(null);
  const rafRef = useRef(0);
  const histTimer = useRef<ReturnType<typeof setTimeout>>();

  const imageUrl = useEditor((s) => s.imageUrl);
  const compare = useEditor((s) => s.compare);
  const split = useEditor((s) => s.split);
  const setSplit = useEditor((s) => s.setSplit);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const adjustments = useEffectiveAdjustments();
  const setHist = useHistogram((s) => s.set);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [holdOriginal, setHoldOriginal] = useState(false);
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  /** Tăng lên mỗi lần WebGL context được khôi phục để buộc nạp lại texture ảnh. */
  const [glEpoch, setGlEpoch] = useState(0);
  const showToast = useEditor((s) => s.showToast);

  // Khởi tạo WebGL + theo dõi mất/khôi phục context (GPU đổi driver, hết VRAM, tab ẩn lâu...)
  useEffect(() => {
    const canvas = canvasRef.current!;
    try {
      rendererRef.current = new DevelopRenderer(canvas);
    } catch {
      setError("Trình duyệt không hỗ trợ WebGL. Vui lòng bật tăng tốc phần cứng.");
      return;
    }

    const onLost = (e: Event) => {
      e.preventDefault(); // bắt buộc — cho phép trình duyệt thử khôi phục thay vì mất vĩnh viễn
      rendererRef.current = null;
      setLoading(true);
      showToast("Mất kết nối đồ hoạ (WebGL), đang thử khôi phục…", "info");
    };
    const onRestored = () => {
      try {
        rendererRef.current = new DevelopRenderer(canvas);
        setGlEpoch((n) => n + 1); // buộc effect nạp ảnh chạy lại để upload texture mới
      } catch {
        setError("Không thể khôi phục WebGL. Vui lòng tải lại trang.");
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [showToast]);

  // Nạp ảnh (chạy lại khi đổi ảnh HOẶC khi WebGL context vừa được khôi phục)
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    setLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      r.setImage(img);
      setImgSize({ w: r.width, h: r.height });
      setPan({ x: 0, y: 0 });
      setLoading(false);
    };
    img.onerror = () => { setError("Không thể tải ảnh."); setLoading(false); };
    img.src = imageUrl;
  }, [imageUrl, glEpoch]);

  // Render mỗi khi thông số đổi (gộp vào 1 frame)
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || loading) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      r.render(adjustments, holdOriginal ? 1.01 : compare ? split : null);
      clearTimeout(histTimer.current);
      histTimer.current = setTimeout(() => setHist(r.histogram()), 60);
    });
  }, [adjustments, compare, split, holdOriginal, loading, setHist]);

  // Theo dõi kích thước vùng chứa
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phím Space để kéo, "\" giữ để xem ảnh gốc
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /INPUT|TEXTAREA/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); }
      if (e.key === "\\") setHoldOriginal(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "\\") setHoldOriginal(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const fitScale = imgSize.w
    ? Math.min((box.w - PAD * 2) / imgSize.w, (box.h - PAD * 2) / imgSize.h, 1)
    : 1;
  const scale = zoom === "fit" ? fitScale : zoom;
  const dispW = imgSize.w * scale;
  const dispH = imgSize.h * scale;

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const next = Math.min(4, Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    setZoom(Number(next.toFixed(3)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!(spaceDown || e.button === 1 || zoom !== "fit")) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    panning.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!panning.current) return;
    setPan({ x: panning.current.px + e.clientX - panning.current.x, y: panning.current.py + e.clientY - panning.current.y });
  };
  const onPointerUp = () => { panning.current = null; };

  // Kéo đường chia trước/sau
  const splitDrag = useRef(false);
  const onSplitMove = (e: React.PointerEvent) => {
    if (!splitDrag.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setSplit((e.clientX - rect.left) / rect.width);
  };

  const showPan = zoom === "fit" ? { x: 0, y: 0 } : pan;

  return (
    <div
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => { onPointerMove(e); onSplitMove(e); }}
      onPointerUp={() => { onPointerUp(); splitDrag.current = false; }}
      onDoubleClick={() => setZoom(zoom === "fit" ? 1 : "fit")}
      className="canvas-bg relative h-full w-full overflow-hidden"
      style={{ cursor: spaceDown || zoom !== "fit" ? (panning.current ? "grabbing" : "grab") : "default" }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: dispW, height: dispH,
          transform: `translate(calc(-50% + ${showPan.x}px), calc(-50% + ${showPan.y}px))`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full shadow-[0_8px_40px_rgba(0,0,0,0.55)]"
          style={{ opacity: loading ? 0 : 1, transition: "opacity 300ms ease" }}
        />

        {compare && !loading && (
          <>
            <div
              className="absolute inset-y-0 w-px bg-white/70"
              style={{ left: `${split * 100}%` }}
            />
            <button
              aria-label="Kéo để so sánh"
              onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); splitDrag.current = true; }}
              className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/30 bg-black/60 backdrop-blur"
              style={{ left: `${split * 100}%` }}
            >
              <span className="text-[10px] text-fg">⟷</span>
            </button>
            <span className="absolute left-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-2 backdrop-blur">Trước</span>
            <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-2 backdrop-blur">Sau</span>
          </>
        )}
      </div>

      <AnimatePresence>
        {holdOriginal && (
          <motion.span
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-black/60 px-2.5 py-1 text-[11px] text-fg-2 backdrop-blur"
          >
            Ảnh gốc
          </motion.span>
        )}
        {loading && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center gap-2 text-[12px] text-fg-3"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải ảnh…
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-[13px] text-fg-2">{error}</div>
      )}

      {/* Chỉ báo zoom */}
      {!loading && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-0.5 font-mono text-[10px] text-fg-3 backdrop-blur">
          {Math.round(scale * 100)}% · {imgSize.w}×{imgSize.h}
        </div>
      )}
    </div>
  );
}
