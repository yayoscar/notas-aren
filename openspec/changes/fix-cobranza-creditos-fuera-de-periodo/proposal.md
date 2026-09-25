## Why

El cliente Xavi Vega Contreras debe **$1,250.00** sobre una línea de crédito activa. En su ficha se ve perfectamente. En Cobranza, con la quincena actual seleccionada, la pantalla dice **«Total pendiente $0.00»** y **«No hay créditos pendientes para este periodo»**.

La causa: Cobranza descarta una línea si su `fecha_siguiente_pago` cae después del fin del periodo consultado. La de Xavi es el 15/10/2026 y el periodo va del 16 al 30 de septiembre, así que se descarta. Y se descarta **en silencio**: la línea no aparece en la lista, no suma en «Total pendiente» y no se cuenta en «Al día» ni en «Pendientes». Nada en la pantalla indica que hay dinero fuera del cuadro.

Esa fecha de octubre no la puso el sistema solo: al registrar una venta sobre una línea activa, el panel de ajuste del plan reescribe `fecha_siguiente_pago`. El vendedor la empujó y, sin quererlo, sacó al cliente de la vista de cobranza.

Hay un segundo defecto detrás, y es el que hace que la agenda de cobro no se sostenga sola: **registrar un abono no mueve `fecha_siguiente_pago`**. `usePagos` sólo actualiza `saldo_pagado`, y el diálogo de abono reenvía la misma fecha que ya había. La fecha únicamente cambia si alguien ajusta el plan a mano. Es decir, hoy la agenda está clavada en la fecha del primer pago hasta que alguien la toca.

## What Changes

- **Cobranza deja de esconder saldos.** Las líneas con saldo pendiente cuyo próximo pago cae después del periodo consultado aparecen en un bloque aparte, claramente separado de la lista de cobro, con su cliente, su saldo y su fecha de próximo pago.
- **La lista de cobro del periodo no cambia de criterio.** Sigue siendo lo que toca cobrar en este periodo: lo vencido y lo que vence dentro del rango. El bloque nuevo es informativo, no una ampliación de la ruta de cobro.
- **Los totales dejan de mentir.** «Total pendiente» sigue refiriéndose al periodo, pero la pantalla muestra además cuánto hay fuera de él, de modo que la suma de ambas cifras sea todo lo que el cliente debe.
- **Un abono que cubre la cuota adelanta la fecha del próximo pago.** El avance se cuenta por periodos completos según la periodicidad de la línea y se calcula desde la fecha programada, no desde la fecha del abono: pagar tarde no desplaza el calendario, y pagar de más adelanta tantos periodos como cuotas cubra el abono.
- **BREAKING (comportamiento)**: hoy la fecha se queda quieta y el cliente reaparece en cada periodo hasta que alguien ajusta el plan. A partir de este cambio, quien va al corriente sale de la lista de cobro del periodo y pasa al bloque de los que no vencen todavía. Las dos cosas funcionan juntas: el avance automático sólo es aceptable porque el bloque nuevo impide que nadie desaparezca.
- **Un crédito sin fecha de próximo pago deja de ser invisible.** El filtro actual también descarta las líneas cuya `fecha_siguiente_pago` es nula, y `useVentas` la deja nula cuando la venta no lleva fecha de primer pago: esa línea no aparece en **ningún** periodo. Pasa a mostrarse en la ruta de cobro, señalada como sin fecha, para que se le asigne una.
- **El PDF y el compartir de Cobranza siguen siendo la ruta de cobro del periodo.** No incluyen el bloque informativo.

## Capabilities

### New Capabilities

- `cobranza`: la vista de cobro por periodo — qué créditos entran en la ruta de cobro, cuáles quedan fuera y cómo se informa de ellos, y qué representan los totales de la pantalla.

### Modified Capabilities

- `credito`: se añade el comportamiento del calendario de pagos. Hasta ahora la especificación cubría la línea, los abonos y la liquidación, pero no decía nada sobre cuándo avanza la fecha del próximo pago.

## Impact

**Aplicación**

- `src/hooks/useCobranza.ts`: el descarte por `fecha_siguiente_pago` está en la construcción de la lista; hay que pasar de descartar a clasificar.
- `src/app/(dashboard)/seguimiento-cobranza/page.tsx`: es la página que el menú llama «Cobranza». Ahí van el bloque nuevo y los totales.
- `src/components/cobranza/CobranzaTable.tsx`: reutilizable, o una variante reducida para el bloque informativo.
- `src/hooks/usePagos.ts`: el avance de `fecha_siguiente_pago` al registrar el abono.
- `src/components/cobranza/AbonoCobranzaDialog.tsx`: hoy reenvía la fecha sin tocarla; hay que conciliarlo con el avance automático para que el ajuste manual de plan siga mandando cuando el usuario lo elige.
- `src/components/cobranza/CobranzaListaPDF.tsx`: verificar que sigue recibiendo sólo la ruta de cobro.

**Sin cambios de esquema.** `fecha_siguiente_pago` ya existe en `lineas_credito`; lo que falta es que alguien la mueva.

**Riesgo principal**: el avance automático toca el calendario de todas las líneas activas. Si avanza de más, los clientes salen de la ruta de cobro antes de tiempo; si avanza de menos, se les cobra dos veces el mismo periodo. Es la parte que hay que probar con más cuidado.
