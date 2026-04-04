"use client"

import { useRouter } from "next/navigation"
import { useProductos } from "@/hooks/useProductos"
import { useSetDetalle } from "@/hooks/useSetDetalle"
import { ProductoForm } from "@/components/inventario/ProductoForm"
import type { ProductoFormValues } from "@/lib/validations/producto.schema"

export default function NuevoProductoPage() {
  const router = useRouter()
  const { create } = useProductos()
  const setDetalle = useSetDetalle(undefined)

  function handleSubmit(values: ProductoFormValues) {
    const { set_items, ...rest } = values
    const cleaned = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v])
    ) as unknown as Parameters<typeof create.mutate>[0]
    create.mutate(cleaned, {
      onSuccess: (data) => {
        if (set_items && set_items.length > 0 && data?.id) {
          setDetalle.sync.mutate(
            { productoId: data.id, items: set_items },
            { onSettled: () => router.push("/inventario") }
          )
        } else {
          router.push("/inventario")
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <ProductoForm onSubmit={handleSubmit} isPending={create.isPending} />
    </div>
  )
}
