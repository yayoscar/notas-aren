-- Allow pagos without a specific venta (e.g. credit line payments from cobranza)
ALTER TABLE pagos ALTER COLUMN venta_id DROP NOT NULL;
