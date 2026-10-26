"use client";
import { create } from "zustand";

export interface HistogramData { r: Uint32Array; g: Uint32Array; b: Uint32Array; l: Uint32Array }

export const useHistogram = create<{ data: HistogramData | null; set: (d: HistogramData) => void }>((set) => ({
  data: null,
  set: (d) => set({ data: d }),
}));
