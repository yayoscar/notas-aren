-- Folio de entrada tolerante a huecos en la numeración.
--
-- La versión original numeraba con COUNT(*) + 1 sobre los folios del año. Eso
-- funciona mientras nunca se borre una entrada: en cuanto hay un hueco, el
-- conteo vuelve a caer sobre un número ya emitido y el INSERT muere contra
-- entradas_folio_key (23505). Al habilitarse el borrado de entradas, el bug
-- dejaba de ser teórico: el primer borrado rompía el siguiente alta.
--
-- MAX + 1 tolera los huecos y nunca reasigna el folio de una entrada viva.
-- El folio de la última entrada del año sí vuelve a quedar libre si se borra,
-- lo cual es deliberado: garantizar lo contrario exigiría una tabla contador
-- persistente, y con ella entrar en la lista de respaldo y en las columnas
-- explícitas de restore_database.
--
-- La concurrencia no cambia: dos altas simultáneas pueden seguir chocando
-- contra el UNIQUE, igual que antes. fn_generar_folio_venta arrastra el mismo
-- defecto, pero las ventas no se borran y quedan fuera de este cambio.

CREATE OR REPLACE FUNCTION fn_generar_folio_entrada()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(substring(folio from '[0-9]+$')::INTEGER), 0) + 1
    INTO v_next
    FROM entradas
   WHERE folio ~ ('^ENT-' || v_year || '-[0-9]+$');

  NEW.folio := 'ENT-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
