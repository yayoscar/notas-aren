## Why

Una entrada de inventario no se puede corregir ni eliminar. Si se captura mal la cantidad, el costo, el producto o el proveedor, el error queda permanente: el stock queda inflado y la única salida es un ajuste manual que no deja rastro de la causa. `useEntradas` expone solo `query` y `create`.

Los perfiles de vendedor tampoco se pueden dar de baja. La columna `vendedores.activo` existe desde la primera migración y se pinta como badge "Activo/Inactivo" en la lista y el detalle, pero ninguna parte del código la escribe nunca, y el login no la consulta. Un vendedor que ya no trabaja conserva su acceso indefinidamente.

## What Changes

### Entradas

- **Editar una entrada** existente (proveedor, fecha, factura, notas y las líneas de detalle), ajustando el stock por la diferencia. Solo administrador.
- **Eliminar una entrada** por completo, revirtiendo el stock que sumó. Borrado real: la fila desaparece. Solo administrador.
- **Guardia de stock suficiente**: si el producto ya no tiene las piezas que aportó la entrada (se vendieron, o se derivaron a parcial/tester), el borrado o la reducción de cantidad se **bloquea** con un mensaje que nombra el producto y las piezas faltantes. Nunca se deja stock negativo.
- **Los precios no se revierten.** Crear una entrada actualiza `productos.precio_*` y escribe en `precios_historico`; borrarla o editarla deja esos precios intactos. Se corrigen desde el producto si hace falta.
- **Movimientos de stock compensatorios**: cada reversión escribe su fila en `stock_movimientos`, igual que hace hoy el borrado de detalles de venta. `v_stock_inconsistencias` debe seguir limpio después de cualquier borrado o edición.
- **BREAKING (interno)**: `fn_generar_folio_entrada` genera el folio con `COUNT(*) + 1` contra una columna `UNIQUE`. En cuanto exista un hueco por borrado, el siguiente alta falla con folio duplicado (23505). Se sustituye por una generación tolerante a huecos. Los folios ya emitidos no cambian.

### Vendedores

- **Desactivar y reactivar** un vendedor escribiendo `activo`. Solo administrador; un administrador no puede desactivarse a sí mismo.
- **BREAKING (comportamiento)**: `activo = false` pasa a **negar el acceso**. Hoy la columna no hace nada; a partir de este cambio se comprueba al iniciar sesión y en la sesión ya abierta. Todos los vendedores existentes tienen `activo = true`, así que nadie pierde acceso al desplegar.
- Un vendedor inactivo **desaparece de los selectores** (ventas, seguimiento de cobranza) pero sigue visible en la lista de vendedores y en todo su historial.
- **Eliminar definitivamente** un perfil, junto con su usuario de acceso, **solo cuando no tiene ningún registro asociado**. Seis tablas apuntan a `vendedores` sin `ON DELETE` (cinco de ellas `NOT NULL`), y otras cinco columnas apuntan a su `auth.users`; con un solo registro en cualquiera de ellas el borrado es imposible y la acción se bloquea explicando qué lo impide. Desactivar es la vía normal; borrar es para un perfil creado por error.
- **Las dos acciones se ejecutan en el servidor** con verificación de rol, como ya hacen el alta de vendedor y el reseteo de contraseña. Hoy la política RLS de `UPDATE` sobre `vendedores` permite a cualquier usuario autenticado modificar cualquier perfil, incluido ascenderse a `admin`; este cambio cierra esa puerta para las operaciones que introduce.

## Capabilities

### New Capabilities

- `entradas`: registro de entradas de inventario — su corrección y eliminación, y el efecto de ambas sobre el stock, los movimientos y el folio.
- `vendedores`: perfiles de vendedor — su baja lógica, el efecto de la baja sobre el acceso y la visibilidad, y su eliminación definitiva.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío; estas son las dos primeras capacidades especificadas.

## Impact

**Base de datos** (`supabase/migrations/`)
- `fn_generar_folio_entrada`: reemplazo de `COUNT(*) + 1`.
- Nuevo trigger espejo `AFTER DELETE ON entradas_detalle`, análogo a `trg_stock_venta_delete` (`20260713000001`), que repone/descuenta stock y escribe el movimiento.
- Función(es) para eliminar y editar una entrada de forma atómica, con la guardia de stock y la verificación de rol — siguiendo el precedente de `fn_crear_producto_derivado` (`20260905000001`).
- Políticas RLS sobre `vendedores` para las operaciones nuevas.
- Sin columnas nuevas, así que `restore_database` (que enumera columnas explícitamente) no se toca.

**Aplicación**
- `src/hooks/useEntradas.ts`: mutaciones `update` y `remove`.
- `src/app/(dashboard)/entradas/[id]/page.tsx` y una vista de edición; hoy el detalle es de solo lectura y la lista no tiene columna de acciones.
- `src/lib/validations/entrada.schema.ts`.
- `src/hooks/useVendedores.ts`: mutaciones de desactivar, reactivar y eliminar.
- Nueva ruta de API bajo `src/app/api/vendedores/[id]/`.
- `src/app/(dashboard)/vendedores/page.tsx` y `[id]/page.tsx`: acciones sobre el badge de estado.
- `src/app/(auth)/login/page.tsx`, `src/hooks/useVendedorActual.ts`, `src/app/(dashboard)/layout.tsx`: comprobación de `activo`.
- `src/app/(dashboard)/ventas/page.tsx` y `seguimiento-cobranza/page.tsx`: filtrado de vendedores inactivos en los selectores.

**Riesgo principal**: el stock es dinero. Toda reversión tiene que dejar `productos.stock_actual` y `stock_movimientos` en el mismo estado que si la entrada nunca hubiera existido.
