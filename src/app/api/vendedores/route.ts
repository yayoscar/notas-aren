import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/supabase/env.server"
import { requireAdmin } from "@/lib/supabase/require-admin"

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

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
