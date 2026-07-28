-- =============================================================================
-- REPARACIÓN DE STOCK descuadrado por el bug de doble descuento al editar ventas
-- =============================================================================
-- Correr en el SQL Editor de Supabase. Ejecuta los pasos EN ORDEN y revisa la
-- salida de cada uno antes de pasar al siguiente. El PASO 4 (UPDATE) está
-- comentado a propósito: descoméntalo solo después de revisar el PASO 3.
--
-- SUPUESTOS del recálculo (válidos para inventario que arranca desde cero):
--   * El stock de cada producto proviene de sus ENTRADAS menos sus VENTAS.
--   * Los productos NO tienen stock inicial cargado por importación (stock_inicial).
--   * No se han hecho DEVOLUCIONES sobre estos productos.
-- Si alguno de estos supuestos no aplica a un producto, NO lo repares con este
-- script (revisa ese caso a mano). El PASO 4 solo toca productos que aparecen en
-- alguna venta, para acotar el alcance.
-- =============================================================================


-- PASO 1 — Evidencia del bug: movimientos de SALIDA_VENTA duplicados por venta.
-- Si una venta tiene más de una fila SALIDA_VENTA para el mismo producto, cada
-- fila extra es un descuento fantasma provocado por una edición.
SELECT sm.referencia_id AS venta_id, sm.producto_id, p.nombre,
       COUNT(*) AS movimientos_salida,
       SUM(sm.cantidad) AS unidades_descontadas
FROM stock_movimientos sm
JOIN productos p ON p.id = sm.producto_id
WHERE sm.tipo = 'SALIDA_VENTA' AND sm.referencia_tipo = 'venta'
GROUP BY sm.referencia_id, sm.producto_id, p.nombre
HAVING COUNT(*) > 1
ORDER BY movimientos_salida DESC;


-- PASO 2 — Productos con stock negativo (otra señal del mismo bug).
SELECT id, nombre, marca, sku, stock_actual
FROM productos
WHERE activo = true AND stock_actual < 0
ORDER BY stock_actual;


-- PASO 3 — PREVIEW del recálculo. Compara el stock guardado contra el recalculado
-- (entradas - ventas que descuentan). NO modifica nada: solo mira las diferencias.
WITH entradas_por_prod AS (
  SELECT ed.producto_id, SUM(ed.cantidad) AS total_entradas
  FROM entradas_detalle ed
  GROUP BY ed.producto_id
),
ventas_por_prod AS (
  SELECT vd.producto_id, SUM(vd.cantidad) AS total_ventas
  FROM ventas_detalle vd
  JOIN ventas v ON v.id = vd.venta_id
  WHERE v.tipo_venta = 'contado'
     OR (v.tipo_venta = 'credito' AND v.entrega_despues_pago = false)
  GROUP BY vd.producto_id
)
SELECT p.id, p.nombre, p.sku,
       p.stock_actual AS stock_guardado,
       COALESCE(e.total_entradas, 0)                                  AS entradas,
       COALESCE(vt.total_ventas, 0)                                   AS ventas,
       COALESCE(e.total_entradas, 0) - COALESCE(vt.total_ventas, 0)   AS stock_recalculado
FROM productos p
LEFT JOIN entradas_por_prod e ON e.producto_id = p.id
LEFT JOIN ventas_por_prod  vt ON vt.producto_id = p.id
-- Solo productos que aparecen en alguna venta (los únicos que pudo dañar el bug)
WHERE vt.producto_id IS NOT NULL
  AND p.stock_actual <> COALESCE(e.total_entradas, 0) - COALESCE(vt.total_ventas, 0)
ORDER BY p.nombre;


-- PASO 4 — APLICAR la corrección. Revisa primero el PASO 3.
-- Descomenta el bloque (quita /* y */) y ejecútalo.
/*
WITH entradas_por_prod AS (
  SELECT ed.producto_id, SUM(ed.cantidad) AS total_entradas
  FROM entradas_detalle ed
  GROUP BY ed.producto_id
),
ventas_por_prod AS (
  SELECT vd.producto_id, SUM(vd.cantidad) AS total_ventas
  FROM ventas_detalle vd
  JOIN ventas v ON v.id = vd.venta_id
  WHERE v.tipo_venta = 'contado'
     OR (v.tipo_venta = 'credito' AND v.entrega_despues_pago = false)
  GROUP BY vd.producto_id
),
recalc AS (
  SELECT p.id,
         COALESCE(e.total_entradas, 0) - COALESCE(vt.total_ventas, 0) AS stock_correcto
  FROM productos p
  LEFT JOIN entradas_por_prod e ON e.producto_id = p.id
  JOIN ventas_por_prod vt ON vt.producto_id = p.id  -- solo productos vendidos
)
UPDATE productos p
SET stock_actual = r.stock_correcto,
    updated_at   = now()
FROM recalc r
WHERE p.id = r.id
  AND p.stock_actual <> r.stock_correcto;
*/
