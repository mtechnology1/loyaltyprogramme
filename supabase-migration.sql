-- LoyalSip Supabase Migration
-- Run this in your Supabase SQL Editor to create the required tables

-- Config table (single row for shop settings)
CREATE TABLE config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_name TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#6F4E37',
  background_color TEXT DEFAULT '#FFF8F0',
  reward_threshold INTEGER DEFAULT 8,
  reward_description TEXT DEFAULT 'Free coffee of your choice',
  shop_url TEXT DEFAULT '',
  setup_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers table
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  pass_code TEXT UNIQUE NOT NULL,
  visits INTEGER DEFAULT 0,
  redeemed INTEGER DEFAULT 0,
  join_date BIGINT NOT NULL,
  last_visit BIGINT,
  history JSONB DEFAULT '[]'::jsonb
);

-- Pending stamp/redemption requests
CREATE TABLE pending_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'stamp',
  status TEXT DEFAULT 'pending',
  created_at BIGINT NOT NULL
);

-- Resolved requests (for customer polling)
CREATE TABLE resolved_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'stamp',
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  resolved_at BIGINT NOT NULL
);

-- Recent stamps (barista activity feed)
CREATE TABLE recent_stamps (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  visits INTEGER DEFAULT 0,
  is_redemption BOOLEAN DEFAULT false,
  time BIGINT NOT NULL
);

-- Enable Row Level Security with public access policies
-- (suitable for a simple loyalty app using the anon key)
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolved_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access on config" ON config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on pending_requests" ON pending_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on resolved_requests" ON resolved_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on recent_stamps" ON recent_stamps FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone != '';
CREATE INDEX idx_customers_email ON customers(email) WHERE email != '';
CREATE INDEX idx_customers_pass_code ON customers(pass_code);
CREATE INDEX idx_pending_customer_id ON pending_requests(customer_id);
CREATE INDEX idx_resolved_customer_id ON resolved_requests(customer_id);
