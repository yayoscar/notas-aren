-- Add DELETE policy on clientes table (RLS was enabled but DELETE was missing)
CREATE POLICY "Authenticated users can delete clientes"
  ON clientes FOR DELETE TO authenticated
  USING (true);
