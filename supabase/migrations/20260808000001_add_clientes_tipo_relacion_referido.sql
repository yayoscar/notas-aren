-- =====================================================================
-- Alinea el repositorio con producción.
--
-- `clientes.tipo_relacion_referido` existía en el proyecto alojado pero
-- ninguna migración la creaba: se añadió a mano y nunca se versionó. Se
-- detectó con `npm run db:check-drift`.
--
-- Texto libre que describe la relación con quien refirió al cliente
-- (`clientes.cliente_referido_id`). Se replica la definición exacta de
-- producción: text, nulable, sin default, sin constraint ni índice.
--
-- `IF NOT EXISTS` hace la migración idempotente, de modo que aplicarla
-- contra producción —donde la columna ya existe— no tiene efecto.
-- =====================================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_relacion_referido text;
