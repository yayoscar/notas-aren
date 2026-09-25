## Context

Ver `proposal.md` — Why. Los requisitos están en `specs/credito/spec.md`.

El estado actual del modelo, que es lo que condiciona todo:

- **Una línea de crédito por cliente, que agrupa todas sus compras a crédito.** `idx_linea_credito_activa` es un índice único parcial sobre `cliente_id WHERE estado = 'activa'`. Al registrar una venta a crédito, `useVentas` suma el total de la venta al `saldo_total` de la línea activa, o crea una línea nueva. Por tanto `linea.saldo_total` equivale a la suma de los totales de sus ventas.
- **Los abonos se registran contra la línea.** `usePagos` inserta el pago con `linea_credito_id` y `venta_id` opcional —nulo cuando se cobra desde Cobranza, que es el caso normal—, actualiza `saldo_pagado` y marca la línea como `liquidada` si el saldo queda cubierto.
- **`trg_liquidacion_credito` (`AFTER INSERT ON pagos`) resuelve todo desde `NEW.venta_id`.** Con un pago de línea, `SELECT ... FROM ventas WHERE id = NULL` no devuelve fila y la función sale sin hacer nada. Es el origen de los dos síntomas.
- **`fn_actualizar_stock_venta` excluye a propósito** las ventas `credito` con `entrega_despues_pago = true`: no descuenta al registrar, esperando que lo haga el trigger de liquidación. Al estar muerto ese trigger, esas ventas no descuentan nunca.
- **El detalle de venta ya está medio migrado.** `ventas/[id]/page.tsx` calcula `lineaSaldoPendiente` desde la línea para el importe, pero sigue leyendo `venta.estado_credito` para el badge y para decidir si se puede abonar. El historial del cliente y el listado de ventas no se migraron en absoluto.
- **`ventas.estado_credito` lo escribe más de un flujo**: el trigger de pagos, `useDevolucionUnificada` y la migración de datos `20260328000002`. No es una columna que se pueda ignorar ni retirar sin tocar bastantes sitios.
- **Las migraciones se aplican a mano** (`npm run db:push-prod`); deben ser idempotentes.

## Goals / Non-Goals

**Goals:**

- Que la regla de reparto exista **una sola vez**. Es la trampa evidente de este cambio: el trigger que marca las ventas y la pantalla que muestra los importes tienen que repartir igual, o volvemos a tener dos verdades como ahora.
- Que la sincronización no dependa de por dónde entre el pago, porque ese es exactamente el fallo que se está corrigiendo.
- Que el descuento de inventario retenido no pueda ocurrir dos veces.
- Reparar los datos existentes sin inventar movimientos de inventario con fecha de hoy.

**Non-Goals:**

- Retirar `ventas.estado_credito` y derivar todo al vuelo. Es la solución limpia a largo plazo, pero la columna la leen y la escriben media docena de sitios y la persiste la restauración de respaldos.
- Terminar la migración a líneas de crédito en las pantallas que aún no la usan más allá de lo que exige el spec.
- Cambiar cómo Cobranza decide a quién cobrar. Esa parte funciona: el cliente sí desapareció.
- Ajustar el inventario de las ventas con entrega retenida que quedaron sin descontar. Se identifican, no se corrigen solas.

## Decisions

### D1 — La regla de reparto vive en una vista de Postgres, y la usan todos

Se crea una vista que expone, por cada venta a crédito, cuánto se le ha imputado, cuánto le queda y si está saldada. La imputación es: tomar `saldo_pagado` de la línea y repartirlo entre sus ventas ordenadas por fecha, de la más antigua a la más reciente.

La consultan los tres consumidores: el historial del cliente para los importes, el trigger de sincronización para decidir qué ventas marcar, y la migración de reparación. Es lo único que evita que el badge y el importe vuelvan a discrepar.

Para una venta sin línea —las anteriores a `20260328000001`— la vista imputa desde `pagos WHERE venta_id = v.id`, que es el comportamiento viejo. Así la vista sirve para todas las ventas y no hay dos caminos en el cliente.

*Alternativa descartada*: repartir en TypeScript dentro de `useVentasCliente` y otra vez en SQL dentro del trigger. Es menos infraestructura, y es literalmente el error que produjo este bug: dos sitios calculando lo mismo, uno de ellos desactualizado.

### D2 — La sincronización cuelga de `lineas_credito`, no de `pagos`

El trigger nuevo es `AFTER UPDATE ON lineas_credito`: cuando cambia `saldo_pagado` o `saldo_total`, recalcula qué ventas de esa línea quedan saldadas y las marca.

Colgarlo de la línea y no del pago es lo que hace que funcione «venga el pago por donde venga»: no son sólo los abonos los que mueven una línea, también las devoluciones (`useDevolucionUnificada`) y la importación. Todas pasan por un `UPDATE` sobre `lineas_credito`.

`trg_liquidacion_credito` se conserva para las ventas sin línea, que siguen dependiendo de él. Los dos no se pisan: ambos actúan sólo sobre ventas con `estado_credito = 'activo'`, así que el primero que llegue hace el trabajo y el segundo no encuentra nada que hacer.

