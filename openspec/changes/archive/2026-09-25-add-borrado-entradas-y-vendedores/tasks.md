## 1. Base de datos — entradas

- [x] 1.1 Migración: trigger `AFTER DELETE ON entradas_detalle` espejo de `fn_actualizar_stock_entrada`, que descuenta `productos.stock_actual` y asienta un movimiento `AJUSTE_NEGATIVO`; aborta con `RAISE EXCEPTION` si la existencia fuera a quedar negativa. Tomar como plantilla `20260713000001_create_stock_venta_delete_trigger.sql`
- [x] 1.2 Migración: reemplazar `fn_generar_folio_entrada` por la versión `MAX + 1` sobre los folios del año en curso (D5)
- [x] 1.3 Verificar en local que borrar una fila de `entradas_detalle` a mano repone el stock y deja `v_stock_inconsistencias` vacía
- [x] 1.4 Verificar en local que, con un hueco en la numeración, un alta nueva de entrada no falla y no reasigna folios existentes
- [x] 1.5 Migración: función de eliminación de entrada (`SECURITY DEFINER`) que verifica rol admin, comprueba la suficiencia de existencias de **todas** las líneas antes de borrar nada, y borra la entrada dejando que el trigger de 1.1 mueva el stock. El mensaje de error nombra producto, piezas a revertir y piezas disponibles
- [x] 1.6 Migración: función de edición de entrada (`SECURITY DEFINER`) que verifica rol admin, actualiza la cabecera, borra y reinserta las líneas —apoyándose en los triggers para la simetría de stock (D2)—, recalcula el total y conserva el folio
- [x] 1.7 Verificar que ninguna de las dos funciones escribe `productos.stock_actual` directamente
- [x] 1.8 Migración no prevista en el plan: helper `fn_es_admin()` y políticas RLS por verbo sobre `entradas` y `entradas_detalle`, que restringen UPDATE y DELETE a administradores. Sin esto el rechazo a un vendedor vivía sólo dentro de la función y un `DELETE` directo desde el navegador pasaba

## 2. Aplicación — entradas

- [x] 2.1 Ampliar `src/lib/validations/entrada.schema.ts` con el esquema de edición
- [x] 2.2 Añadir las mutaciones `update` y `remove` a `src/hooks/useEntradas.ts`, llamando a las funciones de 1.5 y 1.6, con invalidación de las consultas de entradas, productos y movimientos de stock
- [x] 2.3 Superficie de edición de una entrada en ruta propia `/entradas/[id]/editar`. **No reutiliza el formulario de `entradas/nueva`**: ese formulario está entretejido con la cola de diálogos de cambio de precio y con los campos de precio de venta por línea, que la edición no debe tener (D4). Extraerlo con un modo habría atravesado ~200 líneas del alta, la ruta de escritura más delicada del módulo. Se duplica el maquetado de la tabla de líneas a cambio de no tocar el alta
- [x] 2.4 Botón de eliminar en el detalle de la entrada, con `ConfirmDeleteDialog`; el texto advierte que no se puede deshacer y que los precios del producto no se revierten (D4)
- [x] 2.5 Accesos a editar y eliminar desde la lista de entradas, que hoy no tiene columna de acciones
- [x] 2.6 Propagar el mensaje de bloqueo por existencias insuficientes tal cual llega de la base, sin reemplazarlo por un texto genérico

## 3. Base de datos — vendedores

- [x] 3.1 Migración: trigger `BEFORE UPDATE ON vendedores` que rechaza cambios en `rol`, `activo`, `usuario` y `auth_user_id` salvo que el autor sea el servidor (`auth.uid() IS NULL`) o un administrador, dejando pasar la autoedición de `debe_cambiar_password` (D7)
- [x] 3.2 Migración: política `FOR DELETE` sobre `vendedores` restringida a administradores, idempotente (`DROP POLICY IF EXISTS` antes del `CREATE`)
- [x] 3.3 Verificar en local que un vendedor no puede ascenderse a `admin` ni reactivarse escribiendo directo a la tabla, y que el cambio de contraseña propio sigue funcionando

## 4. Servidor — vendedores

