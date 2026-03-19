import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
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
  const { nombre, telefono, usuario, rol, password } = body

  if (!nombre || !telefono || !usuario || !password) {
    return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 })
  }

  // Create auth user with fake email
  const email = `${usuario}@notasdearen.local`
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Create vendedor record
  const { data: vendedor, error: vendedorError } = await supabaseAdmin
    .from("vendedores")
    .insert({
      nombre,
      telefono,
      usuario,
      rol: rol || "vendedor",
      auth_user_id: authData.user.id,
      debe_cambiar_password: true,
    })
    .select()
    .single()

  if (vendedorError) {
    // Rollback: delete auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: vendedorError.message }, { status: 400 })
  }

  return NextResponse.json(vendedor)
}
