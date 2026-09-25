-- Restringir la edición y el borrado de entradas a administradores.
--
-- Hasta ahora entradas y entradas_detalle tenían una sola política
-- "Authenticated full access" FOR ALL, así que a nivel de base cualquier
-- usuario autenticado podía borrarlas. Eso daba igual mientras la aplicación
-- no ofreciera el borrado —el único control era la redirección del layout—,
-- pero al exponerlo hay que respaldarlo donde de verdad se aplica.
--
-- SELECT e INSERT se dejan como estaban: la página de entradas ya es
-- admin-only por ruta, y estrecharlos aquí no aporta y sí puede romper el alta.

-- Helper de rol. SECURITY DEFINER para que pueda usarse dentro de políticas
-- sin depender de las políticas de la propia tabla vendedores.
-- auth.uid() va calificado porque search_path queda fijado.
CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vendedores
     WHERE auth_user_id = auth.uid()
       AND rol = 'admin'
       AND activo
  );
$$;

REVOKE EXECUTE ON FUNCTION fn_es_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_es_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated full access" ON entradas;
DROP POLICY IF EXISTS "entradas_select" ON entradas;
DROP POLICY IF EXISTS "entradas_insert" ON entradas;
DROP POLICY IF EXISTS "entradas_update_admin" ON entradas;
DROP POLICY IF EXISTS "entradas_delete_admin" ON entradas;

CREATE POLICY "entradas_select" ON entradas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "entradas_insert" ON entradas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entradas_update_admin" ON entradas
  FOR UPDATE TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());
CREATE POLICY "entradas_delete_admin" ON entradas
  FOR DELETE TO authenticated USING (fn_es_admin());

DROP POLICY IF EXISTS "Authenticated full access" ON entradas_detalle;
DROP POLICY IF EXISTS "entradas_detalle_select" ON entradas_detalle;
DROP POLICY IF EXISTS "entradas_detalle_insert" ON entradas_detalle;
DROP POLICY IF EXISTS "entradas_detalle_update_admin" ON entradas_detalle;
DROP POLICY IF EXISTS "entradas_detalle_delete_admin" ON entradas_detalle;

CREATE POLICY "entradas_detalle_select" ON entradas_detalle
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "entradas_detalle_insert" ON entradas_detalle
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entradas_detalle_update_admin" ON entradas_detalle
  FOR UPDATE TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());
CREATE POLICY "entradas_detalle_delete_admin" ON entradas_detalle
  FOR DELETE TO authenticated USING (fn_es_admin());
