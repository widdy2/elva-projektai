-- Atvirkštinio PVM (96 str.) palaikymas sąskaitoms
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN NOT NULL DEFAULT false;
