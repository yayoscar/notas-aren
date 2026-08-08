"use client"

import { IS_LOCAL_DB } from "@/lib/supabase/env"

/**
 * Píldora fija que indica a qué base de datos apunta la aplicación.
 *
 *   verde  "BD LOCAL"          -> NEXT_PUBLIC_APP_ENV=local
 *   roja   "⚠ BD PRODUCCIÓN"   -> corriendo en desarrollo contra producción
 *   nada                        -> deploy real de producción
 *
 * Es `pointer-events-none` para no interferir con el Header sticky ni con
 * los diálogos de la app.
 */
export function EnvBanner() {
  const esDeployReal = process.env.NODE_ENV === "production" && !IS_LOCAL_DB
  if (esDeployReal) return null

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed bottom-3 left-3 z-[100] select-none rounded-full px-3 py-1 text-xs font-semibold shadow-lg ${
        IS_LOCAL_DB
          ? "bg-emerald-600 text-white"
          : "animate-pulse bg-red-600 text-white"
      }`}
    >
      {IS_LOCAL_DB ? "BD LOCAL" : "⚠ BD PRODUCCIÓN"}
    </div>
  )
}
