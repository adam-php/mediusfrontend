-- ===========================================
-- MEDIUS ESCROW & MARKETPLACE SCHEMA
-- Complete database schema with RLS policies
-- ===========================================

-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ===========================================
-- USER PROFILES & AUTHENTICATION
-- ===========================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text,
  display_name text,
  bio text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  rating decimal(3,2) default 5.0 check (rating >= 0 and rating <= 5),
  volume_usd decimal(12,2) default 0,
  referred_by uuid references public.profiles(id),
  referral_code text unique,
  referral_payout_address text,
  referral_payout_currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- MARKETPLACE LISTINGS
-- ===========================================

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price_usd decimal(12,2) not null check (price_usd > 0),
  accept_all boolean not null default true,
  payment_methods text[] not null default array['crypto', 'paypal'],
  status text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  tags text[] default array[]::text[],
  -- NEW: Dynamic delivery and pricing fields
  fulfillment_url text,
  pricing_rules jsonb not null default '{}'::jsonb,
  rating decimal(3,2) default 5.0,
  seller_volume_usd decimal(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- URL validation constraint for fulfillment_url
alter table public.listings
  add constraint listings_fulfillment_url_scheme_chk
    check (fulfillment_url is null or fulfillment_url ~* '^https?://');

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.listing_currencies (
  listing_id uuid not null references public.listings(id) on delete cascade,
  currency text not null,
  network text, -- For crypto (ERC20, BEP20, etc.)
  created_at timestamptz default now(),
  primary key (listing_id, currency, coalesce(network, ''))
);

-- ===========================================
-- REVIEWS & REPORTS
-- ===========================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(listing_id, reviewer_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('listing', 'profile', 'message')),
  entity_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- MODERATION SYSTEM
-- ===========================================

create table if not exists public.moderation_config (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai',
  api_key text,
  thresholds jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- CART & CHECKOUT
-- ===========================================

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  payment_method text not null check (payment_method in ('crypto', 'paypal')),
  selected_currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, listing_id)
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_usd decimal(12,2) not null,
  payment_method text not null,
  selected_currency text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  paypal_order_id text,
  crypto_address text,
  groups jsonb, -- For checkout grouping logic
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- ESCROW SYSTEM
-- ===========================================

create table if not exists public.escrows (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  amount_usd decimal(12,2) not null check (amount_usd > 0),
  amount_crypto decimal(18,8),
  currency text not null,
  payment_method text not null check (payment_method in ('crypto', 'paypal')),
  status text not null default 'pending' check (status in ('pending', 'funded', 'processing', 'completed', 'cancelled', 'refunded', 'release_failed')),
  -- PayPal fields
  paypal_order_id text,
  paypal_authorization_id text,
  paypal_capture_id text,
  -- Crypto fields
  deposit_address text,
  buyer_refund_address text,
  -- NEW: Dynamic delivery tracking
  funded_at timestamptz,
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending','success','failed')),
  fulfillment_attempts integer not null default 0,
  fulfillment_last_code integer,
  fulfillment_last_error text,
  fulfillment_last_at timestamptz,
  fulfillment_idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.escrow_messages (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  message_type text not null default 'text' check (message_type in ('text', 'system', 'address_response', 'refund_address_response', 'amount_confirmation')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.escrow_wallets (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows(id) on delete cascade,
  currency text not null,
  network text,
  address text not null,
  memo text,
  balance decimal(18,8) default 0,
  required_amount decimal(18,8) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(escrow_id, currency, coalesce(network, ''))
);

-- ===========================================
-- TRANSACTIONS & PAYMENTS
-- ===========================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows(id) on delete cascade,
  type text not null check (type in ('deposit', 'release', 'refund')),
  amount decimal(18,8) not null,
  currency text not null,
  network text,
  tx_hash text,
  from_address text,
  to_address text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  confirmations integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- REFERRAL SYSTEM
-- ===========================================

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd decimal(12,2) not null,
  amount_crypto decimal(18,8),
  currency text not null,
  payout_address text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  tx_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(escrow_id, referrer_id)
);

create table if not exists public.referral_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('earned', 'paid_out')),
  amount_usd decimal(12,2) not null,
  description text,
  escrow_id uuid references public.escrows(id),
  created_at timestamptz default now()
);

-- ===========================================
-- FRIENDSHIPS & SOCIAL
-- ===========================================

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id),
  check (requester_id != addressee_id)
);

-- ===========================================
-- CONVERSATIONS & MESSAGES
-- ===========================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  starter_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  title text,
  created_at timestamptz default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  image_url text,
  created_at timestamptz default now()
);

-- ===========================================
-- SEARCH & RECOMMENDATIONS
-- ===========================================

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text,
  filters jsonb default '{}'::jsonb,
  results_count integer,
  created_at timestamptz default now()
);

-- ===========================================
-- ADMIN & SECURITY
-- ===========================================

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  details jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists public.vault_secrets (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_referral_code on public.profiles(referral_code);

create index if not exists idx_listings_seller_id on public.listings(seller_id);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_created_at on public.listings(created_at);

create index if not exists idx_listing_images_listing_id on public.listing_images(listing_id);
create index if not exists idx_listing_images_sort_order on public.listing_images(listing_id, sort_order);

create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_cart_items_listing_id on public.cart_items(listing_id);

create index if not exists idx_escrows_buyer_id on public.escrows(buyer_id);
create index if not exists idx_escrows_seller_id on public.escrows(seller_id);
create index if not exists idx_escrows_listing_id on public.escrows(listing_id);
create index if not exists idx_escrows_status on public.escrows(status);
create index if not exists idx_escrows_funded_at on public.escrows(funded_at);
create index if not exists idx_escrows_paypal_order_id on public.escrows(paypal_order_id);

create index if not exists idx_escrow_messages_escrow_id on public.escrow_messages(escrow_id);
create index if not exists idx_escrow_messages_created_at on public.escrow_messages(created_at);

create index if not exists idx_transactions_escrow_id on public.transactions(escrow_id);
create index if not exists idx_transactions_status on public.transactions(status);

create index if not exists idx_reports_entity on public.reports(entity_type, entity_id);
create index if not exists idx_reports_status on public.reports(status);

create index if not exists idx_conversations_participants on public.conversations(starter_id, recipient_id);
create index if not exists idx_conversation_messages_conversation_id on public.conversation_messages(conversation_id);
