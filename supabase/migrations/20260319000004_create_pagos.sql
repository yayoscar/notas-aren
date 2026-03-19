-- Tabla unificada de pagos (contado y abonos a crédito)
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  tipo_pago TEXT NOT NULL CHECK (tipo_pago IN ('efectivo', 'transferencia', 'retiro_sin_tarjeta')),
  cuenta_bancaria_id UUID REFERENCES cat_cuenta_bancaria(id),
  vendedor_id UUID NOT NULL REFERENCES vendedores(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_pagos_venta ON pagos(venta_id);
CREATE INDEX idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha);

-- RLS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON pagos
FOR ALL USING (auth.role() = 'authenticated');
