-- =====================================================================
-- Fix: detect generated columns via pg_attribute (more reliable)
-- =====================================================================
-- The previous version queried information_schema.columns for
-- is_generated='ALWAYS', but for some reason that didn't catch
-- ventas_detalle.subtotal. Switching to pg_attribute.attgenerated
-- which is the canonical Postgres source:
--   attgenerated = 's'  → STORED generated column
--   attgenerated = ''   → not generated
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
  excluded_cols text[];
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

  -- 2. TRUNCATE everything in reverse dependency order
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

  -- 3. INSERT with stripped generated columns
  FOREACH tbl IN ARRAY all_tables LOOP
    -- Use pg_attribute (canonical) instead of information_schema.
    -- attgenerated is non-empty for any generated column.
    -- attidentity = 'a' covers GENERATED ALWAYS AS IDENTITY.
    SELECT COALESCE(array_agg(a.attname::text), ARRAY[]::text[])
    INTO excluded_cols
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = tbl
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND (a.attgenerated <> '' OR a.attidentity = 'a');

    -- Log so we can see what's being stripped (visible in pg logs).
    RAISE NOTICE 'Restoring %: stripping cols = %', tbl, excluded_cols;

    EXECUTE format(
      'INSERT INTO public.%1$I
       SELECT (jsonb_populate_record(NULL::public.%1$I, row - $1)).*
       FROM jsonb_array_elements($2) AS row',
      tbl
    ) USING excluded_cols, COALESCE(data->tbl, '[]'::jsonb);

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
