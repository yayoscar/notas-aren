## Context

Ver `proposal.md` — Why. Los requisitos están en `specs/entradas/spec.md` y `specs/vendedores/spec.md`.

Restricciones del código actual que condicionan el enfoque:

- **Todo el I/O de entradas va del navegador a Postgres** con el cliente de Supabase. No hay ninguna ruta de API para entradas. El único control de acceso es la redirección del `useEffect` en `src/app/(dashboard)/layout.tsx`; la política RLS es `FOR ALL USING (auth.role() = 'authenticated')`, o sea que a nivel de base **cualquier usuario autenticado ya puede borrar entradas**.
- **El stock de una entrada lo mueve un trigger `AFTER INSERT` sobre `entradas_detalle`**, sin espejo para DELETE. Ventas sí tiene el suyo (`trg_stock_venta_delete`, migración `20260713000001`), añadido precisamente porque editar una venta borra y reinserta detalles; el comentario de esa migración documenta el doble descuento que causó no tenerlo.
- **`fn_generar_folio_entrada` usa `COUNT(*) + 1`** contra una columna `UNIQUE`.
- **`total` se calcula en el cliente** (`useEntradas.ts`), no por trigger.
- **`entradas.usuario_id` nunca se escribe**: todas las filas lo tienen en `NULL`. No hay noción de propietario de una entrada.
- **`vendedores` tiene RLS `FOR UPDATE USING (true) WITH CHECK (true)`** y ninguna política `FOR DELETE`. Hoy cualquier autenticado puede modificar cualquier perfil, incluido ascenderse a `admin`.
- **Seis tablas referencian `vendedores` sin `ON DELETE`**; cinco de esas columnas son `NOT NULL`. Además `vendedores.auth_user_id` referencia `auth.users` sin `ON DELETE`, y otras cinco columnas de negocio (`clientes.usuario_id`, `entradas.usuario_id`, `stock_movimientos.usuario_id`, `precios_historico.usuario_id`) apuntan también a `auth.users`.
- **`supabase/seed.sql` hace `GRANT ALL ON ALL TABLES`** al resetear la base local. Cualquier permiso revocado por migración quedaría restituido en local, haciendo divergir local de producción.
- **La comprobación de rol admin en servidor está duplicada en cuatro rutas de API**, sin helper compartido.
- **Las migraciones se aplican a mano** (`npm run db:push-prod`); el deploy de Vercel no las corre. Deben escribirse idempotentes.

## Goals / Non-Goals

**Goals:**

- Que revertir stock sea una operación atómica y verificada: comprobar suficiencia y restar dentro de la misma transacción.
- Que la simetría entrada/reversión la garantice la base de datos, no el código de la aplicación, igual que en ventas.
- Que las operaciones privilegiadas nuevas no dependan de esconder un botón.
- Cambio mínimo de esquema: ninguna columna ni tabla nueva, para no tocar `restore_database` ni el respaldo.

**Non-Goals:**

- Rehacer el modelo de permisos de la aplicación. El resto de la app sigue autorizándose en el cliente; este cambio no lo corrige salvo donde lo introduce.
- Bitácora de auditoría de entradas equivalente a `ventas_historial`. El rastro de una edición o un borrado queda en `stock_movimientos`, no en una tabla de historial propia.
- Reversión de precios. Decidido conservarlos (ver Decisiones).
- Reasignar el trabajo de un vendedor a otro para poder borrarlo.

## Decisions

### D1 — La eliminación y la edición de una entrada se ejecutan en una función de Postgres, no desde el cliente

La guardia «¿hay existencias suficientes?» seguida de «réstalas» tiene que ser indivisible: entre la lectura y la escritura puede colarse una venta. Desde el navegador son dos viajes separados.

Se añaden funciones que hacen la comprobación, la mutación y la verificación de rol en una sola transacción.

*Corregido al implementar*: quedaron como `SECURITY INVOKER` (el modo por defecto, el mismo de `fn_crear_producto_derivado`) y no `SECURITY DEFINER`. Con invocador basta, y además obliga a que el permiso real viva en las políticas RLS de `entradas`, que es donde de verdad se aplica: la comprobación dentro de la función sólo sirve para dar un mensaje legible. Sin las políticas, un `DELETE` directo desde el navegador habría pasado por encima de la función. La única `SECURITY DEFINER` es `fn_es_admin()`, que se usa dentro de políticas. Precedente directo en el repo: `fn_crear_producto_derivado` (`20260905000001`) y el commit `40a9374` «crear derivados de forma atómica», que resolvió exactamente este problema para otro flujo.

