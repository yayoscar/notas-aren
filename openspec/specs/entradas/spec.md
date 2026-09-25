# entradas Specification

## Purpose

Registro de la mercancía que entra al inventario desde un proveedor: qué se recibió, en qué cantidad, a qué costo, y cómo eso altera las existencias. Esta capacidad cubre la corrección y la eliminación de una entrada ya registrada, y la integridad del stock frente a ambas.

## Requirements

### Requirement: Corrección de una entrada registrada

El sistema DEBE permitir a un administrador modificar una entrada ya registrada: los datos de cabecera (proveedor, fecha, fecha de factura, número de factura, notas) y las líneas de detalle (agregar, quitar, o cambiar producto, cantidad y costo unitario).

El stock de cada producto afectado DEBE quedar como si la entrada se hubiera capturado desde el principio con los valores nuevos. El total de la entrada DEBE recalcularse a partir de las líneas resultantes.

El folio de la entrada NO DEBE cambiar al editarla.

Los precios del producto (compra, venta de contado, venta a crédito) NO DEBEN modificarse al editar la entrada.

#### Scenario: Aumentar la cantidad de una línea
- **WHEN** un administrador cambia la cantidad de una línea de 10 a 15 piezas y guarda
- **THEN** el stock del producto aumenta en 5 piezas
- **AND** queda registrado un movimiento de stock por esas 5 piezas que referencia la entrada
- **AND** el total de la entrada refleja las 15 piezas al costo unitario vigente

#### Scenario: Reducir la cantidad de una línea con existencias suficientes
- **WHEN** un administrador cambia la cantidad de una línea de 15 a 10 piezas y el producto tiene al menos 5 piezas en existencia
- **THEN** el stock del producto disminuye en 5 piezas
- **AND** queda registrado el movimiento de stock correspondiente

#### Scenario: Reducir la cantidad sin existencias suficientes
- **WHEN** un administrador intenta reducir la cantidad de una línea en 5 piezas y el producto solo tiene 2 piezas en existencia
- **THEN** la edición se rechaza por completo
- **AND** se muestra un mensaje que nombra el producto, las piezas que se necesitan devolver y las que hay disponibles
- **AND** ni la entrada ni el stock ni los movimientos cambian

#### Scenario: Quitar una línea de la entrada
- **WHEN** un administrador elimina una línea de la entrada y el producto tiene existencias suficientes
- **THEN** el stock de ese producto disminuye en la cantidad completa de la línea
- **AND** la línea desaparece de la entrada
- **AND** el total de la entrada se recalcula sin ella

#### Scenario: Agregar una línea a la entrada
- **WHEN** un administrador agrega una línea con un producto que no estaba en la entrada
- **THEN** el stock de ese producto aumenta en la cantidad indicada
- **AND** la línea aparece en la entrada con su subtotal

#### Scenario: Cambiar solo datos de cabecera
- **WHEN** un administrador cambia el número de factura y las notas sin tocar las líneas
- **THEN** los datos se guardan
- **AND** ni el stock ni los movimientos de stock cambian

#### Scenario: El folio sobrevive a la edición
- **WHEN** un administrador guarda cualquier cambio sobre una entrada
- **THEN** el folio de la entrada sigue siendo el mismo que antes de editar

#### Scenario: Los precios del producto no se tocan
- **WHEN** un administrador cambia el costo unitario de una línea de 100 a 120
- **THEN** el total de la entrada refleja el costo nuevo
- **AND** el precio de compra y los precios de venta del producto conservan el valor que tenían antes de editar

#### Scenario: Un vendedor no puede editar entradas
- **WHEN** un usuario cuyo rol no es administrador intenta editar una entrada
- **THEN** la operación se rechaza
- **AND** la entrada queda sin cambios

### Requirement: Eliminación de una entrada

El sistema DEBE permitir a un administrador eliminar por completo una entrada registrada. La entrada y sus líneas de detalle DEBEN desaparecer de la base de datos, y el stock que la entrada aportó DEBE revertirse.

La eliminación DEBE ser atómica: si cualquier línea no se puede revertir, no se elimina nada.

Los precios del producto NO DEBEN revertirse al eliminar la entrada.

