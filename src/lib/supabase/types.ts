export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TipoMovimiento =
  | "ENTRADA_COMPRA"
  | "ENTRADA_DEVOLUCION"
  | "SALIDA_VENTA"
  | "SALIDA_MUESTRA"
  | "SALIDA_EXHIBICION"
  | "SALIDA_MERMA"
  | "AJUSTE_POSITIVO"
  | "AJUSTE_NEGATIVO"
  | "SALIDA_TESTER"
  | "ENTRADA_CAMBIO"

export type TipoVenta = "contado" | "credito"
export type TipoPago = "efectivo" | "transferencia" | "retiro_sin_tarjeta"
export type Periodicidad = "semanal" | "quincenal" | "mensual"
export type EstadoCredito = "activo" | "liquidado"
export type EstadoProducto = "nuevo" | "tester" | "parcial"
export type EstadoVenta = "activa" | "cancelada"
export type TipoDevolucion = "devolucion" | "cambio" | "anulacion"

export interface Database {
  public: {
    Tables: {
      cat_genero: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      cat_tamano: {
        Row: {
          id: string
          ml: number
          etiqueta: string
          activo: boolean
        }
        Insert: {
          id?: string
          ml: number
          etiqueta: string
          activo?: boolean
        }
        Update: {
          id?: string
          ml?: number
          etiqueta?: string
          activo?: boolean
        }
      }
      cat_presentacion: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      cat_concentracion: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      cat_tipo_perfume: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      proveedores: {
        Row: {
          id: string
          nombre: string
          nombre_contacto: string | null
          telefono: string | null
          email: string | null
          notas: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          nombre_contacto?: string | null
          telefono?: string | null
          email?: string | null
          notas?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          nombre_contacto?: string | null
          telefono?: string | null
          email?: string | null
          notas?: string | null
          activo?: boolean
          created_at?: string
        }
      }
      productos: {
        Row: {
          id: string
          nombre: string
          marca: string
          sku: string | null
          genero_id: string | null
          tamano_id: string | null
          presentacion_id: string | null
          concentracion_id: string | null
          tipo_perfume_id: string | null
          proveedor_id: string | null
          precio_compra: number
          precio_venta_contado: number
          precio_venta_credito: number
          precio_mayoreo: number | null
          comision_porcentaje: number | null
          stock_actual: number
          stock_minimo: number | null
          imagen_url: string | null
          activo: boolean
          producto_origen_id: string | null
          estado_producto: string
          porcentaje_precio_parcial: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          marca: string
          sku?: string | null
          genero_id?: string | null
          tamano_id?: string | null
          presentacion_id?: string | null
          concentracion_id?: string | null
          tipo_perfume_id?: string | null
          proveedor_id?: string | null
          precio_compra?: number
          precio_venta_contado?: number
          precio_venta_credito?: number
          precio_mayoreo?: number | null
          comision_porcentaje?: number | null
          stock_actual?: number
          stock_minimo?: number | null
          imagen_url?: string | null
          activo?: boolean
          producto_origen_id?: string | null
          estado_producto?: string
          porcentaje_precio_parcial?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          marca?: string
          sku?: string | null
          genero_id?: string | null
          tamano_id?: string | null
          presentacion_id?: string | null
          concentracion_id?: string | null
          tipo_perfume_id?: string | null
          proveedor_id?: string | null
          precio_compra?: number
          precio_venta_contado?: number
          precio_venta_credito?: number
          precio_mayoreo?: number | null
          comision_porcentaje?: number | null
          stock_actual?: number
          stock_minimo?: number | null
          imagen_url?: string | null
          activo?: boolean
          producto_origen_id?: string | null
          estado_producto?: string
          porcentaje_precio_parcial?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      stock_movimientos: {
        Row: {
          id: string
          producto_id: string
          tipo: TipoMovimiento
          cantidad: number
          stock_antes: number
          stock_despues: number
          referencia_id: string | null
          referencia_tipo: string | null
          notas: string | null
          usuario_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          producto_id: string
          tipo: TipoMovimiento
          cantidad: number
          stock_antes: number
          stock_despues: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          notas?: string | null
          usuario_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          producto_id?: string
          tipo?: TipoMovimiento
          cantidad?: number
          stock_antes?: number
          stock_despues?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          notas?: string | null
          usuario_id?: string | null
          created_at?: string
        }
      }
      entradas: {
        Row: {
          id: string
          folio: string
          proveedor_id: string
          fecha: string
          fecha_factura: string | null
          numero_factura: string | null
          total: number
          notas: string | null
          usuario_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          folio?: string
          proveedor_id: string
          fecha?: string
          fecha_factura?: string | null
          numero_factura?: string | null
          total?: number
          notas?: string | null
          usuario_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          folio?: string
          proveedor_id?: string
          fecha?: string
          fecha_factura?: string | null
          numero_factura?: string | null
          total?: number
          notas?: string | null
          usuario_id?: string | null
          created_at?: string
        }
      }
      entradas_detalle: {
        Row: {
          id: string
          entrada_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          id?: string
          entrada_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
        }
        Update: {
          id?: string
          entrada_id?: string
          producto_id?: string
          cantidad?: number
          precio_unitario?: number
        }
      }
      cat_ciudad: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      clientes: {
        Row: {
          id: string
          nombre: string
          telefono: string
          correo: string | null
          fecha_nacimiento: string | null
          ciudad_id: string
          direccion: string
          referencia_ubicacion: string
          latitud: number | null
          longitud: number | null
          cliente_referido_id: string | null
          tipo_relacion_referido: string | null
          limite_credito: number
          usuario_id: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          telefono: string
          correo?: string | null
          fecha_nacimiento?: string | null
          ciudad_id: string
          direccion: string
          referencia_ubicacion: string
          latitud?: number | null
          longitud?: number | null
          cliente_referido_id?: string | null
          tipo_relacion_referido?: string | null
          limite_credito?: number
          usuario_id?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          telefono?: string
          correo?: string | null
          fecha_nacimiento?: string | null
          ciudad_id?: string
          direccion?: string
          referencia_ubicacion?: string
          latitud?: number | null
          longitud?: number | null
          cliente_referido_id?: string | null
          tipo_relacion_referido?: string | null
          limite_credito?: number
          usuario_id?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      precios_historico: {
        Row: {
          id: string
          producto_id: string
          precio_compra: number
          precio_venta_contado: number
          precio_venta_credito: number
          activo: boolean
          origen: string
          usuario_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          producto_id: string
          precio_compra: number
          precio_venta_contado: number
          precio_venta_credito: number
          activo?: boolean
          origen: string
          usuario_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          producto_id?: string
          precio_compra?: number
          precio_venta_contado?: number
          precio_venta_credito?: number
          activo?: boolean
          origen?: string
          usuario_id?: string | null
          created_at?: string
        }
      }
      vendedores: {
        Row: {
          id: string
          nombre: string
          telefono: string
          usuario: string
          rol: string
          auth_user_id: string
          debe_cambiar_password: boolean
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          telefono: string
          usuario: string
          rol?: string
          auth_user_id: string
          debe_cambiar_password?: boolean
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          telefono?: string
          usuario?: string
          rol?: string
          auth_user_id?: string
          debe_cambiar_password?: boolean
          activo?: boolean
          created_at?: string
        }
      }
      cat_cuenta_bancaria: {
        Row: {
          id: string
          alias: string
          clabe: string
          activo: boolean
        }
        Insert: {
          id?: string
          alias: string
          clabe: string
          activo?: boolean
        }
        Update: {
          id?: string
          alias?: string
          clabe?: string
          activo?: boolean
        }
      }
      cat_categoria_gasto: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      ventas: {
        Row: {
          id: string
          folio: string
          vendedor_id: string
          cliente_id: string
          tipo_venta: string
          fecha: string
          total: number
          periodicidad: string | null
          fecha_primer_pago: string | null
          entrega_despues_pago: boolean
          estado_credito: string | null
          meses_credito: number | null
          estado_venta: string
          motivo_cancelacion: string | null
          fecha_cobro_especifica: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folio?: string
          vendedor_id: string
          cliente_id: string
          tipo_venta: string
          fecha: string
          total?: number
          periodicidad?: string | null
          fecha_primer_pago?: string | null
          entrega_despues_pago?: boolean
          estado_credito?: string | null
          meses_credito?: number | null
          estado_venta?: string
          motivo_cancelacion?: string | null
          fecha_cobro_especifica?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folio?: string
          vendedor_id?: string
          cliente_id?: string
          tipo_venta?: string
          fecha?: string
          total?: number
          periodicidad?: string | null
          fecha_primer_pago?: string | null
          entrega_despues_pago?: boolean
          estado_credito?: string | null
          meses_credito?: number | null
          estado_venta?: string
          motivo_cancelacion?: string | null
          fecha_cobro_especifica?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ventas_detalle: {
        Row: {
          id: string
          venta_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          producto_id?: string
          cantidad?: number
          precio_unitario?: number
          created_at?: string
        }
      }
      pagos: {
        Row: {
          id: string
          venta_id: string
          monto: number
          tipo_pago: string
          cuenta_bancaria_id: string | null
          referencia_devolucion_id: string | null
          vendedor_id: string
          cliente_id: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          monto: number
          tipo_pago: string
          cuenta_bancaria_id?: string | null
          referencia_devolucion_id?: string | null
          vendedor_id: string
          cliente_id: string
          fecha?: string
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          monto?: number
          tipo_pago?: string
          cuenta_bancaria_id?: string | null
          referencia_devolucion_id?: string | null
          vendedor_id?: string
          cliente_id?: string
          fecha?: string
          created_at?: string
        }
      }
      gastos: {
        Row: {
          id: string
          concepto: string
          monto: number
          categoria_id: string
          fecha: string
          vendedor_id: string
          tipo_pago: string
          cuenta_bancaria_id: string | null
          comprobante_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          concepto: string
          monto: number
          categoria_id: string
          fecha: string
          vendedor_id: string
          tipo_pago: string
          cuenta_bancaria_id?: string | null
          comprobante_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          concepto?: string
          monto?: number
          categoria_id?: string
          fecha?: string
          vendedor_id?: string
          tipo_pago?: string
          cuenta_bancaria_id?: string | null
          comprobante_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      devoluciones: {
        Row: {
          id: string
          venta_id: string
          tipo: string
          vendedor_id: string
          cliente_id: string
          fecha: string
          monto_original: number
          monto_nuevo: number | null
          diferencia: number | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          tipo: string
          vendedor_id: string
          cliente_id: string
          fecha?: string
          monto_original: number
          monto_nuevo?: number | null
          diferencia?: number | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          tipo?: string
          vendedor_id?: string
          cliente_id?: string
          fecha?: string
          monto_original?: number
          monto_nuevo?: number | null
          diferencia?: number | null
          notas?: string | null
          created_at?: string
        }
      }
      devoluciones_detalle: {
        Row: {
          id: string
          devolucion_id: string
          tipo: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          estado_producto_devuelto: string | null
          created_at: string
        }
        Insert: {
          id?: string
          devolucion_id: string
          tipo: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          estado_producto_devuelto?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          devolucion_id?: string
          tipo?: string
          producto_id?: string
          cantidad?: number
          precio_unitario?: number
          estado_producto_devuelto?: string | null
          created_at?: string
        }
      }
      saldos_favor: {
        Row: {
          id: string
          cliente_id: string
          monto: number
          monto_restante: number
          origen: string
          referencia_id: string
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          monto: number
          monto_restante: number
          origen: string
          referencia_id: string
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          monto?: number
          monto_restante?: number
          origen?: string
          referencia_id?: string
          notas?: string | null
          created_at?: string
        }
      }
      cobranza_seguimiento: {
        Row: {
          id: string
          venta_id: string
          periodo_inicio: string
          periodo_fin: string
          frecuencia: string
          atendido: boolean
          fecha_atendido: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          periodo_inicio: string
          periodo_fin: string
          frecuencia: string
          atendido?: boolean
          fecha_atendido?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          periodo_inicio?: string
          periodo_fin?: string
          frecuencia?: string
          atendido?: boolean
          fecha_atendido?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ventas_historial: {
        Row: {
          id: string
          venta_id: string
          tipo: string
          usuario_id: string
          datos_anteriores: Record<string, unknown> | null
          datos_nuevos: Record<string, unknown> | null
          motivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          tipo: string
          usuario_id: string
          datos_anteriores?: Record<string, unknown> | null
          datos_nuevos?: Record<string, unknown> | null
          motivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          tipo?: string
          usuario_id?: string
          datos_anteriores?: Record<string, unknown> | null
          datos_nuevos?: Record<string, unknown> | null
          motivo?: string | null
          created_at?: string
        }
      }
    }
    Enums: {
      tipo_movimiento: TipoMovimiento
    }
  }
}

// Convenience types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]

export type Producto = Tables<"productos">
export type Proveedor = Tables<"proveedores">
export type Entrada = Tables<"entradas">
export type EntradaDetalle = Tables<"entradas_detalle">
export type StockMovimiento = Tables<"stock_movimientos">
export type CatGenero = Tables<"cat_genero">
export type CatTamano = Tables<"cat_tamano">
export type CatPresentacion = Tables<"cat_presentacion">
export type CatConcentracion = Tables<"cat_concentracion">
export type CatTipoPerfume = Tables<"cat_tipo_perfume">
export type PrecioHistorico = Tables<"precios_historico">
export type OrigenPrecio = "inventario" | "entrada"
export type CatCiudad = Tables<"cat_ciudad">
export type Cliente = Tables<"clientes">
export type Vendedor = Tables<"vendedores">
export type RolVendedor = "admin" | "vendedor"
export type CuentaBancaria = Tables<"cat_cuenta_bancaria">
export type CategoriaGasto = Tables<"cat_categoria_gasto">
export type Venta = Tables<"ventas">
export type VentaDetalle = Tables<"ventas_detalle">
export type Pago = Tables<"pagos">
export type Gasto = Tables<"gastos">
export type Devolucion = Tables<"devoluciones">
export type DevolucionDetalle = Tables<"devoluciones_detalle">
export type SaldoFavor = Tables<"saldos_favor">
export type CobranzaSeguimiento = Tables<"cobranza_seguimiento">
export type VentaHistorial = Tables<"ventas_historial">
