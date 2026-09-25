## 1. Vista de imputación

- [x] 1.1 Migración: vista que expone por cada venta a crédito su `linea_credito_id`, su total, lo imputado, el saldo pendiente y si está saldada. El reparto toma `lineas_credito.saldo_pagado` y lo distribuye entre las ventas de la línea ordenadas por `fecha` ascendente, excluyendo las canceladas (D1)
- [x] 1.2 En la misma vista, cubrir las ventas sin línea imputando desde `pagos WHERE venta_id = v.id`, que es el comportamiento anterior a `20260328000001`
- [x] 1.3 En la misma vista, tratar `estado_credito = 'liquidado'` como palabra final: saldo pendiente cero aunque el reparto no cubra la venta (D3)
- [x] 1.4 `GRANT SELECT` a `authenticated`, siguiendo lo que hace `v_stock_inconsistencias`. **Además `WITH (security_invoker = true)`**, que no estaba previsto: sin él la vista se saltaba la RLS de las tablas base y `anon` leía los saldos de todos los clientes sin iniciar sesión. Verificado antes y después. `v_stock_inconsistencias` tiene el mismo agujero, pero sólo expone existencias y queda fuera de este cambio
- [x] 1.5 Verificar la vista contra los datos locales: el reparto de una línea con dos ventas, una línea saldada, una venta sin línea, y que la suma de los renglones cuadra con el pendiente de la línea
- [x] 1.6 Numerar la migración por detrás de las cinco de `add-borrado-entradas-y-vendedores`, que están escritas y sin desplegar

## 2. Trigger de sincronización

- [x] 2.1 Migración: trigger `AFTER UPDATE ON lineas_credito` que, cuando cambien `saldo_pagado` o `saldo_total`, marque como liquidadas las ventas de esa línea que la vista da por saldadas. Sólo promueve `activo → liquidado`, nunca al revés (D2, D3)
- [x] 2.2 En el mismo trigger, descontar el stock de las ventas con `entrega_despues_pago` que acaban de pasar a liquidadas, con su movimiento `SALIDA_VENTA`, tomando como plantilla el bloque equivalente de `fn_verificar_liquidacion_credito`
- [x] 2.3 Acotar el descuento con `WHERE estado_credito = 'activo'` —la transición es la única garantía de que ocurre una vez— y añadir la comprobación de que no exista ya un `SALIDA_VENTA` para esa venta (D4)
- [x] 2.4 Dejar `trg_liquidacion_credito` en su sitio, para las ventas sin línea. Verificar que los dos triggers no se solapan: ambos actúan sólo sobre ventas en `'activo'`
- [x] 2.5 Verificar en local: un abono de línea que salda marca todas las ventas de la línea; un abono parcial no marca ninguna; un segundo abono sobre una línea ya saldada no vuelve a descontar stock
- [x] 2.6 Verificar que una devolución que liquida una venta no queda deshecha por el siguiente abono

## 3. Reparación de los datos existentes

- [x] 3.1 Migración idempotente que marque como liquidadas las ventas que la vista da por saldadas y que sigan en `'activo'` (D5)
- [x] 3.2 Comprobar explícitamente que la migración no toca `productos.stock_actual` ni inserta en `stock_movimientos`
- [x] 3.3 Dejar una consulta documentada que liste las ventas con `entrega_despues_pago` liquidadas sin movimiento `SALIDA_VENTA`, para revisarlas a mano. No se ajustan automáticamente
- [x] 3.4 Verificar sobre la copia local de producción cuántas ventas corrige y que ninguna de ellas conserva saldo real

## 4. Historial del cliente

- [x] 4.1 Reescribir `useVentasCliente` (`src/hooks/useVentas.ts`) para que tome el estado y el saldo pendiente de la vista, en lugar de restar `pagos WHERE venta_id`
- [x] 4.2 Ajustar la pestaña Historial de `src/app/(dashboard)/clientes/[id]/page.tsx` para pintar el badge desde ese estado. Revisar de paso la condición `v.saldo_restante > 0` de la tarjeta móvil, que hoy esconde el badge de las ventas sin saldo mientras la tabla de escritorio sí lo muestra
- [x] 4.3 Comprobar el caso reportado de punta a punta: cliente con la venta `V-20260706-PQCW`, línea liquidada, el historial debe decir «Pagado» y cero pendiente

## 5. Resto de pantallas

- [x] 5.1 Verificar que el listado de ventas y el detalle de venta muestran el badge correcto una vez `estado_credito` está sincronizado, sin cambiarles el código
- [x] 5.2 Verificar que el reporte de créditos activos contra liquidados cuenta bien
- [x] 5.3 Comprobar que `esCreditoActivo` en `ventas/[id]/page.tsx` deja de ofrecer abonar sobre una venta ya saldada

## 6. Verificación

- [x] 6.1 Recorrer los escenarios de `specs/credito/spec.md`, incluidos el reparto por antigüedad con las cifras del spec y los cuatro de la corrección de datos
- [x] 6.2 Probar el flujo real desde Cobranza en local, ejecutando por PostgREST con un token autenticado la misma secuencia que hace `usePagos` (insertar el abono contra la línea sin `venta_id`, luego actualizar la línea). El historial pasa de «$400.00 pendiente / activo» a «0 / liquidado». La base local se devolvió a su estado previo al terminar
- [x] 6.3 Probar una venta con «entrega al liquidar» cobrada desde Cobranza: el stock baja y queda el movimiento
- [x] 6.4 Comprobar `v_stock_inconsistencias` vacía después de los descuentos por liquidación
- [x] 6.5 Aplicar las migraciones dos veces seguidas para confirmar que son idempotentes
- [x] 6.6 `npm run lint` y `npm run build`
- [x] 6.7 `npm run db:check-drift` y `npm run db:pending-prod`, sin hacer push. Listan las tres migraciones nuevas más las cinco del cambio anterior. **`db:check-drift` no compara vistas**: contrasta tablas, columnas, restricciones, índices, triggers, políticas y funciones, así que `v_venta_credito_saldo` queda fuera de su radar