*Alternativa descartada*: replicar el patrón de `updateVenta` (borrar detalles y reinsertarlos desde el cliente, confiando en los triggers). Funciona para el stock, pero deja la validación de suficiencia y la de rol fuera de la transacción y sin forma de imponerlas.

### D2 — El stock lo mueve un trigger espejo `AFTER DELETE ON entradas_detalle`; la función solo valida antes

Un único punto escribe existencias. La función comprueba la suficiencia de todas las líneas **antes** de borrar nada y aborta con un mensaje legible si alguna falla; el trigger hace la reversión y asienta el movimiento. La función nunca toca `productos.stock_actual` directamente, para no repetir el doble descuento que documenta `20260713000001`.

El trigger lleva además su propia `RAISE EXCEPTION` si la existencia fuera a quedar negativa: red de seguridad para cualquier borrado que llegue por otra vía (cascada, script, restauración).

Como efecto secundario, **editar una entrada se implementa reescribiendo líneas**, en la línea de `updateVenta`: los dos triggers se compensan solos y no hay que calcular diferencias de stock por producto.

*Corregido al implementar*: reescribir **todas** las líneas daba el stock correcto pero incumplía el escenario «cambiar sólo datos de cabecera», que exige que los movimientos no cambien. Cada línea intacta dejaba un `AJUSTE_NEGATIVO` y un `ENTRADA_COMPRA` que se anulaban entre sí, ensuciando el historial. La función empareja línea a línea por `(producto_id, cantidad, precio_unitario)` y sólo toca las que difieren. El orden insertar-antes-de-borrar se mantiene por la misma razón de siempre.

*Alternativa descartada*: calcular el delta por producto en la función. Más código, y una segunda implementación de la aritmética de stock que puede divergir de los triggers.

### D3 — Los movimientos de stock son un libro de solo agregar

La reversión escribe un movimiento nuevo (`AJUSTE_NEGATIVO`, con `referencia_tipo` propio para eliminación y para edición) en lugar de borrar el `ENTRADA_COMPRA` original. Es lo que hace `trg_stock_venta_delete` al reponer con `AJUSTE_POSITIVO`, y mantiene cuadrada la vista `v_stock_inconsistencias`, que suma movimientos.

Consecuencia aceptada: la fila `ENTRADA_COMPRA` conserva un `referencia_id` que apunta a una entrada que ya no existe. `stock_movimientos.referencia_id` no tiene clave foránea y **ningún punto de la aplicación lo resuelve contra `entradas`** (solo se escribe), así que no rompe nada hoy. Queda anotado como riesgo para quien añada esa vista mañana.

### D4 — Los precios no se revierten

Decisión del usuario. Crear una entrada escribe en `precios_historico` y pisa `productos.precio_*`, pero esas filas **no guardan `entrada_id`**: revertirlas exigiría una columna nueva, y con ella tocar `restore_database`, que enumera columnas explícitamente.

Consecuencia aceptada y visible: tras eliminar una entrada, el precio de compra del producto puede seguir reflejando una compra que ya no existe. Se corrige desde la ficha del producto.

### D5 — El folio pasa a `MAX + 1` sobre los folios del año

`COUNT(*) + 1` reutiliza un número en cuanto hay un hueco y choca contra el `UNIQUE`. `MAX + 1` tolera huecos intermedios y no renumera nada.

Consecuencia aceptada: si se elimina la **última** entrada del año, su folio vuelve a emitirse. Para un sistema donde el borrado existe para corregir una captura equivocada, recuperar el folio que se esperaba es razonable.

*Alternativa descartada*: una tabla contador que solo incrementa, que garantizaría no reutilizar jamás. Obliga a una tabla nueva y, con ella, a meterla en la lista de respaldo y en las columnas explícitas de `restore_database` — infraestructura sensible a cambio de una garantía que aquí no se necesita. Si algún día la auditoría la exige, esta es la vía.

