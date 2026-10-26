"use client";
import { useRef } from "react";

export interface ColorWheelProps {
  hue: number; // 0-360
  sat: number; // 0-100
  onChange: (hue: number, sat: number) => void;
  onChangeEnd?: () => void;
  size?: number;
  label?: string;
}

/** Vòng tròn chọn màu kiểu Lightroom Split Toning — góc = hue, khoảng cách tâm = saturation. */
export function ColorWheel({ hue, sat, onChange, onChangeEnd, size = 76, label }: ColorWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromEvent = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / radius);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0 = phải (đỏ)
    if (angle < 0) angle += 360;
    onChange(Math.round(angle), Math.round(dist * 100));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    fromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    fromEvent(e.clientX, e.clientY);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onChangeEnd?.();
  };

  const r = (sat / 100) * (size / 2);
  const rad = (hue * Math.PI) / 180;
  const px = size / 2 + Math.cos(rad) * r;
  const py = size / 2 + Math.sin(rad) * r;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative touch-none rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 72%)," +
            "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          style={{ left: px, top: py }}
        />
      </div>
      {label && <span className="text-[10px] text-fg-3">{label}</span>}
    </div>
  );
}
