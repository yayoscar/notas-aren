-- Drop existing generic update policy on clientes
DROP POLICY IF EXISTS "Authenticated users can update clientes" ON clientes;

-- Vendedor can only update their own clients, admin can update all
CREATE POLICY "Vendedor edita solo sus clientes"
  ON clientes FOR UPDATE TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM vendedores WHERE auth_user_id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    usuario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM vendedores WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );
