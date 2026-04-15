"use client"

import { useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { CumpleanosFilters } from "@/components/clientes/CumpleanosFilters"
import { CumpleanosTable } from "@/components/clientes/CumpleanosTable"
import { WhatsAppCumpleDialog } from "@/components/clientes/WhatsAppCumpleDialog"
import { useCumpleaneros, type ClienteCumpleanero } from "@/hooks/useCumpleaneros"
import type { RangoCumple } from "@/lib/cumpleanos"

const RANGOS_VALIDOS: RangoCumple[] = ["hoy", "semana", "mes", "3meses", "6meses"]

function CumpleanosContent() {
  const searchParams = useSearchParams()
  const filtroParam = searchParams.get("filtro")
  const rangoInicial: RangoCumple =
    filtroParam && RANGOS_VALIDOS.includes(filtroParam as RangoCumple)
      ? (filtroParam as RangoCumple)
      : "hoy"

  const [rango, setRango] = useState<RangoCumple>(rangoInicial)
  const [search, setSearch] = useState("")
  const [dialogCliente, setDialogCliente] = useState<ClienteCumpleanero | null>(null)

  const { data, isLoading } = useCumpleaneros(rango)

  const filtered = useMemo(() => {
    const lista = data ?? []
    if (!search) return lista
    const s = search.toLowerCase()
    return lista.filter((c) => c.nombre.toLowerCase().includes(s))
  }, [data, search])

  const tipoMensaje = rango === "hoy" ? "felicitacion" : "invitacion"

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Cumpleaños de clientes</h1>
        <p className="text-sm text-muted-foreground">
          Felicita e invita a tus clientes en fechas importantes
        </p>
      </div>

      <CumpleanosFilters value={rango} onChange={setRango} />

      <Card>
        <CardHeader>
          <CardTitle>
            {filtered.length} {filtered.length === 1 ? "cumpleañero" : "cumpleañeros"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <CumpleanosTable
            clientes={filtered}
            onSendWhatsApp={setDialogCliente}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <WhatsAppCumpleDialog
        open={dialogCliente !== null}
        onOpenChange={(v) => {
          if (!v) setDialogCliente(null)
        }}
        cliente={dialogCliente}
        tipoMensaje={tipoMensaje}
      />
    </div>
  )
}

export default function CumpleanosPage() {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <CumpleanosContent />
    </Suspense>
  )
}
