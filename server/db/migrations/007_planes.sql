-- 007: planes de pago (SaaS). Una fila por suscripción, venga de la web (Mercado Pago),
-- del App Store / Google Play (RevenueCat) o regalada por el equipo (cortesía).
CREATE TABLE suscripciones (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'familia',
  origen        TEXT NOT NULL CHECK (origen IN ('mercadopago', 'apple', 'google', 'cortesia')),
  externo_id    TEXT,                       -- id de la suscripción en el proveedor
  periodo       TEXT NOT NULL DEFAULT 'mensual' CHECK (periodo IN ('mensual', 'anual')),
  estado        TEXT NOT NULL CHECK (estado IN ('pendiente', 'prueba', 'activa', 'cancelada', 'vencida', 'problema_pago')),
  monto_clp     INT,                        -- lo que paga la persona por periodo
  vence_en      TIMESTAMPTZ,                -- hasta cuándo tiene el plan (null = sin fecha)
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origen, externo_id)
);
CREATE INDEX suscripciones_usuario_idx ON suscripciones (usuario_id);

-- Historial de cambios (para métricas: altas, cancelaciones, renovaciones).
CREATE TABLE suscripcion_eventos (
  id             BIGSERIAL PRIMARY KEY,
  suscripcion_id BIGINT REFERENCES suscripciones(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  detalle        JSONB,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Correo solo para cobrar en la web (Mercado Pago lo exige); no se usa para nada más.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo_cobro TEXT;
