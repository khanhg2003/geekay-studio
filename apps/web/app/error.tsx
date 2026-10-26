"use client";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg-app px-6 text-center text-fg">
      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-fg text-[16px] font-bold text-black">G</span>
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Đã có lỗi xảy ra</h1>
        <p className="mt-1.5 max-w-sm text-[13px] text-fg-2">
          Geekay Studio gặp sự cố không mong muốn. Vui lòng thử lại — nếu còn lỗi, hãy tải lại trang.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex h-9 items-center gap-1.5 rounded-md bg-fg px-3 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Thử lại
      </button>
    </main>
  );
}
