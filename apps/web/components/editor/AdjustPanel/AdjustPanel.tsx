"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { Slider } from "@/components/ui/Slider";
import { ADJUSTMENT_GROUPS, formatValue, type AdjustmentGroup } from "@/lib/adjustments";
import { useEditor } from "@/stores/editorStore";
import { Histogram } from "./Histogram";

function Group({ group }: { group: AdjustmentGroup }) {
  const [open, setOpen] = useState(group.id !== "effects");
  const adjustments = useEditor((s) => s.adjustments);
  const aiTargets = useEditor((s) => s.aiTargets);
  const setLive = useEditor((s) => s.setLive);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);

  const dirty = group.items.some((i) => adjustments[i.key] !== 0);

  return (
    <section className="border-b border-line">
      <div className="flex h-9 items-center px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-2 hover:text-fg"
          aria-expanded={open}
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="h-3 w-3" />
          </motion.span>
          {group.label}
          {dirty && <span className="ml-1 h-1 w-1 rounded-full bg-fg-2" />}
        </button>
        {dirty && (
          <button
            type="button"
            title={`Đặt lại ${group.label}`}
            onClick={() => apply(Object.fromEntries(group.items.map((i) => [i.key, 0])), `Đặt lại ${group.label}`, "manual")}
            className="rounded p-1 text-fg-3 hover:bg-white/5 hover:text-fg"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {group.items.map((s) => (
                <Slider
                  key={s.key}
                  id={`slider-${s.key}`}
                  label={s.label}
                  value={adjustments[s.key]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  precision={s.precision}
                  track={s.track}
                  marker={aiTargets?.[s.key]}
                  onChange={(v) => setLive(s.key, v)}
                  onChangeEnd={(v) => commit(`${s.label} ${formatValue(s.key, v)}`)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function AdjustPanel({ className }: { className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <div className="border-b border-line p-4">
        <Histogram />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {ADJUSTMENT_GROUPS.map((g) => <Group key={g.id} group={g} />)}
      </div>
    </div>
  );
}
