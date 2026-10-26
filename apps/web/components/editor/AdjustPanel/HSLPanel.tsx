"use client";
import { useState } from "react";
import clsx from "clsx";
import { Slider } from "@/components/ui/Slider";
import { AccordionSection } from "./AccordionSection";
import { HSL_COLORS, SPEC_BY_KEY, hslKey, type HslColorKey } from "@/lib/adjustments";
import { useEditor } from "@/stores/editorStore";

export function HSLPanel() {
  const [active, setActive] = useState<HslColorKey>("red");
  const adjustments = useEditor((s) => s.adjustments);
  const setLive = useEditor((s) => s.setLive);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);

  const dirty = HSL_COLORS.some(
    ({ key }) => adjustments[hslKey(key, "Hue")] !== 0 || adjustments[hslKey(key, "Sat")] !== 0 || adjustments[hslKey(key, "Lum")] !== 0,
  );
  const activeDirty = (key: HslColorKey) =>
    adjustments[hslKey(key, "Hue")] !== 0 || adjustments[hslKey(key, "Sat")] !== 0 || adjustments[hslKey(key, "Lum")] !== 0;

  const resetAll = () =>
    apply(
      Object.fromEntries(HSL_COLORS.flatMap(({ key }) => [[hslKey(key, "Hue"), 0], [hslKey(key, "Sat"), 0], [hslKey(key, "Lum"), 0]])),
      "Đặt lại HSL",
      "manual",
    );

  const activeColor = HSL_COLORS.find((c) => c.key === active)!;

  return (
    <AccordionSection label="Màu theo dải (HSL)" defaultOpen={false} dirty={dirty} onReset={resetAll}>
      <div className="px-4 pb-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {HSL_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.label}
              onClick={() => setActive(c.key)}
              className={clsx(
                "relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform",
                active === c.key ? "scale-110 border-white/70" : "border-white/10 hover:border-white/30",
              )}
              style={{ backgroundColor: c.swatch }}
            >
              {activeDirty(c.key) && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-fg ring-1 ring-bg-panel" />
              )}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[11px] font-medium text-fg-2">{activeColor.label}</p>
        {(["Hue", "Sat", "Lum"] as const).map((ch) => {
          const key = hslKey(active, ch);
          const spec = SPEC_BY_KEY[key];
          return (
            <Slider
              key={key}
              id={`slider-${key}`}
              label={spec.label.split("·")[1]?.trim() ?? spec.label}
              value={adjustments[key]}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              onChange={(v) => setLive(key, v)}
              onChangeEnd={() => commit(`${activeColor.label} ${ch}`)}
            />
          );
        })}
      </div>
    </AccordionSection>
  );
}