La concurrencia no mejora ni empeora: dos altas simultáneas pueden seguir chocando contra el `UNIQUE`, igual que hoy. El mismo defecto vive en `fn_generar_folio_venta`, pero ventas no admite borrado y queda fuera de alcance.

### D6 — Las bajas de vendedor se ejecutan desde una ruta de API con clave de servicio

Es el patrón que ya usan el alta de vendedor, el reseteo de contraseña y las dos rutas de configuración: verificar sesión, leer `rol` del vendedor y responder 403 si no es `admin`. Se añade `PATCH` y `DELETE` sobre `src/app/api/vendedores/[id]/`, que hoy no existe.

Dado que la comprobación se repetiría por sexta vez, se extrae a un helper compartido y se reescriben las cuatro rutas existentes sobre él.

### D7 — Un trigger `BEFORE UPDATE` sobre `vendedores` protege `rol`, `activo`, `usuario` y `auth_user_id`

La ruta de API no basta: la política RLS deja que cualquier autenticado escriba esas columnas directamente desde el navegador. El trigger rechaza el cambio salvo que lo haga el servidor (`auth.uid()` es `NULL` bajo la clave de servicio) o un administrador.

El trigger tiene que dejar pasar el caso legítimo de autoedición que ya existe: `src/app/(auth)/cambiar-password/page.tsx` limpia `debe_cambiar_password` sobre la propia fila. Por eso protege columnas concretas en lugar de bloquear la actualización entera.

*Alternativa descartada*: `REVOKE UPDATE (rol, activo, ...) ON vendedores FROM authenticated`, que es la herramienta idiomática de Postgres. Queda anulada por el `GRANT ALL ON ALL TABLES` de `supabase/seed.sql` en cada `db:reset`, con lo que local y producción se comportarían distinto — precisamente el fallo que `npm run db:check-drift` existe para cazar.

Se añade también la política `FOR DELETE` que hoy falta, restringida a administradores.

### D8 — La desactivación revoca el acceso en tres capas

Marcar `activo = false` en una tabla no cierra ninguna sesión por sí solo. Se combinan:

1. **Al iniciar sesión**: tras autenticar se lee `activo`; si es falso se cierra la sesión y el mensaje dice que la cuenta está desactivada, no que las credenciales fallan.
2. **En el middleware**: `src/lib/supabase/middleware.ts` ya llama a `getUser()` en cada petición; se añade la lectura de `activo` y la redirección a login. Esto corta el acceso a las páginas de inmediato, sin esperar a que caduque el token.
3. **En el proveedor de identidad**: al desactivar, la ruta de API inhabilita también el usuario de acceso, de modo que su token no pueda renovarse.

*Trade-off*: el punto 2 añade una consulta por petición al middleware, que ya hacía una llamada de red. Para una aplicación interna de este tamaño es aceptable; si pesara, se puede replegar al `useEffect` del layout, a costa de que la revocación solo actúe al navegar.

*Riesgo residual*: entre la desactivación y la caducidad del token de acceso, una petición construida a mano contra la API de Supabase sigue pasando el RLS, que solo exige `authenticated`. Es la misma limitación que ya tiene el control de rol de toda la app; cerrarla del todo exigiría llevar `activo` a las políticas RLS de cada tabla, fuera de alcance.

### D9 — Borrar un vendedor se hace en dos pasos, y el orden lo fija la clave foránea

`vendedores.auth_user_id` referencia `auth.users` sin `ON DELETE`, así que hay que borrar primero el perfil y después el usuario de acceso. Son dos sistemas distintos y no comparten transacción.

El modo de fallo peligroso es que el segundo paso falle y quede un usuario de acceso sin perfil. Se neutraliza con una corrección que conviene por sí sola: **hoy el guardia del layout no hace nada cuando no hay perfil** (`if (isLoading || !vendedor) return`). Pasa a denegar el acceso, con lo que un usuario huérfano queda inofensivo y la ruta de API puede reintentar.

Antes de borrar, la ruta cuenta los registros asociados en las seis tablas que referencian `vendedores` y en las cuatro columnas de negocio que referencian su `auth.users`, y responde con el desglose si hay alguno.

