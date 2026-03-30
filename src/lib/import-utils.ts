import * as XLSX from "xlsx"

export interface ColumnDef {
  key: string
  label: string
  required: boolean
}

export function generateTemplate(
  columns: ColumnDef[],
  sampleRows: Record<string, string | number>[],
  fileName: string
) {
  const headers = columns.map((c) => c.label)
  const rows = sampleRows.map((row) => columns.map((c) => row[c.key] ?? ""))

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Set column widths based on header length
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 4, 15) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Datos")
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

export async function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]

  if (!ws) throw new Error("El archivo no contiene hojas de datos")

  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
  if (raw.length === 0) throw new Error("El archivo está vacío")

  const headers = (raw[0] as string[]).map((h) => String(h).trim())
  const dataRows = raw.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== ""))

  const rows = dataRows.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      const val = (row as string[])[i]
      obj[h] = val !== undefined && val !== null ? String(val).trim() : ""
    })
    return obj
  })

  return { headers, rows }
}

export function validateColumns(
  headers: string[],
  expected: string[]
): { valid: boolean; missing: string[]; extra: string[] } {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase())
  const normalizedExpected = expected.map((e) => e.trim().toLowerCase())

  const missing = expected.filter(
    (e) => !normalizedHeaders.includes(e.trim().toLowerCase())
  )
  const extra = headers.filter(
    (h) => !normalizedExpected.includes(h.trim().toLowerCase())
  )

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  }
}
