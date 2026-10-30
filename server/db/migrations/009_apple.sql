-- Iniciar sesión con Apple (obligatorio en la app de iPhone si se ofrece Google).
ALTER TABLE usuarios ALTER COLUMN google_sub DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apple_sub TEXT UNIQUE;
