-- 006: cuentas (inicio de sesión con Google) y chat por comuna.

-- Datos mínimos de cada persona (Ley 21.719): el identificador de Google, el nombre que se
-- muestra (nombre e inicial del apellido) y la foto. No se guarda el correo.
CREATE TABLE usuarios (
  id              BIGSERIAL PRIMARY KEY,
  google_sub      TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  foto_url        TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_ingreso  TIMESTAMPTZ NOT NULL DEFAULT now(),
  bloqueado       BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueo  TEXT
);

CREATE TABLE chat_mensajes (
  id          BIGSERIAL PRIMARY KEY,
  comuna_cut  CHAR(5) NOT NULL REFERENCES comunas(cut),
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  oculto      BOOLEAN NOT NULL DEFAULT false,
  oculto_por  TEXT CHECK (oculto_por IN ('denuncias', 'moderacion', 'autor')),
  denuncias   INT NOT NULL DEFAULT 0
);
CREATE INDEX chat_mensajes_comuna_idx ON chat_mensajes (comuna_cut, id DESC);

CREATE TABLE chat_denuncias (
  mensaje_id  BIGINT REFERENCES chat_mensajes(id) ON DELETE CASCADE,
  usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mensaje_id, usuario_id)
);

-- Quién hizo cada reporte (para moderar abusos). Si la persona borra su cuenta, el reporte queda sin autor.
ALTER TABLE emergency_reports ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL;
