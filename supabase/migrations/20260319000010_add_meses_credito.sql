-- Agregar campo meses_credito a ventas (plazo del crédito en meses: 1-3, default 2)
ALTER TABLE ventas
ADD COLUMN meses_credito SMALLINT DEFAULT 2 CHECK (meses_credito BETWEEN 1 AND 3);
