"use client";
import type { Adjustments } from "./adjustments";
import type { Preset } from "./presets";

const STORAGE_KEY = "geekay.customPresets.v1";
/** Bắn ra khi danh sách preset riêng đổi — PresetSidebar lắng nghe để tự cập nhật trong cùng tab. */
export const CUSTOM_PRESETS_EVENT = "geekay-custom-presets-changed";

export type CustomPreset = Preset & { createdAt: number };

function safeParse(raw: string | null): CustomPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Preset do người dùng tự lưu (từ gợi ý AI hoặc chỉnh tay) — lưu cục bộ trên trình duyệt. */
export function loadCustomPresets(): CustomPreset[] {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function persist(list: CustomPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private browsing / storage đầy — bỏ qua, không chặn luồng chính của người dùng.
  }
  window.dispatchEvent(new Event(CUSTOM_PRESETS_EVENT));
}

export function saveCustomPreset(name: string, adjustments: Partial<Adjustments>): CustomPreset {
  const preset: CustomPreset = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Preset của tôi",
    category: "Của bạn",
    adjustments,
    createdAt: Date.now(),
  };
  const list = [...loadCustomPresets(), preset];
  persist(list);
  return preset;
}

export function deleteCustomPreset(id: string) {
  persist(loadCustomPresets().filter((p) => p.id !== id));
}
