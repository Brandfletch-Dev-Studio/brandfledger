-- Add owner_id to businesses table for multi-tenant auth
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

-- Enable RLS on businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Policy: users can see and manage their own businesses
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
CREATE POLICY "Users can view own businesses" ON businesses
  FOR SELECT USING (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
CREATE POLICY "Users can insert own businesses" ON businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
CREATE POLICY "Users can update own businesses" ON businesses
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;
CREATE POLICY "Users can delete own businesses" ON businesses
  FOR DELETE USING (auth.uid() = owner_id);

-- Enable RLS on transactions (scoped by business_id)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage transactions for their businesses
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on products, categories, invoices, customers, etc.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Products policies
DROP POLICY IF EXISTS "Users can manage own products" ON products;
CREATE POLICY "Users can manage own products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
  );

-- Categories policies
DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
  );

-- Invoices policies
DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
CREATE POLICY "Users can manage own invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
  );

-- Customers policies
DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
CREATE POLICY "Users can manage own customers" ON customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
  );

-- Team members policies
DROP POLICY IF EXISTS "Users can manage own team" ON team_members;
CREATE POLICY "Users can manage own team" ON team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
  );

-- Platform settings: readable by all authenticated users, writable by service role only
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON platform_settings;
CREATE POLICY "Authenticated users can read platform settings" ON platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
