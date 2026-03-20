"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { clienteSchema, type ClienteFormValues } from "@/lib/validations/cliente.schema"
import { useCatalogo } from "@/hooks/useCatalogos"
import { useClientes } from "@/hooks/useClientes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Cliente } from "@/lib/supabase/types"
import { X } from "lucide-react"

const MapPicker = dynamic(
  () => import("@/components/clientes/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-[300px] w-full rounded-md border bg-muted animate-pulse" /> }
)

interface Props {
  cliente?: Cliente | null
  onSubmit: (values: ClienteFormValues) => void
  isPending: boolean
}

export function ClienteForm({ cliente, onSubmit, isPending }: Props) {
  const ciudades = useCatalogo("cat_ciudad")
  const { query: clientesQuery } = useClientes()

  const [searchReferido, setSearchReferido] = useState("")
  const [showSearchReferido, setShowSearchReferido] = useState(false)
  const [referidoNombre, setReferidoNombre] = useState<string>(
    cliente?.cliente_referido_id
      ? (clientesQuery.data as unknown as Cliente[] | undefined)?.find(
          (c) => c.id === cliente.cliente_referido_id
        )?.nombre ?? ""
      : ""
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: cliente?.nombre ?? "",
      telefono: cliente?.telefono ?? "",
      correo: cliente?.correo ?? "",
      fecha_nacimiento: cliente?.fecha_nacimiento ?? "",
      ciudad_id: cliente?.ciudad_id ?? "",
      direccion: cliente?.direccion ?? "",
      referencia_ubicacion: cliente?.referencia_ubicacion ?? "",
      latitud: cliente?.latitud ?? null,
      longitud: cliente?.longitud ?? null,
      cliente_referido_id: cliente?.cliente_referido_id ?? "",
    },
  })

  const latitud = watch("latitud")
  const longitud = watch("longitud")

  const filteredReferidos = useMemo(() => {
    if (!clientesQuery.data || !searchReferido) return []
    const s = searchReferido.toLowerCase()
    return (clientesQuery.data as unknown as Cliente[])
      .filter(
        (c) =>
          c.activo &&
          c.id !== cliente?.id &&
          (c.nombre.toLowerCase().includes(s) || c.telefono.includes(s))
      )
      .slice(0, 8)
  }, [clientesQuery.data, searchReferido, cliente?.id])

  function selectReferido(c: Cliente) {
    setValue("cliente_referido_id", c.id)
    setReferidoNombre(c.nombre)
    setSearchReferido("")
    setShowSearchReferido(false)
  }

  function clearReferido() {
    setValue("cliente_referido_id", "")
    setReferidoNombre("")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" {...register("nombre")} placeholder="Nombre completo" />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input id="telefono" {...register("telefono")} placeholder="10 dígitos" />
              {errors.telefono && <p className="text-sm text-destructive">{errors.telefono.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <Input id="correo" type="email" {...register("correo")} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
              <Input id="fecha_nacimiento" type="date" {...register("fecha_nacimiento")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ciudad_id">Ciudad *</Label>
              <select
                id="ciudad_id"
                {...register("ciudad_id")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Seleccionar —</option>
                {(ciudades.query.data ?? [])
                  .filter((c) => c.activo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
              </select>
              {errors.ciudad_id && <p className="text-sm text-destructive">{errors.ciudad_id.message}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Dirección *</Label>
              <Input id="direccion" {...register("direccion")} placeholder="Calle, número, colonia" />
              {errors.direccion && <p className="text-sm text-destructive">{errors.direccion.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referencia_ubicacion">Referencia de ubicación *</Label>
            <Input id="referencia_ubicacion" {...register("referencia_ubicacion")} placeholder="Entre calles, cerca de..." />
            {errors.referencia_ubicacion && <p className="text-sm text-destructive">{errors.referencia_ubicacion.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Ubicación en mapa</Label>
            <MapPicker
              latitud={latitud}
              longitud={longitud}
              onChange={(lat, lng) => {
                setValue("latitud", lat)
                setValue("longitud", lng)
              }}
            />
            {latitud != null && longitud != null && (
              <p className="text-xs text-muted-foreground">
                Lat: {latitud.toFixed(6)}, Lng: {longitud.toFixed(6)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referido</CardTitle>
        </CardHeader>
        <CardContent>
          {referidoNombre ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="flex-1 text-sm">{referidoNombre}</span>
              <Button size="icon" variant="ghost" type="button" onClick={clearReferido}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Buscar cliente que recomienda..."
                value={searchReferido}
                onChange={(e) => {
                  setSearchReferido(e.target.value)
                  setShowSearchReferido(true)
                }}
                onFocus={() => setShowSearchReferido(true)}
              />
              {showSearchReferido && filteredReferidos.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                  {filteredReferidos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-accent"
                      onClick={() => selectReferido(c)}
                    >
                      <span>{c.nombre}</span>
                      <span className="text-muted-foreground">{c.telefono}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : cliente ? "Actualizar" : "Crear cliente"}
        </Button>
      </div>
    </form>
  )
}
