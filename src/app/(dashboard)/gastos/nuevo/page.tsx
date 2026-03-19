"use client"

import { useRouter } from "next/navigation"
import { useGastos } from "@/hooks/useGastos"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { GastoForm } from "@/components/gastos/GastoForm"
import type { GastoFormValues } from "@/lib/validations/gasto.schema"

export default function NuevoGastoPage() {
  const router = useRouter()
  const { create } = useGastos()
  const { vendedor } = useVendedorActual()

  function handleSubmit(values: GastoFormValues) {
    if (!vendedor) return

    create.mutate(
      {
        concepto: values.concepto,
        monto: values.monto,
        categoria_id: values.categoria_id,
        fecha: values.fecha,
        vendedor_id: vendedor.id,
        tipo_pago: values.tipo_pago,
        cuenta_bancaria_id: values.cuenta_bancaria_id ?? null,
        comprobante_url: null,
      },
      {
        onSuccess: () => router.push("/gastos"),
      }
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo gasto</h1>
      <GastoForm onSubmit={handleSubmit} isPending={create.isPending} />
    </div>
  )
}
