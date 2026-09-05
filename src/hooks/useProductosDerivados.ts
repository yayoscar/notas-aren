"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { ProductoWithRelations } from "./useProductos"
import { toast } from "sonner"

interface CrearParcialInput {
  producto_origen_id: string
  cantidad: number
}

interface CrearSegundaInput {
  producto_origen_id: string
  cantidad: number
  precio_venta_contado?: number // optional: if omitted, inherits from source
  precio_venta_credito?: number // optional: if omitted, inherits from source
  porcentaje_precio_parcial?: number
  descontar_stock?: boolean // default true; false when called from devoluciones (stock already handled)
}

export function useDerivados(productoOrigenId: string) {
  const supabase = createClient()

  return useQuery<ProductoWithRelations[]>({
    queryKey: ["productos_derivados", productoOrigenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          *,
          cat_genero(nombre),
          cat_tamano(etiqueta),
          cat_presentacion(nombre),
          cat_concentracion(nombre),
          cat_tipo_perfume(nombre),
          proveedores(nombre)
        `)
        .eq("producto_origen_id", productoOrigenId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as ProductoWithRelations[]
    },
    enabled: !!productoOrigenId,
  })
}

export function useCrearParcial() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CrearParcialInput) => {
      // Todo el flujo (validar stock, descontar, registrar movimiento y crear o
      // incrementar el derivado) ocurre dentro de una sola transacción en la BD.
      // Ver supabase/migrations/20260905000001_create_derivado_rpc.sql
      const { data, error } = await supabase.rpc("fn_crear_producto_derivado", {
        p_origen_id: input.producto_origen_id,
        p_cantidad: input.cantidad,
        p_estado: "parcial",
      })
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({
        queryKey: ["productos_derivados", variables.producto_origen_id],
      })
      queryClient.invalidateQueries({
        queryKey: ["stock_movimientos", variables.producto_origen_id],
      })
      toast.success("Parcial registrado exitosamente")
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Error al registrar parcial"
      ),
  })
}

export function useCrearSegunda() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CrearSegundaInput) => {
      const { data, error } = await supabase.rpc("fn_crear_producto_derivado", {
        p_origen_id: input.producto_origen_id,
        p_cantidad: input.cantidad,
        p_estado: "segunda",
        p_precio_venta_contado: input.precio_venta_contado ?? null,
        p_precio_venta_credito: input.precio_venta_credito ?? null,
        p_porcentaje_precio_parcial: input.porcentaje_precio_parcial ?? null,
        p_descontar_stock: input.descontar_stock !== false,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({
        queryKey: ["productos_derivados", variables.producto_origen_id],
      })
      queryClient.invalidateQueries({
        queryKey: ["stock_movimientos", variables.producto_origen_id],
      })
      toast.success("Producto segunda registrado")
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al registrar producto segunda"
      ),
  })
}
