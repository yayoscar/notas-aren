-- Reparación de trazabilidad para "The Most Wanted" (SKU 3614274129281).
--
-- Contexto: antes del commit cb0a156 los hooks de derivados copiaban el SKU del
-- padre en el INSERT del derivado. Como productos.sku es UNIQUE, ese INSERT
-- fallaba siempre, pero el descuento de stock ya estaba persistido en una llamada
-- REST previa y no se revertía. Cada reintento evaporaba una pieza.
--
-- El ajuste de stock (padre 1 -> 6) ya se aplicó. Este script solo completa el
-- LEDGER para que la suma de movimientos cuadre con stock_actual:
--   1. Registra como cantidades los dos saltos que quedaron sin movimiento.
--   2. Agrega la partida de ENTRADA que los derivados nunca recibieron.
--
-- No modifica ningún stock_actual: todas esas bajas ya ocurrieron en su momento.
-- Idempotente: no hace nada si ya se aplicó.

BEGIN;

INSERT INTO stock_movimientos
 (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, notas, created_at)
SELECT * FROM (VALUES
 ('71ce3d04-866a-4093-81f0-4c7adf7722b7'::uuid,'AJUSTE_NEGATIVO'::tipo_movimiento,2,8,6,'correccion',
  'Backfill de trazabilidad: 2 intentos fallidos de crear parcial descontaron stock sin registrar movimiento (bug de sku duplicado, previo a cb0a156). Sin salida fisica.',
  '2026-05-30 03:29:00+00'::timestamptz),
 ('71ce3d04-866a-4093-81f0-4c7adf7722b7'::uuid,'AJUSTE_NEGATIVO'::tipo_movimiento,1,5,4,'correccion',
  'Backfill de trazabilidad: 1 intento fallido de crear parcial descontó stock sin registrar movimiento (bug de sku duplicado, previo a cb0a156). Sin salida fisica.',
  '2026-06-16 14:17:00+00'::timestamptz)
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movimientos
  WHERE producto_id = '71ce3d04-866a-4093-81f0-4c7adf7722b7'
    AND tipo = 'AJUSTE_NEGATIVO'
    AND referencia_tipo = 'correccion'
);

INSERT INTO stock_movimientos
 (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_id, referencia_tipo, notas, created_at)
SELECT * FROM (VALUES
 ('1872f703-e1a9-4a6a-bd88-cf8a8be1069a'::uuid,'ENTRADA_CAMBIO'::tipo_movimiento,1,0,1,
  '71ce3d04-866a-4093-81f0-4c7adf7722b7'::uuid,'derivacion',
  'Backfill: ingreso por derivacion desde nuevo (no se registraba antes de 20260905000002).',
  '2026-07-06 15:33:02.630085+00'::timestamptz),
 ('b177f4b9-190e-4c40-a5b7-8d50a5e045e3'::uuid,'ENTRADA_CAMBIO'::tipo_movimiento,1,0,1,
  '71ce3d04-866a-4093-81f0-4c7adf7722b7'::uuid,'derivacion',
  'Backfill: ingreso por derivacion desde nuevo (no se registraba antes de 20260905000002).',
  '2026-07-06 15:33:12.525077+00'::timestamptz)
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movimientos
  WHERE referencia_tipo = 'derivacion'
    AND producto_id IN ('1872f703-e1a9-4a6a-bd88-cf8a8be1069a','b177f4b9-190e-4c40-a5b7-8d50a5e045e3')
);

COMMIT;

-- Verificación: debe devolver 0 filas.
SELECT nombre, estado_producto, stock_actual, stock_segun_movimientos, diferencia
FROM v_stock_inconsistencias;
