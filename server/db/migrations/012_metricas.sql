-- 012: métricas de uso sin datos personales, para el panel de zumichile.com/panel.
-- Cada instalación manda un «latido» al abrir la app con un identificador al azar que la app inventa
-- (no es el teléfono ni la persona). El servidor guarda solo su huella (SHA-256 con sal), la comuna y
-- la plataforma. Con eso se cuentan usuarios activos y nuevos; no se puede saber quién es nadie.
CREATE TABLE IF NOT EXISTS metricas_instalaciones (
  huella       TEXT PRIMARY KEY,
  primera_vez  DATE NOT NULL DEFAULT CURRENT_DATE,
  plataforma   TEXT NOT NULL DEFAULT 'web',
  comuna_cut   CHAR(5),
  avisos       BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS metricas_dias (
  dia     DATE NOT NULL DEFAULT CURRENT_DATE,
  huella  TEXT NOT NULL,
  PRIMARY KEY (dia, huella)
);
CREATE TABLE IF NOT EXISTS metricas_eventos (
  dia     DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo    TEXT NOT NULL,
  n       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, tipo)
);
