CREATE TABLE marketplace_products (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  image text NOT NULL,
  price integer NOT NULL CHECK (price > 0 AND price < 10000000)
);
CREATE TABLE marketplace_orders (
  id uuid PRIMARY KEY,
  total bigint NOT NULL CHECK (total > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','creating','review','paid','fulfilled')),
  payment_id text UNIQUE,
  checkout_url text,
  tx_ref text,
  customer_name text,
  customer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
CREATE INDEX marketplace_orders_recent ON marketplace_orders (created_at DESC, id DESC);
CREATE TABLE marketplace_order_lines (
  order_id uuid NOT NULL REFERENCES marketplace_orders(id),
  product_slug text NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price integer NOT NULL CHECK (unit_price > 0 AND unit_price < 10000000),
  PRIMARY KEY (order_id, product_slug)
);
