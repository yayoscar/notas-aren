"use client"

import { useRouter } from "next/navigation"
import { useVendedores } from "@/hooks/useVendedores"
import { VendedorCreateForm } from "@/components/vendedores/VendedorForm"
import type { VendedorFormValues } from "@/lib/validations/vendedor.schema"

export default function NuevoVendedorPage() {
  const router = useRouter()
  const { create } = useVendedores()

  function handleSubmit(values: VendedorFormValues) {
    create.mutate(values, {
      onSuccess: () => router.push("/vendedores"),
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo vendedor</h1>
      <VendedorCreateForm onSubmit={handleSubmit} isPending={create.isPending} />
    </div>
  )
}
