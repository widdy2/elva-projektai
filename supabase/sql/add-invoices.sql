-- Invoices lentelė (sąskaitos)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'cancelled')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  vat_rate DECIMAL(5, 2) DEFAULT 21,
  vat_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_org ON invoices(organization_id, invoice_number);

-- Invoice items lentelė (sąskaitos pozicijos)
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit TEXT DEFAULT 'vnt',
  unit_price DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Nuosekli sąskaitų numeracija be spragų (sequence per organizaciją)
CREATE TABLE IF NOT EXISTS invoice_sequences (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  last_number INT DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_invoice_number(p_organization_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  INSERT INTO invoice_sequences (organization_id, last_number)
  VALUES (p_organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  RETURN 'SF-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices of their organization" ON invoices;
CREATE POLICY "Users can view invoices of their organization" ON invoices
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
CREATE POLICY "Users can insert invoices" ON invoices
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
CREATE POLICY "Users can update invoices" ON invoices
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
CREATE POLICY "Users can delete invoices" ON invoices
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoice items of their organization" ON invoice_items;
CREATE POLICY "Users can view invoice items of their organization" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert invoice items" ON invoice_items;
CREATE POLICY "Users can insert invoice items" ON invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update invoice items" ON invoice_items;
CREATE POLICY "Users can update invoice items" ON invoice_items
  FOR UPDATE USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete invoice items" ON invoice_items;
CREATE POLICY "Users can delete invoice items" ON invoice_items
  FOR DELETE USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS invoice_sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoice sequence" ON invoice_sequences;
CREATE POLICY "Users can view own invoice sequence" ON invoice_sequences
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );