-- ═══════════════════════════════════════════════════════════════
-- BIASHARA360 — Database Schema v1.0
-- Run this in Netlify DB (Neon) SQL editor after claiming database
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── SHOPS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  business_type         TEXT NOT NULL DEFAULT 'kiosk',
  phone                 TEXT NOT NULL UNIQUE,   -- owner's Safaricom number
  mpesa_till            TEXT,
  mpesa_paybill         TEXT,
  tier                  TEXT NOT NULL DEFAULT 'trial',
  trial_ends            TIMESTAMPTZ,
  subscription_expires  TIMESTAMPTZ,
  vat_rate              NUMERIC(5,2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier',   -- owner|manager|cashier
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT NOT NULL,
  barcode       TEXT,
  category      TEXT DEFAULT 'General',
  cost_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'piece',
  qty_in_stock  NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 5,
  expiry_date   DATE,
  image_url     TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, sku)
);

-- ─── SALES ────────────────────────────────────────────────────
-- IMMUTABLE — no updates allowed once inserted (financial integrity)
CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY,             -- generated client-side
  shop_id         UUID NOT NULL REFERENCES shops(id),
  cashier_id      UUID NOT NULL REFERENCES users(id),
  total_amount    NUMERIC(12,2) NOT NULL,
  discount        NUMERIC(12,2) DEFAULT 0,
  net_amount      NUMERIC(12,2) NOT NULL,
  payment_method  TEXT NOT NULL,               -- cash|mpesa|split|credit
  cash_received   NUMERIC(12,2),
  change_given    NUMERIC(12,2),
  mpesa_phone     TEXT,
  mpesa_code      TEXT,
  mpesa_amount    NUMERIC(12,2),
  note            TEXT,
  sold_at         TIMESTAMPTZ NOT NULL,         -- immutable timestamp
  is_void         BOOLEAN DEFAULT FALSE,
  void_reason     TEXT,
  voided_by       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SALE ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  product_name  TEXT NOT NULL,    -- snapshot at time of sale
  qty           NUMERIC(12,3) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL,
  cost_at_sale  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12,2) NOT NULL
);

-- ─── MPESA TRANSACTIONS ───────────────────────────────────────
-- Used by server functions to track STK Push → callback flow
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id TEXT UNIQUE NOT NULL,
  phone               TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  account_ref         TEXT,
  status              TEXT DEFAULT 'pending',  -- pending|success|failed
  mpesa_code          TEXT,
  amount_paid         NUMERIC(12,2),
  phone_paid          TEXT,
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- ─── ALERTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  product_id  UUID REFERENCES products(id),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STOCK MOVEMENTS ──────────────────────────────────────────
-- Audit log for all stock changes
CREATE TABLE IF NOT EXISTS stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  type        TEXT NOT NULL,     -- sale|purchase|adjustment|void|wastage
  qty_change  NUMERIC(12,3) NOT NULL,
  qty_after   NUMERIC(12,3) NOT NULL,
  reference   TEXT,              -- sale ID or PO number
  note        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES FOR FAST QUERIES ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_shop      ON products(shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date    ON sales(shop_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_alerts_shop_unread ON alerts(shop_id, is_read);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout     ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product  ON stock_movements(product_id, created_at);

-- ─── PREVENT UPDATES ON SALES (Financial Integrity) ──────────
-- Once a sale is recorded, it cannot be changed — only voided
CREATE OR REPLACE FUNCTION prevent_sale_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow updating void fields
  IF OLD.is_void = FALSE AND NEW.is_void = TRUE THEN
    RETURN NEW;  -- Voiding is allowed
  END IF;
  IF OLD.net_amount != NEW.net_amount OR
     OLD.payment_method != NEW.payment_method OR
     OLD.sold_at != NEW.sold_at THEN
    RAISE EXCEPTION 'Mauzo hayawezi kubadilishwa baada ya kuandikwa.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sale_immutability
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION prevent_sale_update();

-- ─── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── CLEANUP OLD PENDING MPESA (older than 10 minutes) ────────
-- Run this as a scheduled function or on each STK Push call
CREATE OR REPLACE FUNCTION cleanup_stale_mpesa()
RETURNS void AS $$
BEGIN
  UPDATE mpesa_transactions
  SET status = 'failed', failure_reason = 'Timeout - customer did not respond'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- DONE! After running this:
-- 1. Note your NETLIFY_DATABASE_URL from Netlify dashboard
-- 2. Set all environment variables in Netlify site settings
-- 3. Deploy your app
-- ═══════════════════════════════════════════════════════════════
