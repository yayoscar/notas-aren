import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/supabase/env.server"
import { requireAdmin } from "@/lib/supabase/require-admin"

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Un baneo "para siempre": GoTrue no acepta una duración infinita, así que se
// usa un siglo. Se levanta con 'none' al reactivar.
const BANEO_INDEFINIDO = "876000h"

/**
 * Registros que impiden borrar un perfil.
 *
 * Las seis primeras tablas referencian vendedores(id) y las cuatro últimas
 * referencian su auth.users(id). Ninguna de las diez tiene ON DELETE, así que
 * basta una fila en cualquiera para que el borrado sea imposible: Postgres
 * respondería con una violación de clave foránea. Se cuentan antes para poder
 * explicar qué lo impide en lugar de devolver un 23503.
 */
const DEPENDENCIAS_POR_VENDEDOR = [
  { tabla: "ventas", columna: "vendedor_id", etiqueta: "ventas" },
  { tabla: "pagos", columna: "vendedor_id", etiqueta: "pagos" },
  { tabla: "gastos", columna: "vendedor_id", etiqueta: "gastos" },
  { tabla: "devoluciones", columna: "vendedor_id", etiqueta: "devoluciones" },
  { tabla: "ventas_historial", columna: "usuario_id", etiqueta: "ediciones de venta" },
  { tabla: "lineas_credito", columna: "vendedor_id", etiqueta: "líneas de crédito" },
] as const

const DEPENDENCIAS_POR_USUARIO = [
  { tabla: "clientes", columna: "usuario_id", etiqueta: "clientes" },
  { tabla: "entradas", columna: "usuario_id", etiqueta: "entradas" },
  { tabla: "stock_movimientos", columna: "usuario_id", etiqueta: "movimientos de stock" },
  { tabla: "precios_historico", columna: "usuario_id", etiqueta: "cambios de precio" },
] as const

async function contarDependencias(vendedorId: string, authUserId: string) {
  const bloqueos: { etiqueta: string; cantidad: number }[] = []

  const consultas = [
    ...DEPENDENCIAS_POR_VENDEDOR.map((d) => ({ ...d, valor: vendedorId })),
    ...DEPENDENCIAS_POR_USUARIO.map((d) => ({ ...d, valor: authUserId })),
  ]

  for (const { tabla, columna, etiqueta, valor } of consultas) {
    const { count, error } = await supabaseAdmin
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq(columna, valor)

    if (error) {
      throw new Error(`Error al revisar ${etiqueta}: ${error.message}`)
    }
    if (count && count > 0) {
      bloqueos.push({ etiqueta, cantidad: count })
    }
  }

  return bloqueos
}

async function cargarVendedor(id: string) {
  const { data } = await supabaseAdmin
    .from("vendedores")
    .select("id, nombre, usuario, activo, auth_user_id")
    .eq("id", id)
    .maybeSingle()
  return data
}

/**
 * Consultar si un perfil se puede eliminar, sin eliminarlo.
 *
 * El diálogo de confirmación lo llama al abrirse para poder decir qué lo
 * impide antes de que el administrador confirme algo que iba a fallar.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const vendedor = await cargarVendedor(params.id)
  if (!vendedor) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 })
  }

  if (vendedor.id === guard.vendedor.id) {
    return NextResponse.json({
      puedeEliminar: false,
      esPropio: true,
      bloqueos: [],
    })
  }

  try {
    const bloqueos = await contarDependencias(vendedor.id, vendedor.auth_user_id)
    return NextResponse.json({
      puedeEliminar: bloqueos.length === 0,
      esPropio: false,
      bloqueos,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al revisar registros" },
      { status: 500 }
    )
  }
}

/** Activar o desactivar un vendedor. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await request.json()
  const activo = body?.activo

  if (typeof activo !== "boolean") {
    return NextResponse.json(
      { error: "Se espera el campo 'activo' como booleano" },
      { status: 400 }
    )
  }

  const vendedor = await cargarVendedor(params.id)
  if (!vendedor) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 })
  }

  if (!activo && vendedor.id === guard.vendedor.id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propio perfil" },
      { status: 400 }
    )
  }

  if (vendedor.activo === activo) {
    return NextResponse.json(vendedor)
  }

  // El proveedor de identidad va primero: marcar la columna sin revocar el
  // acceso dejaría un perfil que se ve inactivo pero cuyo token sigue
  // renovándose, que es el modo de fallo peligroso de los dos.
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    vendedor.auth_user_id,
    { ban_duration: activo ? "none" : BANEO_INDEFINIDO }
  )
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("vendedores")
    .update({ activo })
    .eq("id", params.id)
    .select()
    .single()

  if (error) {
    // Dejar el acceso y la columna en desacuerdo confundiría al administrador,
    // así que se revierte lo ya hecho antes de reportar el fallo.
    await supabaseAdmin.auth.admin.updateUserById(vendedor.auth_user_id, {
      ban_duration: activo ? BANEO_INDEFINIDO : "none",
    })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

/** Eliminar definitivamente un perfil y su usuario de acceso. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const vendedor = await cargarVendedor(params.id)
  if (!vendedor) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 })
  }

  if (vendedor.id === guard.vendedor.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio perfil" },
      { status: 400 }
    )
  }

  let bloqueos
  try {
    bloqueos = await contarDependencias(vendedor.id, vendedor.auth_user_id)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al revisar registros" },
      { status: 500 }
    )
  }

  if (bloqueos.length > 0) {
    return NextResponse.json(
      {
        error: `No se puede eliminar a ${vendedor.nombre} porque tiene registros asociados`,
        bloqueos,
      },
      { status: 409 }
    )
  }

  // El perfil va primero: vendedores.auth_user_id referencia auth.users sin
  // ON DELETE, así que el usuario de acceso no se puede borrar mientras el
  // perfil lo apunte.
  const { error: perfilError } = await supabaseAdmin
    .from("vendedores")
    .delete()
    .eq("id", params.id)

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 400 })
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    vendedor.auth_user_id
  )

  if (authError) {
    // El perfil ya no existe, así que el usuario huérfano no puede entrar a la
    // aplicación: el guardia del layout deniega el acceso a quien no tiene
    // perfil. Aun así hay que decirlo para que alguien lo limpie.
    return NextResponse.json(
      {
        error:
          `Se eliminó el perfil de ${vendedor.nombre}, pero su usuario de acceso ` +
          `no se pudo borrar: ${authError.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
