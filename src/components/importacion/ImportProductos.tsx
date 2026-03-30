"use client"

import { useState } from "react"
import { ImportUploader } from "./ImportUploader"
import { ImportResults } from "./ImportResults"
import { useImportProductos } from "@/hooks/useImportacion"
import {
  importProductoRowSchema,
  PRODUCTO_TEMPLATE_COLUMNS,
  PRODUCTO_SAMPLE_ROWS,
} from "@/lib/validations/import-productos.schema"

export function ImportProductos() {
  const importMutation = useImportProductos()
  const [result, setResult] = useState<{ inserted: number; rejected: { row: number; reason: string }[] } | null>(null)

  function validateRow(row: Record<string, string>) {
    const parsed = importProductoRowSchema.safeParse(row)
    if (parsed.success) return { valid: true, errors: {} }

    const errors: Record<string, string> = {}
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        errors[key] = issue.message
      })
    }
    return { valid: false, errors }
  }

  function handleConfirm(data: Record<string, string>[]) {
    const parsed = data.map((row) => importProductoRowSchema.parse(row))
    importMutation.mutate(parsed, {
      onSuccess: (res) => setResult(res),
    })
  }

  if (result) {
    return <ImportResults inserted={result.inserted} rejected={result.rejected} onReset={() => setResult(null)} />
  }

  return (
    <ImportUploader
      title="Importar Productos"
      description="Todos los productos se registrarán como nuevos (entrada directa, condición completa). Los productos existentes serán omitidos."
      templateColumns={PRODUCTO_TEMPLATE_COLUMNS}
      templateSampleRows={PRODUCTO_SAMPLE_ROWS}
      templateFileName="Plantilla_Productos"
      validateRow={validateRow}
      onConfirm={handleConfirm}
      isLoading={importMutation.isPending}
    />
  )
}
