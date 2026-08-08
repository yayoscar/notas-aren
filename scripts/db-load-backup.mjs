#!/usr/bin/env node
/**
 * Carga en la base LOCAL un respaldo `.zip` exportado por el propio sistema
 * (el que produce /configuracion/respaldo).
 *
 *   npm run db:load-backup -- ~/Descargas/notas-aren-backup-2026-08-08-1200.zip
 *   npm run db:load-backup -- <zip> --force    (continúa pese a la deriva de esquema)
 *
 * Por qué hace falta sembrar auth.users:
 *   El respaldo NO incluye `auth.users`, pero cinco columnas tienen FK contra
 *   esa tabla, y `restore_database` sólo hace `DISABLE TRIGGER USER`, que no
 *   desactiva los triggers de las FK. Sin este paso previo la restauración
 *   falla entera sobre una base recién reseteada.
 *
 * Se invoca el mismo RPC `public.restore_database` que usa la app, así que
 * esto ejercita el camino de producción, no una implementación paralela.
 */
import { readFile } from "node:fs/promises"

import { createClient } from "@supabase/supabase-js"
import JSZip from "jszip"

import { die, info, requireLocalApiUrl } from "./lib/guards.mjs"

const args = process.argv.slice(2)
const force = args.includes("--force")
const zipPath = args.find((a) => !a.startsWith("--"))

if (!zipPath) die("Uso: npm run db:load-backup -- <ruta-al-respaldo.zip>")

const API_URL = requireLocalApiUrl()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL
if (!SERVICE_KEY) die("Falta SUPABASE_SERVICE_ROLE_KEY_LOCAL en .env.local.")

const PASSWORD = process.env.LOCAL_DEV_PASSWORD || "local1234"
if (PASSWORD.length < 6) die("LOCAL_DEV_PASSWORD debe tener al menos 6 caracteres.")

const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---------------------------------------------------------------------------
// 1. Leer el ZIP
// ---------------------------------------------------------------------------
let zip
try {
  zip = await JSZip.loadAsync(await readFile(zipPath))
} catch (e) {
  die(`No se pudo abrir "${zipPath}": ${e.message}`)
}

const metaFile = zip.file("metadata.json")
if (!metaFile) die("El ZIP no contiene metadata.json — ¿es un respaldo del sistema?")
const metadata = JSON.parse(await metaFile.async("string"))

const tablas = metadata.tables ?? []
if (!tablas.length) die("metadata.json no trae la lista de tablas.")

const data = {}
const ausentes = []
for (const t of tablas) {
  const f = zip.file(`${t}.json`)
  if (!f) {
    ausentes.push(t)
    data[t] = []
    continue
  }
  data[t] = JSON.parse(await f.async("string"))
}

const totalOrigen = Object.values(data).reduce((a, r) => a + r.length, 0)
info(
  `Respaldo v${metadata.version} del ${metadata.generatedAt} — ` +
    `${tablas.length} tablas, ${totalOrigen} filas.`
)
if (ausentes.length) {
  console.warn(`⚠ Sin archivo en el ZIP (se cargarán vacías): ${ausentes.join(", ")}`)
}

// ---------------------------------------------------------------------------
// 2. Validar el esquema — misma regla que src/lib/backup/validate-schema.ts
// ---------------------------------------------------------------------------
const deriva = []
for (const [tabla, filas] of Object.entries(data)) {
  if (!filas.length) continue
  const { data: columnas, error } = await admin.rpc("get_table_columns", {
    p_table_name: tabla,
  })
  if (error) {
    deriva.push(`${tabla}: no se pudo leer el esquema (${error.message})`)
    continue
  }
  if (!columnas?.length) {
    deriva.push(`${tabla}: la tabla no existe en la base local`)
    continue
  }
  const existentes = new Set(columnas)
  const faltantes = Object.keys(filas[0]).filter((c) => !existentes.has(c))
  if (faltantes.length) {
    deriva.push(`${tabla}: columnas del respaldo ausentes en local → ${faltantes.join(", ")}`)
  }
}

