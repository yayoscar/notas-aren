"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { addWeeks, addMonths, format } from "date-fns"
import { parseLocalDate } from "@/lib/utils"
import { convertClienteDateToISO } from "@/lib/validations/import-clientes.schema"
import { convertCreditoDateToISO } from "@/lib/validations/import-creditos.schema"

interface ImportResult {
  inserted: number
  rejected: { row: number; reason: string }[]
}

export function useImportProductos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation<
    ImportResult,
    Error,
    { nombre: string; marca: string; precio_compra: number; precio_venta_contado: number; precio_venta_credito: number; stock_inicial: number }[]
  >({
    mutationFn: async (rows) => {
      const result: ImportResult = { inserted: 0, rejected: [] }

      // Check for existing products by name
      const nombres = rows.map((r) => r.nombre)
      const { data: existing } = await supabase
        .from("productos")
        .select("nombre")
        .in("nombre", nombres)
      const existingNames = new Set((existing ?? []).map((p) => p.nombre.toLowerCase()))

      const toInsert: {
        nombre: string
        marca: string
        precio_compra: number
        precio_venta_contado: number
        precio_venta_credito: number
        stock_actual: number
        estado_producto: string
        activo: boolean
      }[] = []

      rows.forEach((row, i) => {
        if (existingNames.has(row.nombre.toLowerCase())) {
          result.rejected.push({ row: i + 2, reason: `Producto "${row.nombre}" ya existe` })
          return
        }
        toInsert.push({
          nombre: row.nombre,
          marca: row.marca,
          precio_compra: row.precio_compra,
          precio_venta_contado: row.precio_venta_contado,
          precio_venta_credito: row.precio_venta_credito,
          stock_actual: row.stock_inicial,
          estado_producto: "nuevo",
          activo: true,
        })
      })

      if (toInsert.length > 0) {
        const { error } = await supabase.from("productos").insert(toInsert)
        if (error) throw error
        result.inserted = toInsert.length
      }

      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success(`${data.inserted} productos importados`)
    },
    onError: () => toast.error("Error al importar productos"),
  })
}

export function useImportClientes() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation<
    ImportResult,
    Error,
    { rows: { nombre: string; telefono: string; fecha_nacimiento?: string }[]; ciudadId: string }
  >({
    mutationFn: async ({ rows, ciudadId }) => {
      const result: ImportResult = { inserted: 0, rejected: [] }

      // Check for existing clients by phone
      const telefonos = rows.map((r) => r.telefono)
      const { data: existing } = await supabase
        .from("clientes")
        .select("telefono")
        .in("telefono", telefonos)
      const existingPhones = new Set((existing ?? []).map((c) => c.telefono))

      const toInsert: {
        nombre: string
        telefono: string
        fecha_nacimiento: string | null
        ciudad_id: string
        direccion: string
        referencia_ubicacion: string
      }[] = []

      rows.forEach((row, i) => {
        if (existingPhones.has(row.telefono)) {
          result.rejected.push({ row: i + 2, reason: `Teléfono ${row.telefono} ya existe` })
          return
        }
        toInsert.push({
          nombre: row.nombre,
          telefono: row.telefono,
          fecha_nacimiento: row.fecha_nacimiento ? convertClienteDateToISO(row.fecha_nacimiento) : null,
          ciudad_id: ciudadId,
          direccion: "",
          referencia_ubicacion: "",
        })
      })

      if (toInsert.length > 0) {
        const { error } = await supabase.from("clientes").insert(toInsert)
        if (error) throw error
        result.inserted = toInsert.length
      }

      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success(`${data.inserted} clientes importados`)
    },
    onError: () => toast.error("Error al importar clientes"),
  })
}

function calcularSiguientePago(ultimaFecha: string, periodicidad: string): string {
  const date = parseLocalDate(ultimaFecha)
  let result: Date
  switch (periodicidad) {
    case "semanal":
      result = addWeeks(date, 1); break
    case "quincenal":
      result = addWeeks(date, 2); break
    case "mensual":
    default:
      result = addMonths(date, 1); break
  }
  return format(result, "yyyy-MM-dd")
}

export function useImportCreditos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation<
    ImportResult,
    Error,
    {
      rows: {
        cliente: string
        telefono_cliente: string
        credito_total: number
        monto_saldado: number
        periodicidad: string
        ultima_fecha_pago: string
        monto_ultimo_pago: number
        numero_meses: number
      }[]
      vendedorId: string
    }
  >({
    mutationFn: async ({ rows, vendedorId }) => {
      const result: ImportResult = { inserted: 0, rejected: [] }

      // Look up all clients by phone
      const telefonos = rows.map((r) => r.telefono_cliente)
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, telefono")
        .in("telefono", telefonos)
      const clienteMap = new Map((clientes ?? []).map((c) => [c.telefono, c.id]))

      const toInsert: {
        cliente_id: string
        vendedor_id: string
        saldo_total: number
        saldo_pagado: number
        meses_credito: number
        periodicidad: string
        fecha_inicio: string
        fecha_siguiente_pago: string
        estado: string
      }[] = []

      rows.forEach((row, i) => {
        const clienteId = clienteMap.get(row.telefono_cliente)
        if (!clienteId) {
          result.rejected.push({
            row: i + 2,
            reason: `Cliente con teléfono ${row.telefono_cliente} no encontrado`,
          })
          return
        }

        const fechaInicio = convertCreditoDateToISO(row.ultima_fecha_pago)
        const siguientePago = calcularSiguientePago(fechaInicio, row.periodicidad)

        toInsert.push({
          cliente_id: clienteId,
          vendedor_id: vendedorId,
          saldo_total: row.credito_total,
          saldo_pagado: row.monto_saldado,
          meses_credito: row.numero_meses,
          periodicidad: row.periodicidad,
          fecha_inicio: fechaInicio,
          fecha_siguiente_pago: siguientePago,
          estado: row.monto_saldado >= row.credito_total ? "liquidada" : "activa",
        })
      })

      if (toInsert.length > 0) {
        const { error } = await supabase.from("lineas_credito").insert(toInsert)
        if (error) throw error
        result.inserted = toInsert.length
      }

      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success(`${data.inserted} créditos importados`)
    },
    onError: () => toast.error("Error al importar créditos"),
  })
}
