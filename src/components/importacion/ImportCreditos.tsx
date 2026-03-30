"use client"

import { useState } from "react"
import { ImportUploader } from "./ImportUploader"
import { ImportResults } from "./ImportResults"
import { useImportCreditos } from "@/hooks/useImportacion"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import {
  importCreditoRowSchema,
  CREDITO_TEMPLATE_COLUMNS,
  CREDITO_SAMPLE_ROWS,
} from "@/lib/validations/import-creditos.schema"

export function ImportCreditos() {
  const importMutation = useImportCreditos()
  const { vendedor } = useVendedorActual()
  const [result, setResult] = useState<{ inserted: number; rejected: { row: number; reason: string }[] } | null>(null)

  function validateRow(row: Record<string, string>) {
    const parsed = importCreditoRowSchema.safeParse(row)
    if (parsed.success) return { valid: true, errors: {} }

    const errors: Record<string, string> = {}
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const key = (issue.path[0] as string) || "credito_total"
        errors[key] = issue.message
      })
    }
    return { valid: false, errors }
  }

  function handleConfirm(data: Record<string, string>[]) {
    if (!vendedor?.id) return
    const parsed = data.map((row) => ({
      cliente: row.cliente,
      telefono_cliente: row.telefono_cliente,
      credito_total: Number(row.credito_total),
      monto_saldado: Number(row.monto_saldado),
      periodicidad: row.periodicidad,
      ultima_fecha_pago: row.ultima_fecha_pago,
      monto_ultimo_pago: Number(row.monto_ultimo_pago),
      numero_meses: Number(row.numero_meses),
    }))
    importMutation.mutate(
      { rows: parsed, vendedorId: vendedor.id },
      { onSuccess: (res) => setResult(res) }
    )
  }

  if (result) {
    return <ImportResults inserted={result.inserted} rejected={result.rejected} onReset={() => setResult(null)} />
  }

  return (
    <ImportUploader
      title="Importar Créditos"
      description="Los clientes deben existir previamente en el sistema (se buscan por teléfono). Los créditos se asignarán al administrador actual."
      templateColumns={CREDITO_TEMPLATE_COLUMNS}
      templateSampleRows={CREDITO_SAMPLE_ROWS}
      templateFileName="Plantilla_Creditos"
      validateRow={validateRow}
      onConfirm={handleConfirm}
      isLoading={importMutation.isPending}
    />
  )
}
