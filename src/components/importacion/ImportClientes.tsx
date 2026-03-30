"use client"

import { useState } from "react"
import { ImportUploader } from "./ImportUploader"
import { ImportResults } from "./ImportResults"
import { useImportClientes } from "@/hooks/useImportacion"
import { useCatalogo } from "@/hooks/useCatalogos"
import {
  importClienteRowSchema,
  CLIENTE_TEMPLATE_COLUMNS,
  CLIENTE_SAMPLE_ROWS,
} from "@/lib/validations/import-clientes.schema"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export function ImportClientes() {
  const importMutation = useImportClientes()
  const { query: ciudadesQuery } = useCatalogo("cat_ciudad")
  const ciudades = ciudadesQuery.data
  const isLoadingCiudades = ciudadesQuery.isLoading
  const [ciudadId, setCiudadId] = useState<string>("")
  const [result, setResult] = useState<{ inserted: number; rejected: { row: number; reason: string }[] } | null>(null)

  const ciudadesActivas = (ciudades ?? []).filter((c) => c.activo)

  function validateRow(row: Record<string, string>) {
    const parsed = importClienteRowSchema.safeParse(row)
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
    if (!ciudadId) return
    const parsed = data.map((row) => ({
      nombre: row.nombre,
      telefono: row.telefono,
      fecha_nacimiento: row.fecha_nacimiento || undefined,
    }))
    importMutation.mutate(
      { rows: parsed, ciudadId },
      { onSuccess: (res) => setResult(res) }
    )
  }

  if (result) {
    return <ImportResults inserted={result.inserted} rejected={result.rejected} onReset={() => setResult(null)} />
  }

  return (
    <ImportUploader
      title="Importar Clientes"
      description="Importa clientes desde un archivo Excel. Se detectarán duplicados por número de teléfono."
      templateColumns={CLIENTE_TEMPLATE_COLUMNS}
      templateSampleRows={CLIENTE_SAMPLE_ROWS}
      templateFileName="Plantilla_Clientes"
      validateRow={validateRow}
      onConfirm={handleConfirm}
      isLoading={importMutation.isPending}
    >
      <div className="space-y-2">
        <Label>Ciudad para todos los clientes importados</Label>
        <Select value={ciudadId} onValueChange={setCiudadId} disabled={isLoadingCiudades}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecciona una ciudad" />
          </SelectTrigger>
          <SelectContent>
            {ciudadesActivas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!ciudadId && (
          <p className="text-xs text-amber-600">Debes seleccionar una ciudad antes de importar</p>
        )}
      </div>
    </ImportUploader>
  )
}
