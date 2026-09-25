"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Entrada } from "@/lib/supabase/types"
import { toast } from "sonner"
import { localDateToISO } from "@/lib/utils"

export type EntradaWithProveedor = Entrada & {
  proveedores: { nombre: string } | null
}

export type EntradaDetalleWithProducto = {
  id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos: { nombre: string; sku: string | null; precio_venta_contado: number | null; precio_venta_credito: number | null } | null
}

export type EntradaFullDetail = Entrada & {
  proveedores: { nombre: string } | null
  entradas_detalle: EntradaDetalleWithProducto[]
}

interface EntradaDetalleInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

interface ActualizarEntradaInput {
  id: string
  proveedor_id: string
  fecha: string
  fecha_factura?: string | null
  numero_factura?: string | null
  notas?: string | null
  detalles: EntradaDetalleInput[]
}

interface CrearEntradaInput {
  proveedor_id: string
  fecha: string
  fecha_factura?: string | null
  numero_factura?: string | null
  notas?: string | null
  detalles: EntradaDetalleInput[]
}

export function useEntradas() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<EntradaWithProveedor[]>({
    queryKey: ["entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entradas")
        .select(`*, proveedores(nombre)`)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as EntradaWithProveedor[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: CrearEntradaInput) => {
      const { detalles, ...entradaData } = input

      const total = detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      const { data: entrada, error: entradaError } = await supabase
        .from("entradas")
        .insert({
          ...entradaData,
          total,
          fecha: localDateToISO(entradaData.fecha),
          fecha_factura: entradaData.fecha_factura ? localDateToISO(entradaData.fecha_factura) : null,
        })
        .select()
        .single()
      if (entradaError) throw entradaError

      const detailRows = detalles.map((d) => ({
        entrada_id: entrada.id as string,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
      }))

      const { error: detalleError } = await supabase
        .from("entradas_detalle")
        .insert(detailRows)
      if (detalleError) throw detalleError

      return entrada
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entradas"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Entrada registrada exitosamente")
    },
    onError: () => toast.error("Error al registrar entrada"),
  })

  // Editar y eliminar viven en funciones de Postgres, no aquí: la comprobación
  // de existencias y la mutación del stock tienen que ocurrir en la misma
  // transacción. Ver supabase/migrations/20260925000004_entrada_eliminar_actualizar.sql
  const update = useMutation({
    mutationFn: async (input: ActualizarEntradaInput) => {
      const { id, detalles, ...entradaData } = input

      const { data, error } = await supabase.rpc("fn_actualizar_entrada", {
        p_entrada_id: id,
        p_proveedor_id: entradaData.proveedor_id,
        p_fecha: localDateToISO(entradaData.fecha),
        p_fecha_factura: entradaData.fecha_factura
          ? localDateToISO(entradaData.fecha_factura)
          : null,
        p_numero_factura: entradaData.numero_factura || null,
        p_notas: entradaData.notas || null,
        p_detalles: detalles,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (_data, variables) => {
      invalidarEntrada(variables.id)
      toast.success("Entrada actualizada")
    },
    // El mensaje viene de la base y nombra el producto y las piezas que faltan.
    // Sustituirlo por un texto genérico dejaría al usuario sin saber qué corregir.
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_eliminar_entrada", {
        p_entrada_id: id,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, id) => {
      invalidarEntrada(id)
      toast.success("Entrada eliminada")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function invalidarEntrada(id: string) {
    queryClient.invalidateQueries({ queryKey: ["entradas"] })
    queryClient.invalidateQueries({ queryKey: ["entradas", id] })
    // El stock y sus movimientos los mueven los triggers, así que la caché
    // local de productos queda obsoleta en cuanto se edita o se borra.
    queryClient.invalidateQueries({ queryKey: ["productos"] })
    queryClient.invalidateQueries({ queryKey: ["stock_movimientos"] })
  }

  return { query, create, update, remove }
}

export function useEntrada(id: string) {
  const supabase = createClient()

  return useQuery<EntradaFullDetail>({
    queryKey: ["entradas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entradas")
        .select(
          `*, proveedores(nombre), entradas_detalle(id, producto_id, cantidad, precio_unitario, subtotal, productos(nombre, sku, precio_venta_contado, precio_venta_credito))`
        )
        .eq("id", id)
        .single()
      if (error) throw error
      return data as unknown as EntradaFullDetail
    },
    enabled: !!id,
  })
}
