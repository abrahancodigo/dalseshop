-- =====================================================
-- DALSE SHOP — Complete Database Schema
-- Migration: Create all tables, indexes, RLS, triggers
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE brands (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT,
  description TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  compare_price NUMERIC(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  sku TEXT DEFAULT '',
  barcode TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  images JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  variants JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT DEFAULT '',
  slug TEXT,
  content TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coupons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL,
  discount NUMERIC(5,2) DEFAULT 0,
  type TEXT DEFAULT 'percentage',
  min_purchase NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT DEFAULT '',
  slug TEXT,
  content TEXT DEFAULT '',
  sections JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT false,
  is_home_page BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number INTEGER,
  customer_email TEXT DEFAULT '',
  customer JSONB DEFAULT '{}',
  items JSONB DEFAULT '[]',
  total NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  shipping_address JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT DEFAULT '',
  email TEXT,
  phone TEXT DEFAULT '',
  total_orders INTEGER DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  role TEXT DEFAULT 'lector',
  custom_permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT '',
  position TEXT DEFAULT '',
  salary NUMERIC(12,2) DEFAULT 0,
  hire_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payroll_periods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  calculations JSONB DEFAULT '{}',
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE loans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) DEFAULT 0,
  remaining NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Config: key-value store for single-document configs
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_brand ON products(brand);

CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_is_published ON posts(is_published);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_is_published ON pages(is_published);
CREATE INDEX idx_pages_is_home_page ON pages(is_home_page);
CREATE INDEX idx_pages_updated_at ON pages(updated_at DESC);

CREATE INDEX idx_subscribers_email ON subscribers(email);

CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_last_order_at ON customers(last_order_at DESC);

CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);

CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);

CREATE INDEX idx_payroll_periods_created_at ON payroll_periods(created_at DESC);

CREATE INDEX idx_loans_employee_id ON loans(employee_id);
CREATE INDEX idx_loans_created_at ON loans(created_at DESC);

CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_brands_order ON brands("order");
CREATE INDEX idx_categories_order ON categories("order");