if (deriva.length) {
  console.error("\n⚠ Deriva de esquema entre el respaldo y supabase/migrations:")
  deriva.forEach((d) => console.error(`   · ${d}`))
  if (!force) {
    die("Corrige las migraciones, o repite con --force para continuar de todos modos.")
  }
  console.warn("  Continuando por --force.\n")
} else {
  info("Esquema compatible.")
}

// ---------------------------------------------------------------------------
// 3. Sembrar auth.users con los UUID exactos que referencia el respaldo
// ---------------------------------------------------------------------------
// Las cinco columnas con FK a auth.users. Ojo: ventas_historial.usuario_id
// apunta a vendedores(id), no a auth — por eso no está en la lista.
const COLUMNAS_AUTH = [
  ["vendedores", "auth_user_id"],
  ["clientes", "usuario_id"],
  ["entradas", "usuario_id"],
  ["stock_movimientos", "usuario_id"],
  ["precios_historico", "usuario_id"],
]

const requeridos = new Set()
for (const [tabla, columna] of COLUMNAS_AUTH) {
  for (const fila of data[tabla] ?? []) {
    if (fila?.[columna]) requeridos.add(fila[columna])
  }
}

// El login arma el email como `${usuario}@notasdearen.local`
// (src/app/(auth)/login/page.tsx), así que respetamos esa convención para que
// puedas entrar con el mismo usuario que en producción.
const emailPorUuid = new Map()
for (const v of data.vendedores ?? []) {
  if (v.auth_user_id && v.usuario) {
    emailPorUuid.set(v.auth_user_id, `${v.usuario}@notasdearen.local`)
  }
}

const existentes = new Set()
for (let page = 1; ; page++) {
  const { data: r, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) die(`listUsers: ${error.message}`)
  r.users.forEach((u) => existentes.add(u.id))
  if (r.users.length < 1000) break
}

let creados = 0
for (const id of requeridos) {
  if (existentes.has(id)) continue
  const emailPreferido = emailPorUuid.get(id) ?? `huerfano-${id.slice(0, 8)}@notasdearen.local`

  let { error } = await admin.auth.admin.createUser({
    id,
    email: emailPreferido,
    password: PASSWORD,
    email_confirm: true,
  })

  // Un vendedor puede repetir `usuario`; en ese caso caemos a un email único.
  if (error && /already|duplicate|registered/i.test(error.message)) {
    ;({ error } = await admin.auth.admin.createUser({
      id,
      email: `huerfano-${id.slice(0, 8)}@notasdearen.local`,
      password: PASSWORD,
      email_confirm: true,
    }))
  }
  if (error) die(`No se pudo crear el usuario auth ${id} (${emailPreferido}): ${error.message}`)
  creados++
}
info(`auth.users: ${creados} creados, ${requeridos.size - creados} ya existían.`)

// ---------------------------------------------------------------------------
// 4. Restaurar con el mismo RPC que usa la app
// ---------------------------------------------------------------------------
info("Ejecutando restore_database…")
const { data: resultado, error: errorRpc } = await admin.rpc("restore_database", {
  payload: { metadata, data },
})
if (errorRpc) die(`restore_database: ${errorRpc.message}`)
info(`Restauradas ${resultado.restoredTables.length} tablas, ${resultado.totalRows} filas.`)

// ---------------------------------------------------------------------------
// 5. Dejar los vendedores listos para entrar
// ---------------------------------------------------------------------------
// Va después del RPC porque `restore_database` hace TRUNCATE de vendedores.
const { error: errorUpdate } = await admin
  .from("vendedores")
  .update({ debe_cambiar_password: false })
  .eq("debe_cambiar_password", true)
if (errorUpdate) console.warn(`⚠ No se pudo limpiar debe_cambiar_password: ${errorUpdate.message}`)

const { data: vendedores } = await admin
  .from("vendedores")
  .select("usuario, nombre, rol, activo")
  .order("rol")

console.log(`\n✔ Listo. Contraseña para todos los usuarios locales: ${PASSWORD}\n`)
for (const v of vendedores ?? []) {
  const marca = v.rol === "admin" ? "★" : " "
  console.log(`   ${marca} ${String(v.usuario).padEnd(18)} ${v.nombre}${v.activo ? "" : "  (inactivo)"}`)
}
console.log("\n   http://localhost:3000/login\n")
