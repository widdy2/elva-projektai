-- Pakeisti quotes.client_id į nullable
ALTER TABLE quotes ALTER COLUMN client_id DROP NOT NULL;
