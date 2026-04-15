-- =====================================================================
-- Fix: restore_database — skip GENERATED columns during INSERT
-- =====================================================================
-- Previous version errored with:
--   "cannot insert a non-DEFAULT value into column 'subtotal'"
-- because some tables have GENERATED ALWAYS AS (...) STORED columns
-- (e.g. ventas_detalle.subtotal). PostgreSQL forbids inserting any
-- value into those columns — including from jsonb_populate_record.
--
-- Fix: for each table, query information_schema for generated columns
-- and strip those keys from the JSONB row before populating. This is
-- done in a single loop instead of 28 hardcoded INSERTs.
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
  generated_cols text[];
  -- Tables in FORWARD dependency order (parents → children).
  -- Mirror of BACKUP_TABLES in src/lib/backup/constants.ts.
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

  -- 1. Disable user triggers on every backup table.
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', tbl);
  END LOOP;

  -- 2. TRUNCATE in REVERSE dependency order. CASCADE for safety,
  --    RESTART IDENTITY to reset sequences.
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

  -- 3. INSERT each table in forward dependency order. Strip generated
  --    columns from the row JSONB so PostgreSQL doesn't complain about
  --    "cannot insert a non-DEFAULT value into column".
  FOREACH tbl IN ARRAY all_tables LOOP
    -- Find columns we must NOT insert into:
    --   - is_generated = 'ALWAYS' covers GENERATED ALWAYS AS (...) STORED
    --   - identity_generation = 'ALWAYS' covers GENERATED ALWAYS AS IDENTITY
    SELECT COALESCE(array_agg(column_name::text), ARRAY[]::text[])
    INTO generated_cols
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = tbl
      AND (is_generated = 'ALWAYS' OR identity_generation = 'ALWAYS');

    -- jsonb minus a text[] removes all those keys at once. We pass the
    -- generated_cols as a parameter via USING. If the array is empty,
    -- jsonb - '{}'::text[] is a no-op.
    EXECUTE format(
      'INSERT INTO public.%1$I
       SELECT (jsonb_populate_record(NULL::public.%1$I, row - $1)).*
       FROM jsonb_array_elements($2) AS row',
      tbl
    ) USING generated_cols, COALESCE(data->tbl, '[]'::jsonb);

    GET DIAGNOSTICS table_rows = ROW_COUNT;
    total_rows := total_rows + table_rows;
    restored_tables := array_append(restored_tables, tbl);
  END LOOP;

  -- 4. Re-enable user triggers.
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', tbl);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restoredTables', to_jsonb(restored_tables),
    'totalRows', total_rows
  );

EXCEPTION WHEN OTHERS THEN
  -- Best-effort: re-enable triggers before propagating.
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
