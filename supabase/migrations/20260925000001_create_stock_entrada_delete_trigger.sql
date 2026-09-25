-- Revertir stock cuando se elimina un detalle de entrada.
--
-- Es el espejo de fn_actualizar_stock_entrada, que sólo existía para INSERT:
-- una entrada sumaba stock al registrarse y nada lo restaba al borrarse. Sin
-- este trigger, eliminar una entrada dejaba las existencias infladas en
-- silencio y los movimientos descuadrados frente a v_stock_inconsistencias.
--
-- Es también lo que hace simétrica la EDICIÓN de una entrada, que borra las
-- líneas viejas y reinserta las nuevas: trg_stock_entrada vuelve a sumar lo
-- nuevo y este trigger resta lo viejo. Mismo planteamiento que
-- trg_stock_venta_delete (20260713000001) para el lado de ventas.
--
-- A diferencia del de ventas, aquí la reversión RESTA, así que puede dejar el
-- stock negativo si las piezas ya se vendieron o se derivaron a parcial/segunda.
-- Por eso aborta la transacción en lugar de permitirlo: el pre-chequeo de
-- fn_eliminar_entrada/fn_actualizar_entrada da un mensaje mejor, pero este
-- guardia protege cualquier borrado que llegue por otra vía (cascada, script).

CREATE OR REPLACE FUNCTION fn_revertir_stock_entrada_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_antes INTEGER;
  v_nombre      TEXT;
  v_origen      TEXT;
BEGIN
  SELECT stock_actual, nombre INTO v_stock_antes, v_nombre
  FROM productos WHERE id = OLD.producto_id
  FOR UPDATE;

  -- El producto puede haber desaparecido si se está borrando en cascada.
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  IF v_stock_antes < OLD.cantidad THEN
    RAISE EXCEPTION
      'No se puede revertir la entrada: "%" tiene % piezas en existencia y la entrada aportó %',
      v_nombre, v_stock_antes, OLD.cantidad
      USING ERRCODE = '23514';
  END IF;

  -- Lo fija la función que orquesta la operación; por defecto, eliminación.
  v_origen := COALESCE(
    NULLIF(current_setting('app.entrada_operacion', true), ''),
    'eliminacion_entrada'
  );

  UPDATE productos
     SET stock_actual = stock_actual - OLD.cantidad,
         updated_at   = now()
   WHERE id = OLD.producto_id;

  INSERT INTO stock_movimientos (
    producto_id, tipo, cantidad, stock_antes, stock_despues,
    referencia_id, referencia_tipo, notas, usuario_id
  ) VALUES (
    OLD.producto_id, 'AJUSTE_NEGATIVO', OLD.cantidad,
    v_stock_antes, v_stock_antes - OLD.cantidad,
    OLD.entrada_id, v_origen,
    'Reversión de entrada de inventario', auth.uid()
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_entrada_delete ON entradas_detalle;

CREATE TRIGGER trg_stock_entrada_delete
AFTER DELETE ON entradas_detalle
FOR EACH ROW EXECUTE FUNCTION fn_revertir_stock_entrada_delete();
