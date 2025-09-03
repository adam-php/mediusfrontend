-- Conversations and messages (idempotent)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  starter_id uuid not null,
  recipient_id uuid not null,
  listing_id uuid,
  title text,
  created_at timestamptz default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text,
  image_url text,
  created_at timestamptz default now()
);

-- RLS policies
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for select using (auth.uid() in (starter_id, recipient_id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() = starter_id);

drop policy if exists conv_msgs_select on public.conversation_messages;
create policy conv_msgs_select on public.conversation_messages
  for select using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.starter_id, c.recipient_id)
  ));

drop policy if exists conv_msgs_insert on public.conversation_messages;
create policy conv_msgs_insert on public.conversation_messages
  for insert with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.starter_id, c.recipient_id)
  ));

