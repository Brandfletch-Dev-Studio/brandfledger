-- NEW FILE: supabase/migrations/002_storage_and_subscriptions.sql
-- Adds: receipts storage bucket, subscriptions table, subscription policies, profiles view

-- ============================================================
-- SUBSCRIPTIONS (wire up the existing schema column)
-- ============================================================
create table if not exists subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid references businesses(id) on delete cascade not null unique,
  plan         text not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  status       text not null default 'active' check (status in ('active','past_due','cancelled','trialing')),
  stripe_subscription_id text,
  stripe_customer_id     text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table subscriptions enable row level security;
create policy "subscription_owner" on subscriptions for all using (
  business_id in (select id from businesses where owner_id = auth.uid())
);

-- ============================================================
-- STORAGE BUCKET: receipts
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload receipts to their own business folder
create policy "receipt_upload" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and auth.role() = 'authenticated'
  );

create policy "receipt_select" on storage.objects
  for select using (bucket_id = 'receipts');

create policy "receipt_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- PROFILES VIEW (for team member lookup by email)
-- ============================================================
-- This exposes auth.users safely for within-app lookups
create or replace view public.profiles as
  select
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    created_at
  from auth.users;

-- Grant select to authenticated users (safe — no passwords exposed)
grant select on public.profiles to authenticated;
