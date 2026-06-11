"use client"

import { useState } from "react"
import { useClienteDeletionCheck, useEliminarCliente } from "@/hooks/useClientes"
import { formatMoney } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react"

interface Props {
  clienteId: string
  clienteNombre: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function EliminarClienteDialog({
  clienteId,
  clienteNombre,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [confirmName, setConfirmName] = useState("")
  const check = useClienteDeletionCheck(clienteId)
  const eliminar = useEliminarCliente()

  const nameMatches =
    confirmName.trim().toLowerCase() === clienteNombre.trim().toLowerCase()

  const errorMessage =
    eliminar.isError && eliminar.error instanceof Error
      ? eliminar.error.message
      : eliminar.isError
        ? "Error al eliminar cliente"
        : null

  function handleDelete() {
    eliminar.mutate(
      { clienteId },
      {
        onSuccess: () => {
          setConfirmName("")
          onOpenChange(false)
          onDeleted()
        },
      }
    )
  }

  // Loading state
  if (check.isLoading) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verificando...</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  const data = check.data

  // BLOCKED: Active credit
  if (data?.creditoActivo) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              No se puede eliminar
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este cliente tiene un crédito activo con saldo pendiente de{" "}
              <span className="font-mono font-medium text-foreground">
                {formatMoney(data.saldoPendiente)}
              </span>
              . Liquida o cancela el crédito primero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => onOpenChange(false)}>Entendido</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // ERROR: Deletion failed
  if (errorMessage && !eliminar.isPending) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Error al eliminar
            </AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                eliminar.reset()
                onOpenChange(false)
              }}
            >
              Cerrar
            </Button>
            <Button variant="destructive" onClick={() => eliminar.reset()}>
              Reintentar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // WARNING: Has history or referrals
  if (data?.tieneHistorial || (data?.referidos?.length ?? 0) > 0) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Eliminar {clienteNombre} permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta acción no se puede deshacer. Se eliminará permanentemente:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {(data?.countVentas ?? 0) > 0 && (
                    <li>{data!.countVentas} venta(s)</li>
                  )}
                  {(data?.countPagos ?? 0) > 0 && (
                    <li>{data!.countPagos} pago(s)</li>
                  )}
                  {(data?.countLineasLiquidadas ?? 0) > 0 && (
                    <li>
                      {data!.countLineasLiquidadas} línea(s) de crédito
                      liquidada(s)
                    </li>
                  )}
                </ul>
                {(data?.referidos?.length ?? 0) > 0 && (
                  <p className="text-sm">
                    Se perderá la relación de referido con:{" "}
                    <span className="font-medium">
                      {data!.referidos.map((r) => r.nombre).join(", ")}
                    </span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-name" className="text-sm text-muted-foreground">
              Escribe <span className="font-medium text-foreground">{clienteNombre}</span> para confirmar
            </Label>
            <Input
              id="confirm-name"
              placeholder={clienteNombre}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmName("")
                onOpenChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!nameMatches || eliminar.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {eliminar.isPending
                ? "Eliminando..."
                : "Eliminar permanentemente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // SIMPLE: No history, no referrals
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {clienteNombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Este cliente no tiene historial. Se eliminará permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={eliminar.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {eliminar.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
