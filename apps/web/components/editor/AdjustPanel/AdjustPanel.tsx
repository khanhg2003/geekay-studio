"use client";
import clsx from "clsx";
import { Slider } from "@/components/ui/Slider";
import { ADJUSTMENT_GROUPS, formatValue, type AdjustmentGroup } from "@/lib/adjustments";
import { useEditor } from "@/stores/editorStore";
import { AccordionSection } from "./AccordionSection";
import { CurvePanel } from "./CurvePanel";
import { Histogram } from "./Histogram";
import { HSLPanel } from "./HSLPanel";
import { SplitTonePanel } from "./SplitTonePanel";

function Group({ group }: { group: AdjustmentGroup }) {
  const adjustments = useEditor((s) => s.adjustments);
  const aiTargets = useEditor((s) => s.aiTargets);
  const setLive = useEditor((s) => s.setLive);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);

  const dirty = group.items.some((i) => adjustments[i.key] !== 0);

  return (
    <AccordionSection
      label={group.label}
      defaultOpen={group.id !== "effects" && group.id !== "detail"}
      dirty={dirty}
      onReset={() => apply(Object.fromEntries(group.items.map((i) => [i.key, 0])), `Đặt lại ${group.label}`, "manual")}
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
    </AccordionSection>
  );
}

const GROUP_BY_ID = Object.fromEntries(ADJUSTMENT_GROUPS.map((g) => [g.id, g]));

export function AdjustPanel({ className }: { className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <div className="border-b border-line p-4">
        <Histogram />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <Group group={GROUP_BY_ID.wb} />
        <Group group={GROUP_BY_ID.light} />
        <Group group={GROUP_BY_ID.presence} />
        <CurvePanel />
        <HSLPanel />
        <SplitTonePanel />
        <Group group={GROUP_BY_ID.detail} />
        <Group group={GROUP_BY_ID.effects} />
      </div>
    </div>
  );
}
