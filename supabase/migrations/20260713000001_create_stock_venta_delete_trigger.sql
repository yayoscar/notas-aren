-- Reponer stock cuando se elimina un detalle de venta.
-- Necesario porque el flujo de EDITAR venta borra los detalles viejos y reinserta
-- los nuevos: sin este trigger, el borrado no reponía stock pero el reinsert sí lo
-- volvía a descontar (via trg_stock_venta), causando un doble descuento en cada edición.
--
-- Este trigger es el espejo de fn_actualizar_stock_venta: solo repone stock si la
-- venta original efectivamente lo descontó (contado, o crédito con entrega inmediata).

CREATE OR REPLACE FUNCTION fn_restaurar_stock_venta_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_tipo_venta TEXT;
  v_entrega_despues BOOLEAN;
  v_stock_antes INTEGER;
BEGIN
  -- La venta padre puede ya no existir si se está eliminando en cascada (ON DELETE CASCADE).
  SELECT tipo_venta, entrega_despues_pago
  INTO v_tipo_venta, v_entrega_despues
  FROM ventas WHERE id = OLD.venta_id;

  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  -- Solo reponer si esta venta había descontado stock
  IF v_tipo_venta = 'contado' OR (v_tipo_venta = 'credito' AND v_entrega_despues = false) THEN
    SELECT stock_actual INTO v_stock_antes FROM productos WHERE id = OLD.producto_id;

    UPDATE productos
    SET stock_actual = stock_actual + OLD.cantidad,
        updated_at = now()
    WHERE id = OLD.producto_id;

    INSERT INTO stock_movimientos (
      producto_id, tipo, cantidad, stock_antes, stock_despues,
      referencia_id, referencia_tipo
    ) VALUES (
      OLD.producto_id, 'AJUSTE_POSITIVO', OLD.cantidad,
      v_stock_antes, v_stock_antes + OLD.cantidad,
      OLD.venta_id, 'edicion_venta'
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_venta_delete
AFTER DELETE ON ventas_detalle
FOR EACH ROW EXECUTE FUNCTION fn_restaurar_stock_venta_delete();
