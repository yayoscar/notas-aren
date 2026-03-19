-- SKU ya no es obligatorio
ALTER TABLE productos ALTER COLUMN sku DROP NOT NULL;
