"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react"
import { generateTemplate, parseExcelFile, validateColumns, type ColumnDef } from "@/lib/import-utils"

interface RowError {
  [column: string]: string
}

interface ImportUploaderProps {
  title: string
  description: string
  templateColumns: ColumnDef[]
  templateSampleRows: Record<string, string | number>[]
  templateFileName: string
  validateRow: (row: Record<string, string>) => { valid: boolean; errors: RowError }
  onConfirm: (data: Record<string, string>[]) => void
  isLoading: boolean
  children?: React.ReactNode
}

export function ImportUploader({
  title,
  description,
  templateColumns,
  templateSampleRows,
  templateFileName,
  validateRow,
  onConfirm,
  isLoading,
  children,
}: ImportUploaderProps) {
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [rowErrors, setRowErrors] = useState<Map<number, RowError>>(new Map())
  const [columnError, setColumnError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const expectedLabels = templateColumns.map((c) => c.label)

  function handleDownloadTemplate() {
    generateTemplate(templateColumns, templateSampleRows, templateFileName)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setColumnError(null)
    setParsedRows([])
    setRowErrors(new Map())
    setFileName(file.name)

    try {
      const { headers, rows } = await parseExcelFile(file)
      const colValidation = validateColumns(headers, expectedLabels)

      if (!colValidation.valid) {
        const messages: string[] = []
        if (colValidation.missing.length > 0) {
          messages.push(`Columnas faltantes: ${colValidation.missing.join(", ")}`)
        }
        if (colValidation.extra.length > 0) {
          messages.push(`Columnas extras: ${colValidation.extra.join(", ")}`)
        }
        setColumnError(messages.join(". "))
        return
      }

      // Map labels to keys
      const labelToKey = new Map(templateColumns.map((c) => [c.label.toLowerCase(), c.key]))
      const mappedRows = rows.map((row) => {
        const mapped: Record<string, string> = {}
        Object.entries(row).forEach(([label, value]) => {
          const key = labelToKey.get(label.toLowerCase())
          if (key) mapped[key] = value
        })
        return mapped
      })

      // Validate each row
      const errors = new Map<number, RowError>()
      mappedRows.forEach((row, i) => {
        const result = validateRow(row)
        if (!result.valid) {
          errors.set(i, result.errors)
        }
      })

      setParsedRows(mappedRows)
      setRowErrors(errors)
    } catch (err) {
      setColumnError(err instanceof Error ? err.message : "Error al leer el archivo")
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClear() {
    setParsedRows([])
    setRowErrors(new Map())
    setColumnError(null)
    setFileName(null)
  }

  function handleConfirm() {
    const validRows = parsedRows.filter((_, i) => !rowErrors.has(i))
    onConfirm(validRows)
  }

  const hasErrors = rowErrors.size > 0
  const hasCriticalErrors = columnError !== null
  const validCount = parsedRows.length - rowErrors.size

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Extra controls (city select, etc.) */}
        {children}

        {/* Download template */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Plantilla
          </Button>
          <span className="text-sm text-muted-foreground">
            Descarga la plantilla Excel con las columnas requeridas
          </span>
        </div>

        {/* File upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir Archivo
          </Button>
          {fileName && (
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span>{fileName}</span>
              <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Column error */}
        {columnError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Estructura de columnas incorrecta</p>
              <p>{columnError}</p>
              <p className="mt-1 text-xs">
                Descarga la plantilla para ver las columnas requeridas.
              </p>
            </div>
          </div>
        )}

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <>
            <div className="text-sm text-muted-foreground">
              {parsedRows.length} filas encontradas — {validCount} válidas
              {hasErrors && (
                <span className="text-red-600">
                  {" "}— {rowErrors.size} con errores
                </span>
              )}
            </div>

            <div className="max-h-[400px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {templateColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => {
                    const errors = rowErrors.get(i)
                    return (
                      <TableRow key={i} className={errors ? "bg-red-50" : ""}>
                        <TableCell className="text-muted-foreground">{i + 2}</TableCell>
                        {templateColumns.map((col) => (
                          <TableCell
                            key={col.key}
                            className={errors?.[col.key] ? "text-red-600 font-medium" : ""}
                            title={errors?.[col.key] || undefined}
                          >
                            {row[col.key] || "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          {errors ? (
                            <span className="text-xs text-red-600">
                              {Object.values(errors).join("; ")}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Confirm button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Se importarán {validCount} de {parsedRows.length} registros
                {hasErrors && " (las filas con errores serán omitidas)"}
              </p>
              <Button
                onClick={handleConfirm}
                disabled={hasCriticalErrors || validCount === 0 || isLoading}
              >
                {isLoading ? "Importando..." : `Confirmar Importación (${validCount})`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
