-- Create precios_historico table
CREATE TABLE precios_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio_compra numeric NOT NULL,
  precio_venta_contado numeric NOT NULL,
  precio_venta_credito numeric NOT NULL,
  activo boolean NOT NULL DEFAULT false,
  origen text NOT NULL CHECK (origen IN ('inventario', 'entrada')),
  usuario_id uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active price per product
CREATE UNIQUE INDEX idx_precio_activo_unico
  ON precios_historico(producto_id)
  WHERE activo = true;

-- Index for fast lookups by product
CREATE INDEX idx_precios_historico_producto
  ON precios_historico(producto_id, created_at DESC);

-- Enable RLS
ALTER TABLE precios_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read precios_historico"
  ON precios_historico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert precios_historico"
  ON precios_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update precios_historico"
  ON precios_historico FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
