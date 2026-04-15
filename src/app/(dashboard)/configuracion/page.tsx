"use client"

import { useState, useEffect } from "react"
import { useConfigValue, useUpdateConfigValue } from "@/hooks/useConfiguracion"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Save, Upload, Database } from "lucide-react"
import Link from "next/link"

export default function ConfiguracionPage() {
  const { isAdmin, isLoading: isLoadingVendedor } = useVendedorActual()
  const { data: mensajeActual, isLoading: isLoadingConfig } = useConfigValue("recordatorio_whatsapp")
  const { data: diasLimiteActual, isLoading: isLoadingDias } = useConfigValue("dias_limite_devolucion")
  const { data: felicitacionActual, isLoading: isLoadingFelicitacion } = useConfigValue("felicitacion_cumple_whatsapp")
  const { data: invitacionActual, isLoading: isLoadingInvitacion } = useConfigValue("invitacion_cumple_whatsapp")
  const updateConfig = useUpdateConfigValue()

  const [mensaje, setMensaje] = useState("")
  const [diasLimite, setDiasLimite] = useState("7")
  const [felicitacion, setFelicitacion] = useState("")
  const [invitacion, setInvitacion] = useState("")

  useEffect(() => {
    if (mensajeActual) setMensaje(mensajeActual)
  }, [mensajeActual])

  useEffect(() => {
    if (diasLimiteActual) setDiasLimite(diasLimiteActual)
  }, [diasLimiteActual])

  useEffect(() => {
    if (felicitacionActual) setFelicitacion(felicitacionActual)
  }, [felicitacionActual])

  useEffect(() => {
    if (invitacionActual) setInvitacion(invitacionActual)
  }, [invitacionActual])

  if (isLoadingVendedor) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta seccion.</p>
      </div>
    )
  }

  function handleGuardar() {
    updateConfig.mutate({ key: "recordatorio_whatsapp", value: mensaje })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configuracion</h1>

      <Card>
        <CardHeader>
          <CardTitle>Mensaje de recordatorio de pago</CardTitle>
          <CardDescription>
            Este mensaje se enviara por WhatsApp cuando uses el boton de recordatorio en la vista de cobranza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingConfig ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <Textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={5}
                placeholder="Escribe el mensaje de recordatorio..."
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles: <code className="bg-muted px-1 rounded">{"{nombre}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{monto}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{fecha_pago}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{saldo}"}</code>
              </p>
              <div className="flex justify-end">
                <Button onClick={handleGuardar} disabled={updateConfig.isPending || mensaje === mensajeActual}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateConfig.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mensaje de felicitación de cumpleaños</CardTitle>
          <CardDescription>
            Este mensaje se propone cuando felicitas a un cliente cuyo cumpleaños es hoy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingFelicitacion ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <Textarea
                value={felicitacion}
                onChange={(e) => setFelicitacion(e.target.value)}
                rows={5}
                placeholder="Escribe el mensaje de felicitación..."
              />
              <p className="text-xs text-muted-foreground">
                Variable disponible: <code className="bg-muted px-1 rounded">{"{nombre}"}</code>
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => updateConfig.mutate({ key: "felicitacion_cumple_whatsapp", value: felicitacion })}
                  disabled={updateConfig.isPending || felicitacion === (felicitacionActual ?? "")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateConfig.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensaje de invitación por cumpleaños</CardTitle>
          <CardDescription>
            Este mensaje se propone para invitar a clientes con cumpleaños próximo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingInvitacion ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <Textarea
                value={invitacion}
                onChange={(e) => setInvitacion(e.target.value)}
                rows={5}
                placeholder="Escribe el mensaje de invitación..."
              />
              <p className="text-xs text-muted-foreground">
                Variable disponible: <code className="bg-muted px-1 rounded">{"{nombre}"}</code>
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => updateConfig.mutate({ key: "invitacion_cumple_whatsapp", value: invitacion })}
                  disabled={updateConfig.isPending || invitacion === (invitacionActual ?? "")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateConfig.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devoluciones</CardTitle>
          <CardDescription>
            Limite de dias para aceptar devoluciones despues de la fecha de venta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingDias ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={diasLimite}
                  onChange={(e) => setDiasLimite(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">dias despues de la venta</span>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => updateConfig.mutate({ key: "dias_limite_devolucion", value: diasLimite })}
                  disabled={updateConfig.isPending || diasLimite === (diasLimiteActual ?? "7")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateConfig.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Importación Masiva</CardTitle>
          <CardDescription>
            Carga inicial de productos, clientes y créditos desde archivos Excel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/configuracion/importacion">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Ir a Importación
            </Button>
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Respaldo y Restauración</CardTitle>
          <CardDescription>
            Genera un respaldo completo de la base de datos o restaura desde un archivo ZIP previamente descargado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/configuracion/respaldo">
            <Button variant="outline">
              <Database className="mr-2 h-4 w-4" />
              Ir a Respaldo
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