La eliminación DEBE pedir confirmación explícita antes de ejecutarse, y la confirmación DEBE advertir que la acción no se puede deshacer.

#### Scenario: Eliminar una entrada cuyas piezas siguen en existencia
- **WHEN** un administrador confirma la eliminación de una entrada de 10 piezas de un producto que tiene 10 o más en existencia
- **THEN** la entrada y sus líneas dejan de existir
- **AND** el stock del producto disminuye en 10 piezas
- **AND** queda registrado un movimiento de stock por la reversión

#### Scenario: Eliminar una entrada con varias líneas
- **WHEN** un administrador elimina una entrada con líneas de tres productos distintos, todos con existencias suficientes
- **THEN** el stock de los tres productos se revierte por la cantidad de su línea
- **AND** queda un movimiento de stock por cada producto

#### Scenario: Bloqueo por existencias insuficientes
- **WHEN** un administrador intenta eliminar una entrada de 10 piezas de un producto del que solo quedan 3 en existencia
- **THEN** la eliminación se rechaza
- **AND** se muestra un mensaje que nombra el producto, las 10 piezas que habría que revertir y las 3 disponibles
- **AND** la entrada, el stock y los movimientos quedan intactos

#### Scenario: Bloqueo parcial cancela toda la eliminación
- **WHEN** un administrador intenta eliminar una entrada de tres líneas y una sola de ellas no tiene existencias suficientes
- **THEN** la eliminación se rechaza por completo
- **AND** el stock de las otras dos líneas no se modifica

#### Scenario: El stock nunca queda negativo
- **WHEN** se elimina o se reduce cualquier entrada
- **THEN** ningún producto queda con existencia menor que cero

#### Scenario: Los precios sobreviven a la eliminación
- **WHEN** un administrador elimina una entrada que en su momento actualizó los precios del producto
- **THEN** el producto conserva el precio de compra y los precios de venta vigentes
- **AND** el histórico de precios conserva sus registros

#### Scenario: Un vendedor no puede eliminar entradas
- **WHEN** un usuario cuyo rol no es administrador intenta eliminar una entrada
- **THEN** la operación se rechaza
- **AND** la entrada sigue existiendo

### Requirement: Generación de folio tolerante a huecos

El sistema DEBE asignar a cada entrada nueva un folio del año en curso que no colisione con el de ninguna entrada existente, y DEBE seguir haciéndolo cuando existan huecos dejados por entradas eliminadas.

El folio de una entrada eliminada queda libre y PUEDE volver a emitirse si era el último del año; los folios de las entradas que siguen existiendo NUNCA DEBEN reasignarse ni renumerarse.

#### Scenario: Alta posterior a la eliminación de la última entrada
- **WHEN** existen las entradas ENT-2026-0001 a ENT-2026-0005, se elimina ENT-2026-0005 y se registra una entrada nueva
- **THEN** la entrada nueva se crea sin error
- **AND** su folio no coincide con el de ninguna entrada existente

#### Scenario: Alta posterior a la eliminación de una entrada intermedia
- **WHEN** existen las entradas ENT-2026-0001 a ENT-2026-0005, se elimina ENT-2026-0003 y se registra una entrada nueva
- **THEN** la entrada nueva se crea sin error
- **AND** su folio no reutiliza ENT-2026-0003

#### Scenario: Los folios existentes no se renumeran
- **WHEN** se elimina cualquier entrada
- **THEN** el folio de las entradas restantes sigue siendo el mismo que antes

### Requirement: Consistencia entre existencias y movimientos

Tras cualquier corrección o eliminación de una entrada, la existencia registrada de cada producto afectado DEBE seguir coincidiendo con la suma de sus movimientos de stock. Toda alteración de existencias derivada de estas operaciones DEBE quedar asentada como movimiento.

#### Scenario: El reporte de inconsistencias sigue limpio
- **WHEN** se edita o se elimina una entrada
- **THEN** ningún producto afectado aparece en el reporte de inconsistencias de stock

#### Scenario: La reversión queda asentada en el historial
- **WHEN** se elimina una entrada
- **THEN** el historial de movimientos conserva tanto el movimiento original de la entrada como el de su reversión
- **AND** el saldo neto de ambos sobre la existencia del producto es cero
