import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/supabase/require-admin"
import { NextResponse } from "next/server"
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/supabase/env.server"

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

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
