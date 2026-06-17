-- FoodApp initial schema.
-- Applied to the Supabase project via MCP / SQL editor.
-- All access is server-side via the service-role key, which bypasses RLS;
-- the browser never touches these tables directly.

-- Chats: one per uploaded food photo
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_url text not null,
  food_name text,
  nutrition jsonb
);

-- Messages: conversation turns for a chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);

-- RLS on, with no public policies (server-only access).
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Public storage bucket for food photos.
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do nothing;
