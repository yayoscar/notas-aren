import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import JSZip from "jszip"
import { BACKUP_TABLES } from "@/lib/backup/constants"
import type { BackupMetadata, BackupPayload } from "@/lib/backup/types"
import { validateBackupSchema } from "@/lib/backup/validate-schema"
import {
  IS_LOCAL_DB,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/env.server"

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Allow longer execution because restore can take a while with
// tens of thousands of rows.
export const maxDuration = 300

/**
 * POST /api/configuracion/restore
 *
 * Receives a multipart/form-data upload with a single field `file`
 * containing the backup ZIP. Validates schema compatibility, then
 * invokes the atomic Postgres function `public.restore_database`.
 * Admin only.
 */
export async function POST(request: Request) {
  const serverSupabase = createServerClient()

  // 1. Auth check
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

  // 1b. Guard: una restauración borra y reescribe las 30 tablas. Desde una
  // máquina de desarrollo eso sólo tiene sentido contra la base local. En el
  // deploy real NODE_ENV === "production", así que la función legítima sigue
  // disponible.
  if (process.env.NODE_ENV !== "production" && !IS_LOCAL_DB) {
    return NextResponse.json(
      {
        error:
          "Restauración bloqueada: estás en desarrollo apuntando a PRODUCCIÓN. " +
          "Cambia NEXT_PUBLIC_APP_ENV=local en .env.local y reinicia el servidor.",
      },
      { status: 403 }
    )
  }

  // 2. Read the uploaded file
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el archivo enviado" },
      { status: 400 }
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Archivo de respaldo faltante o vacío" },
      { status: 400 }
    )
  }

  // 3. Parse ZIP
  let zip: JSZip
  try {
    const buffer = await file.arrayBuffer()
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return NextResponse.json(
      { error: "ZIP inválido o corrupto" },
      { status: 400 }
    )
  }

  // 4. Read metadata.json
  const metadataFile = zip.file("metadata.json")
  if (!metadataFile) {
    return NextResponse.json(
      { error: "El ZIP no contiene metadata.json — no es un respaldo válido" },
      { status: 400 }
    )
  }

  let metadata: BackupMetadata
  try {
    const raw = await metadataFile.async("string")
    const parsed = JSON.parse(raw)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.version !== "string" ||
      typeof parsed.generatedAt !== "string"
    ) {
      throw new Error("metadata shape invalid")
    }
    metadata = parsed as BackupMetadata
  } catch {
    return NextResponse.json(
      { error: "metadata.json inválido o corrupto" },
      { status: 400 }
    )
  }

  // 5. Read each table's JSON. Missing files are tolerated → empty array.
  const data: Record<string, unknown[]> = {}
  const missingTables: string[] = []

  for (const table of BACKUP_TABLES) {
    const entry = zip.file(`${table}.json`)
    if (!entry) {
      data[table] = []
      missingTables.push(table)
      continue
    }
    try {
      const raw = await entry.async("string")
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return NextResponse.json(
          { error: `${table}.json no contiene un arreglo válido` },
          { status: 400 }
        )
      }
      data[table] = parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error desconocido"
      return NextResponse.json(
        { error: `Error al leer ${table}.json: ${msg}` },
        { status: 400 }
      )
    }
  }

  // 6. Validate schema compatibility
  const validation = await validateBackupSchema(data, supabaseAdmin)
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "El esquema del respaldo no es compatible con la base de datos actual",
        details: validation.errors,
      },
      { status: 400 }
    )
  }

  // 7. Invoke the atomic restore RPC
  const payload: BackupPayload = { metadata, data }

  const { data: result, error: rpcError } = await supabaseAdmin.rpc(
    "restore_database",
    { payload: payload as unknown as Record<string, unknown> }
  )

  if (rpcError) {
    return NextResponse.json(
      { error: `Error al restaurar la base de datos: ${rpcError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    restoredTables: (result as { restoredTables?: string[] })?.restoredTables ?? [],
    totalRows: (result as { totalRows?: number })?.totalRows ?? 0,
    missingTables,
  })
}
