/**
 * Resuelve a qué base de datos apunta la aplicación.
 *
 * El interruptor es `NEXT_PUBLIC_APP_ENV` en `.env.local`:
 *   - "local"      → stack local de Supabase (`npm run db:start`)
 *   - cualquier otro valor, o ausente → producción
 *
 * Las variables de producción conservan sus nombres originales, así que si
 * `NEXT_PUBLIC_APP_ENV` no está definida el comportamiento es idéntico al que
 * había antes de introducir este módulo (importante para el deploy).
 *
 * IMPORTANTE: Next.js reemplaza `process.env.NEXT_PUBLIC_*` en tiempo de build
 * mediante análisis estático LITERAL. Nunca construyas el nombre de la variable
 * de forma dinámica (`process.env["NEXT_PUBLIC_" + x]`): en el cliente sería
 * `undefined`.
 */

export type AppEnv = "local" | "production"

export const APP_ENV: AppEnv =
  process.env.NEXT_PUBLIC_APP_ENV === "local" ? "local" : "production"

export const IS_LOCAL_DB = APP_ENV === "local"

export const SUPABASE_URL = IS_LOCAL_DB
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL!
  : process.env.NEXT_PUBLIC_SUPABASE_URL!

export const SUPABASE_ANON_KEY = IS_LOCAL_DB
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Fallar al importar es preferible al `Invalid URL` opaco que lanza
// @supabase/ssr cuando la URL llega vacía.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    `[supabase/env] Faltan credenciales para NEXT_PUBLIC_APP_ENV="${APP_ENV}". ` +
      `Revisa .env.local (variables ${
        IS_LOCAL_DB
          ? "NEXT_PUBLIC_SUPABASE_URL_LOCAL / NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL"
          : "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
      }).`
  )
}
