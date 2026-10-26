"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";

export function AccordionSection({
  label, defaultOpen = true, dirty, onReset, children,
}: {
  label: string;
  defaultOpen?: boolean;
  dirty?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex h-9 items-center px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-2 hover:text-fg"
          aria-expanded={open}
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="h-3 w-3" />
          </motion.span>
          {label}
          {dirty && <span className="ml-1 h-1 w-1 rounded-full bg-fg-2" />}
        </button>
        {dirty && onReset && (
          <button
            type="button"
            title={`Đặt lại ${label}`}
            onClick={onReset}
            className="rounded p-1 text-fg-3 hover:bg-white/5 hover:text-fg"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
