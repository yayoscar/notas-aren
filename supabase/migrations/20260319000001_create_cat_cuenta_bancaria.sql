-- Catálogo de cuentas bancarias (para pagos por transferencia)
CREATE TABLE cat_cuenta_bancaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  clabe TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

ALTER TABLE cat_cuenta_bancaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON cat_cuenta_bancaria
FOR ALL USING (auth.role() = 'authenticated');

-- Catálogo de categorías de gasto
CREATE TABLE cat_categoria_gasto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

ALTER TABLE cat_categoria_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON cat_categoria_gasto
FOR ALL USING (auth.role() = 'authenticated');

-- Seed categorías iniciales
INSERT INTO cat_categoria_gasto (nombre) VALUES
  ('Renta'),
  ('Servicios'),
  ('Insumos'),
  ('Transporte'),
  ('Publicidad'),
  ('Otros');
