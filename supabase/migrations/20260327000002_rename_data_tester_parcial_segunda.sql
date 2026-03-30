-- Migration 2 of 2: Rename data values (runs in separate transaction)

-- Relax CHECK constraints
ALTER TABLE productos DROP CONSTRAINT IF EXISTS chk_estado_producto;
ALTER TABLE productos ADD CONSTRAINT chk_estado_producto
  CHECK (estado_producto IN ('nuevo', 'tester', 'parcial', 'segunda'));

ALTER TABLE devoluciones_detalle DROP CONSTRAINT IF EXISTS devoluciones_detalle_estado_producto_devuelto_check;
ALTER TABLE devoluciones_detalle ADD CONSTRAINT devoluciones_detalle_estado_producto_devuelto_check
  CHECK (estado_producto_devuelto IS NULL OR estado_producto_devuelto IN ('nuevo', 'parcial', 'segunda'));

-- parcial → segunda (FIRST to avoid collision)
UPDATE productos SET estado_producto = 'segunda' WHERE estado_producto = 'parcial';
UPDATE devoluciones_detalle SET estado_producto_devuelto = 'segunda' WHERE estado_producto_devuelto = 'parcial';

-- tester → parcial
UPDATE productos SET estado_producto = 'parcial' WHERE estado_producto = 'tester';

-- Tighten CHECK constraint to final values
ALTER TABLE productos DROP CONSTRAINT chk_estado_producto;
ALTER TABLE productos ADD CONSTRAINT chk_estado_producto
  CHECK (estado_producto IN ('nuevo', 'parcial', 'segunda'));

-- Update stock movement types and references
UPDATE stock_movimientos SET tipo = 'SALIDA_PARCIAL' WHERE tipo = 'SALIDA_TESTER';
UPDATE stock_movimientos SET referencia_tipo = 'parcial' WHERE referencia_tipo = 'tester';
UPDATE stock_movimientos SET referencia_tipo = 'segunda' WHERE referencia_tipo = 'parcial' AND tipo = 'SALIDA_MERMA';
