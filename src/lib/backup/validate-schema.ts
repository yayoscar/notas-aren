import type { SupabaseClient } from "@supabase/supabase-js"

export type SchemaValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }

/**
 * Validates that every column present in the backup payload still
 * exists in the current database schema. Tolerates missing tables in
 * the backup (treated as empty) and tolerates extra columns in the DB
 * (those will simply be NULL after restore).
 *
 * Fails on backup columns that no longer exist in the DB, because
 * those would cause `jsonb_populate_record` to error during restore
 * — which would correctly roll back, but with a much less actionable
 * error message than what we can produce here.
 */
export async function validateBackupSchema(
  data: Record<string, unknown[]>,
  supabaseAdmin: SupabaseClient
): Promise<SchemaValidationResult> {
  const errors: string[] = []

  for (const [tableName, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue

    // Use the first row's keys as the backup-side schema sample.
    const firstRow = rows[0]
    if (typeof firstRow !== "object" || firstRow === null) continue

    const backupColumns = Object.keys(firstRow as Record<string, unknown>)

    // Fetch current columns from DB via the helper RPC.
    const { data: currentColumns, error } = await supabaseAdmin.rpc(
      "get_table_columns",
      { p_table_name: tableName }
    )

    if (error) {
      errors.push(
        `No se pudo leer el esquema actual de la tabla "${tableName}": ${error.message}`
      )
      continue
    }

    if (!currentColumns || (currentColumns as string[]).length === 0) {
      errors.push(
        `La tabla "${tableName}" del respaldo no existe en la base de datos actual.`
      )
      continue
    }

    const currentSet = new Set(currentColumns as string[])
    const missing = backupColumns.filter((col) => !currentSet.has(col))

    if (missing.length > 0) {
      errors.push(
        `Tabla "${tableName}": las siguientes columnas del respaldo ya no existen en la BD: ${missing.join(", ")}`
      )
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
