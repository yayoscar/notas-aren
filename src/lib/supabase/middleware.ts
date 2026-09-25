import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Un vendedor desactivado conserva su sesión hasta que caduque el token.
  // Comprobarlo sólo en el navegador no sería revocar el acceso, así que se
  // hace aquí, del lado del servidor, en cada petición. Cuesta una consulta
  // más sobre la que updateSession ya hacía con getUser().
  if (user && !request.nextUrl.pathname.startsWith("/login")) {
    const { data: vendedor } = await supabase
      .from("vendedores")
      .select("activo")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    // Sin perfil tampoco hay acceso: es lo que deja inofensivo al usuario
    // huérfano si el borrado de un vendedor falla al quitar su usuario.
    if (!vendedor || !vendedor.activo) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("motivo", vendedor ? "desactivado" : "sin-perfil")
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
