"use client"

import { useEffect, useState } from "react"
import { MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfigValue } from "@/hooks/useConfiguracion"
import { limpiarTelefono } from "@/lib/utils"

type TipoMensaje = "felicitacion" | "invitacion"

const CONFIG_KEY: Record<TipoMensaje, string> = {
  felicitacion: "felicitacion_cumple_whatsapp",
  invitacion: "invitacion_cumple_whatsapp",
}

const FALLBACK: Record<TipoMensaje, string> = {
  felicitacion:
    "¡Feliz cumpleaños, {nombre}! 🎂 En Notas de Aren queremos desearte un día lleno de momentos especiales. Te esperamos para consentirte con tu fragancia favorita. ✨",
  invitacion:
    "Hola {nombre}, se acerca tu cumpleaños y en Notas de Aren queremos celebrarlo contigo. Ven a consentirte con un detalle especial durante tu mes de cumpleaños. 🎁🌸",
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  cliente: { nombre: string; telefono: string } | null
  tipoMensaje: TipoMensaje
}

export function WhatsAppCumpleDialog({ open, onOpenChange, cliente, tipoMensaje }: Props) {
  const { data: template, isLoading } = useConfigValue(CONFIG_KEY[tipoMensaje])
  const [mensaje, setMensaje] = useState("")

  useEffect(() => {
    if (!open || !cliente) return
    const base = template ?? FALLBACK[tipoMensaje]
    setMensaje(base.replace(/\{nombre\}/g, cliente.nombre))
  }, [open, cliente, template, tipoMensaje])

  const telLimpio = limpiarTelefono(cliente?.telefono)
  const telefonoValido = telLimpio.length > 0

  function handleEnviar() {
    if (!telefonoValido) return
    const url = `https://wa.me/52${telLimpio}?text=${encodeURIComponent(mensaje)}`
    window.open(url, "_blank")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {tipoMensaje === "felicitacion" ? "Felicitar por cumpleaños" : "Invitar por cumpleaños"}
          </DialogTitle>
          <DialogDescription>
            {cliente?.nombre ?? "—"} · {cliente?.telefono ?? "Sin teléfono"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={6}
            placeholder="Escribe el mensaje..."
          />
        )}

        {!telefonoValido && (
          <p className="text-xs text-destructive">Teléfono no válido</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!telefonoValido || !mensaje.trim()}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
