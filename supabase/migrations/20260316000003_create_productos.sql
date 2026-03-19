CREATE TABLE productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  marca TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  genero_id UUID REFERENCES cat_genero(id),
  tamano_id UUID REFERENCES cat_tamano(id),
  presentacion_id UUID REFERENCES cat_presentacion(id),
  concentracion_id UUID REFERENCES cat_concentracion(id),
  tipo_perfume_id UUID REFERENCES cat_tipo_perfume(id),
  proveedor_id UUID REFERENCES proveedores(id),
  precio_compra NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_venta_contado NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_venta_credito NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_mayoreo NUMERIC(10,2) DEFAULT 0,
  comision_porcentaje NUMERIC(5,2) DEFAULT 10.00,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER DEFAULT 5,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_updated_at
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
