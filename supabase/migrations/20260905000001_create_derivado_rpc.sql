-- Crear productos derivados (parcial / segunda) de forma ATÓMICA.
--
-- Contexto del bug que motiva esta migración:
-- Los hooks useCrearParcial/useCrearSegunda orquestaban el flujo desde el cliente
-- con llamadas REST independientes: descontaban el stock del padre y DESPUÉS
-- insertaban el producto derivado. Como `productos.sku` es UNIQUE y el derivado
-- se creaba copiando el SKU del padre, ese INSERT fallaba siempre con 23505.
-- Al no haber transacción, el descuento de stock ya estaba persistido y no se
-- revertía: cada reintento del usuario evaporaba una pieza del inventario.
--
--   * useCrearParcial registraba el movimiento al final => el stock se perdía
--     SIN dejar ningún registro en stock_movimientos (saltos en la cadena).
--   * useCrearSegunda registraba el movimiento antes => quedaban mermas
--     huérfanas sin producto segunda asociado.
--
-- El commit cb0a156 (2026-07-03) parchó el síntoma poniendo `sku: null`, pero la
-- falta de atomicidad seguía intacta: cualquier error, cierre de pestaña o corte
-- de red reproducía exactamente el mismo agujero. Esta función mueve todo el
-- flujo a una sola transacción de Postgres.

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
  v_origen_real uuid;
  v_source      productos%ROWTYPE;
  v_derivado    productos%ROWTYPE;
  v_tipo_mov    tipo_movimiento;
  v_stock_antes integer;
BEGIN
  IF p_estado NOT IN ('parcial', 'segunda') THEN
    RAISE EXCEPTION 'Estado de derivado inválido: %', p_estado
      USING ERRCODE = '22023';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero'
      USING ERRCODE = '22023';
  END IF;

  -- Resolver el padre real: el origen puede ser el padre o un derivado suyo.
  SELECT COALESCE(producto_origen_id, id) INTO v_origen_real
  FROM productos WHERE id = p_origen_id;

  IF v_origen_real IS NULL THEN
    RAISE EXCEPTION 'Producto origen no encontrado: %', p_origen_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Bloquear toda la familia (padre + derivados) en orden determinista por id.
  -- Evita tanto el lost update del read-modify-write anterior como deadlocks
  -- entre llamadas concurrentes que tocan las mismas filas en distinto orden.
  PERFORM id FROM productos
   WHERE id = v_origen_real OR producto_origen_id = v_origen_real
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_source FROM productos WHERE id = p_origen_id;

  -- ¿Ya existe un derivado de este estado para el padre?
  SELECT * INTO v_derivado FROM productos
   WHERE producto_origen_id = v_origen_real
     AND estado_producto = p_estado
   LIMIT 1;

  -- Un producto no puede ser origen y destino a la vez (se anularía el descuento).
  IF FOUND AND v_derivado.id = v_source.id THEN
    RAISE EXCEPTION 'El producto origen ya es el derivado "%" de su familia', p_estado
      USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    UPDATE productos
       SET stock_actual = stock_actual + p_cantidad,
           updated_at   = now()
     WHERE id = v_derivado.id
     RETURNING * INTO v_derivado;
  ELSE
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

  -- Descontar del origen y dejar SIEMPRE el rastro en la misma transacción.
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

-- Red de seguridad: detecta productos cuyo stock_actual no cuadra con la suma de
-- sus movimientos. Cualquier reaparición de esta clase de bug queda visible aquí.
CREATE OR REPLACE VIEW v_stock_inconsistencias AS
SELECT
  p.id,
  p.nombre,
  p.sku,
  p.estado_producto,
  p.stock_actual,
  COALESCE(SUM(
    CASE WHEN m.tipo::text LIKE 'ENTRADA%' OR m.tipo = 'AJUSTE_POSITIVO'
         THEN m.cantidad ELSE -m.cantidad END
  ), 0)::integer AS stock_segun_movimientos,
  p.stock_actual - COALESCE(SUM(
    CASE WHEN m.tipo::text LIKE 'ENTRADA%' OR m.tipo = 'AJUSTE_POSITIVO'
         THEN m.cantidad ELSE -m.cantidad END
  ), 0)::integer AS diferencia
FROM productos p
LEFT JOIN stock_movimientos m ON m.producto_id = p.id
GROUP BY p.id, p.nombre, p.sku, p.estado_producto, p.stock_actual
HAVING p.stock_actual <> COALESCE(SUM(
    CASE WHEN m.tipo::text LIKE 'ENTRADA%' OR m.tipo = 'AJUSTE_POSITIVO'
         THEN m.cantidad ELSE -m.cantidad END
  ), 0)::integer;

GRANT SELECT ON v_stock_inconsistencias TO authenticated;
