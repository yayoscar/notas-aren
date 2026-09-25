-- Reparar ventas.estado_credito en los datos ya existentes.
--
-- Hasta 20260925000007, un abono cobrado desde Cobranza liquidaba la línea de
-- crédito pero dejaba sus ventas en 'activo' para siempre: el trigger que las
-- marcaba resolvía todo desde pagos.venta_id, que en esos abonos es nulo. El
-- historial del cliente, el listado de ventas y el reporte de créditos activos
-- contra liquidados llevan desde entonces contando mal esas ventas.
--
-- Esta migración las pone al día. Es idempotente por construcción: sólo toca
-- las que siguen en 'activo', así que una segunda pasada no cambia nada.
--
-- NO TOCA EXISTENCIAS, a propósito. Una venta con entrega al liquidar que se
-- saldó hace meses y nunca descontó su mercancía ya salió físicamente del
-- local; registrar hoy su salida movería el inventario en la fecha equivocada
-- y ensuciaría el arqueo del mes en curso en lugar de arreglar nada. El bloque
-- del final las lista para revisarlas a mano.

UPDATE ventas v
   SET estado_credito = 'liquidado'
  FROM v_venta_credito_saldo s
 WHERE s.venta_id = v.id
   AND v.estado_credito = 'activo'
   AND s.imputado >= s.total;

-- Ventas con entrega retenida que quedaron liquidadas sin haber descontado su
-- mercancía. Requieren un ajuste manual de inventario con la fecha correcta.
--
-- Para volver a consultarlas en cualquier momento:
--
--   SELECT v.folio, v.fecha, c.nombre, p.nombre AS producto, d.cantidad
--     FROM ventas v
--     JOIN clientes c        ON c.id = v.cliente_id
--     JOIN ventas_detalle d  ON d.venta_id = v.id
--     JOIN productos p       ON p.id = d.producto_id
--    WHERE v.entrega_despues_pago
--      AND v.estado_credito = 'liquidado'
--      AND v.estado_venta <> 'cancelada'
--      AND NOT EXISTS (SELECT 1 FROM stock_movimientos m
--                       WHERE m.referencia_id = v.id
--                         AND m.referencia_tipo = 'venta'
--                         AND m.tipo = 'SALIDA_VENTA')
--    ORDER BY v.fecha;
DO $$
DECLARE
  v_folios TEXT;
  v_total  INTEGER;
BEGIN
  SELECT count(*), string_agg(v.folio, ', ' ORDER BY v.fecha)
    INTO v_total, v_folios
    FROM ventas v
   WHERE v.entrega_despues_pago
     AND v.estado_credito = 'liquidado'
     AND v.estado_venta <> 'cancelada'
     AND NOT EXISTS (
       SELECT 1 FROM stock_movimientos m
        WHERE m.referencia_id = v.id
          AND m.referencia_tipo = 'venta'
          AND m.tipo = 'SALIDA_VENTA');

  IF v_total > 0 THEN
    RAISE WARNING
      'Hay % venta(s) con entrega al liquidar que nunca descontaron inventario: %. Requieren ajuste manual; esta migración no toca existencias a propósito.',
      v_total, v_folios;
  END IF;
END $$;
