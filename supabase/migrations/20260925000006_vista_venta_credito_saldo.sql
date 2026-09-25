-- Saldo e imputación por venta a crédito.
--
-- Desde que el crédito vive en lineas_credito (20260328000001), el saldo ya no
-- vive en la venta: una línea agrupa TODAS las compras a crédito del cliente y
-- los abonos se registran contra ella, no contra una venta. Calcular el
-- pendiente de una venta como `total - SUM(pagos WHERE venta_id = v.id)` ignora
-- todo lo cobrado desde Cobranza, que es la vía normal. De ahí que el historial
-- del cliente siguiera mostrando "Crédito activo" sobre una línea ya liquidada.
--
-- Regla de imputación: lo abonado a la línea se aplica a sus ventas de la más
-- antigua a la más reciente. Así cada venta tiene un pendiente propio y la suma
-- de los renglones cuadra con el pendiente de la línea.
--
-- Esta vista es el ÚNICO sitio donde vive esa regla. La consultan el historial
-- del cliente, el trigger que sincroniza ventas.estado_credito y la migración
-- que repara los datos viejos. Tenerla escrita dos veces —una en SQL y otra en
-- TypeScript— es exactamente el error que produjo este bug.

DROP VIEW IF EXISTS v_venta_credito_saldo;

-- security_invoker es imprescindible, no cosmético: sin él la vista corre con
-- los permisos de su dueño y se salta la RLS de ventas, lineas_credito y pagos.
-- Comprobado: `anon`, con sólo la clave pública y sin iniciar sesión, no puede
-- leer ninguna de esas tablas, pero sí leía esta vista — es decir, los saldos
-- de todos los clientes quedaban expuestos.
--
-- Se hace con security_invoker y no con REVOKE porque supabase/seed.sql ejecuta
-- GRANT ALL ON ALL TABLES y ALTER DEFAULT PRIVILEGES en cada `npm run db:reset`:
-- cualquier permiso revocado por migración volvería a concederse en local. Una
-- propiedad de la vista no la deshace ningún GRANT.
--
-- Nota para el futuro: fn_sincronizar_credito_linea (20260925000007) lee esta
-- vista desde un trigger y se apoya en que la RLS de ventas hoy es
-- `authenticated -> true`. Si algún día se estrecha por usuario, esa función
-- tendrá que pasar a SECURITY DEFINER o vería menos ventas de las que debe.
CREATE VIEW v_venta_credito_saldo WITH (security_invoker = true) AS
WITH ventas_credito AS (
  SELECT v.id, v.cliente_id, v.linea_credito_id, v.total,
         v.estado_credito, v.entrega_despues_pago, v.fecha, v.created_at
    FROM ventas v
   WHERE v.tipo_venta = 'credito'
     -- Una venta cancelada no consume abonos: su total ya se retiró de la línea.
     AND v.estado_venta <> 'cancelada'
),
con_linea AS (
  SELECT vc.id, vc.cliente_id, vc.linea_credito_id, vc.total,
         vc.estado_credito, vc.entrega_despues_pago,
         l.saldo_pagado,
         -- Total de las ventas MÁS ANTIGUAS de la misma línea: lo que ya se
         -- llevaron antes de llegar a ésta.
         COALESCE(SUM(vc.total) OVER (
           PARTITION BY vc.linea_credito_id
           ORDER BY vc.fecha, vc.created_at, vc.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ), 0) AS total_anterior
    FROM ventas_credito vc
    JOIN lineas_credito l ON l.id = vc.linea_credito_id
),
sin_linea AS (
  -- Ventas anteriores a la migración a líneas: se imputan desde sus propios
  -- pagos, que es como funcionaba antes.
  SELECT vc.id, vc.cliente_id, vc.linea_credito_id, vc.total,
         vc.estado_credito, vc.entrega_despues_pago,
         COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = vc.id), 0)::numeric,
         0::numeric
    FROM ventas_credito vc
   WHERE vc.linea_credito_id IS NULL
),
imputacion AS (
  SELECT t.id AS venta_id, t.cliente_id, t.linea_credito_id, t.total,
         t.estado_credito, t.entrega_despues_pago,
         LEAST(t.total, GREATEST(0, t.saldo_pagado - t.total_anterior)) AS imputado
    FROM (SELECT * FROM con_linea UNION ALL SELECT * FROM sin_linea) t
)
SELECT
  venta_id,
  cliente_id,
  linea_credito_id,
  total,
  entrega_despues_pago,
  estado_credito,
  imputado,
  -- Una venta ya marcada como liquidada es palabra final: puede haberlo sido
  -- por una devolución, que el reparto no conoce. El trigger sólo promueve
  -- activo -> liquidado, nunca al revés, y esto es su contraparte.
  (estado_credito = 'liquidado' OR imputado >= total) AS saldada,
  CASE WHEN estado_credito = 'liquidado' OR imputado >= total
       THEN 0::numeric
       ELSE total - imputado
  END AS saldo_pendiente
FROM imputacion;

GRANT SELECT ON v_venta_credito_saldo TO authenticated;
