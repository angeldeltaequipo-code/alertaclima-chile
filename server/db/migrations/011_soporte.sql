-- 011: chat de soporte del sitio (zumichile.com). Angel, el fundador, responde desde zumichile.com/soporte/.
-- Cada conversación tiene un identificador al azar que solo conoce el navegador de quien escribió.
CREATE TABLE IF NOT EXISTS soporte_conversaciones (
  id             TEXT PRIMARY KEY,
  nombre         TEXT,
  contacto       TEXT,
  pagina         TEXT,
  creada_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  sin_leer       INT NOT NULL DEFAULT 0,
  visto_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS soporte_conv_act_idx ON soporte_conversaciones (actualizada_en DESC);

CREATE TABLE IF NOT EXISTS soporte_mensajes (
  id        BIGSERIAL PRIMARY KEY,
  conv_id   TEXT NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
  autor     TEXT NOT NULL CHECK (autor IN ('visita', 'angel')),
  texto     TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS soporte_msg_conv_idx ON soporte_mensajes (conv_id, id);
