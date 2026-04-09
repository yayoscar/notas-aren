import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { format } from "date-fns"
import JSZip from "jszip"
import { BACKUP_TABLES, BACKUP_FORMAT_VERSION } from "@/lib/backup/constants"
import type { BackupMetadata } from "@/lib/backup/types"

// Service-role admin client (bypasses RLS — required to read all tables).
// Mirrors the pattern used by src/app/api/vendedores/route.ts.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/configuracion/backup
 *
 * Generates a complete database backup as a ZIP archive containing one
 * JSON file per table plus a metadata.json. Only callable by admin
 * vendedores. Returns the ZIP as a binary download.
 */
export async function POST() {
  const serverSupabase = createServerClient()

  // 1. Auth check — must be a logged-in admin.
  const {
    data: { user },
  } = await serverSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { data: vendedorActual } = await serverSupabase
    .from("vendedores")
    .select("rol")
    .eq("auth_user_id", user.id)
    .single()

  if (vendedorActual?.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  // 2. Dump all tables using service role (bypasses RLS).
  // Use a high range to fetch all rows in one call. Supabase default
  // limit is 1000, so we explicitly request up to 100k per table.
  const data: Record<string, unknown[]> = {}

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .range(0, 99999)

    if (error) {
      return NextResponse.json(
        { error: `Error al respaldar tabla ${table}: ${error.message}` },
        { status: 500 }
      )
    }

    data[table] = rows ?? []
  }

  // 3. Build the ZIP with one JSON per table + metadata.json
  const zip = new JSZip()
  const metadata: BackupMetadata = {
    version: BACKUP_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    tableCount: BACKUP_TABLES.length,
    tables: [...BACKUP_TABLES],
  }

  zip.file("metadata.json", JSON.stringify(metadata, null, 2))
  for (const [table, rows] of Object.entries(data)) {
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2))
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  // 4. Stream as downloadable file.
  const filename = `notas-aren-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.zip`

  // Cast needed because of a lib mismatch between Node's Uint8Array
  // (whose `.buffer` may be SharedArrayBuffer) and DOM's BlobPart.
  const blob = new Blob([buffer as BlobPart], { type: "application/zip" })

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(blob.size),
    },
  })
}
