-- 005: notificaciones (Web Push).

-- Configuración del servidor que se genera sola la primera vez (claves VAPID).
CREATE TABLE IF NOT EXISTS server_config (
  clave     TEXT PRIMARY KEY,
  valor     TEXT NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una suscripción por navegador. El endpoint lo entrega el servicio de notificaciones
-- del teléfono (Google, Apple, Mozilla); no identifica a la persona.
CREATE TABLE push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_ok   TIMESTAMPTZ,
  fallos      INT NOT NULL DEFAULT 0
);

CREATE TABLE push_subscription_comunas (
  subscription_id BIGINT REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  comuna_cut      CHAR(5) REFERENCES comunas(cut),
  PRIMARY KEY (subscription_id, comuna_cut)
);
CREATE INDEX push_sub_comunas_cut_idx ON push_subscription_comunas (comuna_cut);
