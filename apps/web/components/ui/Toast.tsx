"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";
import { useEditor } from "@/stores/editorStore";

const AUTO_DISMISS_MS = 5000;

export function Toast() {
  const toast = useEditor((s) => s.toast);
  const dismiss = useEditor((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-50 flex justify-center px-4 md:bottom-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="pointer-events-auto flex max-w-[420px] items-start gap-2 rounded-md border border-line-strong bg-bg-elevated/95 px-3 py-2.5 text-[12px] text-fg-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            {toast.tone === "error" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            ) : (
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
            )}
            <span className="leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
