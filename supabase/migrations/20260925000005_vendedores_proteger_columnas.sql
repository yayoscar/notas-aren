-- Proteger las columnas privilegiadas de vendedores.
--
-- La política RLS de la tabla es "Authenticated users can update vendedores"
-- FOR UPDATE USING (true) WITH CHECK (true): hasta ahora cualquier usuario
-- autenticado podía escribir cualquier fila de vendedores desde el navegador,
-- incluida la suya, y por tanto ascenderse a rol = 'admin'. Al exponer la
-- desactivación de perfiles eso deja de ser tolerable: un vendedor podría
-- reactivarse solo.
--
-- Se hace con un trigger y no con REVOKE UPDATE (rol, activo, ...), que sería
-- la herramienta idiomática, porque supabase/seed.sql ejecuta
-- GRANT ALL ON ALL TABLES en cada `npm run db:reset`. Un permiso revocado por
-- migración volvería a concederse en local y la base local dejaría de
-- comportarse como producción: justo la deriva que db:check-drift existe para
-- detectar. Un trigger no lo puede deshacer ningún GRANT.
--
-- Protege columnas concretas, no la fila entera, porque hay una autoedición
-- legítima que debe seguir funcionando: /cambiar-password limpia
-- debe_cambiar_password sobre la propia fila del usuario.

CREATE OR REPLACE FUNCTION fn_proteger_columnas_vendedor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.activo IS DISTINCT FROM OLD.activo
     OR NEW.usuario IS DISTINCT FROM OLD.usuario
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
  THEN
    -- auth.uid() es NULL cuando escribe el servidor con la clave de servicio
    -- (las rutas de API, que ya verifican el rol) o una migración.
    IF auth.uid() IS NOT NULL AND NOT fn_es_admin() THEN
      RAISE EXCEPTION
        'Sólo un administrador puede cambiar el rol, el estado o el usuario de un vendedor'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_columnas_vendedor ON vendedores;

CREATE TRIGGER trg_proteger_columnas_vendedor
BEFORE UPDATE ON vendedores
FOR EACH ROW EXECUTE FUNCTION fn_proteger_columnas_vendedor();

-- La tabla nunca tuvo política FOR DELETE, así que cualquier DELETE desde el
-- cliente afectaba silenciosamente a 0 filas. Ahora que el borrado existe,
-- queda declarado y restringido.
DROP POLICY IF EXISTS "Administradores pueden eliminar vendedores" ON vendedores;

CREATE POLICY "Administradores pueden eliminar vendedores"
  ON vendedores FOR DELETE TO authenticated
  USING (fn_es_admin());
