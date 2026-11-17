-- 010: audios de la voz de ZUMI ya generados. Así una frase se paga (o gasta cupo) una sola vez,
-- aunque el servidor se reinicie, y las frases comunes (reportes de una comuna) se comparten.
CREATE TABLE IF NOT EXISTS voz_cache (
  clave     TEXT PRIMARY KEY,
  wav       BYTEA NOT NULL,
  usos      INT NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voz_cache_usado_idx ON voz_cache (usado_en);
