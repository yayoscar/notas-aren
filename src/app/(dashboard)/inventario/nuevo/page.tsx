"use client"

import { useRouter } from "next/navigation"
import { useProductos } from "@/hooks/useProductos"
import { ProductoForm } from "@/components/inventario/ProductoForm"
import type { ProductoFormValues } from "@/lib/validations/producto.schema"

export default function NuevoProductoPage() {
  const router = useRouter()
  const { create } = useProductos()

  function handleSubmit(values: ProductoFormValues) {
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
    ) as unknown as Parameters<typeof create.mutate>[0]
    create.mutate(cleaned, {
      onSuccess: () => router.push("/inventario"),
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <ProductoForm onSubmit={handleSubmit} isPending={create.isPending} />
    </div>
  )
}
