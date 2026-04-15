-- =====================================================================
-- Final fix: hardcoded generated-column map
-- =====================================================================
-- Previous attempts queried information_schema and pg_attribute to
-- find generated columns dynamically. Neither worked reliably in this
-- environment. Switching to a hardcoded map of {table → stripped cols}
-- which is deterministic and doesn't depend on system catalogs.
--
-- Known generated columns (from migrations 20260316000005,
-- 20260319000002, 20260324000004):
--   entradas_detalle.subtotal     = cantidad * precio_unitario STORED
--   ventas_detalle.subtotal       = cantidad * precio_unitario STORED
--   devoluciones_detalle.subtotal = cantidad * precio_unitario STORED
--
-- ⚠️ If you add a new GENERATED column to any table, add it here too.
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
  -- Map of table → array of generated/identity columns to strip from
  -- the JSONB before INSERT. PostgreSQL refuses to accept any value
  -- (including NULL) for GENERATED ALWAYS columns.
  generated_map jsonb := '{
    "entradas_detalle":     ["subtotal"],
    "ventas_detalle":       ["subtotal"],
    "devoluciones_detalle": ["subtotal"]
  }'::jsonb;
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

  -- 1. Disable user triggers (stock, liquidación de crédito, historiales)
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

  -- 3. INSERT each table, stripping its hardcoded generated columns
  FOREACH tbl IN ARRAY all_tables LOOP
    -- Resolve cols-to-strip from the hardcoded map. Empty array if
    -- the table has no generated columns.
    IF generated_map ? tbl THEN
      excluded_cols := ARRAY(SELECT jsonb_array_elements_text(generated_map->tbl));
    ELSE
      excluded_cols := ARRAY[]::text[];
    END IF;

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
