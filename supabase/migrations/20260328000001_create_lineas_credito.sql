-- Create lineas_credito table
CREATE TABLE lineas_credito (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  vendedor_id uuid REFERENCES vendedores(id),
  saldo_total numeric NOT NULL DEFAULT 0,
  saldo_pagado numeric NOT NULL DEFAULT 0,
  meses_credito integer NOT NULL DEFAULT 2,
  periodicidad text NOT NULL DEFAULT 'quincenal' CHECK (periodicidad IN ('semanal','quincenal','mensual')),
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_siguiente_pago date,
  fecha_cobro_especifica date,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','liquidada','suspendida')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index: only one active line per client
CREATE UNIQUE INDEX idx_linea_credito_activa ON lineas_credito (cliente_id) WHERE estado = 'activa';

-- Add linea_credito_id FK to ventas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS linea_credito_id uuid REFERENCES lineas_credito(id);

-- Add linea_credito_id FK to pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS linea_credito_id uuid REFERENCES lineas_credito(id);

-- Add linea_credito_id FK to cobranza_seguimiento
ALTER TABLE cobranza_seguimiento ADD COLUMN IF NOT EXISTS linea_credito_id uuid REFERENCES lineas_credito(id);

-- RLS policies
ALTER TABLE lineas_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON lineas_credito FOR ALL TO authenticated USING (true) WITH CHECK (true);
