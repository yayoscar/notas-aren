-- Allow multiple rows with the same producto_id per venta
-- Required for parcial/segunda products sold with different percentages/prices
ALTER TABLE ventas_detalle DROP CONSTRAINT IF EXISTS ventas_detalle_venta_id_producto_id_key;
DROP INDEX IF EXISTS ventas_detalle_venta_id_producto_id_key;
DROP INDEX IF EXISTS idx_ventas_detalle_venta_producto;
