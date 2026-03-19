-- Función: Verificar liquidación de crédito al registrar un pago
-- Si el total abonado >= total de la venta:
--   1. Marcar crédito como liquidado
--   2. Si entrega_despues_pago = true, descontar stock ahora
CREATE OR REPLACE FUNCTION fn_verificar_liquidacion_credito()
RETURNS TRIGGER AS $$
DECLARE
  v_total_abonado NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_tipo_venta TEXT;
  v_estado TEXT;
  v_entrega_despues BOOLEAN;
  v_detalle RECORD;
  v_stock_antes INTEGER;
BEGIN
  -- Obtener datos de la venta
  SELECT total, tipo_venta, estado_credito, entrega_despues_pago
  INTO v_total, v_tipo_venta, v_estado, v_entrega_despues
  FROM ventas WHERE id = NEW.venta_id;

  -- Solo aplica para créditos activos
  IF v_tipo_venta = 'credito' AND v_estado = 'activo' THEN
    -- Calcular total abonado
    SELECT COALESCE(SUM(monto), 0) INTO v_total_abonado
    FROM pagos WHERE venta_id = NEW.venta_id;

    -- Si total abonado cubre el total de la venta
    IF v_total_abonado >= v_total THEN
      -- Marcar como liquidado
      UPDATE ventas
      SET estado_credito = 'liquidado',
          updated_at = now()
      WHERE id = NEW.venta_id;

      -- Si la entrega estaba retenida, descontar stock ahora
      IF v_entrega_despues = true THEN
        FOR v_detalle IN
          SELECT producto_id, cantidad FROM ventas_detalle WHERE venta_id = NEW.venta_id
        LOOP
          SELECT stock_actual INTO v_stock_antes FROM productos WHERE id = v_detalle.producto_id;

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
            NEW.venta_id, 'venta'
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_liquidacion_credito
AFTER INSERT ON pagos
FOR EACH ROW EXECUTE FUNCTION fn_verificar_liquidacion_credito();
