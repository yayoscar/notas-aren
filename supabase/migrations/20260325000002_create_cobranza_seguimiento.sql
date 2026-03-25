-- Track attendance status per credit per collection period
CREATE TABLE cobranza_seguimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual')),
  atendido BOOLEAN DEFAULT false,
  fecha_atendido TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venta_id, periodo_inicio)
);

CREATE INDEX idx_cobranza_seg_periodo ON cobranza_seguimiento(periodo_inicio);
CREATE INDEX idx_cobranza_seg_venta ON cobranza_seguimiento(venta_id);

CREATE TRIGGER trg_cobranza_seguimiento_updated_at
  BEFORE UPDATE ON cobranza_seguimiento
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE cobranza_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON cobranza_seguimiento
  FOR ALL USING (auth.role() = 'authenticated');
