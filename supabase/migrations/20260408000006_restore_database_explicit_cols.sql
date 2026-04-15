-- =====================================================================
-- REAL fix: explicit column list in INSERT (excludes generated cols)
-- =====================================================================
-- Root cause of the persistent "cannot insert a non-DEFAULT value into
-- column subtotal" error:
--
--   `INSERT INTO t SELECT (jsonb_populate_record(NULL::t, row)).*`
--
-- The `.*` expands to ALL columns of the record type, including the
-- generated ones — with NULL values. PostgreSQL refuses to insert any
-- value (including NULL) into a GENERATED ALWAYS column. Stripping
-- the JSON key wasn't enough because the record type still has the
-- column.
--
-- Real fix: build an explicit column list from pg_attribute, excluding
-- generated columns, and use it in BOTH the INSERT (col1, col2, ...)
-- AND the SELECT col1, col2, .... This way the generated column is
-- never mentioned in the SQL at all.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.restore_database(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  total_rows bigint := 0;
  restored_tables text[] := ARRAY[]::text[];
  table_rows bigint;
  data jsonb;
  tbl text;
  col_list text;
  all_tables text[] := ARRAY[
    'cat_genero',
    'cat_tamano',
    'cat_presentacion',
    'cat_concentracion',
    'cat_tipo_perfume',
    'cat_categoria_gasto',
    'cat_ciudad',
    'cat_cuenta_bancaria',
    'proveedores',
    'vendedores',
    'clientes',
    'configuracion',
    'productos',
    'precios_historico',
    'set_detalle',
    'entradas',
    'entradas_detalle',
    'lineas_credito',
    'ventas',
    'ventas_detalle',
    'ventas_historial',
    'pagos',
    'cobranza_seguimiento',
    'devoluciones',
    'devoluciones_detalle',
    'saldos_favor',
    'stock_movimientos',
    'gastos'
  ];
BEGIN
  IF payload IS NULL OR payload->'data' IS NULL THEN
    RAISE EXCEPTION 'Invalid payload: missing data field';
  END IF;

  data := payload->'data';

  -- 1. Disable user triggers
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', tbl);
  END LOOP;

  -- 2. TRUNCATE in REVERSE dependency order
  TRUNCATE TABLE
    public.gastos,
    public.stock_movimientos,
    public.saldos_favor,
    public.devoluciones_detalle,
    public.devoluciones,
    public.cobranza_seguimiento,
    public.pagos,
    public.ventas_historial,
    public.ventas_detalle,
    public.ventas,
    public.lineas_credito,
    public.entradas_detalle,
    public.entradas,
    public.set_detalle,
    public.precios_historico,
    public.productos,
    public.configuracion,
    public.clientes,
    public.vendedores,
    public.proveedores,
    public.cat_cuenta_bancaria,
    public.cat_ciudad,
    public.cat_categoria_gasto,
    public.cat_tipo_perfume,
    public.cat_concentracion,
    public.cat_presentacion,
    public.cat_tamano,
    public.cat_genero
  RESTART IDENTITY CASCADE;

  -- 3. INSERT with explicit column list (excludes generated columns)
  FOREACH tbl IN ARRAY all_tables LOOP
    -- Build a comma-separated list of writable columns:
    --   - attnum > 0          → real columns (not system)
    --   - NOT attisdropped    → not dropped
    --   - attgenerated = ''   → not GENERATED ALWAYS AS (...) STORED
    --   - attidentity <> 'a'  → not GENERATED ALWAYS AS IDENTITY
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO col_list
    FROM pg_attribute
    WHERE attrelid = ('public.' || quote_ident(tbl))::regclass
      AND attnum > 0
      AND NOT attisdropped
      AND attgenerated = ''
      AND attidentity <> 'a';

    IF col_list IS NULL THEN
      RAISE EXCEPTION 'No writable columns found for table %', tbl;
    END IF;

    -- INSERT INTO public.t (c1, c2, ...) SELECT c1, c2, ...
    --   FROM jsonb_populate_recordset(NULL::public.t, $1)
    --
    -- jsonb_populate_recordset is the bulk version of populate_record
    -- and accepts a JSON array directly. The explicit column list on
    -- both sides means generated columns are never referenced.
    EXECUTE format(
      'INSERT INTO public.%1$I (%2$s)
       SELECT %2$s
       FROM jsonb_populate_recordset(NULL::public.%1$I, $1)',
      tbl, col_list
    ) USING COALESCE(data->tbl, '[]'::jsonb);

    GET DIAGNOSTICS table_rows = ROW_COUNT;
    total_rows := total_rows + table_rows;
    restored_tables := array_append(restored_tables, tbl);
  END LOOP;

  -- 4. Re-enable triggers
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', tbl);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restoredTables', to_jsonb(restored_tables),
    'totalRows', total_rows
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', tbl);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;
