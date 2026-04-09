/**
 * Source of truth for the database backup/restore module.
 *
 * BACKUP_TABLES is ordered topologically by foreign-key dependencies:
 * parents (catalogos, independent entities) come first, leaf tables
 * (movimientos, historiales) come last. This order matters for restore:
 *   - Inserts walk forward (parents before children)
 *   - Truncates walk backward (children before parents) — see RESTORE_DELETE_ORDER
 *
 * Any new table added to the schema MUST also be added here in the
 * correct dependency position, AND mirrored in the SQL function
 * `public.restore_database` (see migration 20260408000001).
 */
export const BACKUP_TABLES = [
  // Catalogos (no FK dependencies)
  "cat_genero",
  "cat_tamano",
  "cat_presentacion",
  "cat_concentracion",
  "cat_tipo_perfume",
  "cat_categoria_gasto",
  "cat_ciudad",
  "cat_cuenta_bancaria",

  // Independent entities
  "proveedores",
  "vendedores",
  "clientes",
  "configuracion",

  // Products & pricing
  "productos",
  "precios_historico",
  "set_detalle",

  // Inventory operations
  "entradas",
  "entradas_detalle",

  // Credit lines (referenced by ventas/pagos)
  "lineas_credito",

  // Sales
  "ventas",
  "ventas_detalle",
  "ventas_historial",
  "pagos",
  "cobranza_seguimiento",

  // Returns & balances
  "devoluciones",
  "devoluciones_detalle",
  "saldos_favor",

  // Stock movements (FK to many)
  "stock_movimientos",

  // Expenses
  "gastos",
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/**
 * Reverse order for TRUNCATE/DELETE operations during restore.
 * Children must be removed before parents to satisfy FK constraints
 * (even with session_replication_role=replica, this is a safety net).
 */
export const RESTORE_DELETE_ORDER: readonly BackupTable[] = [...BACKUP_TABLES].reverse()

/**
 * Current backup format version. Bump this if the metadata or
 * file structure changes in a non-backwards-compatible way.
 */
export const BACKUP_FORMAT_VERSION = "1.0"
