## Purpose

El ciclo de vida del crédito de un cliente: la línea que agrupa sus compras a crédito, los abonos que la reducen y la liquidación. Cubre qué debe mostrar cada venta a crédito sobre su estado y su saldo, y qué le ocurre a la mercancía retenida cuando el crédito queda saldado.

## ADDED Requirements

### Requirement: El estado de crédito de una venta refleja el de su línea

Una venta a crédito que cuelga de una línea de crédito DEBE mostrarse como pagada en cuanto esa línea queda saldada, sin importar si el abono que la saldó se registró contra una venta concreta o contra la línea.

Mientras la línea conserve saldo pendiente, sus ventas DEBEN mostrarse como crédito activo.

Esto DEBE cumplirse en todas las pantallas que informan del estado de una venta a crédito: el historial de compras del cliente, el listado de ventas y el detalle de la venta.

#### Scenario: Liquidar el saldo desde Cobranza
- **WHEN** se registra desde Cobranza un abono que cubre el saldo pendiente de la línea de crédito de un cliente
- **THEN** el cliente deja de aparecer en Cobranza
- **AND** en su historial de compras cada venta a crédito de esa línea aparece como pagada
- **AND** ninguna de ellas muestra saldo pendiente

#### Scenario: Liquidar con un abono atado a una venta
- **WHEN** se registra un abono que cubre el saldo pendiente de la línea y que además va atado a una venta concreta
- **THEN** todas las ventas de esa línea aparecen como pagadas, no sólo aquella a la que se ató el abono

#### Scenario: Abono parcial
- **WHEN** se registra un abono que no alcanza a cubrir el saldo pendiente de la línea
- **THEN** la línea sigue activa
- **AND** el cliente sigue apareciendo en Cobranza
- **AND** las ventas que conservan saldo siguen mostrándose como crédito activo

#### Scenario: Una compra nueva sobre una línea ya liquidada
- **WHEN** un cliente con la línea liquidada hace una compra a crédito nueva
- **THEN** la compra nueva aparece como crédito activo
- **AND** las compras que ya estaban pagadas siguen apareciendo como pagadas

#### Scenario: Venta de contado
- **WHEN** se consulta una venta de contado en el historial
- **THEN** aparece como pagada y sin saldo pendiente, con independencia de cualquier línea de crédito del cliente

### Requirement: El saldo pendiente por compra se reparte por antigüedad

Una línea de crédito agrupa varias compras, así que el saldo no vive en la venta. El sistema DEBE imputar lo abonado a la línea sobre sus compras de la más antigua a la más reciente, y mostrar el remanente de cada una como su saldo pendiente.

La suma de los saldos pendientes de las compras de una línea DEBE ser igual al saldo pendiente de la línea.

#### Scenario: El abono cubre la compra más antigua y parte de la siguiente
- **WHEN** un cliente tiene dos compras a crédito en la misma línea, de $600.00 y $400.00, y ha abonado $800.00
- **THEN** la compra de $600.00 aparece sin saldo pendiente y como pagada
- **AND** la compra de $400.00 aparece con $200.00 pendientes y como crédito activo

#### Scenario: El abono no alcanza para la primera compra
- **WHEN** ese mismo cliente ha abonado sólo $250.00
- **THEN** la compra de $600.00 aparece con $350.00 pendientes
- **AND** la compra de $400.00 aparece con $400.00 pendientes

#### Scenario: La línea queda saldada
- **WHEN** lo abonado a la línea cubre su saldo total
- **THEN** todas sus compras aparecen con saldo pendiente cero

#### Scenario: Los renglones cuadran con la línea
- **WHEN** se consulta el historial de un cliente con una línea de crédito activa sobre la que no se han registrado devoluciones
- **THEN** la suma de los saldos pendientes de sus compras a crédito coincide con el saldo pendiente de la línea

#### Scenario: El caso reportado
- **WHEN** se consulta el historial de un cliente cuya única compra a crédito es de $600.00 y cuya línea de crédito ya fue liquidada desde Cobranza
- **THEN** esa compra aparece como pagada y con saldo pendiente cero, no como «Crédito activo» con $400.00

### Requirement: La mercancía retenida sale del inventario al liquidarse el crédito

Una venta a crédito marcada con entrega al liquidar no descuenta existencias al registrarse. El sistema DEBE descontarlas cuando el crédito queda saldado, sin importar si el abono que lo saldó se registró contra la venta o contra la línea, y DEBE dejar el movimiento de stock correspondiente.

Ese descuento NO DEBE aplicarse más de una vez para la misma venta.

#### Scenario: Liquidar desde Cobranza una venta con entrega al liquidar
- **WHEN** se salda desde Cobranza la línea de crédito de una venta con entrega al liquidar, de 3 piezas de un producto
- **THEN** la existencia de ese producto disminuye en 3 piezas
- **AND** queda registrado el movimiento de salida correspondiente

#### Scenario: No se descuenta dos veces
- **WHEN** después de haberse liquidado una venta con entrega al liquidar se registra otro abono sobre la misma línea
- **THEN** la existencia del producto no vuelve a disminuir
- **AND** no se registra un segundo movimiento de salida por esa venta

#### Scenario: Varias ventas con entrega retenida en la misma línea
- **WHEN** una línea con dos ventas con entrega al liquidar queda saldada
- **THEN** se descuentan las existencias de ambas ventas, cada una con su movimiento

#### Scenario: Ventas sin entrega retenida
- **WHEN** se liquida una línea cuyas ventas ya descontaron existencias al registrarse
- **THEN** las existencias no cambian

### Requirement: Los reportes cuentan los créditos por su estado real

El reporte de créditos activos contra liquidados DEBE contar cada venta a crédito según si su crédito está efectivamente saldado.

#### Scenario: Un crédito liquidado desde Cobranza cuenta como liquidado
- **WHEN** se consulta el reporte de créditos después de haber liquidado una línea desde Cobranza
- **THEN** las ventas de esa línea cuentan entre los liquidados y no entre los activos

### Requirement: Las ventas ya saldadas quedan corregidas

Las ventas registradas antes de este cambio cuyo crédito ya está saldado DEBEN quedar marcadas como liquidadas. La corrección DEBE poder ejecutarse más de una vez sin efectos añadidos.

La corrección NO DEBE alterar existencias: descontar hoy la mercancía de una entrega de hace meses descuadraría el inventario en lugar de arreglarlo. Las ventas con entrega al liquidar que quedaron sin descontar DEBEN quedar identificadas para revisarlas a mano.

#### Scenario: La venta del reporte queda corregida
- **WHEN** se aplica la corrección sobre los datos existentes
- **THEN** la venta `V-20260706-PQCW` queda marcada como liquidada
- **AND** su cliente deja de aparecer con crédito activo en su historial

#### Scenario: No se tocan los créditos que siguen debiendo
- **WHEN** se aplica la corrección
- **THEN** una venta cuya línea conserva saldo pendiente sigue marcada como crédito activo

#### Scenario: Repetible
- **WHEN** la corrección se aplica una segunda vez
- **THEN** no cambia ninguna venta que ya estuviera correcta

#### Scenario: Las existencias no se mueven
- **WHEN** se aplica la corrección
- **THEN** ninguna existencia de producto cambia
- **AND** no se registra ningún movimiento de stock
