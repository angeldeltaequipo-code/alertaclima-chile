-- 001: extensión PostGIS y tabla de comunas.
-- Las tablas de reportes se agregan en la Fase 2 (002_reportes.sql).

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS comunas (
  cut           CHAR(5) PRIMARY KEY,
  nombre        TEXT NOT NULL,
  region_cut    CHAR(2) NOT NULL,
  region_nombre TEXT NOT NULL,
  geom          GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS comunas_geom_idx ON comunas USING GIST (geom);
