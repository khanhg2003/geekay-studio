"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, Eye, Sparkles, Wand2 } from "lucide-react";
import clsx from "clsx";
import { SPEC_BY_KEY, formatValue, type AdjustmentKey, type Adjustments } from "@/lib/adjustments";
import { askMentor } from "@/lib/mentorApi";
import { useEditor, type MentorMessage } from "@/stores/editorStore";
import { useHistogram } from "@/stores/histogramStore";

const QUICK_PROMPTS = ["Phân tích ảnh này", "Cải thiện tone da", "Tạo mood điện ảnh"];

/** Hook dùng chung: gửi câu hỏi tới Mentor (dùng cả ở thanh mini và panel đầy đủ) */
export function useAskMentor() {
  const pushMessage = useEditor((s) => s.pushMessage);
  const setBusy = useEditor((s) => s.setMentorBusy);
  return async (text: string) => {
    const msg = text.trim();
    if (!msg || useEditor.getState().mentorBusy) return;
    pushMessage({ role: "user", content: msg });
    setBusy(true);
    try {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      const res = await askMentor(msg, useHistogram.getState().data, useEditor.getState().adjustments, canvas);
      pushMessage({ role: "assistant", content: res.advice, suggestion: res.adjustments });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Xin lỗi, Mentor tạm thời không phản hồi. Vui lòng thử lại.";
      pushMessage({ role: "assistant", content: text });
    } finally {
      setBusy(false);
    }
  };
}

function SuggestionCard({ msg }: { msg: MentorMessage }) {
  const current = useEditor((s) => s.adjustments);
  const apply = useEditor((s) => s.apply);
  const setPreview = useEditor((s) => s.setPreview);
  const markApplied = useEditor((s) => s.markApplied);
  const s = msg.suggestion!;
  const keys = Object.keys(s) as AdjustmentKey[];

  return (
    <div className="mt-2.5 overflow-hidden rounded-md border border-line bg-bg-app">
      <ul className="divide-y divide-line">
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between px-2.5 py-1.5 text-[11px]">
            <span className="text-fg-2">{SPEC_BY_KEY[k].label}</span>
            <span className="font-mono tabular-nums">
              <span className="text-fg-3">{formatValue(k, current[k])}</span>
              <span className="mx-1.5 text-fg-3">→</span>
              <span className="text-ai">{formatValue(k, s[k] as number)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex border-t border-line">
        <button
          type="button"
          disabled={msg.applied}
          onMouseEnter={() => !msg.applied && setPreview(s)}
          onMouseLeave={() => setPreview(null)}
          onTouchStart={() => !msg.applied && setPreview(s)}
          onTouchEnd={() => setPreview(null)}
          className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] text-fg-2 transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-40"
        >
          <Eye className="h-3 w-3" /> Rê chuột xem trước
        </button>
        <button
          type="button"
          disabled={msg.applied}
          onClick={() => { apply(s as Partial<Adjustments>, "AI Mentor: áp dụng gợi ý", "ai"); markApplied(msg.id); }}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 border-l border-line py-2 text-[11px] transition-colors",
            msg.applied ? "text-fg-3" : "text-ai hover:bg-ai-soft",
          )}
        >
          {msg.applied ? <><Check className="h-3 w-3" /> Đã áp dụng</> : <><Wand2 className="h-3 w-3" /> Áp dụng</>}
        </button>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-fg-3"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function MentorComposer({ compact = false, onSubmitted }: { compact?: boolean; onSubmitted?: () => void }) {
  const [text, setText] = useState("");
  const busy = useEditor((s) => s.mentorBusy);
  const ask = useAskMentor();
  const send = () => { if (!text.trim()) return; ask(text); setText(""); onSubmitted?.(); };

  return (
    <div className={clsx("flex items-end gap-2 rounded-md border border-line bg-bg-elevated px-2.5 py-2 transition-colors focus-within:border-line-strong")}>
      <Sparkles className="mb-[3px] h-3.5 w-3.5 shrink-0 text-ai" />
      <textarea
        id={compact ? "mentor-input-mini" : "mentor-input"}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={compact ? "Hỏi Mentor về ảnh này…" : "Mô tả điều bạn muốn cải thiện…"}
        className="max-h-24 min-h-[18px] flex-1 resize-none bg-transparent text-[12px] leading-[18px] text-fg placeholder:text-fg-3 outline-none"
      />
      <button
        type="button"
        onClick={send}
        disabled={!text.trim() || busy}
        aria-label="Gửi"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-fg text-black transition-opacity disabled:opacity-20"
      >
        <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function MentorPanel({ className }: { className?: string }) {
  const messages = useEditor((s) => s.messages);
  const busy = useEditor((s) => s.mentorBusy);
  const ask = useAskMentor();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy]);

  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={clsx(m.role === "user" && "flex justify-end")}
            >
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-md bg-bg-elevated px-3 py-2 text-[12px] leading-relaxed text-fg">{m.content}</p>
              ) : (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ai">
                    <Sparkles className="h-3 w-3" /> Mentor
                  </div>
                  <p className="text-[12px] leading-relaxed text-fg-2">{m.content}</p>
                  {m.suggestion && Object.keys(m.suggestion).length > 0 && <SuggestionCard msg={m} />}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && <Typing />}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-line p-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => ask(p)}
              className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-2 transition-colors hover:border-line-strong hover:text-fg disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
        <MentorComposer />
      </div>
    </div>
  );
}
