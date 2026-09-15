-- Viešam pasiūlymo puslapiui (/quote/:token): grąžina tik organizacijos
-- prekinio ženklo laukus pagal pasiūlymo public_token.
-- SECURITY DEFINER leidžia anoniminiam vartotojui gauti duomenis apeinant RLS,
-- bet atiduoda tik šiuos nekritinius laukus (be banko rekvizitų ir t.t.).

CREATE OR REPLACE FUNCTION get_public_quote_org(quote_token TEXT)
RETURNS TABLE (
  name TEXT,
  logo_url TEXT,
  brand_color TEXT,
  phone TEXT,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name, o.logo_url, o.brand_color, o.phone, o.email
  FROM organizations o
  JOIN quotes q ON q.organization_id = o.id
  WHERE q.public_token = quote_token
  LIMIT 1;
$$;
