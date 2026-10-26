-- Geekay Studio — schema khởi tạo
-- Chạy trong Supabase SQL Editor (hoặc `supabase db push` nếu dùng Supabase CLI).

create extension if not exists pgcrypto;

-- ===================== profiles =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Tự tạo profile khi có user mới đăng ký qua Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===================== photos =====================
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  file_name text,
  width int,
  height int,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);
create policy "photos_insert_own" on public.photos
  for insert with check (auth.uid() = user_id);
create policy "photos_update_own" on public.photos
  for update using (auth.uid() = user_id);
create policy "photos_delete_own" on public.photos
  for delete using (auth.uid() = user_id);

-- Postgres KHÔNG tự tạo index cho cột khoá ngoại — cần tạo thủ công để RLS (auth.uid() = user_id)
-- và truy vấn "ảnh của tôi" không phải quét toàn bảng khi dữ liệu lớn dần.
create index if not exists photos_user_id_created_at_idx on public.photos (user_id, created_at desc);

-- ===================== presets =====================
-- Preset hệ thống (is_system = true, user_id null, đọc được bởi mọi người) + preset riêng của user.
create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  category text not null default 'Tuỳ chỉnh',
  adjustments jsonb not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.presets enable row level security;

create policy "presets_select_own_or_system" on public.presets
  for select using (is_system or auth.uid() = user_id);
create policy "presets_insert_own" on public.presets
  for insert with check (auth.uid() = user_id and not is_system);
create policy "presets_update_own" on public.presets
  for update using (auth.uid() = user_id and not is_system);
create policy "presets_delete_own" on public.presets
  for delete using (auth.uid() = user_id and not is_system);

create index if not exists presets_user_id_idx on public.presets (user_id);
-- Lọc preset hệ thống là truy vấn phổ biến nhất (mọi user đều load) nên tách riêng 1 index thay vì quét toàn bảng.
create index if not exists presets_is_system_idx on public.presets (is_system) where is_system;

-- ===================== edit_history =====================
create table if not exists public.edit_history (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  source text not null check (source in ('manual', 'preset', 'ai', 'init')),
  adjustments jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.edit_history enable row level security;

create policy "edit_history_select_own" on public.edit_history
  for select using (auth.uid() = user_id);
create policy "edit_history_insert_own" on public.edit_history
  for insert with check (auth.uid() = user_id);

create index if not exists edit_history_photo_id_idx on public.edit_history (photo_id, created_at desc);
create index if not exists edit_history_user_id_idx on public.edit_history (user_id);

-- ===================== storage: bucket 'photos' =====================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Mỗi user chỉ truy cập được object trong thư mục "{user_id}/..." của chính họ
create policy "storage_photos_select_own" on storage.objects
  for select using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_photos_update_own" on storage.objects
  for update using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
