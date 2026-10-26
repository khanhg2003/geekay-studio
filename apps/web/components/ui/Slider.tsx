"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

export interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  defaultValue?: number;
  /** Nền track tuỳ chỉnh (ví dụ gradient nhiệt độ màu) */
  track?: string;
  /** Giá trị AI đề xuất – hiển thị vạch nhỏ màu amber */
  marker?: number;
  onChange: (v: number) => void;
  onChangeStart?: () => void;
  onChangeEnd?: (v: number) => void;
}

const format = (v: number, p = 0) => {
  const s = v.toFixed(p);
  if (Number(s) === 0) return (0).toFixed(p);
  return v > 0 ? `+${s}` : s;
};

/**
 * Thanh trượt custom kiểu Lightroom:
 * - Fill lưỡng cực từ điểm 0
 * - Double-click nhãn/track: đặt lại · Shift khi kéo: tinh chỉnh ×0.1
 * - Click số để nhập trực tiếp · Phím mũi tên khi focus
 */
export function Slider({
  id, label, value, min, max, step, precision = 0, defaultValue = 0, track, marker,
  onChange, onChangeStart, onChangeEnd,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startV: number } | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const [active, setActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const range = max - min;
  const pct = (v: number) => ((v - min) / range) * 100;
  const zero = pct(Math.min(max, Math.max(min, defaultValue)));
  const pos = pct(value);

  const quantize = useCallback(
    (v: number) => {
      const q = Math.round(v / step) * step;
      return Number(Math.min(max, Math.max(min, q)).toFixed(6));
    },
    [min, max, step],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = trackRef.current!;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    // Click vào track → nhảy tới vị trí đó, sau đó kéo tương đối
    const clicked = quantize(min + ((e.clientX - rect.left) / rect.width) * range);
    onChangeStart?.();
    onChange(clicked);
    drag.current = { startX: e.clientX, startV: clicked };
    setActive(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const rect = trackRef.current!.getBoundingClientRect();
    const fine = e.shiftKey ? 0.1 : 1;
    const dv = ((e.clientX - drag.current.startX) / rect.width) * range * fine;
    const next = quantize(drag.current.startV + dv);
    if (e.shiftKey) { drag.current = { startX: e.clientX, startV: drag.current.startV + dv }; }
    if (next !== latest.current) onChange(next);
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setActive(false);
    onChangeEnd?.(latest.current);
  };

  const reset = () => {
    onChangeStart?.();
    onChange(defaultValue);
    onChangeEnd?.(defaultValue);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mult = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = quantize(value + step * mult);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = quantize(value - step * mult);
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next !== null) {
      e.preventDefault();
      onChangeStart?.();
      onChange(next);
      onChangeEnd?.(next);
    }
  };

  const commitDraft = () => {
    const n = parseFloat(draft.replace(",", "."));
    setEditing(false);
    if (!Number.isNaN(n)) {
      const q = quantize(n);
      onChangeStart?.();
      onChange(q);
      onChangeEnd?.(q);
    }
  };

  useEffect(() => () => { drag.current = null; }, []);

  const changed = Math.abs(value - defaultValue) > 1e-6;

  return (
    <div className="group/slider select-none py-[5px]">
      <div className="mb-[7px] flex items-center justify-between">
        <label
          htmlFor={id}
          onDoubleClick={reset}
          title="Nhấp đúp để đặt lại"
          className={clsx(
            "cursor-default text-[12px] transition-colors",
            changed ? "text-fg" : "text-fg-2",
          )}
        >
          {label}
        </label>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === "Enter") commitDraft(); if (e.key === "Escape") setEditing(false); }}
            className="w-14 rounded-[4px] border border-line-strong bg-bg-elevated px-1 text-right font-mono text-[11px] text-fg outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(value.toFixed(precision)); setEditing(true); }}
            className={clsx(
              "w-14 rounded-[4px] px-1 text-right font-mono text-[11px] tabular-nums transition-colors hover:bg-white/5",
              changed ? "text-fg" : "text-fg-3",
            )}
          >
            {format(value, precision)}
          </button>
        )}
      </div>

      <div
        ref={trackRef}
        id={id}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
        onKeyDown={onKeyDown}
        className="relative flex h-4 cursor-pointer touch-none items-center outline-none focus-visible:[&>.thumb]:ring-2 focus-visible:[&>.thumb]:ring-white/30"
      >
        {/* Track */}
        <div
          className="absolute inset-x-0 h-[2px] rounded-full"
          style={{ background: track ?? "rgba(255,255,255,0.09)", opacity: track ? 0.55 : 1 }}
        />
        {/* Fill lưỡng cực */}
        {!track && (
          <div
            className="absolute h-[2px] rounded-full bg-fg/80"
            style={{ left: `${Math.min(zero, pos)}%`, width: `${Math.abs(pos - zero)}%` }}
          />
        )}
        {/* Vạch điểm 0 */}
        {zero > 0 && zero < 100 && (
          <div className="absolute h-[6px] w-px bg-white/15" style={{ left: `${zero}%` }} />
        )}
        {/* Marker AI */}
        {marker !== undefined && Math.abs(marker - value) > 1e-6 && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            className="absolute h-[9px] w-[2px] rounded-full bg-ai"
            style={{ left: `${pct(marker)}%`, x: "-50%" }}
            title={`AI đề xuất: ${format(marker, precision)}`}
          />
        )}
        {/* Thumb */}
        <motion.div
          className="thumb absolute h-[11px] w-[11px] rounded-full border border-black/40 bg-fg shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          style={{ left: `${pos}%`, x: "-50%" }}
          animate={{ scale: active ? 1.25 : 1 }}
          whileHover={{ scale: 1.15 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  );
}
