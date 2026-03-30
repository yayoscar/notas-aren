-- Create configuracion table (key-value store)
CREATE TABLE IF NOT EXISTS configuracion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default WhatsApp reminder message
INSERT INTO configuracion (key, value) VALUES (
  'recordatorio_whatsapp',
  'Hola {nombre}, te recordamos que tienes un pago pendiente de {monto} con fecha {fecha_pago}. Tu saldo actual es de {saldo}. Gracias por tu preferencia. — Notas de Aren'
) ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Read policy: all authenticated users
CREATE POLICY "configuracion_read" ON configuracion
  FOR SELECT TO authenticated USING (true);

-- Write policy: only admin vendors
CREATE POLICY "configuracion_write" ON configuracion
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendedores
      WHERE vendedores.auth_user_id = auth.uid()
      AND vendedores.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendedores
      WHERE vendedores.auth_user_id = auth.uid()
      AND vendedores.rol = 'admin'
    )
  );
