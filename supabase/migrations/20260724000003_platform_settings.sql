-- Platform settings table for admin-configurable rates
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default pricing
INSERT INTO platform_settings (key, value) VALUES
  ('pricing', '{"monthly_rate": 15000, "currency": "MWK", "annual_rate": 150000, "trial_days": 14, "features": ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"]}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (disabled for now, same as other tables)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
