"use client";
import { Check, X } from "lucide-react";
import { ASPECT_OPTIONS, centeredRectForRatio } from "@/lib/crop";
import { useEditor } from "@/stores/editorStore";

export function CropToolbar() {
  const crop = useEditor((s) => s.crop);
  const rotation = useEditor((s) => s.rotation);
  const setLiveCrop = useEditor((s) => s.setLiveCrop);
  const setLiveRotation = useEditor((s) => s.setLiveRotation);
  const setCropToolActive = useEditor((s) => s.setCropToolActive);
  const commitCrop = useEditor((s) => s.commitCrop);

  const applyAspect = (ratio: number | null) => {
    if (ratio === null) { setLiveCrop(null); return; } // Gốc ảnh — dùng toàn khung
    if (ratio === 0) return; // Tự do — giữ khung hiện tại, chỉ bỏ khoá tỉ lệ
    setLiveCrop(centeredRectForRatio(ratio, 1, 1));
  };

  const cancel = () => {
    setLiveCrop(null);
    setLiveRotation(0);
    setCropToolActive(false);
  };
  const confirm = () => {
    commitCrop("Cắt & xoay ảnh");
    setCropToolActive(false);
  };

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-2.5 bg-black/75 p-3 backdrop-blur">
      <div className="flex flex-wrap gap-1.5">
        {ASPECT_OPTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => applyAspect(a.ratio)}
            className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-fg-2 transition-colors hover:border-white/40 hover:text-fg"
          >
            {a.label}
          </button>
        ))}
        {!crop && <span className="self-center text-[10px] text-fg-3">(đang dùng toàn bộ ảnh)</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="w-16 shrink-0 text-[11px] text-fg-2">Làm thẳng</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={rotation}
          onChange={(e) => setLiveRotation(Number(e.target.value))}
          className="h-1 flex-1 accent-white"
        />
        <span className="w-12 shrink-0 text-right font-mono text-[11px] text-fg-3">{rotation.toFixed(1)}°</span>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-fg-2 transition-colors hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" /> Huỷ
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex items-center gap-1 rounded-md bg-fg px-2.5 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
        >
          <Check className="h-3.5 w-3.5" /> Áp dụng
        </button>
      </div>
    </div>
  );
}
