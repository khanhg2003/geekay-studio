"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setState("sending");
    setError(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      // Chưa cấu hình Supabase — chạy chế độ demo cục bộ để vẫn xem được giao diện.
      await new Promise((r) => setTimeout(r, 900));
      setState("sent");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
      return;
    }
    setState("sent");
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg-app px-6">
      <div className="w-full max-w-[340px]">
        <div className="mb-10 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-fg text-[12px] font-bold text-black">G</span>
          <span className="text-[14px] font-semibold tracking-tight">Geekay Studio</span>
        </div>

        <AnimatePresence mode="wait">
          {state !== "sent" ? (
            <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <h1 className="text-[22px] font-semibold tracking-tight">Đăng nhập</h1>
              <p className="mt-1.5 text-[13px] text-fg-2">Chúng tôi sẽ gửi một liên kết đăng nhập tới email của bạn.</p>

              <label htmlFor="email" className="mt-8 block text-[12px] text-fg-2">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@vidu.com"
                className="mt-1.5 h-10 w-full rounded-md border border-line-strong bg-bg-panel px-3 text-[13px] text-fg placeholder:text-fg-3 outline-none transition-colors focus:border-white/30"
              />
              {error && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              )}
              <button
                id="btn-login"
                type="submit"
                disabled={!valid || state === "sending"}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-fg text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Gửi liên kết <ArrowRight className="h-4 w-4" /></>}
              </button>
            </motion.form>
          ) : (
            <motion.div key="sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong">
                <Mail className="h-4 w-4 text-fg-2" />
              </div>
              <h1 className="mt-6 text-[22px] font-semibold tracking-tight">Kiểm tra hộp thư</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
                Đã gửi liên kết đăng nhập tới <span className="text-fg">{email}</span>. Liên kết có hiệu lực trong 60 phút.
              </p>
              <button type="button" onClick={() => setState("idle")} className="mt-6 text-[12px] text-fg-3 underline-offset-4 hover:text-fg hover:underline">
                Dùng email khác
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
