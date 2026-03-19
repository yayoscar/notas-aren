-- Migrate existing prices from productos to precios_historico
INSERT INTO precios_historico (producto_id, precio_compra, precio_venta_contado, precio_venta_credito, activo, origen, created_at)
SELECT id, precio_compra, precio_venta_contado, precio_venta_credito, true, 'inventario', now()
FROM productos
WHERE activo = true
  AND (precio_compra > 0 OR precio_venta_contado > 0 OR precio_venta_credito > 0);
