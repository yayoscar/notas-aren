import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/supabase/env.server"

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const serverSupabase = createServerClient()

  // Verify caller is admin
  const { data: { user } } = await serverSupabase.auth.getUser()
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

  const body = await request.json()
  const { password } = body

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 })
  }

  // Get vendedor
  const { data: vendedor, error: vendedorError } = await supabaseAdmin
    .from("vendedores")
    .select("auth_user_id")
    .eq("id", params.id)
    .single()

  if (vendedorError || !vendedor) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 })
  }

  // Update auth password
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    vendedor.auth_user_id,
    { password }
  )

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Mark debe_cambiar_password = true
  await supabaseAdmin
    .from("vendedores")
    .update({ debe_cambiar_password: true })
    .eq("id", params.id)

  return NextResponse.json({ success: true })
}
