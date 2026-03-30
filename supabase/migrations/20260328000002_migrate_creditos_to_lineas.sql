-- Migration: Consolidate existing active credits into lineas_credito
-- WARNING: Run on staging first. This is a data migration.

BEGIN;

-- For each client with active credits, create ONE linea_credito
-- Uses the most recent venta's periodicidad and MAX meses_credito
INSERT INTO lineas_credito (
  cliente_id,
  vendedor_id,
  saldo_total,
  saldo_pagado,
  meses_credito,
  periodicidad,
  fecha_inicio,
  fecha_siguiente_pago,
  fecha_cobro_especifica,
  estado
)
SELECT
  v.cliente_id,
  -- vendedor from most recent credit venta
  (SELECT v2.vendedor_id FROM ventas v2
   WHERE v2.cliente_id = v.cliente_id
   AND v2.tipo_venta = 'credito' AND v2.estado_credito = 'activo'
   ORDER BY v2.created_at DESC LIMIT 1),
  -- saldo_total = sum of all active credit totals
  SUM(v.total),
  -- saldo_pagado = sum of all payments for these ventas
  COALESCE((
    SELECT SUM(p.monto) FROM pagos p
    WHERE p.venta_id IN (
      SELECT v3.id FROM ventas v3
      WHERE v3.cliente_id = v.cliente_id
      AND v3.tipo_venta = 'credito' AND v3.estado_credito = 'activo'
    )
  ), 0),
  -- meses_credito from most recent
  (SELECT v2.meses_credito FROM ventas v2
   WHERE v2.cliente_id = v.cliente_id
   AND v2.tipo_venta = 'credito' AND v2.estado_credito = 'activo'
   ORDER BY v2.created_at DESC LIMIT 1),
  -- periodicidad from most recent
  COALESCE((SELECT v2.periodicidad FROM ventas v2
   WHERE v2.cliente_id = v.cliente_id
   AND v2.tipo_venta = 'credito' AND v2.estado_credito = 'activo'
   ORDER BY v2.created_at DESC LIMIT 1), 'quincenal'),
  -- fecha_inicio = earliest fecha_primer_pago
  COALESCE(MIN(v.fecha_primer_pago), CURRENT_DATE),
  -- fecha_siguiente_pago from most recent venta
  COALESCE((SELECT v2.fecha_primer_pago FROM ventas v2
   WHERE v2.cliente_id = v.cliente_id
   AND v2.tipo_venta = 'credito' AND v2.estado_credito = 'activo'
   ORDER BY v2.created_at DESC LIMIT 1), CURRENT_DATE),
  -- fecha_cobro_especifica from most recent venta
  (SELECT v2.fecha_cobro_especifica FROM ventas v2
   WHERE v2.cliente_id = v.cliente_id
   AND v2.tipo_venta = 'credito' AND v2.estado_credito = 'activo'
   ORDER BY v2.created_at DESC LIMIT 1),
  'activa'
FROM ventas v
WHERE v.tipo_venta = 'credito' AND v.estado_credito = 'activo'
GROUP BY v.cliente_id;

-- Link ventas to their new linea
UPDATE ventas v
SET linea_credito_id = lc.id
FROM lineas_credito lc
WHERE v.cliente_id = lc.cliente_id
  AND v.tipo_venta = 'credito'
  AND v.estado_credito = 'activo'
  AND lc.estado = 'activa';

-- Link pagos to their new linea (via the venta they belong to)
UPDATE pagos p
SET linea_credito_id = v.linea_credito_id
FROM ventas v
WHERE p.venta_id = v.id
  AND v.linea_credito_id IS NOT NULL;

-- Link cobranza_seguimiento to linea (via venta)
UPDATE cobranza_seguimiento cs
SET linea_credito_id = v.linea_credito_id
FROM ventas v
WHERE cs.venta_id = v.id
  AND v.linea_credito_id IS NOT NULL;

COMMIT;
