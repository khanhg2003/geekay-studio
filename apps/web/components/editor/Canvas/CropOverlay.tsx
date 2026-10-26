"use client";
import { useRef } from "react";
import { clampCropRect, FULL_CROP, type CropRect } from "@/lib/crop";
import { useEditor } from "@/stores/editorStore";

type HandleId = "move" | "nw" | "ne" | "sw" | "se";

/** Khung cắt kéo-thả, đè lên vùng hiển thị ảnh trong CanvasViewport (chỉ hiện khi cropToolActive). */
export function CropOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const crop = useEditor((s) => s.crop) ?? FULL_CROP;
  const setLiveCrop = useEditor((s) => s.setLiveCrop);
  const drag = useRef<{ handle: HandleId; startCrop: CropRect; startX: number; startY: number } | null>(null);

  const beginDrag = (handle: HandleId) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, startCrop: crop, startX: e.clientX, startY: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const dx = (e.clientX - drag.current.startX) / rect.width;
    const dy = (e.clientY - drag.current.startY) / rect.height;
    const { handle, startCrop: s } = drag.current;
    let next: CropRect = { ...s };
    if (handle === "move") {
      next = { ...s, x: s.x + dx, y: s.y + dy };
    } else {
      if (handle.includes("w")) { next.x = s.x + dx; next.w = s.w - dx; }
      if (handle.includes("e")) next.w = s.w + dx;
      if (handle.includes("n")) { next.y = s.y + dy; next.h = s.h - dy; }
      if (handle.includes("s")) next.h = s.h + dy;
    }
    setLiveCrop(clampCropRect(next));
  };

  const endDrag = () => { drag.current = null; };

  const handleStyle = (h: "nw" | "ne" | "sw" | "se"): React.CSSProperties => ({
    left: h.includes("w") ? -8 : undefined,
    right: h.includes("e") ? -8 : undefined,
    top: h.includes("n") ? -8 : undefined,
    bottom: h.includes("s") ? -8 : undefined,
    cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/65" style={{ height: `${crop.y * 100}%` }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65" style={{ height: `${(1 - crop.y - crop.h) * 100}%` }} />
      <div
        className="pointer-events-none absolute bg-black/65"
        style={{ left: 0, top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }}
      />
      <div
        className="pointer-events-none absolute bg-black/65"
        style={{ right: 0, top: `${crop.y * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` }}
      />

      <div
        onPointerDown={beginDrag("move")}
        className="absolute cursor-move border border-white/90"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>
        {(["nw", "ne", "sw", "se"] as const).map((h) => (
          <div
            key={h}
            onPointerDown={beginDrag(h)}
            className="absolute h-4 w-4 rounded-full border-2 border-white bg-black/60"
            style={handleStyle(h)}
          />
        ))}
      </div>
    </div>
  );
}
