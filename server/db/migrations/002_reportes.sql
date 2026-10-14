-- 002: reportes ciudadanos y votos de la comunidad.

CREATE TYPE report_category AS ENUM (
  'anegamiento', 'desborde', 'corte_ruta', 'corte_luz', 'arbol_caido', 'otro'
);

CREATE TYPE report_status AS ENUM ('activo', 'resuelto', 'oculto');

CREATE TABLE emergency_reports (
  id            BIGSERIAL PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  category      report_category NOT NULL,
  comuna_cut    CHAR(5) NOT NULL REFERENCES comunas(cut),
  geom          GEOMETRY(Point, 4326) NOT NULL,
  description   VARCHAR(500),
  status        report_status NOT NULL DEFAULT 'activo',
  confirmations INT NOT NULL DEFAULT 0,
  flags         INT NOT NULL DEFAULT 0,
  reporter_hash TEXT,  -- hash rotativo diario, solo para limitar envíos; no identifica a la persona
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '12 hours'
);

CREATE INDEX reports_geom_idx     ON emergency_reports USING GIST (geom);
CREATE INDEX reports_active_idx   ON emergency_reports (status, expires_at);
CREATE INDEX reports_comuna_idx   ON emergency_reports (comuna_cut, status, expires_at);
CREATE INDEX reports_reporter_idx ON emergency_reports (reporter_hash, created_at);

CREATE TABLE report_votes (
  report_id  BIGINT REFERENCES emergency_reports(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  vote       SMALLINT NOT NULL CHECK (vote IN (1, -1)),  -- 1 = "sigue así", -1 = "ya no / falso"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, voter_hash)
);
