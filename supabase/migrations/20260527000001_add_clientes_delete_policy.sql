-- Add DELETE policy on clientes table (RLS was enabled but DELETE was missing)
--
-- Idempotente a propósito: esta política ya existe en producción —se aplicó a
-- mano antes de que la migración quedara registrada—, así que un
-- `supabase db push` fallaría con 42710 (duplicate_object) sin el DROP previo.
-- El DROP y el CREATE corren dentro de la misma transacción de la migración,
-- de modo que no hay ningún instante en que la tabla quede sin la política.
DROP POLICY IF EXISTS "Authenticated users can delete clientes" ON clientes;

CREATE POLICY "Authenticated users can delete clientes"
  ON clientes FOR DELETE TO authenticated
  USING (true);
