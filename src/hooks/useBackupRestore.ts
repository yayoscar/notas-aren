"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

/**
 * Parse a `Content-Disposition` header to extract the filename.
 * Handles both `filename="foo.zip"` and bare `filename=foo.zip`.
 */
function parseFilename(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return match?.[1] ?? fallback
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generates a backup ZIP via the API and triggers a browser download.
 * Filename comes from the Content-Disposition header on the response.
 */
export function useBackupDatabase() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/configuracion/backup", {
        method: "POST",
      })

      if (!response.ok) {
        let message = "Error al generar el respaldo"
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {
          /* ignore parse failures */
        }
        throw new Error(message)
      }

      const filename = parseFilename(
        response.headers.get("Content-Disposition"),
        `notas-aren-backup-${new Date().toISOString().slice(0, 10)}.zip`
      )

      const blob = await response.blob()
      triggerDownload(blob, filename)
      return { filename }
    },
    onSuccess: ({ filename }) => {
      toast.success(`Respaldo generado: ${filename}`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

/**
 * Restores the database from a user-provided ZIP file. After success,
 * the entire TanStack Query cache is invalidated so every screen
 * refetches against the restored data.
 */
export function useRestoreDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/configuracion/restore", {
        method: "POST",
        body: formData,
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error ?? "Error al restaurar el respaldo"
        const details = Array.isArray(body?.details) ? `\n${body.details.join("\n")}` : ""
        throw new Error(`${message}${details}`)
      }

      return body as {
        success: true
        restoredTables: string[]
        totalRows: number
        missingTables: string[]
      }
    },
    onSuccess: (result) => {
      // Restored DB → every cached query is stale.
      queryClient.invalidateQueries()
      toast.success(
        `Restauración completada con éxito (${result.totalRows.toLocaleString()} registros en ${result.restoredTables.length} tablas)`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
