-- Tabla principal de ventas
CREATE TABLE ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE,
  vendedor_id UUID NOT NULL REFERENCES vendedores(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  tipo_venta TEXT NOT NULL CHECK (tipo_venta IN ('contado', 'credito')),
  fecha DATE NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Campos específicos de crédito (null para contado)
  periodicidad TEXT CHECK (periodicidad IN ('semanal', 'quincenal', 'mensual')),
  fecha_primer_pago DATE,
  entrega_despues_pago BOOLEAN DEFAULT false,
  estado_credito TEXT CHECK (estado_credito IN ('activo', 'liquidado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Detalle de la venta (líneas de producto)
CREATE TABLE ventas_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at para ventas
CREATE TRIGGER trg_ventas_updated_at
BEFORE UPDATE ON ventas
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Índices
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX idx_ventas_vendedor ON ventas(vendedor_id);
CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_tipo ON ventas(tipo_venta);
CREATE INDEX idx_ventas_detalle_venta ON ventas_detalle(venta_id);
CREATE INDEX idx_ventas_detalle_producto ON ventas_detalle(producto_id);

-- RLS
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON ventas
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated full access" ON ventas_detalle
FOR ALL USING (auth.role() = 'authenticated');
