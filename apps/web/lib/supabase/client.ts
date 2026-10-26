"use client";
import { createBrowserClient } from "@supabase/ssr";

let cached: ReturnType<typeof createBrowserClient> | null | undefined;

/**
 * Trả về null nếu chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY — cho phép UI (vd. trang đăng
 * nhập) tự rơi về chế độ demo cục bộ thay vì crash khi chạy chưa có backend Supabase.
 */
export function getSupabaseBrowserClient() {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    cached = null;
    return cached;
  }
  cached = createBrowserClient(url, anonKey);
  return cached;
}
