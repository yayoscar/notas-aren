/**
 * Utilidades compartidas por los scripts `db:*`.
 *
 * Todos comparten la misma premisa: escriben SÓLO contra la base local, y
 * cualquier acceso a producción es de lectura. Estas guardas hacen que esa
 * premisa sea imposible de violar por descuido.
 */
import { spawnSync } from "node:child_process"

export function die(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

export function info(mensaje) {
  console.log(`▸ ${mensaje}`)
}

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])

/**
 * Devuelve `LOCAL_DB_URL` tras comprobar que apunta a esta máquina.
 * Es la guarda que impide que un `TRUNCATE` acabe en producción.
 */
export function requireLocalDbUrl() {
  const url = process.env.LOCAL_DB_URL
  if (!url) die("Falta LOCAL_DB_URL en .env.local.")

  let host
  try {
    host = new URL(url).hostname
  } catch {
    die(`LOCAL_DB_URL no es una URL válida: ${url}`)
  }

  if (!HOSTS_LOCALES.has(host)) {
    die(
      `LOCAL_DB_URL apunta a "${host}", que no es local. Abortando por seguridad.\n` +
        `  Sólo se permite: ${[...HOSTS_LOCALES].join(", ")}`
    )
  }
  return url
}

/** Devuelve la URL de la API local tras comprobar que es de esta máquina. */
export function requireLocalApiUrl() {
  const target = process.env.NEXT_PUBLIC_APP_ENV
  if (target !== "local") {
    die(
      `NEXT_PUBLIC_APP_ENV="${target ?? "(sin definir)"}". Debe ser "local".\n` +
        `  Cambia .env.local antes de continuar.`
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL
  if (!url) die("Falta NEXT_PUBLIC_SUPABASE_URL_LOCAL en .env.local.")

  let host
  try {
    host = new URL(url).hostname
  } catch {
    die(`NEXT_PUBLIC_SUPABASE_URL_LOCAL no es una URL válida: ${url}`)
  }

  if (!HOSTS_LOCALES.has(host)) {
    die(`La API destino apunta a "${host}", que no es local. Abortando por seguridad.`)
  }
  return url
}

/** Cadena del session pooler de producción. Sólo se usa para leer. */
export function requireProdDbUrl() {
  const url = process.env.PROD_DB_URL
  if (!url) {
    die(
      "Falta PROD_DB_URL en .env.local.\n" +
        "  Cópiala del dashboard: Project Settings > Database > Connection string\n" +
        "  > Session pooler (puerto 5432). El host directo db.<ref>.supabase.co\n" +
        "  sólo resuelve por IPv6 y no es alcanzable desde este equipo."
    )
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    die(`PROD_DB_URL no es una URL válida.`)
  }

  if (parsed.port === "6543") {
    die(
      "PROD_DB_URL usa el puerto 6543 (transaction mode), que no soporta pg_dump.\n" +
        "  Usa la cadena del Session pooler, puerto 5432."
    )
  }
  if (parsed.hostname.startsWith("db.") && parsed.hostname.endsWith(".supabase.co")) {
    console.warn(
      `⚠ PROD_DB_URL usa el host directo (${parsed.hostname}), que sólo resuelve por IPv6.\n` +
        `  Si falla con "Network is unreachable", cambia a la cadena del Session pooler.`
    )
  }
  return url
}

/** Ejecuta un comando heredando stdio. Aborta si sale con código distinto de 0. */
export function run(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opciones })
  if (r.error) die(`No se pudo ejecutar "${cmd}": ${r.error.message}`)
  if (r.status !== 0) die(`"${cmd} ${args.join(" ")}" terminó con código ${r.status}.`)
}

/** Ejecuta un comando y devuelve stdout. Aborta si falla. */
export function capture(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opciones })
  if (r.error) die(`No se pudo ejecutar "${cmd}": ${r.error.message}`)
  if (r.status !== 0) {
    die(`"${cmd} ${args.join(" ")}" terminó con código ${r.status}.\n${r.stderr ?? ""}`)
  }
  return r.stdout
}

/** Ejecuta SQL contra la base local y devuelve la salida en crudo. */
export function psql(dbUrl, sql, extraArgs = []) {
  return capture("psql", [
    dbUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-c",
    sql,
    ...extraArgs,
  ])
}