*Alternativa descartada*: arreglar `fn_verificar_liquidacion_credito` para que, cuando `venta_id` sea nulo, resuelva la línea desde `linea_credito_id`. Es el cambio más pequeño, pero sigue atado al pago y deja fuera a las devoluciones y a la importación, que también liquidan líneas.

### D3 — La sincronización es de un solo sentido: `activo → liquidado`, nunca al revés

El trigger sólo promueve. Nunca devuelve una venta a `activo`.

Hace falta porque hay ventas que se liquidan por motivos que el reparto no conoce: `useDevolucionUnificada` marca ventas como liquidadas al cancelar o devolver, ajustando el saldo de la línea por su cuenta. Si el trigger pudiera revertir, desharía esas decisiones en el siguiente abono.

Por simetría, la vista trata `estado_credito = 'liquidado'` como palabra final: una venta ya liquidada aparece con saldo pendiente cero aunque el reparto no la cubriera.

*Limitación aceptada*: en una línea donde una devolución liquidó una venta sin retirar su total del `saldo_total`, la suma de los renglones puede no cuadrar exactamente con el pendiente de la línea. Es preferible a que el historial contradiga a la devolución.

### D4 — El descuento de inventario se engancha a la transición, no al estado

El mismo trigger que marca una venta como liquidada descuenta, en ese mismo momento, el stock de las ventas con `entrega_despues_pago`. La garantía de que no ocurre dos veces es la propia transición: el `UPDATE` lleva `WHERE estado_credito = 'activo'`, así que la segunda vez no hay filas que tocar y no hay descuento.

Como red de seguridad se comprueba además que no exista ya un movimiento `SALIDA_VENTA` para esa venta. Es barato y protege de cualquier camino que marque la venta a mano.

### D5 — La reparación de datos corrige estados y no toca existencias

La migración marca como liquidadas las ventas que la vista da por saldadas. Es idempotente por construcción: opera sobre las que siguen en `'activo'`.

No descuenta inventario. Una venta con entrega retenida que se liquidó hace meses y nunca descontó ya salió físicamente del local; registrar hoy su salida movería el inventario en la fecha equivocada y ensuciaría el arqueo del mes en curso. La migración deja constancia de cuáles son —vía el reporte de la tarea correspondiente— para que se ajusten a mano si procede.

*Riesgo*: la migración corre en producción **antes** de que el trigger exista, o después. Si corre después, el trigger ya habrá marcado lo que tocaba en el primer abono posterior, y la migración sólo limpiará el resto. Cualquiera de los dos órdenes funciona; el plan las ordena por claridad, no por necesidad.

## Risks / Trade-offs

- **`ventas.estado_credito` pasa a ser una caché de algo derivado** → la vista sigue siendo la verdad y la migración de reparación es reejecutable, así que cualquier deriva se corrige volviéndola a aplicar.
- **El trigger sobre `lineas_credito` corre en cada actualización de una línea**, incluido el alta de cada venta a crédito → el trabajo se acota con `WHERE estado_credito = 'activo'` sobre las ventas de esa línea, que son pocas.
- **Descontar stock dentro de un trigger de `lineas_credito`** hace que un abono pueda fallar por un problema de inventario → aceptado: es exactamente lo que ya hacía `trg_liquidacion_credito` para las ventas con línea nula, y es preferible a entregar mercancía sin registrarla.
- **La vista añade una dependencia entre el historial y el esquema de crédito** → si `lineas_credito` cambia, la vista hay que revisarla; `npm run db:check-drift` compara vistas y funciones entre local y producción.
- **Producción se migra a mano** → migraciones idempotentes y respaldo desde `/configuracion/respaldo` antes del push, como indica el README.
- **Hay un cambio pendiente sin archivar** (`add-borrado-entradas-y-vendedores`) con cinco migraciones ya escritas y sin desplegar → las migraciones de este cambio van detrás en el orden de fechas; conviene decidir en qué orden se despliegan los dos.

## Migration Plan

1. Vista de imputación por venta.
2. Trigger `AFTER UPDATE ON lineas_credito` con la sincronización y el descuento de inventario retenido.
3. Migración de reparación de `ventas.estado_credito`.

Verificación en local antes de tocar producción, sobre la copia de datos reales: reproducir el caso reportado —una venta a crédito con un abono de línea que la salda— y comprobar que el historial deja de mostrar «Crédito activo». Después `npm run db:check-drift` y `npm run db:pending-prod`.

**Rollback**: los pasos 1 y 2 se deshacen borrando la vista y el trigger, con lo que el sistema vuelve a comportarse como hoy. El paso 3 no se revierte: marca como liquidado lo que ya estaba liquidado de hecho.

## Open Questions

- Si el reporte de créditos activos contra liquidados y el listado de ventas deben pasar a leer la vista en lugar de la columna. Con la columna sincronizada dan el resultado correcto, así que es una decisión de limpieza que puede tomarse después sin cambiar el contrato.
- Si conviene que una línea liquidada vuelva a `activa` cuando se le suma una compra nueva. Hoy `useVentas` actualiza el `saldo_total` sin tocar el `estado`, pero como sólo ofrece líneas activas, en la práctica se crea una línea nueva. Es independiente de este arreglo.
