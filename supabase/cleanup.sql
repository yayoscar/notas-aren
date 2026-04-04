-- =============================================================
-- LIMPIEZA DE BD: Elimina todos los datos excepto el usuario admin
-- Ejecutar en Supabase SQL Editor
-- =============================================================

BEGIN;

-- Phase 1: Tablas hijas (romper dependencias circulares primero)
DELETE FROM cobranza_seguimiento;
DELETE FROM ventas_historial;
DELETE FROM devoluciones_detalle;
DELETE FROM devoluciones;
DELETE FROM saldos_favor;
DELETE FROM ventas_detalle;
DELETE FROM pagos;
DELETE FROM entradas_detalle;
DELETE FROM entradas;

-- Phase 2: Transacciones principales
DELETE FROM ventas;
DELETE FROM gastos;

-- Phase 3: Créditos y clientes
DELETE FROM lineas_credito;
-- Romper auto-referencia antes de borrar
UPDATE clientes SET cliente_referido_id = NULL WHERE cliente_referido_id IS NOT NULL;
DELETE FROM clientes;

-- Phase 4: Productos e inventario
DELETE FROM stock_movimientos;
DELETE FROM precios_historico;
-- Romper auto-referencia antes de borrar
UPDATE productos SET producto_origen_id = NULL WHERE producto_origen_id IS NOT NULL;
DELETE FROM productos;

-- Phase 5: Vendedores (conservar solo admin)
DELETE FROM vendedores WHERE rol != 'admin';

-- Phase 6: Catálogos opcionales (descomentar si quieres limpiarlos también)
-- DELETE FROM proveedores;
-- DELETE FROM cat_cuenta_bancaria;
-- DELETE FROM cat_categoria_gasto;
-- DELETE FROM cat_ciudad;
-- DELETE FROM cat_tipo_perfume;
-- DELETE FROM cat_concentracion;
-- DELETE FROM cat_presentacion;
-- DELETE FROM cat_tamano;
-- DELETE FROM cat_genero;

COMMIT;
