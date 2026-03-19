-- Update admin user email to match username convention
UPDATE auth.users
SET email = 'admin@notasdearen.local'
WHERE email = 'olanoscar@gmail.com';
