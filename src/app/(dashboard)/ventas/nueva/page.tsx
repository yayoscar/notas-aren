"use client"

import { NuevaVentaForm } from "@/components/ventas/NuevaVentaForm"

export default function NuevaVentaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nueva venta</h1>
      <NuevaVentaForm />
    </div>
  )
}
