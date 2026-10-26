import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Dùng trong Server Component / Route Handler / Server Action. Trả về null nếu chưa cấu hình. */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Gọi từ Server Component (không có quyền set cookie) — bỏ qua, middleware sẽ xử lý refresh.
        }
      },
    },
  });
}
