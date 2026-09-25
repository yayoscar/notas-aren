## Purpose

La vista de cobro por periodo: qué créditos hay que ir a cobrar en la quincena, la semana o el mes seleccionado, cuáles quedan fuera de ese periodo y cómo se informa de ellos para que ningún saldo quede oculto.

## ADDED Requirements

### Requirement: La ruta de cobro del periodo

La lista principal de Cobranza DEBE contener las líneas de crédito con saldo pendiente cuyo próximo pago vence dentro del periodo consultado o ya está vencido. Es lo que hay que cobrar.

Una línea sin saldo pendiente NO DEBE aparecer.

#### Scenario: Crédito que vence dentro del periodo
- **WHEN** se consulta un periodo y una línea con saldo pendiente tiene su próximo pago dentro de ese rango
- **THEN** aparece en la lista de cobro

#### Scenario: Crédito vencido de un periodo anterior
- **WHEN** una línea con saldo pendiente tiene su próximo pago anterior al inicio del periodo consultado
- **THEN** aparece en la lista de cobro

#### Scenario: Crédito liquidado
- **WHEN** una línea ya no tiene saldo pendiente
- **THEN** no aparece ni en la lista de cobro ni en ningún otro bloque de la pantalla

### Requirement: Los créditos que aún no vencen se muestran aparte

Una línea con saldo pendiente cuyo próximo pago cae **después** del fin del periodo consultado NO DEBE desaparecer de la pantalla. DEBE mostrarse en un bloque separado e identificado como tal, fuera de la lista de cobro, indicando al menos el cliente, el saldo pendiente y la fecha del próximo pago.

El bloque NO DEBE aparecer cuando no hay ninguna línea en esa situación.

#### Scenario: El caso reportado
- **WHEN** un cliente debe $1,250.00 y su próximo pago es el 15 de octubre, y se consulta la quincena del 16 al 30 de septiembre
- **THEN** no aparece en la lista de cobro del periodo
- **AND** sí aparece en el bloque de créditos que aún no vencen, con su saldo de $1,250.00 y su fecha del 15 de octubre
- **AND** la pantalla nunca dice que no hay créditos pendientes

#### Scenario: Sin créditos fuera del periodo
- **WHEN** todas las líneas con saldo pendiente vencen dentro del periodo o antes
- **THEN** el bloque de los que aún no vencen no se muestra

#### Scenario: No se mezcla con la ruta de cobro
- **WHEN** hay créditos en ambas situaciones
- **THEN** los que aún no vencen quedan visiblemente separados de la lista de cobro del periodo

### Requirement: Un crédito sin fecha de próximo pago sigue siendo visible

Una línea con saldo pendiente y sin fecha de próximo pago NO DEBE desaparecer de la pantalla. Al no tener vencimiento programado, DEBE aparecer en la ruta de cobro del periodo, señalada como sin fecha, para que alguien le asigne una.

#### Scenario: Línea sin fecha de próximo pago
- **WHEN** una línea con saldo pendiente no tiene fecha de próximo pago
- **THEN** aparece en la lista de cobro del periodo consultado, sea cual sea el periodo
- **AND** se distingue que no tiene fecha de próximo pago

#### Scenario: No queda invisible en ningún periodo
- **WHEN** se consultan periodos distintos
- **THEN** esa línea aparece en todos ellos mientras conserve saldo pendiente

### Requirement: Los totales de la pantalla no ocultan saldo

El total pendiente que muestra la pantalla DEBE seguir refiriéndose a la ruta de cobro del periodo. Cuando existan créditos fuera del periodo, la pantalla DEBE indicar además cuánto suman, de modo que entre ambas cifras quede a la vista todo lo que se adeuda.

Los contadores de créditos al día y pendientes DEBEN seguir contando sólo la ruta de cobro del periodo.

#### Scenario: Saldo fuera del periodo visible en los totales
- **WHEN** no hay nada que cobrar en el periodo pero un cliente debe $1,250.00 con vencimiento posterior
- **THEN** el total del periodo es $0.00
- **AND** la pantalla muestra que hay $1,250.00 pendientes fuera del periodo

#### Scenario: Los contadores siguen siendo del periodo
- **WHEN** hay créditos dentro y fuera del periodo
- **THEN** los contadores de al día y pendientes cuentan únicamente los de la ruta de cobro

### Requirement: Lo que se comparte sigue siendo la ruta de cobro

El PDF y el mensaje que se comparten desde Cobranza DEBEN contener únicamente la ruta de cobro del periodo. Los créditos que aún no vencen NO DEBEN incluirse.

#### Scenario: Descargar la lista del periodo
- **WHEN** se descarga el PDF de un periodo en el que hay créditos que aún no vencen
- **THEN** el PDF contiene sólo los créditos de la ruta de cobro
- **AND** su total coincide con el total del periodo que muestra la pantalla
