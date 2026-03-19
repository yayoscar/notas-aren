-- Función: Folio automático VTA-YYYY-NNNN
CREATE OR REPLACE FUNCTION fn_generar_folio_venta()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM ventas
  WHERE folio LIKE 'VTA-' || v_year || '-%';

  NEW.folio := 'VTA-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_folio_venta
BEFORE INSERT ON ventas
FOR EACH ROW
WHEN (NEW.folio IS NULL OR NEW.folio = '')
EXECUTE FUNCTION fn_generar_folio_venta();
