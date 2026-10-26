"use client";
import { useMemo } from "react";
import { create } from "zustand";
import {
  ADJUSTMENT_KEYS, DEFAULT_ADJUSTMENTS, clampAdjustments,
  type Adjustments, type AdjustmentKey,
} from "@/lib/adjustments";
import type { CurveChannel, CurvePoint } from "@/lib/curve";
import type { CropRect } from "@/lib/crop";

export interface HistoryEntry {
  id: number;
  label: string;
  source: "manual" | "preset" | "ai" | "init";
  adjustments: Adjustments;
  /** null = không cắt (dùng toàn bộ ảnh đã xoay) */
  crop: CropRect | null;
  rotation: number;
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

  /** null = không cắt (dùng toàn bộ ảnh đã xoay) — toạ độ chuẩn hoá 0..1 tương đối với ảnh ĐÃ XOAY. */
  crop: CropRect | null;
  rotation: number;
  cropToolActive: boolean;
  setCropToolActive: (v: boolean) => void;
  setLiveCrop: (c: CropRect | null) => void;
  setLiveRotation: (deg: number) => void;
  commitCrop: (label: string) => void;
  resetCrop: () => void;

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
  /** Cập nhật xem trước khi kéo điểm trên đường cong — tương đương setLive nhưng cho curves. */
  setLiveCurve: (channel: CurveChannel, points: CurvePoint[]) => void;
  commitCurve: (channel: CurveChannel, label: string) => void;
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
  id: uid++, label: "Ảnh gốc", source: "init", adjustments: { ...DEFAULT_ADJUSTMENTS }, crop: null, rotation: 0,
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
  crop: null,
  rotation: 0,
  cropToolActive: false,
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
      crop: null, rotation: 0, cropToolActive: false,
    }),

  setLive: (key, value) => set((s) => ({ adjustments: { ...s.adjustments, [key]: value } })),

  setLiveCurve: (channel, points) =>
    set((s) => ({ adjustments: { ...s.adjustments, curves: { ...s.adjustments.curves, [channel]: points } } })),
  commitCurve: (_channel, label) => get().commit(label, "manual"),

  commit: (label, source = "manual") => {
    const { history, cursor, adjustments, crop, rotation } = get();
    const lastEntry = history[cursor];
    const last = lastEntry.adjustments;
    const changed =
      ADJUSTMENT_KEYS.some((k) => adjustments[k] !== last[k]) || adjustments.curves !== last.curves ||
      crop !== lastEntry.crop || rotation !== lastEntry.rotation;
    if (!changed) return;
    const next = [...history.slice(0, cursor + 1), { id: uid++, label, source, adjustments: { ...adjustments }, crop, rotation }]
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
    const e = history[cursor - 1];
    set({ cursor: cursor - 1, adjustments: { ...e.adjustments }, crop: e.crop, rotation: e.rotation });
  },
  redo: () => {
    const { cursor, history } = get();
    if (cursor >= history.length - 1) return;
    const e = history[cursor + 1];
    set({ cursor: cursor + 1, adjustments: { ...e.adjustments }, crop: e.crop, rotation: e.rotation });
  },
  jumpTo: (i) =>
    set((s) => ({ cursor: i, adjustments: { ...s.history[i].adjustments }, crop: s.history[i].crop, rotation: s.history[i].rotation })),

  setCropToolActive: (v) => set({ cropToolActive: v }),
  setLiveCrop: (c) => set({ crop: c }),
  setLiveRotation: (deg) => set({ rotation: Math.min(45, Math.max(-45, deg)) }),
  commitCrop: (label) => get().commit(label, "manual"),
  resetCrop: () => {
    set({ crop: null, rotation: 0 });
    get().commit("Đặt lại cắt ảnh", "manual");
  },

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
