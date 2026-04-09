"use client"

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const CONFIRM_WORD = "RESTAURAR"

type RestoreConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  isPending: boolean
  onConfirm: () => void
}

export function RestoreConfirmDialog({
  open,
  onOpenChange,
  fileName,
  isPending,
  onConfirm,
}: RestoreConfirmDialogProps) {
  const [typed, setTyped] = useState("")

  // Reset the input every time the dialog reopens.
  useEffect(() => {
    if (!open) setTyped("")
  }, [open])

  const canConfirm = typed === CONFIRM_WORD && !isPending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            ⚠️ Restaurar base de datos
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="font-semibold text-foreground">
                Esta acción REEMPLAZARÁ TODA la base de datos. Los datos actuales se perderán de forma permanente.
              </p>
              <p>
                Archivo seleccionado: <code className="bg-muted px-1 rounded text-xs">{fileName}</code>
              </p>
              <p>
                Para confirmar, escribe <strong>{CONFIRM_WORD}</strong> en el campo de abajo.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="restore-confirm-input" className="sr-only">
            Confirmación
          </Label>
          <Input
            id="restore-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              if (canConfirm) onConfirm()
            }}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restaurando...
              </>
            ) : (
              "Restaurar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
