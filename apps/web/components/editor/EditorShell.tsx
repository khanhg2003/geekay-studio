"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, SlidersHorizontal, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { Topbar } from "./Topbar";
import { PresetSidebar } from "./PresetSidebar";
import { CanvasViewport } from "./Canvas/CanvasViewport";
import { AdjustPanel } from "./AdjustPanel/AdjustPanel";
import { MentorComposer, MentorPanel } from "./MentorPanel/MentorPanel";
import { Toast } from "@/components/ui/Toast";
import { useEditor, type MobilePanel, type RightTab } from "@/stores/editorStore";

const spring = { type: "spring", stiffness: 400, damping: 36 } as const;

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA/.test(t.tagName)) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); s.redo(); }
      else if (e.key === "[") s.setLeftOpen(!s.leftOpen);
      else if (e.key.toLowerCase() === "m" && !mod) s.setRightTab(s.rightTab === "mentor" ? "adjust" : "mentor");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function RightPanel() {
  const tab = useEditor((s) => s.rightTab);
  const setTab = useEditor((s) => s.setRightTab);
  const busy = useEditor((s) => s.mentorBusy);

  const tabs: { id: RightTab; label: string; icon: React.ReactNode }[] = [
    { id: "adjust", label: "Điều chỉnh", icon: <SlidersHorizontal className="h-3 w-3" /> },
    { id: "mentor", label: "AI Mentor", icon: <Sparkles className={clsx("h-3 w-3", tab === "mentor" ? "text-ai" : "")} /> },
  ];

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-line bg-bg-panel md:flex">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx("relative flex h-full items-center gap-1.5 px-2.5 text-[12px] transition-colors", tab === t.id ? "text-fg" : "text-fg-3 hover:text-fg-2")}
          >
            {t.icon}{t.label}
            {t.id === "mentor" && busy && tab !== "mentor" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai" />}
            {tab === t.id && <motion.span layoutId="right-tab" className="absolute inset-x-2 -bottom-px h-px bg-fg" />}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "mentor" ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col"
          >
            {tab === "adjust" ? (
              <>
                <AdjustPanel className="flex-1" />
                {/* Thanh Mentor mini – luôn hiện, không chiếm chỗ */}
                <div className="border-t border-line p-3">
                  <MentorComposer compact onSubmitted={() => setTab("mentor")} />
                </div>
              </>
            ) : (
              <MentorPanel className="flex-1" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

function MobileSheet() {
  const panel = useEditor((s) => s.mobilePanel);
  const setPanel = useEditor((s) => s.setMobilePanel);
  const titles: Record<Exclude<MobilePanel, "none">, string> = { presets: "Presets", adjust: "Điều chỉnh", mentor: "AI Mentor" };

  return (
    <AnimatePresence>
      {panel !== "none" && (
        <motion.div
          key="sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={spring}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) setPanel("none"); }}
          className="absolute inset-x-0 bottom-0 z-30 flex h-[58%] flex-col rounded-t-xl border-t border-line-strong bg-bg-panel shadow-[0_-12px_40px_rgba(0,0,0,0.5)] md:hidden"
        >
          <div className="flex shrink-0 cursor-grab items-center justify-between px-4 pb-1 pt-2">
            <span className="text-[12px] font-medium text-fg">{titles[panel]}</span>
            <div className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/15" />
            <button type="button" aria-label="Đóng" onClick={() => setPanel("none")} className="rounded p-1 text-fg-3 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col" onPointerDownCapture={(e) => e.stopPropagation()}>
            {panel === "presets" && <PresetSidebar className="flex-1" />}
            {panel === "adjust" && <AdjustPanel className="flex-1" />}
            {panel === "mentor" && <MentorPanel className="flex-1" />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileTabBar() {
  const panel = useEditor((s) => s.mobilePanel);
  const setPanel = useEditor((s) => s.setMobilePanel);
  const items: { id: Exclude<MobilePanel, "none">; label: string; icon: React.ReactNode }[] = [
    { id: "presets", label: "Presets", icon: <Layers className="h-4 w-4" /> },
    { id: "adjust", label: "Điều chỉnh", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: "mentor", label: "Mentor", icon: <Sparkles className="h-4 w-4" /> },
  ];
  return (
    <nav className="relative z-40 flex h-14 shrink-0 border-t border-line bg-bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map((it) => (
        <button
          key={it.id}
          id={`mobile-tab-${it.id}`}
          type="button"
          onClick={() => setPanel(panel === it.id ? "none" : it.id)}
          className={clsx(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
            panel === it.id ? (it.id === "mentor" ? "text-ai" : "text-fg") : "text-fg-3",
          )}
        >
          {it.icon}{it.label}
        </button>
      ))}
    </nav>
  );
}

export function EditorShell() {
  useHotkeys();
  const leftOpen = useEditor((s) => s.leftOpen);
  const setLeftOpen = useEditor((s) => s.setLeftOpen);

  return (
    <div className="flex h-[100dvh] flex-col bg-bg-app text-fg">
      <Topbar />
      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar trái cố định (≥1280px) */}
        <aside className="hidden w-[248px] shrink-0 border-r border-line bg-bg-panel xl:flex">
          <PresetSidebar className="flex-1" />
        </aside>

        {/* Drawer trái (768–1279px) */}
        <AnimatePresence>
          {leftOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setLeftOpen(false)}
                className="absolute inset-0 z-20 hidden bg-black/40 md:block xl:hidden"
              />
              <motion.aside
                initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={spring}
                className="absolute inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-bg-panel shadow-2xl md:flex xl:hidden"
              >
                <PresetSidebar className="flex-1" />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="relative min-w-0 flex-1">
          <CanvasViewport />
        </main>

        <RightPanel />
        <MobileSheet />
        <Toast />
      </div>
      <MobileTabBar />
    </div>
  );
}
