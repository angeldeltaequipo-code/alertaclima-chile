-- 003: alertas oficiales (cargadas a mano por un administrador, con fuente obligatoria)
-- y bitácora de todo lo que se hace en el panel.

CREATE TYPE alert_level AS ENUM ('preventiva', 'amarilla', 'roja', 'evacuacion');
CREATE TYPE alert_state AS ENUM ('vigente', 'cancelada');

CREATE TABLE official_alerts (
  id            BIGSERIAL PRIMARY KEY,
  nivel         alert_level NOT NULL,
  amenaza       VARCHAR(80) NOT NULL,          -- ej. "Sistema frontal", "Desborde de ríos"
  titulo        VARCHAR(160) NOT NULL,
  descripcion   VARCHAR(1500),
  instrucciones VARCHAR(1000),                  -- qué hacer, según la fuente oficial
  fuente_nombre VARCHAR(80) NOT NULL,           -- ej. "SENAPRED"
  fuente_url    VARCHAR(500) NOT NULL CHECK (fuente_url ~ '^https://'),
  origen        VARCHAR(40) NOT NULL DEFAULT 'manual', -- 'manual' o el nombre de una integración futura
  estado        alert_state NOT NULL DEFAULT 'vigente',
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta TIMESTAMPTZ,                    -- NULL = hasta que se cancele
  confirmada_en TIMESTAMPTZ NOT NULL DEFAULT now(), -- última vez que alguien verificó que sigue vigente
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE official_alert_comunas (
  alert_id   BIGINT REFERENCES official_alerts(id) ON DELETE CASCADE,
  comuna_cut CHAR(5) REFERENCES comunas(cut),
  PRIMARY KEY (alert_id, comuna_cut)
);
CREATE INDEX official_alert_comunas_cut_idx ON official_alert_comunas (comuna_cut);
CREATE INDEX official_alerts_estado_idx ON official_alerts (estado, vigente_hasta);

CREATE TABLE admin_log (
  id         BIGSERIAL PRIMARY KEY,
  accion     TEXT NOT NULL,
  detalle    JSONB,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
