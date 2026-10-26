"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import clsx from "clsx";
import { DEFAULT_ADJUSTMENTS } from "@/lib/adjustments";
import { SYSTEM_PRESETS } from "@/lib/presets";
import { useEditor } from "@/stores/editorStore";

function Presets() {
  const [q, setQ] = useState("");
  const apply = useEditor((s) => s.apply);
  const setPreview = useEditor((s) => s.setPreview);

  const groups = useMemo(() => {
    const list = SYSTEM_PRESETS.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return list.reduce<Record<string, typeof list>>((acc, p) => ((acc[p.category] ??= []).push(p), acc), {});
  }, [q]);

  return (
    <>
      <div className="p-3">
        <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-bg-elevated px-2.5 focus-within:border-line-strong">
          <Search className="h-3.5 w-3.5 text-fg-3" />
          <input
            id="preset-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm preset"
            className="flex-1 bg-transparent text-[12px] text-fg placeholder:text-fg-3 outline-none"
          />
        </label>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="mb-3">
            <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.1em] text-fg-3">{cat}</div>
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                id={`preset-${p.id}`}
                onMouseEnter={() => setPreview({ ...DEFAULT_ADJUSTMENTS, ...p.adjustments })}
                onMouseLeave={() => setPreview(null)}
                onClick={() => apply(p.adjustments, `Preset: ${p.name}`, "preset", true)}
                className="group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[12px] text-fg-2 transition-colors hover:bg-bg-hover hover:text-fg"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/15 transition-colors group-hover:bg-fg" />
                {p.name}
              </button>
            ))}
          </div>
        ))}
        {Object.keys(groups).length === 0 && (
          <p className="px-2 py-6 text-center text-[12px] text-fg-3">Không tìm thấy preset.</p>
        )}
      </div>
    </>
  );
}

function HistoryList() {
  const history = useEditor((s) => s.history);
  const cursor = useEditor((s) => s.cursor);
  const jumpTo = useEditor((s) => s.jumpTo);

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
      {[...history].map((h, i) => ({ h, i })).reverse().map(({ h, i }) => (
        <button
          key={h.id}
          type="button"
          onClick={() => jumpTo(i)}
          className={clsx(
            "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] transition-colors",
            i === cursor ? "bg-bg-hover text-fg" : i > cursor ? "text-fg-3 hover:bg-bg-hover" : "text-fg-2 hover:bg-bg-hover hover:text-fg",
          )}
        >
          {h.source === "ai" ? <Sparkles className="h-3 w-3 shrink-0 text-ai" /> : <SlidersHorizontal className="h-3 w-3 shrink-0 opacity-50" />}
          <span className="truncate">{h.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PresetSidebar({ className }: { className?: string }) {
  const [tab, setTab] = useState<"presets" | "history">("presets");
  const count = useEditor((s) => s.history.length - 1);

  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
        {(["presets", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx("relative flex h-full items-center gap-1.5 px-2.5 text-[12px] transition-colors", tab === t ? "text-fg" : "text-fg-3 hover:text-fg-2")}
          >
            {t === "presets" ? "Presets" : <><History className="h-3 w-3" /> Lịch sử {count > 0 && <span className="font-mono text-[10px] text-fg-3">{count}</span>}</>}
            {tab === t && <motion.span layoutId="left-tab" className="absolute inset-x-2 -bottom-px h-px bg-fg" />}
          </button>
        ))}
      </div>
      {tab === "presets" ? <Presets /> : <HistoryList />}
    </div>
  );
}
