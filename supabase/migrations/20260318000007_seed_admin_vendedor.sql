-- Seed the existing admin user into vendedores table
INSERT INTO vendedores (nombre, telefono, usuario, rol, auth_user_id, debe_cambiar_password)
SELECT 'Administrador', '', 'admin', 'admin', id, false
FROM auth.users
LIMIT 1;