- [x] 4.1 Extraer a un helper compartido la verificación de sesión y rol admin que hoy está repetida en las cuatro rutas de API
- [x] 4.2 Reescribir sobre el helper `api/vendedores/route.ts`, `api/vendedores/[id]/reset-password/route.ts`, `api/configuracion/backup/route.ts` y `api/configuracion/restore/route.ts`, sin cambiar su comportamiento
- [x] 4.3 Crear `src/app/api/vendedores/[id]/route.ts` con `PATCH` para activar y desactivar, que rechaza que un administrador se desactive a sí mismo
- [x] 4.4 En el `PATCH` de desactivación, inhabilitar además el usuario de acceso en el proveedor de identidad para que su token no pueda renovarse; confirmar antes la capacidad contra la versión instalada de `@supabase/supabase-js` y, si no está disponible, dejar constancia y seguir con las capas 1 y 2 de D8
- [x] 4.5 Añadir `DELETE` a esa misma ruta: verifica admin, rechaza el autoborrado, cuenta los registros asociados en las seis tablas que referencian `vendedores` y en `clientes.usuario_id`, `entradas.usuario_id`, `stock_movimientos.usuario_id` y `precios_historico.usuario_id`, y responde 409 con el desglose por tipo y cantidad si hay alguno
- [x] 4.6 Completar el `DELETE`: borra el perfil y después el usuario de acceso, en ese orden por la clave foránea (D9)

## 5. Aplicación — vendedores

- [x] 5.1 Añadir las mutaciones de desactivar, reactivar y eliminar a `src/hooks/useVendedores.ts`, más `useChequeoEliminacion` y un `GET` en la ruta (no previsto en el plan) para que el diálogo pueda mostrar los bloqueos antes de que el administrador confirme algo que iba a fallar
- [x] 5.2 Acciones de desactivar y reactivar en la lista y el detalle de vendedores, siguiendo el patrón de `cat_tipo_descuento` en `catalogos/page.tsx` (Trash2 cuando está activo, RotateCcw cuando no)
- [x] 5.3 Diálogo de eliminación definitiva con sus tres estados: comprobando, bloqueado con el desglose de registros y la oferta de desactivar, y confirmación. Tomar como referencia `src/components/clientes/EliminarClienteDialog.tsx`
- [x] 5.4 Ocultar a los vendedores inactivos en los selectores de `ventas/page.tsx` y `seguimiento-cobranza/page.tsx`, manteniéndolos visibles en la lista de vendedores y en los registros históricos. **Sin cambios de código**: ambos ya hacían `.filter((v) => v.activo)`; el filtro era inerte porque nada escribía la columna y ahora pasa a tener efecto. Verificado que no hay otros selectores de vendedor

## 6. Revocación de acceso

- [x] 6.1 Comprobar `activo` en `src/app/(auth)/login/page.tsx` tras autenticar: cerrar sesión y mostrar que la cuenta está desactivada, distinto del mensaje de credenciales inválidas
- [x] 6.2 Comprobar `activo` en `src/lib/supabase/middleware.ts` y redirigir a login
- [x] 6.3 Corregir el guardia de `src/app/(dashboard)/layout.tsx` para que deniegue el acceso cuando no existe perfil de vendedor, en lugar del `return` actual (D9)
- [x] 6.4 Exponer `activo` en `src/hooks/useVendedorActual.ts` para el resto de la interfaz

## 7. Verificación

- [x] 7.1 Recorrer los escenarios de `specs/entradas/spec.md`: editar al alza y a la baja, quitar y añadir líneas, solo cabecera, bloqueo por existencias, folio tras borrar, y que el precio del producto no cambie
- [x] 7.2 Recorrer los escenarios de `specs/vendedores/spec.md`: desactivar, reactivar, login denegado, sesión abierta expulsada, autodesactivación rechazada, borrado bloqueado con registros y borrado limpio sin ellos
- [x] 7.3 Comprobar `v_stock_inconsistencias` vacía después de cada operación de entrada
- [x] 7.4 Probar las dos rutas de API con un usuario sin rol admin y sin sesión, saltándose la interfaz. Con sesión de vendedor: 403 en las cuatro rutas. Sin sesión: 307 a login, porque el middleware intercepta antes que el manejador — comportamiento previo, no introducido aquí, pero significa que una ruta de API nunca llega a devolver su 401 en JSON
- [x] 7.5 Validación de las migraciones **sin** `db:reset` ni `db:pull-prod`: esos dos comandos habrían borrado la copia de producción que ya había en la base local, y si `db:pull-prod` fallaba te dejaban sin datos. En su lugar: (a) las cinco migraciones se aplicaron dos veces seguidas sobre la base local sin error — la idempotencia es lo que importa para el push manual a producción; (b) las 60+ migraciones se aplicaron desde cero en una base desechable, sin fallos; (c) todas las pruebas funcionales de arriba corrieron sobre los datos reales que ya tenías en local
- [x] 7.6 `npm run lint` y `npm run build`
- [x] 7.7 `npm run db:pending-prod` lista exactamente las cinco migraciones nuevas y nada más. `npm run db:check-drift` señala esos mismos objetos como pendientes de desplegar, y marca como «falta una migración en el repo» la política `Authenticated full access` y el cuerpo viejo de `fn_generar_folio_entrada`: son los objetos que este cambio sustituye, no una migración que falte. **No se ha hecho ningún push a producción**
