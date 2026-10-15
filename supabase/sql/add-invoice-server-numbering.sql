-- Nuosekli sąskaitų numeracija serverio pusėje (be spragų ir race condition)
-- ELVA##### formatas; tęsia esamą numeraciją iš invoices lentelės

-- 1) Funkcija: ELVA##### formatas (vietoj senojo SF-YYYY-NNNN)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_organization_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq INT;
BEGIN
  INSERT INTO invoice_sequences (organization_id, last_number)
  VALUES (p_organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  RETURN 'ELVA' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Backfill: užpildyti sekas iš didžiausio esamo ELVA numerio (tęsti, ne pradėti iš naujo)
INSERT INTO invoice_sequences (organization_id, last_number)
SELECT organization_id,
       MAX(CAST(SUBSTRING(invoice_number FROM '\d+') AS INT)) AS last_number
FROM invoices
WHERE invoice_number ~* '^ELVA\d+$'
GROUP BY organization_id
ON CONFLICT (organization_id)
DO UPDATE SET last_number = GREATEST(invoice_sequences.last_number, EXCLUDED.last_number);

-- 3) Triggeris: kai invoice_number nenurodytas — generuoja automatiskai
--    (jei rankiniu numeriu jau užimta — praleidžia iki laisvo)
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    NEW.invoice_number := generate_invoice_number(NEW.organization_id);
    WHILE EXISTS (
      SELECT 1 FROM invoices
      WHERE organization_id = NEW.organization_id
        AND invoice_number = NEW.invoice_number
    ) LOOP
      NEW.invoice_number := generate_invoice_number(NEW.organization_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_invoices_set_number ON invoices;
CREATE TRIGGER trg_invoices_set_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_invoice_number();