-- =====================================================
-- AUTO-UPDATE updated_at TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_movements_updated_at BEFORE UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payroll_periods_updated_at BEFORE UPDATE ON payroll_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Helper: check if user is superadmin (by email)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT coalesce(
      (SELECT role = 'superadmin' FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user has admin-level access
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT coalesce(
      (SELECT role IN ('superadmin', 'admin') FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user is authenticated
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- brands ----
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands public read" ON brands FOR SELECT USING (true);
CREATE POLICY "Brands admin write" ON brands FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Brands admin update" ON brands FOR UPDATE USING (is_admin());
CREATE POLICY "Brands admin delete" ON brands FOR DELETE USING (is_admin());

-- ---- categories ----
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories public read" ON categories FOR SELECT USING (true);
CREATE POLICY "Categories admin write" ON categories FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Categories admin update" ON categories FOR UPDATE USING (is_admin());
CREATE POLICY "Categories admin delete" ON categories FOR DELETE USING (is_admin());

-- ---- products ----
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON products FOR SELECT USING (true);
CREATE POLICY "Products admin write" ON products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Products admin update" ON products FOR UPDATE USING (is_admin());
CREATE POLICY "Products admin delete" ON products FOR DELETE USING (is_admin());

-- ---- reviews ----
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public read" ON reviews FOR SELECT USING (true);
CREATE POLICY "Reviews auth create" ON reviews FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Reviews admin update" ON reviews FOR UPDATE USING (is_admin());
CREATE POLICY "Reviews admin delete" ON reviews FOR DELETE USING (is_admin());

-- ---- posts ----
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Posts admin write" ON posts FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Posts admin update" ON posts FOR UPDATE USING (is_admin());
CREATE POLICY "Posts admin delete" ON posts FOR DELETE USING (is_admin());

-- ---- coupons ----
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons auth read" ON coupons FOR SELECT USING (is_authenticated());
CREATE POLICY "Coupons admin write" ON coupons FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Coupons admin update" ON coupons FOR UPDATE USING (is_admin());
CREATE POLICY "Coupons admin delete" ON coupons FOR DELETE USING (is_admin());

-- ---- pages ----
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pages public read" ON pages FOR SELECT USING (true);
CREATE POLICY "Pages admin write" ON pages FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Pages admin update" ON pages FOR UPDATE USING (is_admin());
CREATE POLICY "Pages admin delete" ON pages FOR DELETE USING (is_admin());

-- ---- subscribers ----
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subscribers auth read" ON subscribers FOR SELECT USING (is_authenticated());
CREATE POLICY "Subscribers public create" ON subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Subscribers admin delete" ON subscribers FOR DELETE USING (is_admin());

-- ---- orders ----
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders auth read own" ON orders FOR SELECT USING (
  is_authenticated() AND (customer_email = auth.email() OR is_admin())
);
CREATE POLICY "Orders auth create" ON orders FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Orders admin update" ON orders FOR UPDATE USING (is_admin());
CREATE POLICY "Orders admin delete" ON orders FOR DELETE USING (is_admin());

-- ---- customers ----
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers auth read" ON customers FOR SELECT USING (is_authenticated());
CREATE POLICY "Customers auth upsert" ON customers FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Customers admin update" ON customers FOR UPDATE USING (is_admin());

-- ---- user_profiles ----
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users auth read own" ON user_profiles FOR SELECT USING (
  auth.uid() = auth_user_id OR is_admin()
);
CREATE POLICY "Users auth insert self" ON user_profiles FOR INSERT WITH CHECK (
  auth.uid() = auth_user_id
);
CREATE POLICY "Users admin update" ON user_profiles FOR UPDATE USING (is_admin());
CREATE POLICY "Users admin delete" ON user_profiles FOR DELETE USING (is_admin());

-- ---- inventory_movements ----
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movements auth read" ON inventory_movements FOR SELECT USING (is_authenticated());
CREATE POLICY "Movements admin write" ON inventory_movements FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Movements admin update" ON inventory_movements FOR UPDATE USING (is_admin());
CREATE POLICY "Movements admin delete" ON inventory_movements FOR DELETE USING (is_admin());

-- ---- employees ----
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees auth read" ON employees FOR SELECT USING (is_authenticated());
CREATE POLICY "Employees admin write" ON employees FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Employees admin update" ON employees FOR UPDATE USING (is_admin());
CREATE POLICY "Employees admin delete" ON employees FOR DELETE USING (is_admin());

-- ---- attendance_records ----
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance auth read" ON attendance_records FOR SELECT USING (is_authenticated());
CREATE POLICY "Attendance admin write" ON attendance_records FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Attendance admin update" ON attendance_records FOR UPDATE USING (is_admin());
CREATE POLICY "Attendance admin delete" ON attendance_records FOR DELETE USING (is_admin());

-- ---- payroll_periods ----
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payroll auth read" ON payroll_periods FOR SELECT USING (is_authenticated());
CREATE POLICY "Payroll admin write" ON payroll_periods FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Payroll admin update" ON payroll_periods FOR UPDATE USING (is_admin());
CREATE POLICY "Payroll admin delete" ON payroll_periods FOR DELETE USING (is_admin());

-- ---- loans ----
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Loans auth read" ON loans FOR SELECT USING (is_authenticated());
CREATE POLICY "Loans admin write" ON loans FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Loans admin update" ON loans FOR UPDATE USING (is_admin());
CREATE POLICY "Loans admin delete" ON loans FOR DELETE USING (is_admin());

-- ---- config ----
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config public read" ON config FOR SELECT USING (true);
CREATE POLICY "Config admin write" ON config FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Config admin update" ON config FOR UPDATE USING (is_admin());
CREATE POLICY "Config admin delete" ON config FOR DELETE USING (is_admin());

-- =====================================================
-- SEED DEFAULT CONFIG
-- =====================================================

INSERT INTO config (key, value) VALUES
  ('settings', '{"name":"DalseShop","slogan":"","description":"","logo":"","favicon":"","email":"","phone":"","address":"","legalInfo":{"businessName":"","nit":"","phone":"","email":""},"notifications":{"ownerEmail":"","extraEmail1":"","extraEmail2":""},"contactNotifications":{"email1":"","email2":"","email3":""},"seo":{"metaTitle":"","metaDescription":"","keywords":""},"socialMedia":{"facebook":"","instagram":"","twitter":"","youtube":"","tiktok":"","whatsapp":""}}'),
  ('theme', '{"primaryColor":"#6C5CE7","secondaryColor":"#0D1B2A","accentColor":"#00CEC9","backgroundColor":"#FFFFFF","textColor":"#1A1A2E","headerTextColor":"","footerTextColor":"","mutedTextColor":"#475569","primaryContrastColor":"","secondaryContrastColor":"","fontFamily":"Inter","fontFamilyHeadings":"Inter","borderRadius":"8","headerStyle":"solid","cardStyle":"shadow"}'),
  ('features', '{"cart":true,"orders":true,"coupons":false,"reviews":false,"wishlist":false,"search":true,"newsletter":false,"blog":false,"shipping":false,"customers":false,"showPrices":true}'),
  ('navigation', '{"header":{"menuItems":[{"label":"Inicio","href":"/","order":0},{"label":"Productos","href":"/productos","order":1}]},"footer":{"columns":[{"title":"Información","content":""},{"title":"Enlaces","content":""},{"title":"Contacto","content":""}],"copyright":"© 2026 DalseShop. Todos los derechos reservados.","showSocialLinks":true}}'),
  ('shipping', '{}'),
  ('blog', '{}'),
  ('payroll', '{}'),
  ('orderCounter', '{"value":0}')
ON CONFLICT (key) DO NOTHING;
