-- =====================================================================
-- Restore database from backup payload
-- =====================================================================
-- This migration adds two functions used by the backup/restore module:
--
-- 1. public.get_table_columns(table_name text) RETURNS text[]
--    Returns the list of column names for a given public table.
--    Used by the restore API route for schema validation before restore.
--
-- 2. public.restore_database(payload jsonb) RETURNS jsonb
--    Atomically replaces the contents of all backup-managed tables with
--    the data from the payload. Runs inside an implicit transaction so
--    any error rolls back the entire restore. Disables triggers and
--    foreign-key checks for the duration via session_replication_role.
--
-- The list of tables here MUST stay in sync with BACKUP_TABLES in
-- src/lib/backup/constants.ts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: get_table_columns
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(array_agg(column_name::text ORDER BY ordinal_position), ARRAY[]::text[])
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name;
$$;

-- ---------------------------------------------------------------------
-- Main: restore_database
-- ---------------------------------------------------------------------
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
BEGIN
  -- Validate input shape
  IF payload IS NULL OR payload->'data' IS NULL THEN
    RAISE EXCEPTION 'Invalid payload: missing data field';
  END IF;

  data := payload->'data';

  -- Disable triggers and FK checks for this transaction.
  -- This is critical because:
  --   1. The schema has triggers (stock movements, credit liquidation,
  --      historiales) that would corrupt restored state if they fired.
  --   2. TRUNCATE/INSERT order would otherwise have to be perfect even
  --      with deferrable constraints.
  -- session_replication_role = 'replica' makes Postgres skip user
  -- triggers and FK validation, just like during streaming replication.
  SET LOCAL session_replication_role = 'replica';

  -- ===================================================================
  -- TRUNCATE in REVERSE dependency order (children → parents).
  -- All in one statement so it counts as a single operation.
  -- RESTART IDENTITY resets sequences so restored IDs don't collide
  -- with auto-generated values for tables using SERIAL/IDENTITY.
  -- CASCADE handles any FK we missed in the manual ordering.
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
  -- INSERT in FORWARD dependency order (parents → children).
  -- Each block extracts the table's array from the payload, populates
  -- a typed record from each JSON object, and inserts via SELECT *.
  -- Uses jsonb_populate_record(NULL::table_type, row) which auto-maps
  -- JSON keys to column names of the target table.
  -- ===================================================================

  -- Catalogos
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

  -- Independent entities
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

  -- Products & pricing
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

  -- Inventory
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

  -- Credit lines
  INSERT INTO public.lineas_credito SELECT (jsonb_populate_record(NULL::public.lineas_credito, row)).*
    FROM jsonb_array_elements(COALESCE(data->'lineas_credito', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'lineas_credito');

  -- Sales
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

  -- Returns & balances
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

  -- Stock movements (FK to many)
  INSERT INTO public.stock_movimientos SELECT (jsonb_populate_record(NULL::public.stock_movimientos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'stock_movimientos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'stock_movimientos');

  -- Expenses
  INSERT INTO public.gastos SELECT (jsonb_populate_record(NULL::public.gastos, row)).*
    FROM jsonb_array_elements(COALESCE(data->'gastos', '[]'::jsonb)) AS row;
  GET DIAGNOSTICS table_rows = ROW_COUNT;
  total_rows := total_rows + table_rows;
  restored_tables := array_append(restored_tables, 'gastos');

  -- session_replication_role auto-resets at end of transaction (LOCAL).

  RETURN jsonb_build_object(
    'success', true,
    'restoredTables', to_jsonb(restored_tables),
    'totalRows', total_rows
  );

EXCEPTION WHEN OTHERS THEN
  -- Postgres rolls back the transaction automatically on exception.
  -- Re-raise so the calling RPC sees the original error.
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
-- Both functions are SECURITY DEFINER, but we still want to lock down
-- who can call them. Only the service role (used by the Next.js API
-- routes) should be able to invoke restore_database. anon and
-- authenticated can read get_table_columns since it's harmless metadata.
REVOKE EXECUTE ON FUNCTION public.restore_database(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_database(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_table_columns(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO service_role;
