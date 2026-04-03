"use client"

import { useState } from "react"
import { useLineaCreditoCliente } from "@/hooks/useLineaCredito"
import { useCrearAbono } from "@/hooks/usePagos"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ClienteAutocomplete } from "@/components/ventas/ClienteAutocomplete"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PagoForm } from "@/components/ventas/PagoForm"
import { toast } from "sonner"
import { formatMoney, localToday } from "@/lib/utils"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF } from "@/lib/pdf-utils"

export default function AbonosPage() {
  const { vendedor } = useVendedorActual()
  const crearAbono = useCrearAbono()

  const [step, setStep] = useState(1)
  const [clienteId, setClienteId] = useState("")

  const [abonoMonto, setAbonoMonto] = useState(0)
  const [abonoTipo, setAbonoTipo] = useState("efectivo")
  const [abonoCuenta, setAbonoCuenta] = useState<string | null>(null)
  const [abonoFecha, setAbonoFecha] = useState(localToday())

  const { data: linea, isLoading: lineaLoading } =
    useLineaCreditoCliente(clienteId)

  const saldoPendiente = linea
    ? linea.saldo_total - linea.saldo_pagado
    : 0

  function handleSelectCliente(id: string) {
    setClienteId(id)
    if (id) {
      setStep(2)
    } else {
      setStep(1)
    }
  }

  function handleContinueToAbono() {
    setStep(3)
  }

  function handleRegistrar() {
    if (!vendedor || !linea || abonoMonto <= 0) return

    if (abonoMonto > saldoPendiente) {
      toast.error("El monto no puede ser mayor al saldo pendiente")
      return
    }

    crearAbono.mutate(
      {
        linea_credito_id: linea.id,
        monto: abonoMonto,
        tipo_pago: abonoTipo,
        cuenta_bancaria_id: abonoCuenta,
        vendedor_id: vendedor.id,
        cliente_id: clienteId,
        fecha: abonoFecha,
      },
      {
        onSuccess: async () => {
          try {
            const clienteNombre = linea.clientes?.nombre ?? ""
            const blob = await pdf(
              <AbonoTicketPDF
                folio={linea.id.slice(0, 8).toUpperCase()}
                clienteNombre={clienteNombre}
                fecha={abonoFecha}
                monto={abonoMonto}
                tipoPago={abonoTipo}
                totalCredito={linea.saldo_total}
                totalAbonado={linea.saldo_pagado + abonoMonto}
                saldoRestante={saldoPendiente - abonoMonto}
                saldoAnterior={linea.saldo_pagado}
                vendedorNombre={vendedor?.nombre ?? ""}
                fechaVenta={linea.created_at}
              />
            ).toBlob()
            await downloadPDF(
              blob,
              `abono-${linea.id.slice(0, 8).toUpperCase()}.pdf`
            )
          } catch {
            // PDF generation failed silently, abono was still recorded
          }
          setStep(1)
          setClienteId("")
          setAbonoMonto(0)
          setAbonoTipo("efectivo")
          setAbonoCuenta(null)
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Registrar Abono</h1>

      {/* Step 1: Seleccionar cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant={step >= 1 ? "default" : "secondary"}>1</Badge>
            Seleccionar cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full sm:max-w-md">
            <ClienteAutocomplete
              value={clienteId}
              onSelect={handleSelectCliente}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Línea de crédito activa */}
      {step >= 2 && clienteId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={step >= 2 ? "default" : "secondary"}>2</Badge>
              Línea de crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineaLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : !linea ? (
              <p className="text-muted-foreground">
                Este cliente no tiene créditos activos
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-sm text-muted-foreground">
                      Línea activa
                    </span>
                    {linea.periodicidad && (
                      <Badge variant="outline" className="capitalize">
                        {linea.periodicidad}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">
                        {formatMoney(linea.saldo_total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Abonado</p>
                      <p className="font-medium text-green-600">
                        {formatMoney(linea.saldo_pagado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pendiente</p>
                      <p className="font-bold text-orange-600">
                        {formatMoney(saldoPendiente)}
                      </p>
                    </div>
                  </div>
                </div>
                {step < 3 && (
                  <div className="flex justify-end">
                    <Button onClick={handleContinueToAbono}>
                      Registrar abono
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Registrar abono */}
      {step >= 3 && linea && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">3</Badge>
              Datos del abono
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label>Fecha del abono</Label>
              <Input
                type="date"
                value={abonoFecha}
                onChange={(e) => setAbonoFecha(e.target.value)}
              />
            </div>
            <PagoForm
              monto={abonoMonto}
              tipoPago={abonoTipo}
              cuentaBancariaId={abonoCuenta}
              onMontoChange={setAbonoMonto}
              onTipoPagoChange={setAbonoTipo}
              onCuentaChange={setAbonoCuenta}
            />
            <p className="text-sm text-muted-foreground">
              Saldo pendiente: {formatMoney(saldoPendiente)}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1)
                  setClienteId("")
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegistrar}
                disabled={crearAbono.isPending || abonoMonto <= 0}
              >
                {crearAbono.isPending ? "Registrando..." : "Registrar abono"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
