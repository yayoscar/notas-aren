CREATE TYPE tipo_movimiento AS ENUM (
  'ENTRADA_COMPRA',
  'ENTRADA_DEVOLUCION',
  'SALIDA_VENTA',
  'SALIDA_MUESTRA',
  'SALIDA_EXHIBICION',
  'SALIDA_MERMA',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO'
);

CREATE TABLE stock_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id),
  tipo tipo_movimiento NOT NULL,
  cantidad INTEGER NOT NULL,
  stock_antes INTEGER NOT NULL,
  stock_despues INTEGER NOT NULL,
  referencia_id UUID,
  referencia_tipo TEXT,
  notas TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
