/**
 * Credenciales de servicio (service role), sólo para código de servidor.
 *
 * Vive en un módulo aparte de `./env` para que la clave de servicio nunca
 * aparezca en un archivo que importe el bundle del navegador.
 */
import { APP_ENV, IS_LOCAL_DB } from "./env"

export { SUPABASE_URL, APP_ENV, IS_LOCAL_DB } from "./env"

export const SUPABASE_SERVICE_ROLE_KEY = IS_LOCAL_DB
  ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL!
  : process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    `[supabase/env.server] Falta la service role key para NEXT_PUBLIC_APP_ENV="${APP_ENV}". ` +
      `Revisa .env.local (variable ${
        IS_LOCAL_DB ? "SUPABASE_SERVICE_ROLE_KEY_LOCAL" : "SUPABASE_SERVICE_ROLE_KEY"
      }).`
  )
}
