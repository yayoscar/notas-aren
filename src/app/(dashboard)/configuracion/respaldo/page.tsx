"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { useBackupDatabase, useRestoreDatabase } from "@/hooks/useBackupRestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RestoreConfirmDialog } from "@/components/configuracion/RestoreConfirmDialog"
import { ArrowLeft, Database, Download, Loader2, Upload, FileWarning, Info } from "lucide-react"

export default function RespaldoPage() {
  const { isAdmin, isLoading: isLoadingVendedor } = useVendedorActual()
  const backup = useBackupDatabase()
  const restore = useRestoreDatabase()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoadingVendedor) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Respaldo y Restauración</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setSelectedFile(file ?? null)
  }

  function handleRestoreConfirm() {
    if (!selectedFile) return
    restore.mutate(
      { file: selectedFile },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          setSelectedFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ""
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/configuracion">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Respaldo y Restauración</h1>
      </div>

      {/* Generar Respaldo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Generar Respaldo
          </CardTitle>
          <CardDescription>
            Descarga un archivo ZIP con todos los datos del negocio: productos, inventario, ventas,
            cobranza, clientes, devoluciones, gastos, etc. Útil como punto de restauración antes de
            hacer pruebas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => backup.mutate()}
            disabled={backup.isPending}
          >
            {backup.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando respaldo...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generar Respaldo
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            ⚠️ El archivo contiene datos sensibles del negocio. Guárdalo en lugar seguro.
          </p>
        </CardContent>
      </Card>

      {/* Restaurar Respaldo */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <FileWarning className="h-5 w-5" />
            Restaurar Respaldo
          </CardTitle>
          <CardDescription>
            ⚠️ Esta acción reemplaza completamente la base de datos actual con el contenido del
            archivo ZIP seleccionado. Los datos actuales se perderán de forma permanente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={restore.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              Seleccionar archivo ZIP
            </Button>

            {selectedFile && (
              <span className="text-sm text-muted-foreground">
                <code className="bg-muted px-2 py-1 rounded text-xs">{selectedFile.name}</code>
              </span>
            )}
          </div>

          {selectedFile && (
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={restore.isPending}
            >
              {restore.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restaurando...
                </>
              ) : (
                "Restaurar"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notas importantes */}
      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Notas importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>
              Las cuentas de usuario (login) <strong>no se respaldan</strong>, solo los datos de la
              tabla <code className="bg-muted px-1 rounded text-xs">vendedores</code>. Si restauras
              en otra instalación, los logins deben recrearse manualmente.
            </li>
            <li>
              Solo restaura archivos ZIP generados por esta misma instalación.
            </li>
            <li>
              El esquema de la base de datos se valida automáticamente antes de restaurar. Si hay
              diferencias, la operación se aborta sin tocar nada.
            </li>
            <li>
              La restauración es atómica: si algo falla a la mitad, la base de datos vuelve al
              estado anterior automáticamente.
            </li>
          </ul>
        </CardContent>
      </Card>

      <RestoreConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        fileName={selectedFile?.name ?? ""}
        isPending={restore.isPending}
        onConfirm={handleRestoreConfirm}
      />
    </div>
  )
}
