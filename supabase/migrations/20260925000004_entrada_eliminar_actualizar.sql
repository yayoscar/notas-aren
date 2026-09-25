-- Eliminar y editar una entrada de inventario de forma atómica.
--
-- El motivo de que esto viva en Postgres y no en el cliente es la guardia de
-- existencias: comprobar "¿hay suficiente para revertir?" y restar tienen que
-- ser una sola operación. Desde el navegador son dos viajes separados y entre
-- uno y otro cabe una venta. Mismo razonamiento que fn_crear_producto_derivado
-- (20260905000001), que nació de un agujero exactamente así.
--
-- Ninguna de las dos funciones toca productos.stock_actual directamente: de eso
-- se encargan trg_stock_entrada (INSERT) y trg_stock_entrada_delete (DELETE).
-- Duplicar aquí la aritmética es justo lo que causó el doble descuento que
-- documenta 20260713000001 en el lado de ventas. El pre-chequeo sólo sirve para
-- dar un mensaje legible antes de que el trigger aborte con uno genérico.

-- ---------------------------------------------------------------------------
-- Eliminar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_eliminar_entrada(p_entrada_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_falta TEXT;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'Sólo un administrador puede eliminar entradas'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM entradas WHERE id = p_entrada_id) THEN
    RAISE EXCEPTION 'Entrada no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Bloquear los productos implicados en orden determinista por id: evita el
  -- lost update contra una venta simultánea y los deadlocks entre dos borrados.
  PERFORM p.id FROM productos p
   WHERE p.id IN (SELECT producto_id FROM entradas_detalle WHERE entrada_id = p_entrada_id)
   ORDER BY p.id
   FOR UPDATE;

  -- Agregado por producto: una entrada puede repetir el mismo producto en
  -- varias líneas, y lo que importa es el total a revertir.
  SELECT string_agg(
           format('%s (hay %s piezas y la entrada aportó %s)',
                  p.nombre, p.stock_actual, d.total),
           '; ' ORDER BY p.nombre)
    INTO v_falta
    FROM (SELECT producto_id, SUM(cantidad) AS total
            FROM entradas_detalle
           WHERE entrada_id = p_entrada_id
           GROUP BY producto_id) d
    JOIN productos p ON p.id = d.producto_id
   WHERE p.stock_actual < d.total;

  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede eliminar la entrada porque las piezas ya no están en existencia: %',
      v_falta
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.entrada_operacion', 'eliminacion_entrada', true);

  -- entradas_detalle cae por ON DELETE CASCADE y cada línea dispara la reversión.
  DELETE FROM entradas WHERE id = p_entrada_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_eliminar_entrada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_eliminar_entrada(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Editar
-- ---------------------------------------------------------------------------
-- p_detalles: [{"producto_id": uuid, "cantidad": int, "precio_unitario": num}, ...]
CREATE OR REPLACE FUNCTION fn_actualizar_entrada(
  p_entrada_id     uuid,
  p_proveedor_id   uuid,
  p_fecha          date,
  p_fecha_factura  date,
  p_numero_factura text,
  p_notas          text,
  p_detalles       jsonb
)
RETURNS entradas
LANGUAGE plpgsql
AS $$
DECLARE
  v_entrada entradas%ROWTYPE;
  v_viejos  uuid[];
  v_falta   TEXT;
  v_total   NUMERIC(10,2);
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'Sólo un administrador puede editar entradas'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entrada FROM entradas WHERE id = p_entrada_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La entrada debe conservar al menos una línea'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_detalles) d
     WHERE (d->>'producto_id') IS NULL
        OR COALESCE((d->>'cantidad')::integer, 0) <= 0
        OR COALESCE((d->>'precio_unitario')::numeric, -1) < 0
  ) THEN
    RAISE EXCEPTION
      'Cada línea necesita producto, cantidad mayor a cero y costo no negativo'
      USING ERRCODE = '22023';
  END IF;

  -- Bloquear productos viejos y nuevos, en orden determinista por id.
  PERFORM p.id FROM productos p
   WHERE p.id IN (
     SELECT producto_id FROM entradas_detalle WHERE entrada_id = p_entrada_id
     UNION
     SELECT (d->>'producto_id')::uuid FROM jsonb_array_elements(p_detalles) d
   )
   ORDER BY p.id
   FOR UPDATE;

  SELECT string_agg(DISTINCT s.pid::text, ', ') INTO v_falta
    FROM (SELECT (d->>'producto_id')::uuid AS pid
            FROM jsonb_array_elements(p_detalles) d) s
   WHERE NOT EXISTS (SELECT 1 FROM productos WHERE id = s.pid);

  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', v_falta USING ERRCODE = 'P0002';
  END IF;

  -- Suficiencia sobre el saldo NETO por producto (nuevas menos viejas), no
  -- sobre las viejas por separado: dejar una línea igual no debe bloquearse
  -- porque las piezas ya se hayan vendido.
  WITH viejas AS (
    SELECT producto_id, SUM(cantidad) AS q
      FROM entradas_detalle WHERE entrada_id = p_entrada_id GROUP BY producto_id
  ), nuevas AS (
    SELECT (d->>'producto_id')::uuid AS producto_id,
           SUM((d->>'cantidad')::integer) AS q
      FROM jsonb_array_elements(p_detalles) d GROUP BY 1
  ), delta AS (
    SELECT producto_id, COALESCE(n.q, 0) - COALESCE(v.q, 0) AS d
      FROM viejas v FULL OUTER JOIN nuevas n USING (producto_id)
  )
  SELECT string_agg(
           format('%s (hay %s piezas y se retirarían %s)',
                  p.nombre, p.stock_actual, -delta.d),
           '; ' ORDER BY p.nombre)
    INTO v_falta
    FROM delta JOIN productos p ON p.id = delta.producto_id
   WHERE p.stock_actual + delta.d < 0;

  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede editar la entrada porque las piezas ya no están en existencia: %',
      v_falta
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.entrada_operacion', 'edicion_entrada', true);

  -- Sólo se tocan las líneas que de verdad cambian. Borrar y reinsertar todas
  -- daba el stock correcto —los dos triggers se compensan—, pero dejaba en
  -- stock_movimientos un par de filas que se anulan por cada línea intacta.
  -- Cambiar sólo el número de factura no debe ensuciar el historial de nadie.
  --
  -- El emparejamiento lleva row_number sobre la terna completa para no asumir
  -- que un producto aparece en una sola línea de la entrada.
  --
  -- Los ids a borrar se calculan ANTES de insertar: después, entradas_detalle
  -- contiene las viejas y las nuevas a la vez y ya no se distinguen.
  WITH viejas AS (
    SELECT id, producto_id, cantidad, precio_unitario,
           row_number() OVER (
             PARTITION BY producto_id, cantidad, precio_unitario ORDER BY id) AS rn
      FROM entradas_detalle WHERE entrada_id = p_entrada_id
  ), nuevas AS (
    SELECT (d->>'producto_id')::uuid AS producto_id,
           (d->>'cantidad')::integer AS cantidad,
           (d->>'precio_unitario')::numeric AS precio_unitario,
           row_number() OVER (
             PARTITION BY (d->>'producto_id')::uuid,
                          (d->>'cantidad')::integer,
                          (d->>'precio_unitario')::numeric
             ORDER BY o) AS rn
      FROM jsonb_array_elements(p_detalles) WITH ORDINALITY AS t(d, o)
  )
  SELECT array_agg(v.id) INTO v_viejos
    FROM viejas v
   WHERE NOT EXISTS (
     SELECT 1 FROM nuevas n
      WHERE n.producto_id = v.producto_id
        AND n.cantidad = v.cantidad
        AND n.precio_unitario = v.precio_unitario
        AND n.rn = v.rn);

  -- Insertar ANTES de borrar. La reversión resta: al revés, el stock caería
  -- transitoriamente por debajo de cero y abortaría ediciones cuyo saldo neto
  -- es perfectamente válido.
  WITH viejas AS (
    SELECT producto_id, cantidad, precio_unitario,
           row_number() OVER (
             PARTITION BY producto_id, cantidad, precio_unitario ORDER BY id) AS rn
      FROM entradas_detalle WHERE entrada_id = p_entrada_id
  ), nuevas AS (
    SELECT (d->>'producto_id')::uuid AS producto_id,
           (d->>'cantidad')::integer AS cantidad,
           (d->>'precio_unitario')::numeric AS precio_unitario,
           row_number() OVER (
             PARTITION BY (d->>'producto_id')::uuid,
                          (d->>'cantidad')::integer,
                          (d->>'precio_unitario')::numeric
             ORDER BY o) AS rn
      FROM jsonb_array_elements(p_detalles) WITH ORDINALITY AS t(d, o)
  )
  INSERT INTO entradas_detalle (entrada_id, producto_id, cantidad, precio_unitario)
  SELECT p_entrada_id, n.producto_id, n.cantidad, n.precio_unitario
    FROM nuevas n
   WHERE NOT EXISTS (
     SELECT 1 FROM viejas v
      WHERE v.producto_id = n.producto_id
        AND v.cantidad = n.cantidad
        AND v.precio_unitario = n.precio_unitario
        AND v.rn = n.rn);

  IF v_viejos IS NOT NULL THEN
    DELETE FROM entradas_detalle WHERE id = ANY(v_viejos);
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
    FROM entradas_detalle WHERE entrada_id = p_entrada_id;

  -- El folio no se toca: la entrada sigue siendo la misma.
  UPDATE entradas
     SET proveedor_id   = p_proveedor_id,
         fecha          = p_fecha,
         fecha_factura  = p_fecha_factura,
         numero_factura = p_numero_factura,
         notas          = p_notas,
         total          = v_total
   WHERE id = p_entrada_id
   RETURNING * INTO v_entrada;

  RETURN v_entrada;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_actualizar_entrada(uuid, uuid, date, date, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_actualizar_entrada(uuid, uuid, date, date, text, text, jsonb) TO authenticated;
