## 1. El hook deja de esconder líneas

- [x] 1.1 En `useCreditosCobranzaV2` (`src/hooks/useCobranza.ts`), sustituir los tres `return null` por una clasificación: saldo cero queda fuera; sin fecha de próximo pago va a la ruta de cobro; fecha ≤ fin del periodo va a la ruta de cobro; fecha posterior va al grupo de los que aún no vencen (D2)
- [x] 1.2 Cambiar el retorno del hook a `{ deCobro, noVencen }` (D1). Ajustar el tipo que consume la página
- [x] 1.3 Añadir a `CreditoCobranza` la marca de «sin fecha de próximo pago», para que la interfaz pueda distinguirla
- [x] 1.4 Comprobar que la compilación rompe donde debe. El único consumidor del hook es `seguimiento-cobranza/page.tsx`, pero el compilador destapó además **dos sitios que construyen un `CreditoCobranza` a mano** —`clientes/[id]/credito/[lineaId]/page.tsx` y `DevolucionUnificadaDialog.tsx`— que había que completar con el campo nuevo. Sin el cambio de tipo habrían quedado inconsistentes en silencio

## 2. La pantalla de Cobranza

- [x] 2.1 En `src/app/(dashboard)/seguimiento-cobranza/page.tsx`, alimentar la lista actual únicamente con `deCobro`, sin cambiarle el criterio
- [x] 2.2 Recalcular `totalPendiente`, `alDiaCount` y `pendienteCount` sobre `deCobro`, verificando que siguen dando lo mismo que antes cuando no hay nada fuera del periodo
- [x] 2.3 Bloque nuevo debajo de la lista de cobro con los de `noVencen`: cliente, saldo pendiente y fecha de próximo pago, visualmente separado y con un encabezado que diga que no vencen en este periodo
- [x] 2.4 Ocultar el bloque cuando `noVencen` esté vacío
- [x] 2.5 Mostrar cuánto suma `noVencen`, de forma que entre ese importe y el total del periodo quede a la vista todo lo adeudado
- [x] 2.6 Señalar en la lista de cobro las líneas sin fecha de próximo pago, y comprobar que el diálogo de asignar fecha de cobro funciona sobre ellas
- [x] 2.7 Filtro por vendedor y por estado. **Matizado al implementar**: el de vendedor se aplica a **las dos** listas —si miras la cartera de alguien, la ves entera—, mientras que el de estado (al día / pendientes) sólo tiene sentido sobre la ruta de cobro y no se aplica al bloque informativo

## 3. El PDF y el compartir

- [x] 3.1 Confirmar que `CobranzaListaPDF` y el mensaje de compartir reciben sólo `deCobro`
- [x] 3.2 El total del PDF coincide con el de la pantalla cuando no hay filtro de estado activo. Con «Al día» o «Pendientes» seleccionado el PDF refleja el subconjunto filtrado, que es lo que el usuario pidió ver; es comportamiento previo a este cambio y no se tocó

## 4. El calendario avanza con los abonos

- [x] 4.1 Cuota sobre el saldo **anterior** al abono con la misma fórmula que `cuota_programada`, y periodos como `floor(monto / cuota)` (D4). **Desviación del plan**: la regla no quedó dentro de `usePagos` sino en `src/lib/calculos/calendario-pagos.ts`, junto al cálculo de crédito que ya existía. Metida en el hook era imposible de probar sin levantar la app; extraída, quedó cubierta por 14 casos ejecutables
- [x] 4.2 Avanzar `fecha_siguiente_pago` esos periodos **desde la fecha programada**, no desde la fecha del abono, en el mismo `UPDATE` que ya actualiza `saldo_pagado`
- [x] 4.3 Implementar el avance por periodicidad: semanal 7 días; quincenal al día 15 y al último del mes, reutilizando la convención que ya usa `calcularRangoPredefinido`; mensual un mes
- [x] 4.4 No mover la fecha cuando el abono no alcanza la cuota, ni cuando el abono liquida la línea
- [x] 4.5 Cuando `fecha_siguiente_pago` sea nula, fijarla en el primer vencimiento posterior a la fecha del abono
- [x] 4.6 Dejar anotado en el código que los otros dos caminos que insertan en `pagos` —el enganche de `useVentas` y la carga de `useImportacion`— no deben adelantar el calendario, y por qué (D3)

## 5. El ajuste manual sigue mandando

- [x] 5.1 En `AbonoCobranzaDialog`, dejar de reenviar `credito.fecha_siguiente_pago` a `ajustarPlan`: tal cual está, revertiría el avance que el abono acaba de hacer (D5)
- [x] 5.2 **La premisa de la tarea era incorrecta**: ese paso no tiene ningún selector de fecha de próximo pago, sólo «reducir periodos» o «reducir cuota». El único `type="date"` del diálogo es el de la fecha del abono. Así que la fecha se **omite**, y `fecha_siguiente_pago` pasó a ser opcional en `useAjustarPlanPagos` para que quien ajusta plazo o cuota no pise el calendario. `AjustePlanDialog`, que sí deja elegir fecha, la sigue enviando
- [x] 5.3 Verificar el orden: primero el abono con su avance, después el ajuste manual si lo hubo

## 6. Verificación

- [x] 6.1 Caso reportado verificado con los datos reales de la copia local: la línea de Xavi Vega Contreras ($1,250.00, próximo pago 15/10/2026) clasifica como `no_vence` para la quincena 16–30 Sep, o sea va al bloque nuevo en lugar de desaparecer. El texto del vacío dejó de afirmar que no hay créditos pendientes
- [x] 6.2 Escenarios de `specs/cobranza/spec.md` cubiertos con 10 casos ejecutables sobre `clasificarCreditoEnPeriodo`: dentro del periodo, último día, vencido de antes, primer día fuera, liquidado, sobrepago, sin fecha en dos periodos distintos y fecha ilegible. **Uno falló y destapó un error real**: `parseISO` no lanza con una fecha inválida —devuelve `Invalid Date`— así que el `try/catch` nunca actuaba y esa línea habría ido al bloque informativo en vez de a la vista. Corregido con una comprobación explícita
- [x] 6.3 Escenarios de `specs/credito/spec.md` cubiertos con 14 casos ejecutables: una cuota, dos cuotas, abono parcial, pago tardío contado desde la fecha programada, abono que liquida, línea sin fecha, alternancia 15 / fin de mes incluido febrero, y las periodicidades semanal y mensual
- [x] 6.4 La regla de avance quedó comprobada de forma exhaustiva sobre el módulo de cálculo. **No se ejecutó un abono por la interfaz**: el proyecto no tiene entorno de pruebas ni navegador sin cabeza, así que el recorrido real por pantalla queda para ti
- [x] 6.5 Un crédito liquidado clasifica como `fuera`, que es la única exclusión que sobrevive: no aparece en ninguno de los dos bloques. Verificado, incluido el caso de sobrepago con saldo negativo
- [x] 6.6 `npm run lint` y `npm run build`
