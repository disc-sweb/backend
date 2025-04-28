CREATE TABLE IF NOT EXISTS quickbooks_tokens (
  id            SERIAL        PRIMARY KEY,
  merchant_id   INTEGER       NOT NULL,
  realm_id      TEXT          NOT NULL,
  access_token  TEXT          NOT NULL,
  refresh_token TEXT          NOT NULL,
  expires_at    TIMESTAMPTZ   NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);
