"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useChequeoEliminacion } from "@/hooks/useVendedores"

interface Props {
  vendedorId: string | null
  vendedorNombre: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmarEliminar: () => void
  onDesactivarEnSuLugar: () => void
  isPending: boolean
}

export function EliminarVendedorDialog({
  vendedorId,
  vendedorNombre,
  open,
  onOpenChange,
  onConfirmarEliminar,
  onDesactivarEnSuLugar,
  isPending,
}: Props) {
  const chequeo = useChequeoEliminacion(open ? vendedorId : null)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar el perfil de {vendedorNombre}?
          </AlertDialogTitle>

          {chequeo.isLoading && (
            <AlertDialogDescription>
              Revisando si tiene registros asociados…
            </AlertDialogDescription>
          )}

          {chequeo.isError && (
            <AlertDialogDescription className="text-destructive">
              {chequeo.error instanceof Error
                ? chequeo.error.message
                : "No se pudo revisar el vendedor"}
            </AlertDialogDescription>
          )}

          {chequeo.data?.esPropio && (
            <AlertDialogDescription>
              No puedes eliminar tu propio perfil.
            </AlertDialogDescription>
          )}

          {chequeo.data && !chequeo.data.esPropio && !chequeo.data.puedeEliminar && (
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  No se puede eliminar porque tiene trabajo registrado en el
                  sistema:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {chequeo.data.bloqueos.map((b) => (
                    <li key={b.etiqueta}>
                      {b.cantidad} {b.etiqueta}
                    </li>
                  ))}
                </ul>
                <p>
                  Desactivarlo le quita el acceso al sistema y lo saca de los
                  selectores, conservando todo ese historial.
                </p>
              </div>
            </AlertDialogDescription>
          )}

          {chequeo.data?.puedeEliminar && (
            <AlertDialogDescription>
              Este perfil no tiene ningún registro asociado. Se eliminarán el
              perfil y su usuario de acceso, y el nombre de usuario quedará libre.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>

          {chequeo.data && !chequeo.data.esPropio && !chequeo.data.puedeEliminar && (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={onDesactivarEnSuLugar}
            >
              Desactivar en su lugar
            </Button>
          )}

          {chequeo.data?.puedeEliminar && (
            <AlertDialogAction
              onClick={onConfirmarEliminar}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
