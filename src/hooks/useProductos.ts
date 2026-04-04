"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { checkProductReferences } from "@/lib/catalogo-references"
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

      // Cascade inherited fields to derivados (testers/parciales)
      const cascadeFields = {
        nombre: values.nombre,
        marca: values.marca,
        sku: values.sku,
        genero_id: values.genero_id,
        tamano_id: values.tamano_id,
        presentacion_id: values.presentacion_id,
        concentracion_id: values.concentracion_id,
        tipo_perfume_id: values.tipo_perfume_id,
        proveedor_id: values.proveedor_id,
      }
      // Only include fields that were actually updated
      const fieldsToUpdate = Object.fromEntries(
        Object.entries(cascadeFields).filter(([, v]) => v !== undefined)
      )
      if (Object.keys(fieldsToUpdate).length > 0) {
        await supabase
          .from("productos")
          .update({ ...fieldsToUpdate, updated_at: new Date().toISOString() })
          .eq("producto_origen_id", id)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Producto actualizado")
    },
    onError: () => toast.error("Error al actualizar producto"),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { canDelete, usageMessage } = await checkProductReferences(supabase, id)
      if (!canDelete) throw new Error(usageMessage)
      const { error } = await supabase.from("productos").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Producto eliminado")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return { query, create, update, remove }
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

export function useProductoConDerivados(id: string) {
  const supabase = createClient()

  return useQuery<{
    producto: ProductoWithRelations
    derivados: ProductoWithRelations[]
  }>({
    queryKey: ["productos", id, "derivados"],
    queryFn: async () => {
      const { data: producto, error: prodError } = await supabase
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
      if (prodError) throw prodError

      const { data: derivados, error: derError } = await supabase
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
        .eq("producto_origen_id", id)
        .order("created_at", { ascending: false })
      if (derError) throw derError

      return {
        producto: producto as unknown as ProductoWithRelations,
        derivados: (derivados ?? []) as unknown as ProductoWithRelations[],
      }
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
