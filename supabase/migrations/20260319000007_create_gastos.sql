-- Tabla de gastos / egresos
CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  categoria_id UUID NOT NULL REFERENCES cat_categoria_gasto(id),
  fecha DATE NOT NULL,
  vendedor_id UUID NOT NULL REFERENCES vendedores(id),
  tipo_pago TEXT NOT NULL CHECK (tipo_pago IN ('efectivo', 'transferencia', 'retiro_sin_tarjeta')),
  cuenta_bancaria_id UUID REFERENCES cat_cuenta_bancaria(id),
  comprobante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER trg_gastos_updated_at
BEFORE UPDATE ON gastos
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Índices
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_categoria ON gastos(categoria_id);

-- RLS
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON gastos
FOR ALL USING (auth.role() = 'authenticated');
