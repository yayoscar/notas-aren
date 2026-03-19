CREATE TABLE cat_genero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE cat_tamano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml INTEGER NOT NULL,
  etiqueta TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE cat_presentacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE cat_concentracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE cat_tipo_perfume (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);
