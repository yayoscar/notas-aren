"use client"

import { useState } from "react"
import { useCatalogo } from "@/hooks/useCatalogos"
import { useCuentasBancarias } from "@/hooks/useCuentasBancarias"
import { useCategoriasGasto } from "@/hooks/useCategoriasGasto"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Plus, Check, X, Pencil } from "lucide-react"

type CatalogoTable =
  | "cat_genero"
  | "cat_tamano"
  | "cat_presentacion"
  | "cat_concentracion"
  | "cat_tipo_perfume"
  | "cat_ciudad"

const catalogos: { key: CatalogoTable; label: string; fields: string[] }[] = [
  { key: "cat_genero", label: "Género", fields: ["nombre"] },
  { key: "cat_tamano", label: "Tamaño", fields: ["ml", "etiqueta"] },
  { key: "cat_presentacion", label: "Presentación", fields: ["nombre"] },
  { key: "cat_concentracion", label: "Concentración", fields: ["nombre"] },
  { key: "cat_tipo_perfume", label: "Tipo Perfume", fields: ["nombre"] },
  { key: "cat_ciudad", label: "Ciudad", fields: ["nombre"] },
]

function CatalogoTab({ table, fields }: { table: CatalogoTable; fields: string[] }) {
  const { query, create, update } = useCatalogo(table)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  function startEdit(item: Record<string, unknown>) {
    setEditingId(item.id as string)
    const vals: Record<string, string> = {}
    fields.forEach((f) => (vals[f] = String(item[f] ?? "")))
    setEditValues(vals)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  function saveEdit() {
    if (!editingId) return
    const parsed: Record<string, unknown> = { id: editingId }
    fields.forEach((f) => {
      parsed[f] = f === "ml" ? Number(editValues[f]) : editValues[f]
    })
    update.mutate(parsed as { id: string } & Record<string, unknown>, {
      onSuccess: () => cancelEdit(),
    })
  }

  function startAdd() {
    setAdding(true)
    const vals: Record<string, string> = {}
    fields.forEach((f) => (vals[f] = ""))
    setNewValues(vals)
  }

  function cancelAdd() {
    setAdding(false)
    setNewValues({})
  }

  function saveNew() {
    const parsed: Record<string, unknown> = {}
    fields.forEach((f) => {
      parsed[f] = f === "ml" ? Number(newValues[f]) : newValues[f]
    })
    create.mutate(parsed, { onSuccess: () => cancelAdd() })
  }

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const items = (query.data ?? []) as unknown as Record<string, unknown>[]

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={startAdd} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {fields.map((f) => (
              <TableHead key={f} className="capitalize">
                {f === "ml" ? "ML" : f}
              </TableHead>
            ))}
            <TableHead>Estado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adding && (
            <TableRow>
              {fields.map((f) => (
                <TableCell key={f}>
                  <Input
                    value={newValues[f] ?? ""}
                    onChange={(e) => setNewValues({ ...newValues, [f]: e.target.value })}
                    placeholder={f}
                    type={f === "ml" ? "number" : "text"}
                  />
                </TableCell>
              ))}
              <TableCell />
              <TableCell>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={saveNew} disabled={create.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={cancelAdd}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {items.length === 0 && !adding && (
            <TableRow>
              <TableCell colSpan={fields.length + 2} className="text-center text-muted-foreground">
                Sin registros
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => (
            <TableRow key={item.id as string}>
              {fields.map((f) => (
                <TableCell key={f}>
                  {editingId === item.id ? (
                    <Input
                      value={editValues[f] ?? ""}
                      onChange={(e) => setEditValues({ ...editValues, [f]: e.target.value })}
                      type={f === "ml" ? "number" : "text"}
                    />
                  ) : (
                    String(item[f] ?? "")
                  )}
                </TableCell>
              ))}
              <TableCell>
                <Badge variant={item.activo ? "default" : "secondary"}>
                  {item.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={saveEdit} disabled={update.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => startEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CuentasBancariasTab() {
  const { query, create, update } = useCuentasBancarias()
  const [adding, setAdding] = useState(false)
  const [newAlias, setNewAlias] = useState("")
  const [newClabe, setNewClabe] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAlias, setEditAlias] = useState("")
  const [editClabe, setEditClabe] = useState("")

  if (query.isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alias</TableHead>
            <TableHead>CLABE</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adding && (
            <TableRow>
              <TableCell><Input value={newAlias} onChange={e => setNewAlias(e.target.value)} placeholder="Alias" /></TableCell>
              <TableCell><Input value={newClabe} onChange={e => setNewClabe(e.target.value)} placeholder="CLABE interbancaria" /></TableCell>
              <TableCell />
              <TableCell>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { create.mutate({ alias: newAlias, clabe: newClabe }, { onSuccess: () => { setAdding(false); setNewAlias(""); setNewClabe("") } }) }} disabled={create.isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {(query.data ?? []).map(c => (
            <TableRow key={c.id}>
              <TableCell>{editingId === c.id ? <Input value={editAlias} onChange={e => setEditAlias(e.target.value)} /> : c.alias}</TableCell>
              <TableCell>{editingId === c.id ? <Input value={editClabe} onChange={e => setEditClabe(e.target.value)} /> : c.clabe}</TableCell>
              <TableCell><Badge variant={c.activo ? "default" : "secondary"}>{c.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
              <TableCell>
                {editingId === c.id ? (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { update.mutate({ id: c.id, alias: editAlias, clabe: editClabe }, { onSuccess: () => setEditingId(null) }) }}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditAlias(c.alias); setEditClabe(c.clabe) }}><Pencil className="h-4 w-4" /></Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CategoriasGastoTab() {
  const { query, create, update } = useCategoriasGasto()
  const [adding, setAdding] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState("")

  if (query.isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adding && (
            <TableRow>
              <TableCell><Input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre de categoría" /></TableCell>
              <TableCell />
              <TableCell>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { create.mutate({ nombre: newNombre }, { onSuccess: () => { setAdding(false); setNewNombre("") } }) }} disabled={create.isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {(query.data ?? []).map(c => (
            <TableRow key={c.id}>
              <TableCell>{editingId === c.id ? <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /> : c.nombre}</TableCell>
              <TableCell><Badge variant={c.activo ? "default" : "secondary"}>{c.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
              <TableCell>
                {editingId === c.id ? (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { update.mutate({ id: c.id, nombre: editNombre }, { onSuccess: () => setEditingId(null) }) }}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditNombre(c.nombre) }}><Pencil className="h-4 w-4" /></Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function CatalogosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Catálogos</h1>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="cat_genero">
            <TabsList className="mb-4 flex-wrap">
              {catalogos.map((c) => (
                <TabsTrigger key={c.key} value={c.key}>
                  {c.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="cuentas_bancarias">Cuentas Bancarias</TabsTrigger>
              <TabsTrigger value="categorias_gasto">Cat. Gasto</TabsTrigger>
            </TabsList>
            {catalogos.map((c) => (
              <TabsContent key={c.key} value={c.key}>
                <CatalogoTab table={c.key} fields={c.fields} />
              </TabsContent>
            ))}
            <TabsContent value="cuentas_bancarias">
              <CuentasBancariasTab />
            </TabsContent>
            <TabsContent value="categorias_gasto">
              <CategoriasGastoTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
