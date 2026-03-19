"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Producto, StockMovimiento, InsertTables, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export type ProductoWithRelations = Producto & {
  cat_genero: { nombre: string } | null
  cat_tamano: { etiqueta: string } | null
  cat_presentacion: { nombre: string } | null
  cat_concentracion: { nombre: string } | null
  cat_tipo_perfume: { nombre: string } | null
  proveedores: { nombre: string } | null
}

export function useProductos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<ProductoWithRelations[]>({
    queryKey: ["productos"],
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
        .order("nombre")
      if (error) throw error
      return data as unknown as ProductoWithRelations[]
    },
  })

  const create = useMutation({
    mutationFn: async (values: InsertTables<"productos">) => {
      const { data, error } = await supabase.from("productos").insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Producto creado")
    },
    onError: () => toast.error("Error al crear producto"),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: UpdateTables<"productos"> & { id: string }) => {
      const { data, error } = await supabase.from("productos").update(values).eq("id", id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Producto actualizado")
    },
    onError: () => toast.error("Error al actualizar producto"),
  })

  return { query, create, update }
}

export function useProducto(id: string) {
  const supabase = createClient()

  return useQuery<ProductoWithRelations>({
    queryKey: ["productos", id],
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
        .eq("id", id)
        .single()
      if (error) throw error
      return data as unknown as ProductoWithRelations
    },
    enabled: !!id,
  })
}

export function useStockMovimientos(productoId: string) {
  const supabase = createClient()

  return useQuery<StockMovimiento[]>({
    queryKey: ["stock_movimientos", productoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movimientos")
        .select("*")
        .eq("producto_id", productoId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as StockMovimiento[]
    },
    enabled: !!productoId,
  })
}
