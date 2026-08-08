#!/usr/bin/env node
/**
 * Copia los datos de PRODUCCIÓN a la base de datos LOCAL.
 *
 *   npm run db:pull-prod
 *   npm run db:pull-prod -- --skip-reset    (no rehace el esquema)
 *   npm run db:pull-prod -- --keep-dumps    (conserva tmp/*.sql)
 *
 * El esquema se reconstruye desde supabase/migrations (es decir, esto además
 * verifica que las migraciones del repo siguen describiendo producción), y
 * los datos vienen de un `pg_dump --data-only`.
 *
 * A diferencia del ZIP que exporta la app, este volcado incluye `auth.users`,
 * así que en local entras con los mismos usuarios y contraseñas reales y no
 * hay que sembrar nada para satisfacer las FK contra `auth.users`.
 *
 * Producción se toca ÚNICAMENTE en modo lectura.
 */
import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

import {
  capture,
  die,
  info,
  psql,
  requireLocalDbUrl,
  requireProdDbUrl,
  run,
} from "./lib/guards.mjs"

const args = process.argv.slice(2)
const skipReset = args.includes("--skip-reset")
const keepDumps = args.includes("--keep-dumps")

const PROD_DB_URL = requireProdDbUrl()
const LOCAL_DB_URL = requireLocalDbUrl()

// `pg_dump --disable-triggers` emite `ALTER TABLE ... DISABLE TRIGGER ALL`,
// que exige superusuario. En el stack local de Supabase el rol `postgres` NO
// lo es (`supabase_admin` sí), así que la carga se hace con ese rol.
const LOCAL_SUPERUSER_URL = (() => {
  const u = new URL(LOCAL_DB_URL)
  u.username = "supabase_admin"
  return u.toString()
})()

const tmpDir = resolve(process.cwd(), "tmp")
const dumpAuth = resolve(tmpDir, "prod-auth.sql")
const dumpPublic = resolve(tmpDir, "prod-public.sql")
mkdirSync(tmpDir, { recursive: true })

// ---------------------------------------------------------------------------
// 1. Esquema limpio desde las migraciones
// ---------------------------------------------------------------------------
if (skipReset) {
  info("Se omite `supabase db reset` (--skip-reset).")
} else {
  info("Reconstruyendo el esquema local desde supabase/migrations…")
  run("npx", ["supabase", "db", "reset"])
}

// `seed.sql` inserta catálogos que chocarían por PK con los del volcado.
info("Vaciando las tablas locales…")
psql(
  LOCAL_DB_URL,
  `DO $$ DECLARE r record; BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
       EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
     END LOOP;
   END $$;`
)

// ---------------------------------------------------------------------------
// 2. Volcados de producción (sólo lectura)
// ---------------------------------------------------------------------------
const pgDumpBase = [
  "--data-only",
  "--no-owner",
  "--no-privileges",
  "--quote-all-identifiers",
]

info("Volcando auth.users / auth.identities de producción…")
run("pg_dump", [
  PROD_DB_URL,
  ...pgDumpBase,
  "--table=auth.users",
  "--table=auth.identities",
  "-f",
  dumpAuth,
])

info("Volcando los datos del esquema public de producción…")
run("pg_dump", [
  PROD_DB_URL,
  ...pgDumpBase,
  "--disable-triggers", // evita que los triggers de stock/crédito recalculen
  "--schema=public",
  "-f",
  dumpPublic,
])

// ---------------------------------------------------------------------------
// 3. Carga en local — auth primero, porque public tiene FK hacia auth.users
// ---------------------------------------------------------------------------
const superOk = capture("psql", [
  LOCAL_SUPERUSER_URL,
  "-t",
  "-A",
  "--no-psqlrc",
  "-c",
  "select rolsuper from pg_roles where rolname = current_user",
]).trim()
if (superOk !== "t") {
  die(
    "No se pudo conectar a la base local como supabase_admin (superusuario).\n" +
      "  Hace falta para aplicar el volcado con --disable-triggers.\n" +
      "  Comprueba que el stack está arriba: npm run db:status"
  )
}

info("Cargando auth en la base local…")
loadDump(dumpAuth)

info("Cargando public en la base local…")
loadDump(dumpPublic)

function loadDump(archivo) {
  // `-o /dev/null` descarta el resultado de las sentencias (los `set_config`
  // que emite pg_dump); los errores siguen llegando por stderr.
  capture("psql", [
    LOCAL_SUPERUSER_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-q",
    "-o",
    "/dev/null",
    "-f",
    archivo,
  ])
}

// ---------------------------------------------------------------------------
// 4. Informe
// ---------------------------------------------------------------------------
const conteos = psql(
  LOCAL_DB_URL,
  `SELECT c.relname, c.n_live_tup
     FROM pg_stat_user_tables c
    WHERE c.schemaname = 'public'
    ORDER BY c.relname`,
  ["-t", "-A", "-F", "|"]
)

const filasAuth = psql(LOCAL_DB_URL, "SELECT count(*) FROM auth.users", [
  "-t",
  "-A",
]).trim()

// n_live_tup es una estimación del recolector de estadísticas; para un informe
// tras la carga masiva conviene el conteo exacto de las tablas con contenido.
console.log("\n  Tabla                          Filas")
console.log("  ─────────────────────────────  ─────")
let total = 0
for (const linea of conteos.trim().split("\n").filter(Boolean)) {
  const [tabla] = linea.split("|")
  const n = Number(
    psql(LOCAL_DB_URL, `SELECT count(*) FROM public.${JSON.stringify(tabla)}`, [
      "-t",
      "-A",
    ]).trim()
  )
  total += n
  if (n > 0) console.log(`  ${tabla.padEnd(29)}  ${String(n).padStart(5)}`)
}
console.log(`  ${"auth.users".padEnd(29)}  ${filasAuth.padStart(5)}`)
console.log(`\n  Total en public: ${total} filas.`)

// ---------------------------------------------------------------------------
// 5. Limpieza
// ---------------------------------------------------------------------------
if (keepDumps) {
  console.warn(
    `\n⚠ Los volcados quedan en tmp/ y contienen datos reales de clientes.\n` +
      `  tmp/ está en .gitignore, pero bórralos cuando termines.\n`
  )
} else {
  rmSync(dumpAuth, { force: true })
  rmSync(dumpPublic, { force: true })
}

console.log(
  "\n✔ Base local sincronizada con producción.\n" +
    "  Entra en http://localhost:3000/login con tu usuario y contraseña de siempre.\n"
)
