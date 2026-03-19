-- Enable RLS on all tables
ALTER TABLE cat_genero ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_tamano ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_presentacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_concentracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_tipo_perfume ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas_detalle ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users have full access (single-tenant app)
CREATE POLICY "Authenticated full access" ON cat_genero FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON cat_tamano FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON cat_presentacion FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON cat_concentracion FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON cat_tipo_perfume FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON proveedores FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON productos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON stock_movimientos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON entradas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access" ON entradas_detalle FOR ALL USING (auth.role() = 'authenticated');
