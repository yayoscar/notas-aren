-- Devoluciones / Cambios de producto
CREATE TABLE devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('devolucion', 'cambio')),
  vendedor_id UUID NOT NULL REFERENCES vendedores(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto_original DECIMAL(10,2) NOT NULL,
  monto_nuevo DECIMAL(10,2),
  diferencia DECIMAL(10,2),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE devoluciones_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('devuelto', 'nuevo')),
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  estado_producto_devuelto TEXT CHECK (estado_producto_devuelto IN ('nuevo', 'parcial')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_devoluciones_venta ON devoluciones(venta_id);
CREATE INDEX idx_devoluciones_cliente ON devoluciones(cliente_id);
CREATE INDEX idx_devoluciones_detalle_devolucion ON devoluciones_detalle(devolucion_id);
