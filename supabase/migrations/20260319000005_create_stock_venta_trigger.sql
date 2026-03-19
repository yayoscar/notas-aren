-- Función: Descontar stock al insertar detalle de venta
-- Solo descuenta si es contado, o si es crédito sin entrega_despues_pago
CREATE OR REPLACE FUNCTION fn_actualizar_stock_venta()
RETURNS TRIGGER AS $$
DECLARE
  v_tipo_venta TEXT;
  v_entrega_despues BOOLEAN;
  v_stock_antes INTEGER;
BEGIN
  -- Obtener datos de la venta padre
  SELECT tipo_venta, entrega_despues_pago
  INTO v_tipo_venta, v_entrega_despues
  FROM ventas WHERE id = NEW.venta_id;

  -- Solo descontar stock si aplica
  IF v_tipo_venta = 'contado' OR (v_tipo_venta = 'credito' AND v_entrega_despues = false) THEN
    SELECT stock_actual INTO v_stock_antes FROM productos WHERE id = NEW.producto_id;

    UPDATE productos
    SET stock_actual = stock_actual - NEW.cantidad,
        updated_at = now()
    WHERE id = NEW.producto_id;

    INSERT INTO stock_movimientos (
      producto_id, tipo, cantidad, stock_antes, stock_despues,
      referencia_id, referencia_tipo
    ) VALUES (
      NEW.producto_id, 'SALIDA_VENTA', NEW.cantidad,
      v_stock_antes, v_stock_antes - NEW.cantidad,
      NEW.venta_id, 'venta'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_venta
AFTER INSERT ON ventas_detalle
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock_venta();
