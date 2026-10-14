-- 004: fotos en los reportes vecinales, con denuncias de la comunidad y revisión.

-- Clave para que solo quien creó el reporte pueda agregarle la foto (se guarda solo su hash).
ALTER TABLE emergency_reports ADD COLUMN clave_edicion_hash TEXT;

CREATE TABLE report_photos (
  id          BIGSERIAL PRIMARY KEY,
  report_id   BIGINT NOT NULL UNIQUE REFERENCES emergency_reports(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/webp')),
  datos       BYTEA,                 -- NULL si un administrador la eliminó
  bytes       INT NOT NULL,
  denuncias   INT NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculta', 'eliminada')),
  creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revisada_en TIMESTAMPTZ
);
CREATE INDEX report_photos_estado_idx ON report_photos (estado, creada_en);

CREATE TABLE photo_flags (
  photo_id   BIGINT REFERENCES report_photos(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  creada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, voter_hash)
);
