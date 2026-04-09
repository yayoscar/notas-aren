import type { BackupTable } from "./constants"

/**
 * Metadata stored as `metadata.json` inside every backup ZIP.
 * Used by the restore flow to validate compatibility before
 * attempting to overwrite the database.
 */
export interface BackupMetadata {
  /** Format version. Bumped on breaking changes to the payload shape. */
  version: string
  /** ISO timestamp of when the backup was generated. */
  generatedAt: string
  /** Number of tables included. */
  tableCount: number
  /** List of tables actually included in this backup. */
  tables: string[]
}

/**
 * Full backup payload as held in memory during restore.
 * Mirrors the JSONB shape passed to `public.restore_database(payload jsonb)`.
 */
export interface BackupPayload {
  metadata: BackupMetadata
  /** Map of table name → array of row objects (untyped JSON). */
  data: Record<string, unknown[]>
}

/**
 * Subset of `BackupPayload` keyed strictly by known tables.
 * Useful when you want to enforce that all expected tables are present.
 */
export type StrictBackupData = Record<BackupTable, unknown[]>
