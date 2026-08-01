-- ============================================================
-- USER MANAGEMENT RESTRUCTURE
-- Creates a proper `profiles` table to replace the ad-hoc
-- `accounts` table + fragile auth.users admin API lookups.
-- Backfills all existing data. Does NOT drop any tables.
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text NOT NULL DEFAULT '',
  full_name            text NOT NULL DEFAULT '',
  avatar_url           text,
  subscription_status  text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
  plan                 text DEFAULT NULL
    CHECK (plan IS NULL OR plan IN ('free', 'starter', 'pro', 'enterprise', 'monthly', 'annual')),
  trial_ends_at        timestamptz,
  subscription_ends_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles (subscription_status);

-- 2. RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, subscription_status, trial_ends_at, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'full_name'),
      (NEW.raw_user_meta_data->>'name'),
      ''
    ),
    'trial',
    now() + interval '14 days',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Auto-update profile when auth user changes
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  END IF;
  IF NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data THEN
    UPDATE public.profiles
    SET full_name = COALESCE(
      (NEW.raw_user_meta_data->>'full_name'),
      (NEW.raw_user_meta_data->>'name'),
      full_name
    ), updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- 5. Backfill profiles from accounts + auth.users
INSERT INTO public.profiles (id, email, full_name, subscription_status, plan, trial_ends_at, subscription_ends_at, created_at, updated_at)
SELECT
  a.user_id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    CASE WHEN u.email IS NOT NULL THEN split_part(u.email, '@', 1) ELSE '' END
  ),
  COALESCE(a.subscription_status, 'trial'),
  a.plan,
  a.trial_ends_at,
  a.subscription_ends_at,
  COALESCE(a.created_at, u.created_at, now()),
  COALESCE(a.updated_at, now())
FROM public.accounts a
LEFT JOIN auth.users u ON u.id = a.user_id
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  subscription_status = EXCLUDED.subscription_status,
  plan = EXCLUDED.plan,
  trial_ends_at = EXCLUDED.trial_ends_at,
  subscription_ends_at = EXCLUDED.subscription_ends_at,
  updated_at = now()
WHERE
  public.profiles.email = '' OR public.profiles.full_name = '';

-- Also insert auth.users not in accounts
INSERT INTO public.profiles (id, email, full_name, subscription_status, trial_ends_at, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    CASE WHEN u.email IS NOT NULL THEN split_part(u.email, '@', 1) ELSE '' END
  ),
  'trial',
  now() + interval '14 days',
  u.created_at,
  now()
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 6. Backfill business_members for all business owners
INSERT INTO public.business_members (business_id, user_id, role, created_at)
SELECT b.id, b.owner_id, 'owner', COALESCE(b.created_at, now())
FROM public.businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_members bm
  WHERE bm.business_id = b.id AND bm.user_id = b.owner_id
)
ON CONFLICT (business_id, user_id) DO NOTHING;

-- 7. Clean up subscriptions duplicates (keep latest per business)
DELETE FROM public.subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (business_id) id
  FROM public.subscriptions
  ORDER BY business_id, created_at DESC
);

-- 8. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 9. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Done. No tables dropped. accounts and team_members remain as backups.
