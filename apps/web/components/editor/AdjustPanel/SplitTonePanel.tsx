"use client";
import { ColorWheel } from "@/components/ui/ColorWheel";
import { Slider } from "@/components/ui/Slider";
import { AccordionSection } from "./AccordionSection";
import { SPEC_BY_KEY } from "@/lib/adjustments";
import { useEditor } from "@/stores/editorStore";

export function SplitTonePanel() {
  const adjustments = useEditor((s) => s.adjustments);
  const setLive = useEditor((s) => s.setLive);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);

  const dirty = adjustments.splitShadowSat !== 0 || adjustments.splitMidtoneSat !== 0 || adjustments.splitHighlightSat !== 0;

  const reset = () =>
    apply(
      {
        splitShadowHue: 0, splitShadowSat: 0, splitMidtoneHue: 0, splitMidtoneSat: 0,
        splitHighlightHue: 0, splitHighlightSat: 0, splitBalance: 0, splitBlend: 0,
      },
      "Đặt lại Chỉnh màu",
      "manual",
    );

  const setShadow = (hue: number, sat: number) => { setLive("splitShadowHue", hue); setLive("splitShadowSat", sat); };
  const setMidtone = (hue: number, sat: number) => { setLive("splitMidtoneHue", hue); setLive("splitMidtoneSat", sat); };
  const setHighlight = (hue: number, sat: number) => { setLive("splitHighlightHue", hue); setLive("splitHighlightSat", sat); };

  return (
    <AccordionSection label="Chỉnh màu (Color Grading)" defaultOpen={false} dirty={dirty} onReset={reset}>
      <div className="flex items-start justify-center gap-4 px-4 pb-2 pt-1">
        <ColorWheel size={64} hue={adjustments.splitShadowHue} sat={adjustments.splitShadowSat} onChange={setShadow}
          onChangeEnd={() => commit("Color Grading: vùng tối")} label="Vùng tối" />
        <ColorWheel size={64} hue={adjustments.splitMidtoneHue} sat={adjustments.splitMidtoneSat} onChange={setMidtone}
          onChangeEnd={() => commit("Color Grading: vùng trung tính")} label="Trung tính" />
        <ColorWheel size={64} hue={adjustments.splitHighlightHue} sat={adjustments.splitHighlightSat} onChange={setHighlight}
          onChangeEnd={() => commit("Color Grading: vùng sáng")} label="Vùng sáng" />
      </div>
      <div className="px-4 pb-3">
        {(["splitBlend", "splitBalance"] as const).map((key) => {
          const spec = SPEC_BY_KEY[key];
          return (
            <Slider
              key={key}
              id={`slider-${key}`}
              label={spec.label}
              value={adjustments[key]}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              onChange={(v) => setLive(key, v)}
              onChangeEnd={() => commit(`Color Grading: ${spec.label}`)}
            />
          );
        })}
      </div>
    </AccordionSection>
  );
}
