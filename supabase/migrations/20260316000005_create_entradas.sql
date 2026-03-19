CREATE TABLE entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL DEFAULT '',
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_factura DATE,
  numero_factura TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entradas_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Función: Folio automático ENT-YYYY-NNNN
CREATE OR REPLACE FUNCTION fn_generar_folio_entrada()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM entradas
  WHERE folio LIKE 'ENT-' || v_year || '-%';

  NEW.folio := 'ENT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_folio_entrada
BEFORE INSERT ON entradas
FOR EACH ROW
WHEN (NEW.folio IS NULL OR NEW.folio = '')
EXECUTE FUNCTION fn_generar_folio_entrada();

-- Función: Actualizar stock al insertar detalle de entrada
CREATE OR REPLACE FUNCTION fn_actualizar_stock_entrada()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_antes INTEGER;
BEGIN
  SELECT stock_actual INTO v_stock_antes FROM productos WHERE id = NEW.producto_id;

  UPDATE productos
  SET stock_actual = stock_actual + NEW.cantidad,
      updated_at = now()
  WHERE id = NEW.producto_id;

  INSERT INTO stock_movimientos (
    producto_id, tipo, cantidad, stock_antes, stock_despues,
    referencia_id, referencia_tipo
  ) VALUES (
    NEW.producto_id, 'ENTRADA_COMPRA', NEW.cantidad,
    v_stock_antes, v_stock_antes + NEW.cantidad,
    NEW.entrada_id, 'entrada'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_entrada
AFTER INSERT ON entradas_detalle
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock_entrada();
