-- Descuento aplicado a un ítem específico del detalle de venta.
-- Relación 0..1 con ventas_detalle (UNIQUE sobre venta_detalle_id).
-- ON DELETE CASCADE desde ventas_detalle: si se borra el detalle, se borra el descuento.
-- ON DELETE RESTRICT sobre tipo_descuento_id: respaldo extra — la app usa soft-delete.
CREATE TABLE ventas_detalle_descuento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_detalle_id UUID NOT NULL UNIQUE REFERENCES ventas_detalle(id) ON DELETE CASCADE,
  tipo_descuento_id UUID NOT NULL REFERENCES cat_tipo_descuento(id) ON DELETE RESTRICT,
  porcentaje_aplicado SMALLINT NOT NULL CHECK (porcentaje_aplicado BETWEEN 0 AND 100),
  precio_original NUMERIC(12,2) NOT NULL,
  precio_final NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vdd_tipo ON ventas_detalle_descuento(tipo_descuento_id);

ALTER TABLE ventas_detalle_descuento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON ventas_detalle_descuento
FOR ALL USING (auth.role() = 'authenticated');
