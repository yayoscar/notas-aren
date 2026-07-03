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
      // Fetch parent product
      const { data: parent, error: parentError } = await supabase
        .from("productos")
        .select("*")
        .eq("id", input.producto_origen_id)
        .single()
      if (parentError) throw parentError

      if (parent.stock_actual < input.cantidad) {
        throw new Error("Stock insuficiente")
      }

      const stockAntes = parent.stock_actual

      // Decrement parent stock
      const { error: updateError } = await supabase
        .from("productos")
        .update({
          stock_actual: parent.stock_actual - input.cantidad,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.producto_origen_id)
      if (updateError) throw updateError

      // Check if a parcial derivado already exists
      const { data: existingParcial } = await supabase
        .from("productos")
        .select("*")
        .eq("producto_origen_id", input.producto_origen_id)
        .eq("estado_producto", "parcial")
        .maybeSingle()

      let parcial
      if (existingParcial) {
        // Increment stock of existing parcial
        const { data: updated, error: incError } = await supabase
          .from("productos")
          .update({
            stock_actual: existingParcial.stock_actual + input.cantidad,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingParcial.id)
          .select()
          .single()
        if (incError) throw incError
        parcial = updated
      } else {
        // Create new parcial derivado
        const { data: created, error: parcialError } = await supabase
          .from("productos")
          .insert({
            nombre: parent.nombre,
            marca: parent.marca,
            sku: null, // derivados no reusan el SKU del padre (viola productos_sku_key)
            genero_id: parent.genero_id,
            tamano_id: parent.tamano_id,
            presentacion_id: parent.presentacion_id,
            concentracion_id: parent.concentracion_id,
            tipo_perfume_id: parent.tipo_perfume_id,
            proveedor_id: parent.proveedor_id,
            precio_compra: parent.precio_compra,
            precio_venta_contado: parent.precio_venta_contado,
            precio_venta_credito: parent.precio_venta_credito,
            stock_actual: input.cantidad,
            stock_minimo: 0,
            producto_origen_id: input.producto_origen_id,
            estado_producto: "parcial",
            activo: true,
          })
          .select()
          .single()
        if (parcialError) throw parcialError
        parcial = created
      }

      // Record stock movement on parent
      const { error: movError } = await supabase
        .from("stock_movimientos")
        .insert({
          producto_id: input.producto_origen_id,
          tipo: "SALIDA_PARCIAL",
          cantidad: input.cantidad,
          stock_antes: stockAntes,
          stock_despues: stockAntes - input.cantidad,
          referencia_id: parcial.id,
          referencia_tipo: "parcial",
        })
      if (movError) throw movError

      return parcial
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
      // Fetch source product (can be parent or parcial)
      const { data: source, error: sourceError } = await supabase
        .from("productos")
        .select("*")
        .eq("id", input.producto_origen_id)
        .single()
      if (sourceError) throw sourceError

      // Validate stock if descontar_stock is requested
      if (input.descontar_stock !== false) {
        if (source.stock_actual < input.cantidad) {
          throw new Error("Stock insuficiente")
        }

        const stockAntes = source.stock_actual

        // Decrement source stock
        const { error: updateError } = await supabase
          .from("productos")
          .update({
            stock_actual: source.stock_actual - input.cantidad,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.producto_origen_id)
        if (updateError) throw updateError

        // Record stock movement
        await supabase.from("stock_movimientos").insert({
          producto_id: input.producto_origen_id,
          tipo: "SALIDA_MERMA",
          cantidad: input.cantidad,
          stock_antes: stockAntes,
          stock_despues: stockAntes - input.cantidad,
          referencia_tipo: "segunda",
          notas: "Producto registrado como segunda",
        })
      }

      // Determine the real parent (producto_origen_id of the source, or the source itself)
      const realOrigenId = source.producto_origen_id || source.id

      // Check if a segunda already exists for this parent (only one allowed)
      const { data: existingSegunda } = await supabase
        .from("productos")
        .select("*")
        .eq("producto_origen_id", realOrigenId)
        .eq("estado_producto", "segunda")
        .maybeSingle()

      let segunda
      if (existingSegunda) {
        // Increment stock of existing segunda
        const { data: updated, error: incError } = await supabase
          .from("productos")
          .update({
            stock_actual: existingSegunda.stock_actual + input.cantidad,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSegunda.id)
          .select()
          .single()
        if (incError) throw incError
        segunda = updated
      } else {
        // Create new segunda derivado — inherit prices from source
        const { data: created, error: segundaError } = await supabase
          .from("productos")
          .insert({
            nombre: source.nombre,
            marca: source.marca,
            sku: null, // derivados no reusan el SKU del padre (viola productos_sku_key)
            genero_id: source.genero_id,
            tamano_id: source.tamano_id,
            presentacion_id: source.presentacion_id,
            concentracion_id: source.concentracion_id,
            tipo_perfume_id: source.tipo_perfume_id,
            proveedor_id: source.proveedor_id,
            precio_compra: source.precio_compra,
            precio_venta_contado: input.precio_venta_contado ?? source.precio_venta_contado,
            precio_venta_credito: input.precio_venta_credito ?? source.precio_venta_credito,
            stock_actual: input.cantidad,
            stock_minimo: 0,
            producto_origen_id: realOrigenId,
            estado_producto: "segunda",
            porcentaje_precio_parcial: input.porcentaje_precio_parcial ?? null,
            activo: true,
          })
          .select()
          .single()
        if (segundaError) throw segundaError
        segunda = created
      }

      return segunda
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({
        queryKey: ["productos_derivados", variables.producto_origen_id],
      })
      toast.success("Producto segunda registrado")
    },
    onError: () => toast.error("Error al registrar producto segunda"),
  })
}
