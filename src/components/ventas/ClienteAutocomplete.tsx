"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useClientes, type ClienteWithRelations } from "@/hooks/useClientes"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

interface Props {
  value: string
  onSelect: (clienteId: string) => void
}

export function ClienteAutocomplete({ value, onSelect }: Props) {
  const { query } = useClientes()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const clientes = (query.data ?? []).filter((c) => c.activo)

  const selected = clientes.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (search.length < 2) return []
    const s = search.toLowerCase()
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(s) ||
          (c.cat_ciudad?.nombre ?? "").toLowerCase().includes(s)
      )
      .slice(0, 10)
  }, [clientes, search])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(cliente: ClienteWithRelations) {
    onSelect(cliente.id)
    setSearch("")
    setOpen(false)
  }

  function handleClear() {
    onSelect("")
    setSearch("")
    setOpen(false)
  }

  // If a client is selected, show their name with a clear button
  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selected.nombre}</p>
          <p className="text-xs text-muted-foreground truncate">
            {selected.cat_ciudad?.nombre ?? "Sin ciudad"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 rounded-sm p-0.5 hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nombre..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="pl-10"
        />
      </div>

      {open && search.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b last:border-b-0"
              >
                <p className="text-sm font-medium">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.cat_ciudad?.nombre ?? "Sin ciudad"}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
