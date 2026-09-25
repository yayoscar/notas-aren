## Context

Ver `proposal.md` — Why. Los requisitos están en `specs/cobranza/spec.md` y `specs/credito/spec.md`.

Lo que condiciona el enfoque:

- **El descarte está en un `.map()` que devuelve `null`.** En `useCreditosCobranzaV2` cada línea pasa por tres filtros seguidos: sin saldo pendiente → fuera; sin `fecha_siguiente_pago` → fuera; `fecha_siguiente_pago > rangoFin` → fuera. Los tres desaparecen sin dejar rastro.
- **Un solo consumidor del hook.** `useCreditosCobranzaV2` sólo lo usa `seguimiento-cobranza/page.tsx`, que es la página que el menú llama «Cobranza». Los demás archivos de `components/cobranza/` importan el *tipo* `CreditoCobranza`, no el hook. Cambiar la forma del retorno tiene un único punto de actualización.
- **Los totales se calculan en la página**, no en el hook: `totalPendiente`, `alDiaCount` y `pendienteCount` salen de reducir el arreglo que devuelve el hook. Si el hook empieza a devolver más filas sin más, los totales cambian solos y en silencio.
- **Tres caminos insertan en `pagos`**, no uno: `usePagos.registrarAbono` (el abono de Cobranza), `useVentas.create` (el enganche o primer abono al registrar la venta) y `useImportacion` (carga histórica).
- **`usePagos` ya actualiza la línea** en la misma mutación: lee `saldo_total`/`saldo_pagado`, suma el abono y marca `liquidada` si procede. Es el sitio natural para tocar también la fecha.
- **El diálogo de abono puede ajustar el plan después**, llamando a `ajustarPlan` con una fecha concreta. Hoy le reenvía la fecha sin cambiarla, así que el ajuste es inocuo; en cuanto el abono mueva la fecha, ese reenvío la revertiría.
- **La cuota que ve el usuario** es `cuota_programada`, que el hook calcula como `ceil(saldoPendiente / (meses_credito × factor))` sobre el saldo **anterior** al abono.

## Goals / Non-Goals

**Goals:**

- Que ningún saldo pendiente pueda quedar fuera de la pantalla de Cobranza, por ninguna de las tres vías por las que hoy se cae.
- Que la lista de cobro siga siendo exactamente la ruta de cobro del periodo, sin diluirse.
- Que el compilador obligue a revisar cada sitio que consume la lista, en vez de que el cambio se cuele silenciosamente en los totales y en el PDF.
- Que el avance de la fecha sea predecible: mismo abono, mismo resultado, independientemente de cuándo se registre.

**Non-Goals:**

- Rediseñar Cobranza ni su navegación por periodos.
- Cambiar cómo se calcula la cuota.
- Tocar el enganche de la venta ni la importación histórica.
- Impedir que alguien empuje la fecha a mano hasta sacar a un cliente de la ruta de cobro: con el bloque nuevo deja de ser un problema invisible, que es lo que lo hacía grave.

## Decisions

### D1 — El hook devuelve dos listas, no una con una bandera

`useCreditosCobranzaV2` pasa a devolver `{ deCobro, noVencen }` en lugar de un arreglo.

Devolver un solo arreglo con un campo `vence_en_periodo` sería menos cambio, pero deja que cualquier consumidor lo use entero por descuido: el PDF empezaría a incluir a quien no toca cobrar y `totalPendiente` sumaría saldo que no es del periodo. Justo los dos errores que el spec prohíbe.

Con dos listas, TypeScript rompe la compilación en cada sitio que consume el resultado y obliga a decidir cuál de las dos quiere. Es un único call site, así que el coste es mínimo y la garantía es estructural.

*Alternativa descartada*: dos hooks separados, uno por lista. Duplicaría la consulta a la base para el mismo periodo.

### D2 — Las tres exclusiones se convierten en una clasificación

En vez de tres `return null`, la línea se clasifica:

- sin saldo pendiente → fuera de la pantalla, como hasta ahora;
- sin fecha de próximo pago → `deCobro`, marcada como sin fecha;
- fecha ≤ fin del periodo (incluye vencido) → `deCobro`;
- fecha > fin del periodo → `noVencen`.

La única exclusión que sobrevive es la del saldo cero, que es la correcta: un crédito liquidado no se cobra.

La línea sin fecha va a `deCobro` y no al bloque informativo porque no se puede afirmar que «aún no vence»: no tiene vencimiento. Ponerla donde se ve y se puede actuar es lo útil; la pantalla ya tiene el diálogo para asignarle fecha de cobro.

### D3 — El avance de fecha vive en `usePagos.registrarAbono`, no en un trigger

