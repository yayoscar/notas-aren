import { NextResponse } from "next/server"

import { createClient as createServerClient } from "./server"

export interface VendedorActual {
  id: string
  rol: string
  activo: boolean
  auth_user_id: string
}

type Resultado =
  | { ok: true; vendedor: VendedorActual }
  | { ok: false; response: NextResponse }

/**
 * Verifica que quien llama tenga sesión y rol de administrador.
 *
 * Esta comprobación estaba copiada literalmente en cuatro rutas de API. Al
 * añadir las dos de baja de vendedor habría quedado en seis, así que vive aquí.
 *
 * Exige además que el administrador esté activo: un perfil desactivado pierde
 * el acceso, y eso incluye las operaciones privilegiadas del servidor.
 */
export async function requireAdmin(): Promise<Resultado> {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    }
  }

  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("id, rol, activo, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!vendedor || vendedor.rol !== "admin" || !vendedor.activo) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sin permisos" }, { status: 403 }),
    }
  }

  return { ok: true, vendedor: vendedor as VendedorActual }
}
