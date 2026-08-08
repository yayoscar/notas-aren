-- =====================================================================
-- Permisos de tabla para los roles de la API (SÓLO ENTORNO LOCAL)
--
-- Las versiones recientes de Supabase cambiaron los DEFAULT PRIVILEGES del
-- rol `postgres`: las tablas creadas por las migraciones ya sólo reciben
-- Dxtm (DELETE, TRUNCATE, REFERENCES, TRIGGER) para anon/authenticated/
-- service_role, sin SELECT/INSERT/UPDATE. El proyecto de producción se creó
-- con el comportamiento antiguo (privilegios completos), así que sin este
-- bloque la base local devolvería "permission denied" en cada consulta.
--
-- Esto reproduce la postura de producción: los permisos de tabla son
-- amplios y quien realmente protege los datos es RLS, habilitado en la
-- migración 20260316000006_enable_rls.sql.
--
-- Este archivo lo ejecuta únicamente `supabase db reset` sobre el stack
-- local; nunca se aplica al proyecto alojado.
--
-- Deliberadamente NO se otorgan permisos sobre funciones: `restore_database`
-- y `get_table_columns` revocan el acceso a PUBLIC/anon/authenticated a
-- propósito y sólo lo conceden a service_role.
-- =====================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Datos iniciales de catálogos
INSERT INTO cat_genero (nombre) VALUES ('Masculino'),('Femenino'),('Unisex');
INSERT INTO cat_tamano (ml, etiqueta) VALUES (50,'50 ml'),(100,'100 ml'),(125,'125 ml');
INSERT INTO cat_presentacion (nombre) VALUES
  ('Individual'),('Set'),('Kit'),('Edición Especial'),('Navideña');
INSERT INTO cat_concentracion (nombre) VALUES
  ('Eau de Toilette'),('Eau de Parfum');
INSERT INTO cat_tipo_perfume (nombre) VALUES
  ('Diseñador'),('Árabe'),('Nicho');
