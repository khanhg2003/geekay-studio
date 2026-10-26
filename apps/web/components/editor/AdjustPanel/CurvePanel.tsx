"use client";
import { useRef, useState } from "react";
import clsx from "clsx";
import { AccordionSection } from "./AccordionSection";
import { evalCurve, isDefaultCurves, type CurveChannel, type CurvePoint } from "@/lib/curve";
import { useEditor } from "@/stores/editorStore";

const SIZE = 232;
const CHANNELS: { id: CurveChannel; label: string; color: string }[] = [
  { id: "rgb", label: "RGB", color: "#EDEDED" },
  { id: "r", label: "R", color: "#e5484d" },
  { id: "g", label: "G", color: "#46a758" },
  { id: "b", label: "B", color: "#3b9eff" },
];

export function CurvePanel() {
  const [channel, setChannel] = useState<CurveChannel>("rgb");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndex = useRef<number | null>(null);

  const adjustments = useEditor((s) => s.adjustments);
  const setLiveCurve = useEditor((s) => s.setLiveCurve);
  const commitCurve = useEditor((s) => s.commitCurve);
  const apply = useEditor((s) => s.apply);

  const dirty = !isDefaultCurves(adjustments.curves);
  const points = adjustments.curves[channel];
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const active = CHANNELS.find((c) => c.id === channel)!;

  const toData = (clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 255;
    const y = 255 - ((clientY - rect.top) / rect.height) * 255;
    return { x: Math.min(255, Math.max(0, x)), y: Math.min(255, Math.max(0, y)) };
  };

  const pathD = (() => {
    let d = "";
    for (let i = 0; i <= 64; i++) {
      const x = (i / 64) * 255;
      const y = evalCurve(points, x);
      const px = (x / 255) * SIZE;
      const py = SIZE - (Math.min(255, Math.max(0, y)) / 255) * SIZE;
      d += (i === 0 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1) + " ";
    }
    return d;
  })();

  const onPointerDownPoint = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragIndex.current = idx;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const idx = dragIndex.current;
    if (idx === null) return;
    const isFirst = idx === 0;
    const isLast = idx === sorted.length - 1;
    const p = toData(e.clientX, e.clientY);
    let x = sorted[idx].x;
    if (!isFirst && !isLast) {
      const lo = sorted[idx - 1].x + 1;
      const hi = sorted[idx + 1].x - 1;
      x = Math.min(hi, Math.max(lo, p.x));
    }
    const next = [...sorted];
    next[idx] = { x, y: p.y };
    setLiveCurve(channel, next);
  };

  const onPointerUp = () => {
    if (dragIndex.current === null) return;
    dragIndex.current = null;
    commitCurve(channel, `Đường cong ${active.label}`);
  };

  const onSvgDoubleClick = (e: React.MouseEvent) => {
    const p = toData(e.clientX, e.clientY);
    if (p.x <= sorted[0].x || p.x >= sorted[sorted.length - 1].x) return;
    const next = [...sorted, p].sort((a, b) => a.x - b.x);
    setLiveCurve(channel, next);
    commitCurve(channel, `Thêm điểm đường cong ${active.label}`);
  };

  const onPointRightClick = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (idx === 0 || idx === sorted.length - 1 || sorted.length <= 2) return;
    const next = sorted.filter((_, i) => i !== idx);
    setLiveCurve(channel, next);
    commitCurve(channel, `Xoá điểm đường cong ${active.label}`);
  };

  const reset = () => {
    const identity: CurvePoint[] = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    apply(
      { curves: { rgb: [...identity], r: [...identity], g: [...identity], b: [...identity] } },
      "Đặt lại đường cong",
      "manual",
    );
  };

  const gridLines = [1, 2, 3];

  return (
    <AccordionSection label="Đường cong tông màu" defaultOpen={false} dirty={dirty} onReset={reset}>
      <div className="px-4 pb-3">
        <div className="mb-2 flex gap-1">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={clsx(
                "h-6 min-w-[28px] rounded px-1.5 text-[10px] font-semibold transition-colors",
                channel === c.id ? "bg-white/10 text-fg" : "text-fg-3 hover:text-fg-2",
              )}
              style={channel === c.id ? { boxShadow: `inset 0 -2px 0 0 ${c.color}` } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          height={SIZE}
          className="touch-none select-none rounded-md border border-line bg-black/40"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onSvgDoubleClick}
        >
          {gridLines.map((i) => (
            <line key={`v${i}`} x1={(SIZE / 4) * i} y1={0} x2={(SIZE / 4) * i} y2={SIZE} stroke="rgba(255,255,255,0.06)" />
          ))}
          {gridLines.map((i) => (
            <line key={`h${i}`} x1={0} y1={(SIZE / 4) * i} x2={SIZE} y2={(SIZE / 4) * i} stroke="rgba(255,255,255,0.06)" />
          ))}
          <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="2,3" />
          <path d={pathD} fill="none" stroke={active.color} strokeWidth={1.75} />
          {sorted.map((p, i) => (
            <circle
              key={i}
              cx={(p.x / 255) * SIZE}
              cy={SIZE - (p.y / 255) * SIZE}
              r={4.5}
              fill="#0F0F0F"
              stroke={active.color}
              strokeWidth={1.75}
              className="cursor-pointer"
              onPointerDown={onPointerDownPoint(i)}
              onContextMenu={onPointRightClick(i)}
            />
          ))}
        </svg>
        <p className="mt-1.5 text-[10px] leading-relaxed text-fg-3">
          Nhấp đúp để thêm điểm · chuột phải để xoá · điểm hai đầu chỉ chỉnh được theo chiều dọc.
        </p>
      </div>
    </AccordionSection>
  );
}