*Alternativa descartada*: una función `SECURITY DEFINER` que borre `vendedores` y `auth.users` en una sola transacción. Sería atómica, pero escribir sobre el esquema `auth` desde una migración propia es frágil ante las actualizaciones de Supabase.

## Risks / Trade-offs

- **El stock es dinero: una reversión mal hecha descuadra el inventario** → toda mutación de existencias pasa por los triggers; las pruebas manuales verifican `v_stock_inconsistencias` vacía después de cada operación, y el trigger aborta antes que dejar una existencia negativa.
- **Editar se implementa como borrar y reinsertar líneas** → si el trigger de DELETE fallara o no estuviera desplegado, la edición descontaría sin reponer. La migración del trigger va antes que la función en el orden de despliegue, y `npm run db:check-drift` compara triggers entre local y producción precisamente por esto.
- **Producción se migra a mano** → migraciones idempotentes (`DROP ... IF EXISTS` antes de `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`) y respaldo desde `/configuracion/respaldo` antes del push, como indica el README.
- **El trigger de `vendedores` puede bloquear un flujo legítimo que no previmos** → protege columnas concretas, no la fila entera, y deja pasar explícitamente la autoedición de `debe_cambiar_password`.
- ~~**Inhabilitar el usuario de acceso depende de una capacidad del proveedor de identidad**~~ → confirmado: `ban_duration` existe en `@supabase/auth-js` 2.99.2 y funciona. De hecho actúa antes que la capa 2: el baneo invalida el token, así que `getUser()` del middleware ya devuelve nulo y la redirección sale por la rama de «sin sesión». La comprobación de `activo` del middleware queda como red para los casos en que el baneo no esté en juego (columna en false sin banear, o usuario sin perfil), ambos verificados.
- **Tras borrar una entrada, el precio del producto puede reflejar una compra inexistente** → aceptado en D4; se documenta en el diálogo de confirmación para que quien borra lo sepa.
- **Un `referencia_id` de movimiento puede apuntar a una entrada borrada** → aceptado en D3; hoy nada lo resuelve, pero cualquier vista futura que lo haga debe tolerar la ausencia.

## Migration Plan

Orden de despliegue, cada paso en su propia migración e idempotente:

1. `20260925000001` — trigger espejo `AFTER DELETE ON entradas_detalle` con su guardia de existencia negativa.
2. `20260925000002` — reemplazo de `fn_generar_folio_entrada`.
3. `20260925000003` — helper `fn_es_admin()` y políticas RLS por verbo sobre `entradas` y `entradas_detalle`. **No estaba en el plan original**: sin él la restricción a administradores vivía sólo dentro de las funciones.
4. `20260925000004` — funciones de eliminación y edición de entrada.
5. `20260925000005` — trigger `BEFORE UPDATE` de `vendedores` y política `FOR DELETE`.

Los pasos 1 y 2 siguen siendo correcciones independientes y seguras de aplicar por sí solas: sin ellos el resto es incorrecto, y con ellos y sin el resto el sistema se comporta exactamente como hoy.

Verificación antes de tocar producción: `npm run db:reset`, `npm run db:pull-prod` para trabajar sobre datos reales en local, y `npm run db:check-drift` al terminar. Respaldo desde `/configuracion/respaldo` antes del `db:push-prod`.

**Rollback**: los pasos 1, 3 y 4 se deshacen borrando el trigger, la función o la política. El paso 2 se revierte reponiendo la versión anterior de la función, pero **solo tiene sentido si además no se ha borrado ninguna entrada**: con huecos en la numeración, la versión con `COUNT(*) + 1` vuelve a fallar. En la práctica el paso 2 no se revierte.

## Open Questions

- ~~Si la edición debe ofrecerse como pestaña o como ruta propia.~~ Resuelto al implementar: ruta propia `/entradas/[id]/editar`, con formulario propio. El formulario del alta no se pudo reutilizar porque está entretejido con la cola de diálogos de cambio de precio y con los campos de precio de venta por línea, que la edición no debe tener.
- Si conviene aprovechar la edición para empezar a escribir `entradas.usuario_id`, que hoy siempre queda nulo. Es una mejora independiente y puede decidirse al implementar.
