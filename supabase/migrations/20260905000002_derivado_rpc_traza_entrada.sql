-- Completa la trazabilidad de los productos derivados.
--
-- La versión anterior de fn_crear_producto_derivado registraba la SALIDA en el
-- producto origen, pero el derivado recibía stock sin ningún movimiento propio.
-- Resultado: la suma de movimientos de todo derivado quedaba descuadrada contra
-- su stock_actual, y v_stock_inconsistencias los reportaba como falsos positivos
-- (ocultando inconsistencias reales entre el ruido).
--
-- Ahora cada derivación es una partida doble: SALIDA en el origen + ENTRADA_CAMBIO
-- en el derivado, ambas en la misma transacción.

CREATE OR REPLACE FUNCTION fn_crear_producto_derivado(
  p_origen_id                 uuid,
  p_cantidad                  integer,
  p_estado                    text,
  p_precio_venta_contado      numeric DEFAULT NULL,
  p_precio_venta_credito      numeric DEFAULT NULL,
  p_porcentaje_precio_parcial numeric DEFAULT NULL,
  p_descontar_stock           boolean DEFAULT true
)
RETURNS productos
LANGUAGE plpgsql
AS $$
DECLARE
  v_origen_real          uuid;
  v_source               productos%ROWTYPE;
  v_derivado             productos%ROWTYPE;
  v_tipo_mov             tipo_movimiento;
  v_stock_antes          integer;
  v_derivado_stock_antes integer;
BEGIN
  IF p_estado NOT IN ('parcial', 'segunda') THEN
    RAISE EXCEPTION 'Estado de derivado inválido: %', p_estado
      USING ERRCODE = '22023';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(producto_origen_id, id) INTO v_origen_real
  FROM productos WHERE id = p_origen_id;

  IF v_origen_real IS NULL THEN
    RAISE EXCEPTION 'Producto origen no encontrado: %', p_origen_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM id FROM productos
   WHERE id = v_origen_real OR producto_origen_id = v_origen_real
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_source FROM productos WHERE id = p_origen_id;

  SELECT * INTO v_derivado FROM productos
   WHERE producto_origen_id = v_origen_real
     AND estado_producto = p_estado
   LIMIT 1;

  IF FOUND AND v_derivado.id = v_source.id THEN
    RAISE EXCEPTION 'El producto origen ya es el derivado "%" de su familia', p_estado
      USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    v_derivado_stock_antes := v_derivado.stock_actual;
    UPDATE productos
       SET stock_actual = stock_actual + p_cantidad,
           updated_at   = now()
     WHERE id = v_derivado.id
     RETURNING * INTO v_derivado;
  ELSE
    v_derivado_stock_antes := 0;
    INSERT INTO productos (
      nombre, marca, sku,
      genero_id, tamano_id, presentacion_id, concentracion_id,
      tipo_perfume_id, proveedor_id,
      precio_compra, precio_venta_contado, precio_venta_credito,
      stock_actual, stock_minimo,
      producto_origen_id, estado_producto, porcentaje_precio_parcial, activo
    ) VALUES (
      v_source.nombre, v_source.marca,
      NULL, -- los derivados nunca reusan el SKU del padre (productos_sku_key)
      v_source.genero_id, v_source.tamano_id, v_source.presentacion_id,
      v_source.concentracion_id, v_source.tipo_perfume_id, v_source.proveedor_id,
      v_source.precio_compra,
      COALESCE(p_precio_venta_contado, v_source.precio_venta_contado),
      COALESCE(p_precio_venta_credito, v_source.precio_venta_credito),
      p_cantidad, 0,
      v_origen_real, p_estado, p_porcentaje_precio_parcial, true
    )
    RETURNING * INTO v_derivado;
  END IF;

  -- Partida de ENTRADA en el derivado: siempre, reciba o no descuento el origen.
  INSERT INTO stock_movimientos (
    producto_id, tipo, cantidad, stock_antes, stock_despues,
    referencia_id, referencia_tipo, notas, usuario_id
  ) VALUES (
    v_derivado.id, 'ENTRADA_CAMBIO', p_cantidad,
    v_derivado_stock_antes, v_derivado_stock_antes + p_cantidad,
    v_source.id, 'derivacion',
    'Ingreso por derivación desde ' || v_source.estado_producto,
    auth.uid()
  );

  -- Partida de SALIDA en el origen.
  IF p_descontar_stock THEN
    IF v_source.stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente: hay % y se requieren %',
        v_source.stock_actual, p_cantidad
        USING ERRCODE = '23514';
    END IF;

    v_stock_antes := v_source.stock_actual;
    v_tipo_mov := CASE p_estado
                    WHEN 'parcial' THEN 'SALIDA_PARCIAL'
                    ELSE 'SALIDA_MERMA'
                  END::tipo_movimiento;

    UPDATE productos
       SET stock_actual = stock_actual - p_cantidad,
           updated_at   = now()
     WHERE id = v_source.id;

    INSERT INTO stock_movimientos (
      producto_id, tipo, cantidad, stock_antes, stock_despues,
      referencia_id, referencia_tipo, notas, usuario_id
    ) VALUES (
      v_source.id, v_tipo_mov, p_cantidad,
      v_stock_antes, v_stock_antes - p_cantidad,
      v_derivado.id, p_estado,
      'Producto registrado como ' || p_estado,
      auth.uid()
    );
  END IF;

  RETURN v_derivado;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_crear_producto_derivado(
  uuid, integer, text, numeric, numeric, numeric, boolean
) TO authenticated;
