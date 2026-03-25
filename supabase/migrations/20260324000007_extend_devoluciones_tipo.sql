-- Extend devoluciones.tipo to support 'anulacion' for unified flow
ALTER TABLE devoluciones DROP CONSTRAINT IF EXISTS devoluciones_tipo_check;
ALTER TABLE devoluciones ADD CONSTRAINT devoluciones_tipo_check CHECK (tipo IN ('devolucion', 'cambio', 'anulacion'));
