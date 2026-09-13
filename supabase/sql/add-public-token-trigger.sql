-- Sukurti funkciją public_token generavimui
CREATE OR REPLACE FUNCTION generate_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sukurti triggerį quotes lentelės INSERT operacijai
DROP TRIGGER IF EXISTS set_public_token ON quotes;
CREATE TRIGGER set_public_token
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION generate_public_token();
