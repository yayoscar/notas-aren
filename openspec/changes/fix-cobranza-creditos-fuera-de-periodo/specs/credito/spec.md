## ADDED Requirements

### Requirement: El calendario de pagos avanza con los abonos

Cuando un abono cubre la cuota del periodo de una línea de crédito, el sistema DEBE adelantar la fecha del próximo pago al periodo siguiente, según la periodicidad de la línea.

El avance DEBE contarse en periodos completos desde la **fecha programada**, no desde la fecha en que se registra el abono: pagar tarde no desplaza el calendario. Un abono que cubre varias cuotas DEBE adelantar tantos periodos como cuotas cubra.

Un abono que no alcanza a cubrir la cuota del periodo NO DEBE mover la fecha.

Cuando la línea queda saldada, la fecha del próximo pago deja de ser relevante y NO DEBE seguir avanzando.

Un ajuste manual del plan de pagos DEBE prevalecer sobre el avance automático.

#### Scenario: Abono de una cuota
- **WHEN** una línea quincenal tiene su próximo pago el 30 de septiembre y se registra un abono igual a la cuota
- **THEN** la fecha del próximo pago pasa al siguiente periodo quincenal

#### Scenario: Abono que cubre dos cuotas
- **WHEN** se registra un abono que cubre exactamente el doble de la cuota
- **THEN** la fecha del próximo pago avanza dos periodos

#### Scenario: Abono parcial
- **WHEN** se registra un abono menor que la cuota del periodo
- **THEN** la fecha del próximo pago no cambia

#### Scenario: Pago tardío no desplaza el calendario
- **WHEN** una línea quincenal con próximo pago el 15 de septiembre recibe la cuota el 28 de septiembre
- **THEN** la fecha del próximo pago avanza un periodo contado desde el 15 de septiembre, no desde el 28

#### Scenario: El abono liquida la línea
- **WHEN** un abono cubre todo el saldo pendiente
- **THEN** la línea queda liquidada
- **AND** desaparece de Cobranza, tanto de la ruta de cobro como del bloque de los que aún no vencen

#### Scenario: El ajuste manual manda
- **WHEN** se registra un abono y en el mismo paso se ajusta el plan de pagos con una fecha concreta
- **THEN** la fecha del próximo pago es la que se indicó en el ajuste

#### Scenario: Quien va al corriente sale de la ruta de cobro
- **WHEN** un cliente paga su cuota del periodo y le queda saldo
- **THEN** deja de aparecer en la lista de cobro de ese periodo
- **AND** aparece en el bloque de créditos que aún no vencen, con su saldo
