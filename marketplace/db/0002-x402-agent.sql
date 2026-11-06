CREATE TABLE marketplace_x402_runs (
  id uuid PRIMARY KEY,
  pay_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  tx_hash text
);
CREATE TABLE marketplace_x402_budget (
  day date PRIMARY KEY,
  spent integer NOT NULL CHECK (spent BETWEEN 0 AND 100000)
);
