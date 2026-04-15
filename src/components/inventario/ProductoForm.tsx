"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { productoSchema, type ProductoFormValues } from "@/lib/validations/producto.schema"
import { useCatalogo } from "@/hooks/useCatalogos"
import { useProveedores } from "@/hooks/useProveedores"
import { useMarcas } from "@/hooks/useMarcas"
import { useNombresProducto } from "@/hooks/useNombresProducto"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import type { Producto } from "@/lib/supabase/types"

interface SetItem {
  descripcion: string
  cantidad: number
}

interface Props {
  producto?: Producto | null
  onSubmit: (values: ProductoFormValues) => void
  isPending: boolean
  initialSetItems?: SetItem[]
}

function SelectField({
  label,
  id,
  options,
  register,
  error,
}: {
  label: string
  id: string
  options: { value: string; label: string }[]
  register: ReturnType<typeof useForm<ProductoFormValues>>["register"]
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        {...register(id as keyof ProductoFormValues)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">— Seleccionar —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function ProductoForm({ producto, onSubmit, isPending, initialSetItems }: Props) {
  const generos = useCatalogo("cat_genero")
  const tamanos = useCatalogo("cat_tamano")
  const presentaciones = useCatalogo("cat_presentacion")
  const concentraciones = useCatalogo("cat_concentracion")
  const tipos = useCatalogo("cat_tipo_perfume")
  const proveedores = useProveedores()
  const marcasQuery = useMarcas()

  const [searchMarca, setSearchMarca] = useState(producto?.marca ?? "")
  const [showMarcas, setShowMarcas] = useState(false)

  const filteredMarcas = useMemo(() => {
    if (!marcasQuery.data || !searchMarca) return []
    const s = searchMarca.toLowerCase()
    return marcasQuery.data
      .filter((m) => m.toLowerCase().includes(s))
      .slice(0, 10)
  }, [marcasQuery.data, searchMarca])

  // Nombre suggestions, scoped to the currently-selected marca.
  const [searchNombre, setSearchNombre] = useState(producto?.nombre ?? "")
  const [showNombres, setShowNombres] = useState(false)
  const nombresQuery = useNombresProducto(searchMarca)

  const filteredNombres = useMemo(() => {
    if (!nombresQuery.data) return []
    if (!searchNombre) return nombresQuery.data.slice(0, 10)
    const s = searchNombre.toLowerCase()
    return nombresQuery.data
      .filter((n) => n.toLowerCase().includes(s))
      .slice(0, 10)
  }, [nombresQuery.data, searchNombre])

  const [setItems, setSetItems] = useState<SetItem[]>(
    initialSetItems?.length ? initialSetItems : []
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      nombre: producto?.nombre ?? "",
      marca: producto?.marca ?? "",
      sku: producto?.sku ?? "",
      genero_id: producto?.genero_id ?? "",
      tamano_id: producto?.tamano_id ?? "",
      presentacion_id: producto?.presentacion_id ?? "",
      concentracion_id: producto?.concentracion_id ?? "",
      tipo_perfume_id: producto?.tipo_perfume_id ?? "",
      proveedor_id: producto?.proveedor_id ?? "",
      stock_minimo: producto?.stock_minimo ?? 5,
      imagen_url: producto?.imagen_url ?? "",
      set_items: [],
    },
  })

  const presentacionId = watch("presentacion_id")
  const esSet = useMemo(() => {
    if (!presentacionId || !presentaciones.query.data) return false
    const pres = presentaciones.query.data.find((p) => p.id === presentacionId)
    return pres?.nombre?.toLowerCase().trim() === "set"
  }, [presentacionId, presentaciones.query.data])

  useEffect(() => {
    if (esSet && setItems.length === 0) {
      setSetItems([{ descripcion: "", cantidad: 1 }])
    }
    if (!esSet) {
      setSetItems([])
    }
  }, [esSet])

  // Sync initialSetItems when they load (editing existing product)
  useEffect(() => {
    if (initialSetItems?.length && setItems.length === 0) {
      setSetItems(initialSetItems)
    }
  }, [initialSetItems])

  const handleFormSubmit = (values: ProductoFormValues) => {
    if (esSet) {
      const validItems = setItems.filter((item) => item.descripcion.trim() !== "")
      if (validItems.length === 0) {
        toast.error("Agrega al menos un artículo al set")
        return
      }
      onSubmit({ ...values, set_items: validItems })
    } else {
      onSubmit({ ...values, set_items: [] })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 1. Marca (first — drives nombre suggestions) */}
            <div className="space-y-2 relative">
              <Label htmlFor="marca">Marca *</Label>
              <Input
                id="marca"
                placeholder="Marca"
                value={searchMarca}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchMarca(val)
                  setValue("marca", val)
                  setShowMarcas(true)
                }}
                onFocus={() => setShowMarcas(true)}
                onBlur={() => setTimeout(() => setShowMarcas(false), 150)}
                autoComplete="off"
              />
              {showMarcas && filteredMarcas.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {filteredMarcas.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-b last:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setValue("marca", m)
                        setSearchMarca(m)
                        setShowMarcas(false)
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              {errors.marca && <p className="text-sm text-destructive">{errors.marca.message}</p>}
            </div>

            {/* 2. Nombre (filtered by marca) */}
            <div className="space-y-2 relative">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                placeholder={
                  searchMarca ? "Nombre del perfume" : "Selecciona una marca primero"
                }
                value={searchNombre}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchNombre(val)
                  setValue("nombre", val)
                  setShowNombres(true)
                }}
                onFocus={() => setShowNombres(true)}
                onBlur={() => setTimeout(() => setShowNombres(false), 150)}
                autoComplete="off"
                disabled={!searchMarca}
              />
              {showNombres && filteredNombres.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {filteredNombres.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-b last:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setValue("nombre", n)
                        setSearchNombre(n)
                        setShowNombres(false)
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>

            {/* 3. SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register("sku")} placeholder="SKU-001" />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              label="Género"
              id="genero_id"
              options={(generos.query.data ?? []).filter(g => g.activo).map((g) => ({ value: g.id, label: g.nombre ?? "" }))}
              register={register}
            />
            <SelectField
              label="Tamaño"
              id="tamano_id"
              options={(tamanos.query.data ?? []).filter(t => t.activo).map((t) => ({ value: t.id, label: t.etiqueta ?? "" }))}
              register={register}
            />
            <SelectField
              label="Presentación"
              id="presentacion_id"
              options={(presentaciones.query.data ?? []).filter(p => p.activo).map((p) => ({ value: p.id, label: p.nombre ?? "" }))}
              register={register}
            />
            <SelectField
              label="Concentración"
              id="concentracion_id"
              options={(concentraciones.query.data ?? []).filter(c => c.activo).map((c) => ({ value: c.id, label: c.nombre ?? "" }))}
              register={register}
            />
            <SelectField
              label="Tipo perfume"
              id="tipo_perfume_id"
              options={(tipos.query.data ?? []).filter(t => t.activo).map((t) => ({ value: t.id, label: t.nombre ?? "" }))}
              register={register}
            />
            <SelectField
              label="Proveedor"
              id="proveedor_id"
              options={(proveedores.query.data ?? []).filter(p => p.activo).map((p) => ({ value: p.id, label: p.nombre }))}
              register={register}
            />
          </div>
        </CardContent>
      </Card>

      {esSet && (
        <Card>
          <CardHeader>
            <CardTitle>Artículos del Set</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {setItems.map((item, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  {idx === 0 && <Label>Descripción</Label>}
                  <Input
                    placeholder="Ej: Perfume 100ml Floral"
                    value={item.descripcion}
                    onChange={(e) => {
                      const updated = [...setItems]
                      updated[idx] = { ...updated[idx], descripcion: e.target.value }
                      setSetItems(updated)
                    }}
                  />
                </div>
                <div className="w-24 space-y-2">
                  {idx === 0 && <Label>Cantidad</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) => {
                      const updated = [...setItems]
                      updated[idx] = { ...updated[idx], cantidad: Number(e.target.value) || 1 }
                      setSetItems(updated)
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  disabled={setItems.length <= 1}
                  onClick={() => setSetItems(setItems.filter((_, i) => i !== idx))}
                >
                  <span className="text-destructive text-lg">&times;</span>
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSetItems([...setItems, { descripcion: "", cantidad: 1 }])}
            >
              + Agregar artículo
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="stock_minimo">Stock mínimo</Label>
              <Input id="stock_minimo" type="number" {...register("stock_minimo", { valueAsNumber: true })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : producto ? "Actualizar" : "Crear producto"}
        </Button>
      </div>
    </form>
  )
}
