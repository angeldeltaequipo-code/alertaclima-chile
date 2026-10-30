-- Cobro web con Flow.cl (reemplaza a Mercado Pago).
ALTER TABLE suscripciones DROP CONSTRAINT IF EXISTS suscripciones_origen_check;
ALTER TABLE suscripciones ADD CONSTRAINT suscripciones_origen_check CHECK (origen IN ('mercadopago', 'flow', 'apple', 'google', 'cortesia'));
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS flow_cliente TEXT;
CREATE INDEX IF NOT EXISTS usuarios_flow_cliente ON usuarios (flow_cliente) WHERE flow_cliente IS NOT NULL;
