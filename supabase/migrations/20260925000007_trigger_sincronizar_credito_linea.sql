-- Sincronizar ventas.estado_credito con el estado real del crédito, y sacar del
-- inventario la mercancía retenida cuando el crédito queda saldado.
--
-- Por qué cuelga de lineas_credito y no de pagos:
-- trg_liquidacion_credito (20260319000006) reacciona a INSERT sobre pagos y
-- resuelve todo desde NEW.venta_id. Un abono cobrado desde Cobranza va contra la
-- línea con venta_id nulo, así que su primer SELECT busca por NULL, no encuentra
-- nada y la función termina sin hacer nada. Ése es el bug.
-- Además, no sólo los abonos mueven una línea: también las devoluciones
-- (useDevolucionUnificada) y la importación. Todas pasan por un UPDATE sobre
-- lineas_credito, así que enganchándose ahí se cubren todas.
--
-- trg_liquidacion_credito se conserva: las ventas sin línea siguen dependiendo
-- de él. Los dos actúan sólo sobre ventas en 'activo', de modo que el primero
-- que llegue hace el trabajo y el segundo no encuentra nada que hacer.
--
-- La sincronización es de UN SOLO SENTIDO: activo -> liquidado, nunca al revés.
-- Hay ventas que se liquidan por motivos que el reparto no conoce —una
-- devolución marca la venta y ajusta la línea por su cuenta—, y revertirlas en
-- el siguiente abono desharía esa decisión.

CREATE OR REPLACE FUNCTION fn_sincronizar_credito_linea()
RETURNS TRIGGER AS $$
DECLARE
  v_venta       RECORD;
  v_detalle     RECORD;
  v_stock_antes INTEGER;
BEGIN
  FOR v_venta IN
    SELECT s.venta_id, s.entrega_despues_pago
      FROM v_venta_credito_saldo s
     WHERE s.linea_credito_id = NEW.id
       AND s.estado_credito = 'activo'
       -- Sólo las que el reparto cubre de verdad. La columna `saldada` de la
       -- vista incluye además las ya marcadas a mano, que aquí no interesan.
       AND s.imputado >= s.total
  LOOP
    UPDATE ventas
       SET estado_credito = 'liquidado'
     WHERE id = v_venta.venta_id
       AND estado_credito = 'activo';

    -- La transición es la única garantía de que lo de abajo ocurre una vez:
    -- en la segunda pasada no hay fila que promover y no se descuenta nada.
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF NOT v_venta.entrega_despues_pago THEN
      CONTINUE;
    END IF;

    -- Red de seguridad frente a cualquier camino que haya marcado la venta a
    -- mano sin pasar por aquí.
    IF EXISTS (
      SELECT 1 FROM stock_movimientos
       WHERE referencia_id = v_venta.venta_id
         AND referencia_tipo = 'venta'
         AND tipo = 'SALIDA_VENTA'
    ) THEN
      CONTINUE;
    END IF;

    -- fn_actualizar_stock_venta excluye a propósito las ventas a crédito con
    -- entrega retenida: no descuentan al registrarse, esperando este momento.
    FOR v_detalle IN
      SELECT producto_id, cantidad FROM ventas_detalle WHERE venta_id = v_venta.venta_id
    LOOP
      SELECT stock_actual INTO v_stock_antes
        FROM productos WHERE id = v_detalle.producto_id FOR UPDATE;

      UPDATE productos
         SET stock_actual = stock_actual - v_detalle.cantidad,
             updated_at = now()
       WHERE id = v_detalle.producto_id;

      INSERT INTO stock_movimientos (
        producto_id, tipo, cantidad, stock_antes, stock_despues,
        referencia_id, referencia_tipo
      ) VALUES (
        v_detalle.producto_id, 'SALIDA_VENTA', v_detalle.cantidad,
        v_stock_antes, v_stock_antes - v_detalle.cantidad,
        v_venta.venta_id, 'venta'
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sincronizar_credito_linea ON lineas_credito;

CREATE TRIGGER trg_sincronizar_credito_linea
AFTER UPDATE ON lineas_credito
FOR EACH ROW
WHEN (NEW.saldo_pagado IS DISTINCT FROM OLD.saldo_pagado
   OR NEW.saldo_total  IS DISTINCT FROM OLD.saldo_total)
EXECUTE FUNCTION fn_sincronizar_credito_linea();
