ALTER TABLE invoices ADD COLUMN widerspruch_eingelegt TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_widerspruch ON invoices(widerspruch_eingelegt);
