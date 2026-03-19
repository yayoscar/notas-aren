"use client"

import { useRouter } from "next/navigation"
import { useClientes } from "@/hooks/useClientes"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { ClienteForm } from "@/components/clientes/ClienteForm"
import type { ClienteFormValues } from "@/lib/validations/cliente.schema"

export default function NuevoClientePage() {
  const router = useRouter()
  const { create } = useClientes()
  const { vendedor } = useVendedorActual()

  function handleSubmit(values: ClienteFormValues) {
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
    ) as Record<string, unknown>

    // Auto-assign usuario_id from current vendedor
    cleaned.usuario_id = vendedor?.auth_user_id ?? null

    create.mutate(cleaned as unknown as Parameters<typeof create.mutate>[0], {
      onSuccess: () => router.push("/clientes"),
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo cliente</h1>
      <ClienteForm onSubmit={handleSubmit} isPending={create.isPending} />
    </div>
  )
}
