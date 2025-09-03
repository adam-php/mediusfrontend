-- ===========================================
-- ROW LEVEL SECURITY POLICIES
-- Complete RLS policies for Medius schema
-- ===========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_currencies enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_config enable row level security;
alter table public.cart_items enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.escrows enable row level security;
alter table public.escrow_messages enable row level security;
alter table public.escrow_wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.referral_payouts enable row level security;
alter table public.referral_ledger enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.search_history enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.security_events enable row level security;
alter table public.vault_secrets enable row level security;

-- PROFILES POLICIES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);

-- LISTINGS POLICIES
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select using (status = 'active' or auth.uid() = seller_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update using (auth.uid() = seller_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete using (auth.uid() = seller_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- LISTING IMAGES POLICIES
drop policy if exists listing_images_select on public.listing_images;
create policy listing_images_select on public.listing_images for select using (
  exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')))
);

drop policy if exists listing_images_insert on public.listing_images;
create policy listing_images_insert on public.listing_images for insert with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);

drop policy if exists listing_images_delete on public.listing_images;
create policy listing_images_delete on public.listing_images for delete using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);

-- CART ITEMS POLICIES
drop policy if exists cart_items_select on public.cart_items;
create policy cart_items_select on public.cart_items for select using (auth.uid() = user_id);

drop policy if exists cart_items_insert on public.cart_items;
create policy cart_items_insert on public.cart_items for insert with check (auth.uid() = user_id);

drop policy if exists cart_items_update on public.cart_items;
create policy cart_items_update on public.cart_items for update using (auth.uid() = user_id);

drop policy if exists cart_items_delete on public.cart_items;
create policy cart_items_delete on public.cart_items for delete using (auth.uid() = user_id);

-- ESCROWS POLICIES
drop policy if exists escrows_select on public.escrows;
create policy escrows_select on public.escrows for select using (
  auth.uid() in (buyer_id, seller_id) or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists escrows_insert on public.escrows;
create policy escrows_insert on public.escrows for insert with check (auth.uid() = buyer_id);

drop policy if exists escrows_update on public.escrows;
create policy escrows_update on public.escrows for update using (
  auth.uid() in (buyer_id, seller_id) or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ESCROW MESSAGES POLICIES
drop policy if exists escrow_messages_select on public.escrow_messages;
create policy escrow_messages_select on public.escrow_messages for select using (
  exists (select 1 from public.escrows e where e.id = escrow_id and auth.uid() in (e.buyer_id, e.seller_id)) or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists escrow_messages_insert on public.escrow_messages;
create policy escrow_messages_insert on public.escrow_messages for insert with check (
  exists (select 1 from public.escrows e where e.id = escrow_id and auth.uid() in (e.buyer_id, e.seller_id))
);

-- CONVERSATIONS POLICIES
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select using (auth.uid() in (starter_id, recipient_id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert with check (auth.uid() = starter_id);

-- CONVERSATION MESSAGES POLICIES
drop policy if exists conversation_messages_select on public.conversation_messages;
create policy conversation_messages_select on public.conversation_messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.starter_id, c.recipient_id))
);

drop policy if exists conversation_messages_insert on public.conversation_messages;
create policy conversation_messages_insert on public.conversation_messages for insert with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.starter_id, c.recipient_id))
);

-- REVIEWS POLICIES
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (true);

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (
  auth.uid() = reviewer_id and
  exists (select 1 from public.escrows e where e.listing_id = reviews.listing_id and e.buyer_id = auth.uid() and e.status = 'completed')
);

-- REPORTS POLICIES
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select using (
  auth.uid() = reporter_id or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ADMIN POLICIES (admin-only access)
drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists admin_audit_log_insert on public.admin_audit_log;
create policy admin_audit_log_insert on public.admin_audit_log for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists security_events_select on public.security_events;
create policy security_events_select on public.security_events for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists security_events_insert on public.security_events;
create policy security_events_insert on public.security_events for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists vault_secrets_select on public.vault_secrets;
create policy vault_secrets_select on public.vault_secrets for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists vault_secrets_insert on public.vault_secrets;
create policy vault_secrets_insert on public.vault_secrets for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists vault_secrets_update on public.vault_secrets;
create policy vault_secrets_update on public.vault_secrets for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists vault_secrets_delete on public.vault_secrets;
create policy vault_secrets_delete on public.vault_secrets for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- MODERATION CONFIG (admin-only)
drop policy if exists moderation_config_select on public.moderation_config;
create policy moderation_config_select on public.moderation_config for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists moderation_config_insert on public.moderation_config;
create policy moderation_config_insert on public.moderation_config for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists moderation_config_update on public.moderation_config;
create policy moderation_config_update on public.moderation_config for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- FRIENDSHIPS POLICIES
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select using (auth.uid() in (requester_id, addressee_id));

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert with check (auth.uid() = requester_id);

drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update using (auth.uid() in (requester_id, addressee_id));

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete using (auth.uid() in (requester_id, addressee_id));

-- REFERRAL SYSTEM POLICIES
drop policy if exists referral_payouts_select on public.referral_payouts;
create policy referral_payouts_select on public.referral_payouts for select using (
  auth.uid() in (
    select e.buyer_id from public.escrows e where e.id = referral_payouts.escrow_id
  ) or
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists referral_ledger_select on public.referral_ledger;
create policy referral_ledger_select on public.referral_ledger for select using (auth.uid() = user_id);

-- SEARCH HISTORY POLICIES
drop policy if exists search_history_select on public.search_history;
create policy search_history_select on public.search_history for select using (auth.uid() = user_id);

drop policy if exists search_history_insert on public.search_history;
create policy search_history_insert on public.search_history for insert with check (auth.uid() = user_id);
