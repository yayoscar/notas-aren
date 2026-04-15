-- =====================================================================
-- Fix: restore_database without session_replication_role
-- =====================================================================
-- The previous version used `SET LOCAL session_replication_role = 'replica'`
-- to skip triggers, but that parameter requires superuser privileges,
-- which Supabase's `service_role` does not have.
--
-- This version uses `ALTER TABLE ... DISABLE TRIGGER USER` per table
-- instead. That command requires table ownership, which works because
-- the function is SECURITY DEFINER and its owner (postgres) owns the
-- public tables.
--
-- Note: DISABLE TRIGGER USER skips only user-defined triggers (stock,
-- credit liquidation, historiales). It does NOT disable internal FK
-- constraint triggers, so the INSERT order must remain topologically
-- correct (parents before children).
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
  -- All backup-managed tables, in FORWARD dependency order
  -- (parents → children). Reverse for TRUNCATE.
  -- Must stay in sync with BACKUP_TABLES in src/lib/backup/constants.ts.
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
  -- Validate input shape
  IF payload IS NULL OR payload->'data' IS NULL THEN
    RAISE EXCEPTION 'Invalid payload: missing data field';
  END IF;

  data := payload->'data';

  -- ===================================================================
  -- 1. Disable user triggers on every backup table.
  -- ALTER TABLE requires ownership. Function is SECURITY DEFINER and
  -- owned by postgres, who owns public tables, so this works.
  -- ===================================================================
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', tbl);
  END LOOP;

  -- ===================================================================
  -- 2. TRUNCATE in REVERSE dependency order. CASCADE handles any FK we
  -- might have missed, RESTART IDENTITY resets sequences.
  -- ===================================================================
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

  -- ===================================================================
  -- 3. INSERT in FORWARD dependency order using jsonb_populate_record.
  -- ===================================================================

  INSERT INTO public.cat_genero SELECT (jsonb_populate_record(NULL::public.cat_genero, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_genero', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_genero');

  INSERT INTO public.cat_tamano SELECT (jsonb_populate_record(NULL::public.cat_tamano, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_tamano', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_tamano');

  INSERT INTO public.cat_presentacion SELECT (jsonb_populate_record(NULL::public.cat_presentacion, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_presentacion', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_presentacion');

  INSERT INTO public.cat_concentracion SELECT (jsonb_populate_record(NULL::public.cat_concentracion, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_concentracion', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_concentracion');

  INSERT INTO public.cat_tipo_perfume SELECT (jsonb_populate_record(NULL::public.cat_tipo_perfume, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_tipo_perfume', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_tipo_perfume');

  INSERT INTO public.cat_categoria_gasto SELECT (jsonb_populate_record(NULL::public.cat_categoria_gasto, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_categoria_gasto', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_categoria_gasto');

  INSERT INTO public.cat_ciudad SELECT (jsonb_populate_record(NULL::public.cat_ciudad, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_ciudad', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_ciudad');

  INSERT INTO public.cat_cuenta_bancaria SELECT (jsonb_populate_record(NULL::public.cat_cuenta_bancaria, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cat_cuenta_bancaria', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cat_cuenta_bancaria');

  INSERT INTO public.proveedores SELECT (jsonb_populate_record(NULL::public.proveedores, row)).*
    FROM jsonb_array_elements(COALESCE(data->'proveedores', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'proveedores');

  INSERT INTO public.vendedores SELECT (jsonb_populate_record(NULL::public.vendedores, row)).*
    FROM jsonb_array_elements(COALESCE(data->'vendedores', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'vendedores');

  INSERT INTO public.clientes SELECT (jsonb_populate_record(NULL::public.clientes, row)).*
    FROM jsonb_array_elements(COALESCE(data->'clientes', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'clientes');

  INSERT INTO public.configuracion SELECT (jsonb_populate_record(NULL::public.configuracion, row)).*
    FROM jsonb_array_elements(COALESCE(data->'configuracion', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'configuracion');

  INSERT INTO public.productos SELECT (jsonb_populate_record(NULL::public.productos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'productos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'productos');

  INSERT INTO public.precios_historico SELECT (jsonb_populate_record(NULL::public.precios_historico, row)).*
    FROM jsonb_array_elements(COALESCE(data->'precios_historico', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'precios_historico');

  INSERT INTO public.set_detalle SELECT (jsonb_populate_record(NULL::public.set_detalle, row)).*
    FROM jsonb_array_elements(COALESCE(data->'set_detalle', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'set_detalle');

  INSERT INTO public.entradas SELECT (jsonb_populate_record(NULL::public.entradas, row)).*
    FROM jsonb_array_elements(COALESCE(data->'entradas', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'entradas');

  INSERT INTO public.entradas_detalle SELECT (jsonb_populate_record(NULL::public.entradas_detalle, row)).*
    FROM jsonb_array_elements(COALESCE(data->'entradas_detalle', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'entradas_detalle');

  INSERT INTO public.lineas_credito SELECT (jsonb_populate_record(NULL::public.lineas_credito, row)).*
    FROM jsonb_array_elements(COALESCE(data->'lineas_credito', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'lineas_credito');

  INSERT INTO public.ventas SELECT (jsonb_populate_record(NULL::public.ventas, row)).*
    FROM jsonb_array_elements(COALESCE(data->'ventas', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'ventas');

  INSERT INTO public.ventas_detalle SELECT (jsonb_populate_record(NULL::public.ventas_detalle, row)).*
    FROM jsonb_array_elements(COALESCE(data->'ventas_detalle', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'ventas_detalle');

  INSERT INTO public.ventas_historial SELECT (jsonb_populate_record(NULL::public.ventas_historial, row)).*
    FROM jsonb_array_elements(COALESCE(data->'ventas_historial', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'ventas_historial');

  INSERT INTO public.pagos SELECT (jsonb_populate_record(NULL::public.pagos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'pagos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'pagos');

  INSERT INTO public.cobranza_seguimiento SELECT (jsonb_populate_record(NULL::public.cobranza_seguimiento, row)).*
    FROM jsonb_array_elements(COALESCE(data->'cobranza_seguimiento', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'cobranza_seguimiento');

  INSERT INTO public.devoluciones SELECT (jsonb_populate_record(NULL::public.devoluciones, row)).*
    FROM jsonb_array_elements(COALESCE(data->'devoluciones', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'devoluciones');

  INSERT INTO public.devoluciones_detalle SELECT (jsonb_populate_record(NULL::public.devoluciones_detalle, row)).*
    FROM jsonb_array_elements(COALESCE(data->'devoluciones_detalle', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'devoluciones_detalle');

  INSERT INTO public.saldos_favor SELECT (jsonb_populate_record(NULL::public.saldos_favor, row)).*
    FROM jsonb_array_elements(COALESCE(data->'saldos_favor', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'saldos_favor');

  INSERT INTO public.stock_movimientos SELECT (jsonb_populate_record(NULL::public.stock_movimientos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'stock_movimientos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'stock_movimientos');

  INSERT INTO public.gastos SELECT (jsonb_populate_record(NULL::public.gastos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'gastos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'gastos');

  -- ===================================================================
  -- 4. Re-enable user triggers on every backup table.
  -- ===================================================================
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', tbl);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restoredTables', to_jsonb(restored_tables),
    'totalRows', total_rows
  );

EXCEPTION WHEN OTHERS THEN
  -- Best-effort: try to re-enable triggers before propagating the error.
  -- The transaction will roll back anyway, but if for some reason it
  -- doesn't (e.g. autocommit at the call site), at least we leave the
  -- DB in a usable state.
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
