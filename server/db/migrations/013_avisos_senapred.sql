-- 013: avisos automáticos de las alertas de SENAPRED.
-- Cada alerta nueva (o que sube de nivel) se notifica UNA vez; esta tabla lo recuerda aunque el servidor
-- se reinicie, y guarda cuánto tardó el aviso desde que SENAPRED la publicó (para el panel).
CREATE TABLE IF NOT EXISTS senapred_avisados (
  id          TEXT PRIMARY KEY,
  nivel       TEXT NOT NULL,
  amenaza     TEXT,
  publicada   TIMESTAMPTZ,
  avisada     TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviadas    INT NOT NULL DEFAULT 0,
  latencia_s  INT
);
CREATE INDEX IF NOT EXISTS senapred_avisados_avisada ON senapred_avisados (avisada DESC);
