"use client";
import { useMemo } from "react";
import { create } from "zustand";
import {
  DEFAULT_ADJUSTMENTS, clampAdjustments,
  type Adjustments, type AdjustmentKey,
} from "@/lib/adjustments";

export interface HistoryEntry {
  id: number;
  label: string;
  source: "manual" | "preset" | "ai" | "init";
  adjustments: Adjustments;
}

export interface MentorMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestion?: Partial<Adjustments>;
  applied?: boolean;
}

export type RightTab = "adjust" | "mentor";
export type MobilePanel = "none" | "presets" | "adjust" | "mentor";

export interface Toast {
  id: number;
  message: string;
  tone: "error" | "info";
}

interface EditorState {
  imageUrl: string;
  fileName: string;
  /** File gốc do người dùng tải lên (null với ảnh mẫu) — dùng để xuất full-res qua /v1/render. */
  originalFile: File | null;
  adjustments: Adjustments;
  /** Thông số xem trước tạm thời (hover gợi ý AI / preset) */
  preview: Partial<Adjustments> | null;
  aiTargets: Partial<Adjustments> | null;

  history: HistoryEntry[];
  cursor: number;

  compare: boolean;
  split: number;
  zoom: number | "fit";

  rightTab: RightTab;
  leftOpen: boolean;
  mobilePanel: MobilePanel;

  messages: MentorMessage[];
  mentorBusy: boolean;

  toast: Toast | null;
  showToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;

  setImage: (url: string, name: string, file?: File | null) => void;
  setLive: (key: AdjustmentKey, value: number) => void;
  commit: (label: string, source?: HistoryEntry["source"]) => void;
  apply: (partial: Partial<Adjustments>, label: string, source: HistoryEntry["source"], replace?: boolean) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  jumpTo: (index: number) => void;

  setPreview: (p: Partial<Adjustments> | null) => void;
  setCompare: (v: boolean) => void;
  setSplit: (v: number) => void;
  setZoom: (z: number | "fit") => void;
  setRightTab: (t: RightTab) => void;
  setLeftOpen: (v: boolean) => void;
  setMobilePanel: (p: MobilePanel) => void;

  pushMessage: (m: Omit<MentorMessage, "id">) => number;
  markApplied: (id: number) => void;
  setMentorBusy: (v: boolean) => void;
}

let uid = 1;
const initEntry = (): HistoryEntry => ({
  id: uid++, label: "Ảnh gốc", source: "init", adjustments: { ...DEFAULT_ADJUSTMENTS },
});
const MAX_HISTORY = 100;

export const useEditor = create<EditorState>((set, get) => ({
  imageUrl: "/sample.png",
  fileName: "bien_hoang_hon.png",
  originalFile: null,
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  preview: null,
  aiTargets: null,
  history: [initEntry()],
  cursor: 0,
  compare: false,
  split: 0.5,
  zoom: "fit",
  rightTab: "adjust",
  leftOpen: false,
  mobilePanel: "none",
  messages: [
    {
      id: uid++, role: "assistant",
      content: "Xin chào, tôi là Mentor màu của Geekay. Hãy nhờ tôi phân tích ảnh, hoặc hỏi về một vấn đề cụ thể như tone da, ánh sáng hay mood.",
    },
  ],
  mentorBusy: false,

  toast: null,

  setImage: (url, name, file = null) =>
    set({
      imageUrl: url, fileName: name, originalFile: file, adjustments: { ...DEFAULT_ADJUSTMENTS },
      history: [initEntry()], cursor: 0, preview: null, aiTargets: null, zoom: "fit",
    }),

  setLive: (key, value) => set((s) => ({ adjustments: { ...s.adjustments, [key]: value } })),

  commit: (label, source = "manual") => {
    const { history, cursor, adjustments } = get();
    const last = history[cursor].adjustments;
    const changed = (Object.keys(adjustments) as AdjustmentKey[]).some((k) => adjustments[k] !== last[k]);
    if (!changed) return;
    const next = [...history.slice(0, cursor + 1), { id: uid++, label, source, adjustments: { ...adjustments } }]
      .slice(-MAX_HISTORY);
    set({ history: next, cursor: next.length - 1 });
  },

  apply: (partial, label, source, replace = false) => {
    const base = replace ? DEFAULT_ADJUSTMENTS : get().adjustments;
    set({ adjustments: { ...base, ...clampAdjustments(partial) }, preview: null,
      aiTargets: source === "ai" ? partial : get().aiTargets });
    get().commit(label, source);
  },

  reset: () => get().apply({}, "Đặt lại tất cả", "manual", true),

  undo: () => {
    const { cursor, history } = get();
    if (cursor === 0) return;
    set({ cursor: cursor - 1, adjustments: { ...history[cursor - 1].adjustments } });
  },
  redo: () => {
    const { cursor, history } = get();
    if (cursor >= history.length - 1) return;
    set({ cursor: cursor + 1, adjustments: { ...history[cursor + 1].adjustments } });
  },
  jumpTo: (i) => set((s) => ({ cursor: i, adjustments: { ...s.history[i].adjustments } })),

  setPreview: (p) => set({ preview: p }),
  setCompare: (v) => set({ compare: v }),
  setSplit: (v) => set({ split: Math.min(1, Math.max(0, v)) }),
  setZoom: (z) => set({ zoom: z }),
  setRightTab: (t) => set({ rightTab: t }),
  setLeftOpen: (v) => set({ leftOpen: v }),
  setMobilePanel: (p) => set({ mobilePanel: p }),

  pushMessage: (m) => {
    const id = uid++;
    set((s) => ({ messages: [...s.messages, { ...m, id }] }));
    return id;
  },
  markApplied: (id) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, applied: true } : m)) })),

  showToast: (message, tone = "error") => set({ toast: { id: uid++, message, tone } }),
  dismissToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
  setMentorBusy: (v) => set({ mentorBusy: v }),
}));

/** Thông số thực sự hiển thị = adjustments + preview tạm */
export const useEffectiveAdjustments = () => {
  const adjustments = useEditor((s) => s.adjustments);
  const preview = useEditor((s) => s.preview);
  return useMemo(() => (preview ? { ...adjustments, ...preview } : adjustments), [adjustments, preview]);
};
