-- Viešo pasiūlymo priėmimas: viena atomi operacija.
-- Klientas paspaudžia "Priimti" viešame puslapyje → ši funkcija:
--   1) pakeičia pasiūlymo statusą į 'accepted'
--   2) sukuria klientą su visa pasiūlyme esančia informacija
--   3) sukuria objektą (statusas 'planning', biudžetas = pasiūlymo suma)
--   4) nukopijuoja pozicijas į project_works
--   5) sandėlio prekes nukopijuoja į project_materials
-- SECURITY DEFINER — anonimas gali vykdyti apeinant RLS, bet funkcija
-- veikia tik su konkrečiu public_token (neįmanoma kurti savavališkai).

-- Objekto pavadinimo laukas pasiūlyme
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS object_name TEXT;

CREATE OR REPLACE FUNCTION accept_quote(quote_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_client_id UUID;
  v_project_id UUID;
  v_item RECORD;
BEGIN
  -- Rasti pasiūlymą pagal viešą tokeną
  SELECT * INTO v_quote FROM quotes WHERE public_token = quote_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasiūlymas nerastas';
  END IF;

  -- Jei jau priimtas — nieko nedarome (idempotent)
  IF v_quote.status = 'accepted' THEN
    RETURN json_build_object('success', true, 'already_accepted', true);
  END IF;

  -- Pažymėti kaip priimtą
  UPDATE quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_quote.id;

  -- Sukurti klientą su visa pasiūlyme esančia informacija
  INSERT INTO clients (organization_id, name, email, phone, address)
  VALUES (
    v_quote.organization_id,
    COALESCE(NULLIF(v_quote.client_name, ''), 'Klientas'),
    NULLIF(v_quote.client_email, ''),
    NULLIF(v_quote.client_phone, ''),
    v_quote.address
  )
  RETURNING id INTO v_client_id;

  -- Susieti pasiūlymą su nauju klientu
  UPDATE quotes SET client_id = v_client_id WHERE id = v_quote.id;

  -- Sukurti objektą (planuojamą vykdyti)
  -- Pavadinimas: object_name iš pasiūlymo, arba "Klientas - adresas"
  INSERT INTO projects (organization_id, client_id, name, address, status, budget)
  VALUES (
    v_quote.organization_id,
    v_client_id,
    COALESCE(
      NULLIF(v_quote.object_name, ''),
      COALESCE(NULLIF(v_quote.client_name, ''), 'Klientas') || ' - ' || COALESCE(v_quote.address, '')
    ),
    COALESCE(v_quote.address, ''),
    'planning',
    COALESCE(v_quote.total, 0)
  )
  RETURNING id INTO v_project_id;

  -- Nukopijuoti pasiūlymo pozicijas į objekto darbus
  FOR v_item IN SELECT * FROM quote_items WHERE quote_id = v_quote.id LOOP
    INSERT INTO project_works (project_id, name, status, quantity, work_price, material_price)
    VALUES (
      v_project_id,
      v_item.name,
      'pending',
      COALESCE(v_item.quantity, 1),
      COALESCE(v_item.work_price, 0),
      COALESCE(v_item.material_price, 0)
    );

    -- Sandėlio prekės → objekto medžiagos
    IF v_item.warehouse_item_id IS NOT NULL THEN
      INSERT INTO project_materials (project_id, warehouse_item_id, name, unit, planned_quantity, purchased_quantity, used_quantity, unit_price)
      VALUES (
        v_project_id,
        v_item.warehouse_item_id,
        v_item.name,
        'vnt',
        COALESCE(v_item.quantity, 1),
        COALESCE(v_item.quantity, 1),
        0,
        COALESCE(v_item.material_price, 0)
      );
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'client_id', v_client_id,
    'project_id', v_project_id
  );
END;
$$;
