"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Venta, VentaDetalle, Pago } from "@/lib/supabase/types"
import { toast } from "sonner"

export type VentaWithRelations = Venta & {
  vendedores: { nombre: string } | null
  clientes: { nombre: string; telefono: string } | null
}

export type VentaDetalleWithProducto = VentaDetalle & {
  productos: { nombre: string; sku: string } | null
}

export type PagoWithCuenta = Pago & {
  cat_cuenta_bancaria: { alias: string; clabe: string } | null
}

export type VentaFullDetail = Venta & {
  vendedores: { nombre: string } | null
  clientes: { nombre: string; telefono: string } | null
  ventas_detalle: VentaDetalleWithProducto[]
  pagos: PagoWithCuenta[]
}

interface VentaDetalleInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

interface PagoInput {
  monto: number
  tipo_pago: string
  cuenta_bancaria_id?: string | null
}

interface CrearVentaInput {
  vendedor_id: string
  cliente_id: string
  tipo_venta: string
  fecha: string
  detalles: VentaDetalleInput[]
  // Contado
  pago?: PagoInput
  // Crédito
  periodicidad?: string | null
  fecha_primer_pago?: string | null
  entrega_despues_pago?: boolean
  meses_credito?: number | null
  primer_abono?: PagoInput | null
}

export function useVentas() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<VentaWithRelations[]>({
    queryKey: ["ventas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select(`*, vendedores(nombre), clientes(nombre, telefono)`)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as VentaWithRelations[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: CrearVentaInput) => {
      const { detalles, pago, primer_abono, ...ventaData } = input

      // Calcular total
      const total = detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      // Insertar venta
      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .insert({
          ...ventaData,
          total,
          estado_credito:
            ventaData.tipo_venta === "credito" ? "activo" : null,
        })
        .select()
        .single()
      if (ventaError) throw ventaError

      // Insertar detalle
      const detailRows = detalles.map((d) => ({
        venta_id: venta.id as string,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
      }))

      const { error: detalleError } = await supabase
        .from("ventas_detalle")
        .insert(detailRows)
      if (detalleError) throw detalleError

      // Insertar pago de contado
      if (ventaData.tipo_venta === "contado" && pago) {
        const { error: pagoError } = await supabase.from("pagos").insert({
          venta_id: venta.id as string,
          monto: pago.monto,
          tipo_pago: pago.tipo_pago,
          cuenta_bancaria_id: pago.cuenta_bancaria_id ?? null,
          vendedor_id: ventaData.vendedor_id,
          cliente_id: ventaData.cliente_id,
        })
        if (pagoError) throw pagoError
      }

      // Insertar primer abono de crédito (opcional)
      if (ventaData.tipo_venta === "credito" && primer_abono) {
        const { error: abonoError } = await supabase.from("pagos").insert({
          venta_id: venta.id as string,
          monto: primer_abono.monto,
          tipo_pago: primer_abono.tipo_pago,
          cuenta_bancaria_id: primer_abono.cuenta_bancaria_id ?? null,
          vendedor_id: ventaData.vendedor_id,
          cliente_id: ventaData.cliente_id,
        })
        if (abonoError) throw abonoError
      }

      return venta
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Venta registrada exitosamente")
    },
    onError: () => toast.error("Error al registrar venta"),
  })

  return { query, create }
}

export function useVenta(id: string) {
  const supabase = createClient()

  return useQuery<VentaFullDetail>({
    queryKey: ["ventas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select(
          `*, vendedores(nombre), clientes(nombre, telefono), ventas_detalle(*, productos(nombre, sku)), pagos(*, cat_cuenta_bancaria(alias, clabe))`
        )
        .eq("id", id)
        .single()
      if (error) throw error
      return data as unknown as VentaFullDetail
    },
    enabled: !!id,
  })
}

export type VentaHistorialCliente = Venta & {
  vendedores: { nombre: string } | null
  ventas_detalle: (VentaDetalle & { productos: { nombre: string } | null })[]
  total_abonado: number
  saldo_restante: number
}

export function useVentasCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery<VentaHistorialCliente[]>({
    queryKey: ["ventas", "cliente", clienteId],
    queryFn: async () => {
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(
          `*, vendedores(nombre), ventas_detalle(*, productos(nombre))`
        )
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
      if (ventasError) throw ventasError

      // Obtener pagos para ventas de crédito
      const creditoIds = (ventas ?? [])
        .filter((v) => v.tipo_venta === "credito")
        .map((v) => v.id)

      let pagosPorVenta: Record<string, number> = {}

      if (creditoIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from("pagos")
          .select("venta_id, monto")
          .in("venta_id", creditoIds)
        if (pagosError) throw pagosError

        pagosPorVenta = (pagos ?? []).reduce(
          (acc, p) => {
            acc[p.venta_id] = (acc[p.venta_id] || 0) + p.monto
            return acc
          },
          {} as Record<string, number>
        )
      }

      return (ventas ?? []).map((v) => {
        const isCredito = v.tipo_venta === "credito"
        const totalAbonado = isCredito
          ? pagosPorVenta[v.id] || 0
          : v.total
        return {
          ...v,
          total_abonado: totalAbonado,
          saldo_restante: v.total - totalAbonado,
        } as VentaHistorialCliente
      })
    },
    enabled: !!clienteId,
  })
}
