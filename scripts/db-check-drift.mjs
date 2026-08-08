#!/usr/bin/env node
/**
 * Compara el esquema `public` de PRODUCCIÓN con el de la base LOCAL.
 *
 *   npm run db:check-drift
 *
 * Las migraciones de supabase/migrations se escribieron a mano y tienen huecos
 * de numeración, así que producción pudo derivar del repo en ambos sentidos:
 * cambios aplicados a mano que nadie versionó, y migraciones del repo que
 * nunca se desplegaron.
 *
 * Se comparan columnas, restricciones, índices, triggers, políticas RLS y
 * funciones. Comparar sólo columnas dejaba pasar cosas serias: así fue como
 * `trg_stock_venta_delete` estuvo ausente de producción sin que nadie lo notara.
 *
 * Ambos accesos son de sólo lectura.
 */
import { die, info, psql, requireLocalDbUrl, requireProdDbUrl } from "./lib/guards.mjs"

const PROD_DB_URL = requireProdDbUrl()
const LOCAL_DB_URL = requireLocalDbUrl()

// Cada aspecto produce una lista de descriptores de texto estables y
// comparables. Se lee vía catálogo en lugar de `pg_dump --schema-only` para no
// depender del formato de salida de la versión de pg_dump instalada.
const ASPECTOS = [
  {
    nombre: "tablas",
    sql: `
      SELECT c.relname || '  rls=' || c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       ORDER BY 1`,
  },
  {
    nombre: "columnas",
    sql: `
      SELECT c.table_name || '.' || c.column_name || ' :: ' || c.data_type
             || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
             || CASE WHEN c.column_default IS NOT NULL
                     THEN ' DEFAULT ' || c.column_default ELSE '' END
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
         AND t.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'public'
       ORDER BY 1`,
  },
  {
    nombre: "restricciones",
    sql: `
      SELECT c.relname || '.' || con.conname || ' :: ' || pg_get_constraintdef(con.oid)
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
       ORDER BY 1`,
  },
  {
    nombre: "índices",
    sql: `
      SELECT tablename || '.' || indexname || ' :: ' || indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
       ORDER BY 1`,
  },
  {
    nombre: "triggers",
    sql: `
      SELECT c.relname || '.' || t.tgname || ' :: ' || pg_get_triggerdef(t.oid)
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND NOT t.tgisinternal
       ORDER BY 1`,
  },
  {
    nombre: "políticas RLS",
    sql: `
      SELECT tablename || '.' || policyname || ' [' || cmd || '] roles='
             || array_to_string(roles, ',')
             || ' using=' || coalesce(qual, '-')
             || ' check=' || coalesce(with_check, '-')
        FROM pg_policies
       WHERE schemaname = 'public'
       ORDER BY 1`,
  },
  {
    nombre: "funciones",
    // Se compara la firma y un hash del cuerpo: detecta tanto funciones
    // ausentes como cuerpos editados a mano, sin volcar cientos de líneas.
    sql: `
      SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
             || ' :: cuerpo#' || substr(md5(p.prosrc), 1, 8)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
       ORDER BY 1`,
  },
]

function leer(url, sql, etiqueta, aspecto) {
  const salida = psql(url, sql, ["-t", "-A"])
  const filas = salida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (!filas.length && aspecto === "columnas") {
    die(`El esquema de ${etiqueta} vino vacío.`)
  }
  return new Set(filas)
}

info("Leyendo el esquema de producción y de local…")

let faltanEnLocal = 0
let faltanEnProd = 0
const resumen = []

for (const { nombre, sql } of ASPECTOS) {
  const prod = leer(PROD_DB_URL, sql, "producción", nombre)
  const local = leer(LOCAL_DB_URL, sql, "local", nombre)

  const soloProd = [...prod].filter((x) => !local.has(x)).sort()
  const soloLocal = [...local].filter((x) => !prod.has(x)).sort()

  resumen.push({ nombre, prod: prod.size, local: local.size, soloProd, soloLocal })
  faltanEnLocal += soloProd.length
  faltanEnProd += soloLocal.length
}

console.log("\n  Aspecto          producción   local")
console.log("  ───────────────  ──────────   ─────")
for (const r of resumen) {
  const marca = r.soloProd.length || r.soloLocal.length ? " ←" : ""
  console.log(
    `  ${r.nombre.padEnd(15)}  ${String(r.prod).padStart(10)}   ${String(r.local).padStart(5)}${marca}`
  )
}

if (!faltanEnLocal && !faltanEnProd) {
  console.log("\n✔ Sin deriva: las migraciones del repo describen producción exactamente.\n")
  process.exit(0)
}

for (const r of resumen) {
  if (r.soloProd.length) {
    console.log(
      `\n  ▼ ${r.nombre}: en PRODUCCIÓN pero no en local (${r.soloProd.length})` +
        ` — falta una migración en el repo:`
    )
    r.soloProd.forEach((x) => console.log(`     · ${x}`))
  }
  if (r.soloLocal.length) {
    console.log(
      `\n  ▲ ${r.nombre}: en LOCAL pero no en producción (${r.soloLocal.length})` +
        ` — migración sin desplegar:`
    )
    r.soloLocal.forEach((x) => console.log(`     · ${x}`))
  }
}

// Sólo la deriva prod→local rompe `db:pull-prod`; la contraria es un aviso de
// despliegue pendiente.
if (faltanEnLocal) {
  console.error(
    "\n✖ Hay objetos en producción que la base local no tiene: db:pull-prod puede fallar.\n"
  )
  process.exit(1)
}

console.log(
  `\n⚠ Hay ${faltanEnProd} objeto(s) del repo sin desplegar a producción.\n` +
    `  Revisa qué migraciones faltan:\n` +
    `    psql "$PROD_DB_URL" -c "select version from supabase_migrations.schema_migrations order by version desc limit 5"\n`
)
