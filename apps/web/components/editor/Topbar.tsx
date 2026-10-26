"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Columns2, Crop, Download, ImagePlus, Loader2, Maximize, PanelLeft, Redo2, RotateCcw, Sparkles, Undo2,
} from "lucide-react";
import clsx from "clsx";
import { useAskMentor } from "./MentorPanel/MentorPanel";
import { isRenderApiConfigured, renderFullRes } from "@/lib/renderApi";
import { useEditor } from "@/stores/editorStore";

/** Chặn sớm ở client — tránh decode ảnh siêu nặng làm treo tab trước khi kịp báo lỗi thân thiện. */
const MAX_UPLOAD_MB = 30;

function IconBtn({ label, onClick, disabled, active, children, className, id }: {
  label: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode; className?: string; id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-white/10 text-fg" : "text-fg-2 hover:bg-white/5 hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Topbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const fileName = useEditor((s) => s.fileName);
  const cursor = useEditor((s) => s.cursor);
  const historyLen = useEditor((s) => s.history.length);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const reset = useEditor((s) => s.reset);
  const compare = useEditor((s) => s.compare);
  const setCompare = useEditor((s) => s.setCompare);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const setImage = useEditor((s) => s.setImage);
  const leftOpen = useEditor((s) => s.leftOpen);
  const setLeftOpen = useEditor((s) => s.setLeftOpen);
  const showToast = useEditor((s) => s.showToast);
  const cropToolActive = useEditor((s) => s.cropToolActive);
  const setCropToolActive = useEditor((s) => s.setCropToolActive);
  const setRightTab = useEditor((s) => s.setRightTab);
  const mentorBusy = useEditor((s) => s.mentorBusy);
  const askMentorText = useAskMentor();

  const autoEnhance = async () => {
    setRightTab("mentor");
    try {
      await askMentorText("Phân tích và tự động cải thiện toàn diện ảnh này — chọn bộ thông số phù hợp nhất với ánh sáng, màu sắc và chủ thể hiện có.", { autoApply: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể tự động chỉnh ảnh.");
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      showToast(`Ảnh "${f.name}" nặng hơn ${MAX_UPLOAD_MB}MB — vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }
    setImage(URL.createObjectURL(f), f.name, f);
  };

  const downloadBlob = (b: Blob, ext: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = fileName.replace(/\.\w+$/, "") + "_geekay." + ext;
    a.click();
  };

  /** Xuất từ ảnh proxy đang hiển thị trên canvas (độ phân giải giới hạn bởi PROXY_MAX_EDGE). */
  const exportFromCanvas = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    const prevCompare = useEditor.getState().compare;
    if (prevCompare) setCompare(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      canvas.toBlob((b) => {
        if (b) downloadBlob(b, "jpg");
        if (prevCompare) setCompare(true);
      }, "image/jpeg", 0.95);
    }));
  };

  /** Ưu tiên xuất full-res qua backend (apps/api) nếu đã cấu hình và còn giữ file gốc; lỗi thì fallback về canvas. */
  const exportImage = async () => {
    const { originalFile, adjustments, crop, rotation } = useEditor.getState();
    if (isRenderApiConfigured() && originalFile) {
      setExporting(true);
      try {
        const blob = await renderFullRes(originalFile, adjustments, rotation, crop);
        downloadBlob(blob, "jpg");
        return;
      } catch (err) {
        console.warn("Xuất full-res qua backend thất bại, dùng ảnh proxy thay thế:", err);
        showToast("Không kết nối được server xử lý ảnh — đã xuất bằng bản xem trước (độ phân giải thấp hơn).");
      } finally {
        setExporting(false);
      }
    }
    exportFromCanvas();
  };

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-bg-panel px-2 md:px-3">
      <IconBtn label="Presets" onClick={() => setLeftOpen(!leftOpen)} active={leftOpen} className="hidden md:flex xl:hidden">
        <PanelLeft className="h-4 w-4" />
      </IconBtn>

      <Link href="/editor/demo" className="flex items-center gap-2 pr-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-fg text-[11px] font-bold text-black">G</span>
        <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">Geekay Studio</span>
      </Link>

      <div className="hidden h-4 w-px bg-line-strong md:block" />
      <h1 className="min-w-0 truncate text-[12px] text-fg-2 md:max-w-[220px]">{fileName}</h1>

      <div className="ml-1 flex items-center gap-0.5">
        <IconBtn id="btn-undo" label="Hoàn tác (Ctrl+Z)" onClick={undo} disabled={cursor === 0}><Undo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn id="btn-redo" label="Làm lại (Ctrl+Shift+Z)" onClick={redo} disabled={cursor >= historyLen - 1}><Redo2 className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn label="Đặt lại tất cả" onClick={reset} className="hidden sm:flex"><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
      </div>

      <button
        id="btn-auto"
        type="button"
        title="AI tự động phân tích và chỉnh toàn bộ ảnh"
        onClick={autoEnhance}
        disabled={mentorBusy}
        className="ml-1.5 flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[12px] text-ai transition-colors hover:bg-ai-soft disabled:opacity-40"
      >
        {mentorBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Tự động</span>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <IconBtn id="btn-crop" label="Cắt & xoay ảnh" onClick={() => setCropToolActive(!cropToolActive)} active={cropToolActive}>
          <Crop className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn id="btn-compare" label="So sánh trước/sau (giữ \ để xem ảnh gốc)" onClick={() => setCompare(!compare)} active={compare}>
          <Columns2 className="h-3.5 w-3.5" />
        </IconBtn>
        <button
          type="button"
          onClick={() => setZoom(zoom === "fit" ? 1 : "fit")}
          className="hidden h-7 items-center gap-1 rounded-md px-2 font-mono text-[11px] text-fg-2 hover:bg-white/5 hover:text-fg md:flex"
          title="Chuyển Vừa khung / 100%"
        >
          <Maximize className="h-3 w-3" /> {zoom === "fit" ? "Vừa" : `${Math.round(zoom * 100)}%`}
        </button>
      </div>

      <div className="hidden h-4 w-px bg-line-strong sm:block" />

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
      <button
        id="btn-open"
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 transition-colors hover:bg-white/5 hover:text-fg sm:px-2.5"
      >
        <ImagePlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mở ảnh</span>
      </button>
      <button
        id="btn-export"
        type="button"
        onClick={exportImage}
        disabled={exporting}
        className="flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{exporting ? "Đang xuất…" : "Xuất ảnh"}</span>
      </button>
    </header>
  );
}
