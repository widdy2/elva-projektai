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
  v_is_product BOOLEAN;
BEGIN
  -- Rasti pasiūlymą pagal viešą tokeną
  SELECT * INTO v_quote FROM quotes WHERE public_token = quote_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasiūlymas nerastas';
  END IF;

  -- Jei jau buvo priimtas (objektas sukurtas) — nieko nedarome (idempotent)
  IF v_quote.accepted_at IS NOT NULL THEN
    RETURN json_build_object('success', true, 'already_accepted', true);
  END IF;

  -- Pažymėti kaip priimtą
  UPDATE quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_quote.id;

  -- Klientas: jei pasiūlymas jau susietas su esamu klientu — naudojame jį,
  -- kitaip sukuriame naują su visa pasiūlyme esančia informacija
  IF v_quote.client_id IS NOT NULL THEN
    v_client_id := v_quote.client_id;
  ELSE
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
  END IF;

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

  -- Nukopijuoti pasiūlymo pozicijas: paslaugos → objekto darbai,
  -- prekės (kainyno 'product' arba sandėlio) → objekto medžiagos
  FOR v_item IN SELECT * FROM quote_items WHERE quote_id = v_quote.id LOOP
    -- Nustatyti ar pozicija yra prekė
    v_is_product := NULL;
    IF v_item.price_item_id IS NOT NULL THEN
      SELECT (item_type = 'product') INTO v_is_product
      FROM price_items WHERE id = v_item.price_item_id;
    END IF;
    IF v_is_product IS NULL THEN
      v_is_product := v_item.warehouse_item_id IS NOT NULL
        OR COALESCE(v_item.work_price, 0) = 0;
    END IF;

    IF v_is_product THEN
      INSERT INTO project_materials (project_id, warehouse_item_id, name, unit, planned_quantity, purchased_quantity, used_quantity, unit_price)
      VALUES (
        v_project_id,
        v_item.warehouse_item_id,
        v_item.name,
        COALESCE(v_item.unit, 'vnt'),
        COALESCE(v_item.quantity, 1),
        COALESCE(v_item.quantity, 1),
        0,
        COALESCE(v_item.material_price, 0)
      );
    ELSE
      INSERT INTO project_works (project_id, name, status, quantity, unit, work_price, material_price)
      VALUES (
        v_project_id,
        v_item.name,
        'pending',
        COALESCE(v_item.quantity, 1),
        COALESCE(v_item.unit, 'vnt'),
        COALESCE(v_item.work_price, 0),
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
