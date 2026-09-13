-- Pridėti kainų laukus į project_works
ALTER TABLE project_works ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 2) DEFAULT 1;
ALTER TABLE project_works ADD COLUMN IF NOT EXISTS work_price DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE project_works ADD COLUMN IF NOT EXISTS material_price DECIMAL(12, 2) DEFAULT 0;
