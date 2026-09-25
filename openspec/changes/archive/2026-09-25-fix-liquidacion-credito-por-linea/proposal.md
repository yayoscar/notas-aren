## Why

Se liquidó el saldo de un cliente desde Cobranza. El cliente desapareció de cobranza, como debe ser, pero su historial de compras sigue mostrando la venta `V-20260706-PQCW` como **«Crédito activo»** con **$400.00 pendientes** sobre un total de $600.00.

La causa: cuando se cobra desde Cobranza, el pago se registra contra la **línea de crédito** del cliente y `pagos.venta_id` queda nulo. El trigger `trg_liquidacion_credito` (`20260319000006`) resuelve todo a partir de `NEW.venta_id`: con un pago de línea, su primer `SELECT ... WHERE id = NULL` no encuentra nada y la función termina sin hacer nada. De ahí salen los dos síntomas:

- `ventas.estado_credito` se queda en `'activo'` para siempre, y el badge lo repite.
- El historial calcula el pendiente como `venta.total − SUM(pagos WHERE pagos.venta_id = venta.id)`, que ignora todo lo abonado a la línea.

Es una migración a medias: cuando el crédito pasó de vivir por venta a vivir en `lineas_credito` (`20260328000001`), el detalle de venta se adaptó —ya calcula el pendiente desde la línea— pero el historial del cliente, el listado de ventas y los reportes se quedaron leyendo `ventas.estado_credito`.

El mismo trigger muerto arrastra un segundo fallo, de inventario y no de pantalla: **es el único lugar que descuenta stock en las ventas a crédito con «entrega al liquidar»**. `fn_actualizar_stock_venta` las excluye deliberadamente al registrarlas, esperando que el descuento ocurra al liquidar. Si se cobran desde Cobranza, ese descuento no ocurre nunca y la mercancía sale del local sin bajar del inventario.

## What Changes

- **El historial de compras del cliente dice la verdad.** El estado y el saldo pendiente de una venta a crédito se derivan de su línea de crédito, no de la columna obsoleta. Cuando la línea está liquidada, la venta aparece como pagada y sin pendiente.
- **El saldo pendiente por compra se reparte por antigüedad.** Una línea agrupa todas las compras a crédito del cliente, así que lo abonado se imputa de la compra más antigua a la más reciente. Cada renglón muestra su propio pendiente y la suma de los renglones cuadra con el pendiente de la línea.
- **`ventas.estado_credito` vuelve a mantenerse al día.** Un pago que salda la línea marca como liquidadas todas las ventas que cuelgan de ella, venga el pago atado a una venta o no. La columna sigue alimentando el listado de ventas, el detalle de venta y el reporte de créditos activos contra liquidados, que hoy cuentan mal.
- **El inventario retenido se descuenta al liquidar, sin importar por dónde entre el pago.** Una venta a crédito con «entrega al liquidar» descuenta su stock y deja su movimiento cuando el crédito queda saldado.
- **Se reparan los datos ya existentes.** Una migración recorre las ventas a crédito cuyo crédito ya está saldado y las marca como liquidadas. Sin esto, la venta de la captura y sus compañeras seguirían mintiendo aunque el código nuevo esté bien.
- **No se descuenta stock retroactivamente.** La reparación de datos corrige estados; no toca existencias. Un descuento de inventario con fecha de hoy por una entrega de hace meses descuadraría el inventario en lugar de arreglarlo. Las ventas afectadas se listan para que se ajusten a mano si procede.

## Capabilities

### New Capabilities

- `credito`: el ciclo de vida del crédito de un cliente — la línea de crédito, los abonos, la liquidación, y qué le ocurre al estado de cada venta y a la mercancía retenida cuando el crédito queda saldado.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío; esta es la primera especificación de esta capacidad.

## Impact

**Base de datos** (`supabase/migrations/`)

- `fn_verificar_liquidacion_credito` / `trg_liquidacion_credito`: hoy sólo reaccionan a pagos con venta. Tienen que reaccionar también a los pagos de línea.
- Migración de reparación de `ventas.estado_credito`, idempotente y acotada a las ventas cuyo crédito está efectivamente saldado.
- Las migraciones se aplican a mano (`npm run db:push-prod`), así que el arreglo no llega a producción por el deploy de Vercel.

**Aplicación**

- `src/hooks/useVentas.ts` (`useVentasCliente`): es donde se calcula el pendiente por venta.
- `src/app/(dashboard)/clientes/[id]/page.tsx`: la pestaña Historial, el síntoma reportado.
- `src/hooks/usePagos.ts`: registra el abono y liquida la línea.
- `src/app/(dashboard)/ventas/[id]/page.tsx` y `src/app/(dashboard)/ventas/page.tsx`: badges que leen `estado_credito`.
- `src/hooks/useReportes.ts`: el conteo de créditos activos contra liquidados.

**Riesgo principal**: el descuento de stock al liquidar no puede ejecutarse dos veces para la misma venta. Hoy la protección era implícita —el trigger sólo corría una vez, cuando el abono final traía la venta— y al abrirlo a los pagos de línea deja de serlo.