La lección del arreglo anterior fue que la lógica atada a un camino se muere cuando aparece otro camino, y eso empuja a meter esto en un trigger. Aquí no aplica: de los tres caminos que insertan en `pagos`, **sólo uno debe mover el calendario**.

- `useVentas.create` inserta el enganche o primer abono al registrar la venta. Ese pago *es* el primer pago del plan; adelantarlo dejaría al cliente con el próximo vencimiento corrido desde el día uno.
- `useImportacion` carga historial: los pagos ya ocurrieron y el plan que se importa ya trae su fecha.

Un trigger sobre `pagos` o sobre `lineas_credito` no puede distinguirlos sin inventar una señal extra que habría que pasarle desde el cliente — con lo que la robustez que se buscaba se evapora.

Así que el avance se hace donde ya se actualiza la línea, en la misma mutación y sin un viaje más a la base.

*Riesgo asumido*: si mañana aparece un cuarto camino de abono, no adelantará la fecha. Queda anotado en el propio código.

### D4 — La regla de avance

Sobre el saldo **anterior** al abono, con la misma fórmula que `cuota_programada` para que coincida con lo que el usuario vio en el diálogo:

```
cuota    = ceil(saldo_pendiente_antes / (meses_credito × factor))
periodos = floor(monto / cuota)
```

Si `periodos` es cero, la fecha no se mueve. Si es uno o más, la fecha avanza esos periodos **desde `fecha_siguiente_pago`**, no desde la fecha del abono: pagar tarde no regala plazo, y el calendario no se desplaza por el momento en que alguien registre el cobro.

El avance usa la periodicidad de la línea: semanal 7 días, quincenal al día 15 y al último del mes —la misma convención que ya usa `calcularRangoPredefinido` para los periodos—, mensual un mes.

Si la línea queda liquidada, no se toca la fecha: ya no significa nada y la línea desaparece de Cobranza por saldo cero.

Si `fecha_siguiente_pago` es nula no hay desde dónde contar, así que el abono la fija en el primer vencimiento posterior a la fecha del propio abono. Es la ocasión natural de darle un calendario a una línea que nunca lo tuvo.

### D5 — El ajuste manual del plan se aplica después y prevalece

`AbonoCobranzaDialog` llama a `ajustarPlan` en el `onSuccess` del abono, o sea después. Hoy le pasa `credito.fecha_siguiente_pago` —la vieja— y por eso hay que cambiarlo: tal cual, revertiría el avance que el abono acaba de hacer.

Pasa a enviar la fecha que el usuario eligió en el ajuste. Cuando el usuario no ajusta nada, no se llama a `ajustarPlan` y el avance automático queda.

El orden importa y no se cambia: primero el abono con su avance, después el ajuste manual si lo hubo. La última escritura gana, y es la del usuario.

## Risks / Trade-offs

- **El avance automático toca el calendario de todas las líneas activas**: avanzar de más saca clientes de la ruta de cobro antes de tiempo, avanzar de menos les cobra dos veces el mismo periodo → es lo que hay que probar con más cuidado; los escenarios del spec fijan los casos de una cuota, dos cuotas, abono parcial y pago tardío.
- **Cambiar la forma del retorno del hook** rompe la compilación a propósito → es un solo consumidor y el compilador señala exactamente dónde.
- **El bloque nuevo puede crecer mucho** si la mayoría de los clientes va al corriente, y empujar la ruta de cobro fuera de la pantalla → va debajo de la lista de cobro y colapsado o resumido si hace falta; la lista de cobro manda.
- **Un cliente sin fecha aparece en todos los periodos** hasta que se le asigne una → es deliberado: es la señal de que falta configurarle el plan, y hoy esa línea simplemente no existía para nadie.
- **Sin cambios de esquema ni migraciones**, así que nada que desplegar a la base; el arreglo entra entero con el deploy de la app.

## Migration Plan

No hay migraciones. El cambio es sólo de aplicación y entra con el deploy.

Verificación en local sobre la copia de producción: la línea de Xavi Vega Contreras, con saldo $1,250.00 y próximo pago el 15/10/2026, debe aparecer en el bloque de los que aún no vencen al consultar la quincena del 16 al 30 de septiembre.

**Rollback**: revertir el deploy. No queda estado persistido por este cambio salvo las fechas ya avanzadas por abonos posteriores, que son correctas y no necesitan deshacerse.

## Open Questions

- Si el bloque de los que aún no vencen debe poder plegarse cuando tenga muchas filas. Es una decisión de presentación y no cambia el contrato.
- Si conviene que el panel de ajuste de plan del formulario de venta avise cuando la fecha elegida saca al cliente del periodo en curso. Ese panel fue el que empujó la fecha a octubre, pero con el bloque nuevo el efecto deja de ser invisible, así que puede tratarse aparte.
