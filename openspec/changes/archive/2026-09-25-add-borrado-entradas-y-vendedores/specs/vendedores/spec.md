## Purpose

Perfiles de las personas que operan el sistema: su identidad, su rol y su acceso. Esta capacidad cubre la baja de un perfil —desactivarlo para revocar el acceso conservando su historial, o eliminarlo cuando no tiene historial que conservar— y quién puede ejecutar esas acciones.

## ADDED Requirements

### Requirement: Desactivación y reactivación de un vendedor

El sistema DEBE permitir a un administrador marcar un vendedor como inactivo, y volver a marcarlo como activo. El historial del vendedor (ventas, pagos, gastos, devoluciones, líneas de crédito) DEBE conservarse intacto en ambos casos.

Un administrador NO DEBE poder desactivar su propio perfil.

El estado activo o inactivo DEBE ser visible en la lista de vendedores y en el detalle del vendedor.

#### Scenario: Desactivar un vendedor
- **WHEN** un administrador desactiva a un vendedor y confirma la acción
- **THEN** el vendedor queda marcado como inactivo
- **AND** su historial de ventas, pagos, gastos y devoluciones sigue existiendo sin cambios

#### Scenario: Reactivar un vendedor
- **WHEN** un administrador reactiva a un vendedor inactivo
- **THEN** el vendedor queda marcado como activo
- **AND** recupera el acceso al sistema

#### Scenario: Un administrador no puede desactivarse a sí mismo
- **WHEN** un administrador intenta desactivar su propio perfil
- **THEN** la operación se rechaza con un mensaje que explica el motivo
- **AND** el perfil sigue activo

#### Scenario: Un vendedor no puede desactivar perfiles
- **WHEN** un usuario cuyo rol no es administrador intenta desactivar cualquier perfil, incluido el propio
- **THEN** la operación se rechaza
- **AND** ningún perfil cambia de estado

#### Scenario: Un vendedor no puede cambiar su propio rol
- **WHEN** un usuario cuyo rol no es administrador intenta asignarse el rol de administrador
- **THEN** la operación se rechaza
- **AND** su rol sigue siendo el que tenía

### Requirement: Un vendedor inactivo no tiene acceso

Un vendedor marcado como inactivo NO DEBE poder iniciar sesión, y DEBE perder el acceso aunque ya tuviera una sesión abierta. El mensaje que reciba DEBE indicar que su cuenta está desactivada, no que sus credenciales son incorrectas.

#### Scenario: Intento de inicio de sesión de un vendedor inactivo
- **WHEN** un vendedor inactivo introduce su usuario y contraseña correctos
- **THEN** no entra al sistema
- **AND** se le informa que su cuenta está desactivada

#### Scenario: Sesión abierta al momento de la desactivación
- **WHEN** se desactiva a un vendedor que tiene una sesión abierta
- **THEN** en su siguiente interacción con el sistema queda fuera de la sesión

#### Scenario: Un vendedor activo entra con normalidad
- **WHEN** un vendedor activo introduce su usuario y contraseña correctos
- **THEN** entra al sistema igual que antes de este cambio

#### Scenario: Los vendedores existentes conservan su acceso
- **WHEN** se despliega este cambio sobre los datos actuales
- **THEN** ningún vendedor existente pierde el acceso

### Requirement: Los vendedores inactivos no se ofrecen para asignar trabajo nuevo

Un vendedor inactivo NO DEBE aparecer en los selectores donde se elige a un vendedor para registrar o filtrar trabajo. DEBE seguir apareciendo en la lista de vendedores y en los registros históricos que ya lo referencian.

#### Scenario: Selector de vendedor en una venta nueva
- **WHEN** se abre el selector de vendedor para registrar una venta
- **THEN** los vendedores inactivos no aparecen entre las opciones

#### Scenario: Registros históricos de un vendedor inactivo
- **WHEN** se consulta una venta registrada por un vendedor que después fue desactivado
- **THEN** la venta sigue mostrando a ese vendedor como responsable

#### Scenario: La lista de vendedores los sigue mostrando
- **WHEN** un administrador abre la lista de vendedores
- **THEN** los vendedores inactivos aparecen, señalados como inactivos

### Requirement: Eliminación definitiva de un perfil sin historial

El sistema DEBE permitir a un administrador eliminar definitivamente un perfil de vendedor, junto con su usuario de acceso, únicamente cuando el perfil no tiene ningún registro asociado.

El sistema DEBE comprobar antes de eliminar si existen ventas, pagos, gastos, devoluciones, ediciones de venta, líneas de crédito, clientes, entradas, movimientos de stock o cambios de precio atribuidos a ese perfil. Si existe al menos uno, la eliminación DEBE bloquearse y el sistema DEBE indicar qué tipo de registros lo impiden y cuántos hay, y ofrecer la desactivación como alternativa.

Un administrador NO DEBE poder eliminar su propio perfil.

La eliminación DEBE pedir confirmación explícita y advertir que no se puede deshacer. DEBE ser atómica: o desaparecen el perfil y su usuario de acceso, o no cambia nada.

#### Scenario: Eliminar un perfil creado por error
- **WHEN** un administrador confirma la eliminación de un vendedor que no tiene ningún registro asociado
- **THEN** el perfil desaparece de la lista de vendedores
- **AND** su usuario de acceso deja de existir
- **AND** ese nombre de usuario vuelve a estar disponible para un alta nueva

#### Scenario: Bloqueo por registros asociados
- **WHEN** un administrador intenta eliminar un vendedor que tiene 12 ventas registradas
- **THEN** la eliminación se bloquea
- **AND** se le informa que existen 12 ventas atribuidas a ese vendedor
- **AND** se le ofrece desactivar el perfil en su lugar

#### Scenario: Bloqueo por registros de varios tipos
- **WHEN** un administrador intenta eliminar un vendedor que tiene ventas, pagos y clientes asignados
- **THEN** la eliminación se bloquea
- **AND** se le informa de los tres tipos de registro con su cantidad

#### Scenario: Un administrador no puede eliminarse a sí mismo
- **WHEN** un administrador intenta eliminar su propio perfil
- **THEN** la operación se rechaza con un mensaje que explica el motivo
- **AND** el perfil sigue existiendo

#### Scenario: Un vendedor no puede eliminar perfiles
- **WHEN** un usuario cuyo rol no es administrador intenta eliminar cualquier perfil
- **THEN** la operación se rechaza
- **AND** el perfil sigue existiendo

#### Scenario: Ningún registro queda huérfano
- **WHEN** se elimina un perfil de vendedor
- **THEN** no queda ningún registro en el sistema que apunte a ese vendedor o a su usuario de acceso

### Requirement: Las bajas se autorizan en el servidor

La verificación del rol para desactivar, reactivar y eliminar un perfil DEBE hacerse en el servidor. Ocultar la acción en la interfaz NO DEBE ser el único control: una petición construida a mano por un usuario sin rol de administrador DEBE rechazarse igual.

#### Scenario: Petición directa sin rol de administrador
- **WHEN** un usuario autenticado sin rol de administrador envía directamente una petición para desactivar o eliminar un perfil, sin pasar por la interfaz
- **THEN** la petición se rechaza por falta de permisos
- **AND** ningún perfil cambia

#### Scenario: Petición sin sesión
- **WHEN** se envía una petición para desactivar o eliminar un perfil sin sesión iniciada
- **THEN** la petición se rechaza por falta de autenticación
