# AlertaClima Chile — Instrucciones para Claude Code

Vas a construir **AlertaClima Chile**, una aplicación web progresiva (PWA) para seguir emergencias climáticas en Chile (sistemas frontales, inundaciones, desbordes de ríos). Las personas la van a usar **desde el celular, con mala señal, poca batería y bajo estrés**. Cada decisión técnica y de diseño se mide contra ese escenario.

Trabaja **por fases**. Al terminar cada fase: corre las pruebas, resume qué hiciste, lista lo pendiente y **detente a esperar mi confirmación** antes de seguir con la siguiente.

---

## Reglas que no se negocian

1. **Nunca inventes datos oficiales.** No inventes alertas de SENAPRED, niveles de ríos, URLs ni endpoints de APIs. Si necesitas una fuente externa, revisa su documentación actual. Si no puedes confirmarla, deja un adaptador con datos de prueba claramente rotulados en pantalla como **"DATOS DE PRUEBA"** y avísame.
2. **Separa siempre lo oficial de lo comunitario.** Las alertas oficiales y los reportes vecinales deben verse distintos (color, ícono, etiqueta). Toda alerta oficial muestra su fuente y la hora de su última actualización.
3. **La app debe seguir siendo útil sin conexión.** Si el servidor cae, se muestra la última información guardada con un aviso visible de "Sin conexión — datos de las HH:MM".
4. **Privacidad.** Los reportes guardan la ubicación del *incidente*, no un historial de la persona. No hay cuentas de usuario en el MVP. No guardes IPs en texto plano. Todo esto debe ser compatible con la Ley 21.719 de protección de datos personales.
5. **Si algo de este documento es ambiguo o contradictorio, pregúntame** antes de elegir por tu cuenta.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite, Tailwind CSS v4 (vía `@tailwindcss/vite`) |
| Mapas | Leaflet + react-leaflet |
| PWA | `vite-plugin-pwa` (Workbox) |
| Backend | Node.js + Express + Socket.io |
| Base de datos | PostgreSQL + PostGIS (imagen `postgis/postgis` en Docker Compose) |
| Push | Web Push con claves VAPID (librería `web-push`) |

Arranque sugerido (verifica las versiones actuales antes de instalar):

```bash
npm create vite@latest alertaclima-chile -- --template react
cd alertaclima-chile
npm install leaflet react-leaflet socket.io-client
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

### Estructura de carpetas

```
alertaclima-chile/
├── client/
│   └── src/
│       ├── components/   # UI: Mapa, SelectorComuna, BannerAlerta, FormReporte...
│       ├── hooks/        # useGeolocalizacion, useReportes, useConexion...
│       ├── services/     # api.js, socket.js, radar.js, alertas.js
│       └── data/         # regiones y comunas (estático)
├── server/
│   ├── routes/
│   ├── services/         # adaptadores de fuentes externas
│   ├── db/migrations/
│   └── index.js
└── docker-compose.yml
```

---

## Principios de interfaz

- **Alto contraste:** mínimo WCAG AA, apuntando a AAA en textos críticos. Tiene que leerse a pleno sol.
- **Modo oscuro por defecto** (ahorra batería en pantallas OLED), con un botón para cambiar a modo claro.
- Texto base de 16 px o más y áreas táctiles de 44 × 44 px o más. Tiene que poder usarse con una mano.
- **Modo ahorro:** pausa la animación del radar, reduce la frecuencia de actualización y desactiva efectos visuales. Se activa solo cuando la API de batería indica menos de 20 % (si el navegador la soporta), y también de forma manual.
- Nada de adornos: sin carruseles, sin animaciones decorativas, sin fuentes externas pesadas.
- Textos en español de Chile, cortos y directos ("Calle anegada", no "Se ha reportado una acumulación de agua").
- Carga inicial liviana: el bundle crítico debe ser menor a 200 KB gzip. Carga el mapa de forma diferida si hace falta.

---

## Fase 0 — Base del proyecto

- Monorepo con `client/` y `server/`, ESLint, Prettier y un `README.md` con instrucciones para correrlo.
- `docker-compose.yml` con PostGIS y el backend.
- `.env.example` con todas las variables necesarias (sin secretos reales).

**Listo cuando:** `docker compose up` levanta la base de datos y el servidor, y `npm run dev` levanta el cliente.

---

## Fase 1 — Mapa, comunas y radar (solo frontend)

1. **Selector de región y comuna:** las 16 regiones y 346 comunas, identificadas por su **código único territorial (CUT)** oficial. Obtén el listado de una fuente oficial (INE o SUBDERE). Si no puedes acceder a una, pídeme el archivo en vez de generarlo de memoria.
2. **Mapa Leaflet:** centrado en la ubicación del usuario (si la entrega) o en la comuna elegida, con zoom automático a la comuna seleccionada. La comuna elegida se recuerda localmente.
3. **Capa de radar de precipitación** animada y pausable. Revisa los términos y límites actuales de la API de RainViewer antes de integrarla. Encapsula el proveedor en `services/radar.js` para poder cambiarlo después. Indica en pantalla la hora del último cuadro de radar.
4. **PWA:** manifest, íconos, service worker que cachea la interfaz para abrirla sin conexión, e indicador visible de conexión/desconexión.

**Listo cuando:** la app se instala en Android y en iPhone, abre sin conexión, y el selector lleva el mapa a cualquier comuna.

---

## Fase 2 — Reportes ciudadanos

### Esquema de base de datos

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE comunas (
  cut           CHAR(5) PRIMARY KEY,
  nombre        TEXT NOT NULL,
  region_cut    CHAR(2) NOT NULL,
  region_nombre TEXT NOT NULL,
  geom          GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX comunas_geom_idx ON comunas USING GIST (geom);

CREATE TYPE report_category AS ENUM (
  'anegamiento', 'desborde', 'corte_ruta', 'corte_luz', 'arbol_caido', 'otro'
);

CREATE TYPE report_status AS ENUM ('activo', 'resuelto', 'oculto');

CREATE TABLE emergency_reports (
  id            BIGSERIAL PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  category      report_category NOT NULL,
  comuna_cut    CHAR(5) REFERENCES comunas(cut),
  geom          GEOMETRY(Point, 4326) NOT NULL,
  description   VARCHAR(500),
  status        report_status NOT NULL DEFAULT 'activo',
  confirmations INT NOT NULL DEFAULT 0,
  flags         INT NOT NULL DEFAULT 0,
  reporter_hash TEXT,  -- hash rotativo diario, solo para limitar envíos; no identifica a la persona
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '12 hours'
);
CREATE INDEX reports_geom_idx   ON emergency_reports USING GIST (geom);
CREATE INDEX reports_active_idx ON emergency_reports (status, expires_at);
CREATE INDEX reports_comuna_idx ON emergency_reports (comuna_cut);

CREATE TABLE report_votes (
  report_id  BIGINT REFERENCES emergency_reports(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  vote       SMALLINT NOT NULL CHECK (vote IN (1, -1)),  -- 1 = "sigue así", -1 = "ya no / falso"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, voter_hash)
);
```

Usa migraciones versionadas en `server/db/migrations/`, no SQL suelto.

### Comportamiento

- **Formulario rápido:** categoría (botones grandes con ícono), título opcional y descripción opcional. Por defecto toma el GPS del dispositivo, pero permite mover el pin, porque el incidente no siempre está donde está la persona.
- El servidor calcula `comuna_cut` con `ST_Contains`. No confíes en lo que mande el cliente.
- Las coordenadas se guardan redondeadas a 4 decimales (~11 m).
- **Límite de envíos:** máximo 5 reportes por hora por `reporter_hash`.
- **Confirmación comunitaria:** otros usuarios pueden marcar "sigue así" o "ya no está / es falso". Un reporte con 3 o más votos negativos netos pasa a `oculto` de forma automática. Las confirmaciones extienden `expires_at`.
- Los reportes vencidos dejan de mostrarse. Hay una tarea periódica que los limpia.
- **Tiempo real:** Socket.io por comuna (una sala por `comuna_cut`), con **polling cada 60 s como respaldo** si el WebSocket falla.
- Si se envía un reporte sin conexión, queda en cola y se manda al reconectar (Background Sync o cola propia).
- Los pines comunitarios muestran cuánto tiempo llevan ("hace 25 min") y cuántas confirmaciones tienen.

**Listo cuando:** dos navegadores en la misma comuna ven aparecer los reportes del otro en menos de 5 s, el límite de envíos funciona, y un reporte se oculta tras los votos negativos.

---

## Fase 3 — Alertas oficiales y datos hidrológicos

- **Banner superior fijo** con el estado vigente para la comuna: sin alerta / Alerta Temprana Preventiva / Alerta Amarilla / Alerta Roja / Evacuación. Siempre muestra la fuente y la hora de actualización.
- **Investiga y propónme** cómo obtener las alertas de SENAPRED de forma confiable (API, RSS, publicaciones oficiales). **No implementes scraping ni una integración sin mi aprobación.**
- Mientras tanto, implementa una interfaz `AlertSource` en `server/services/` y un **panel de administración protegido** donde una persona autorizada carga alertas a mano, con enlace obligatorio a la fuente oficial.
- Si una alerta tiene más de X horas sin confirmarse (configurable), el banner lo indica en vez de seguir mostrándola como vigente.
- **Opcional, a evaluar conmigo:** niveles de ríos en tiempo real desde las estaciones fluviométricas de la DGA. Investiga qué datos públicos existen y propónme la integración antes de construirla.

**Listo cuando:** el banner refleja las alertas cargadas en el panel, con fuente y hora, y nunca muestra una alerta sin fuente.

---

## Fase 4 — Notificaciones push

- Web Push con claves VAPID. La suscripción es por comuna (se pueden elegir varias).
- Solo se notifican alertas oficiales y cambios de nivel. **Los reportes vecinales no generan push** en el MVP, para evitar alarmas por reportes falsos.
- **iPhone:** las notificaciones web solo funcionan si la app está instalada en la pantalla de inicio. Detecta iOS y muestra una guía breve de instalación antes de ofrecer la suscripción.
- Opción clara para darse de baja.

**Listo cuando:** una alerta cargada en el panel llega como notificación a un Android y a un iPhone con la app instalada.

---

## Fase 5 — Panel Municipal (producto de pago para instituciones)

### Modelo de negocio (contexto para tus decisiones)

- **La app ciudadana es y seguirá siendo gratuita.** Nada de lo construido en las fases 1 a 4 se pone detrás de un pago.
- Lo que se vende es el **Panel Municipal**: una herramienta de gestión para la oficina de emergencias de cada municipalidad (y más adelante empresas, condominios o colegios), con suscripción anual.
- Los municipios **no pagan con tarjeta**: compran mediante orden de compra en Mercado Público y pagan contra factura electrónica. Por eso el sistema **no necesita pasarela de pago** en esta fase, sino gestionar planes y fechas de vigencia que actualiza un superadministrador.

### Multi-institución (multi-tenant)

```sql
CREATE TYPE org_type AS ENUM ('municipalidad', 'empresa', 'otro');
CREATE TYPE org_role AS ENUM ('admin', 'operador', 'lector');

CREATE TABLE organizations (
  id            BIGSERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,          -- ej. "Municipalidad de Linares"
  rut           VARCHAR(12) UNIQUE,
  tipo          org_type NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'piloto',
  vigente_hasta DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_comunas (     -- comunas que administra cada institución
  org_id     BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  comuna_cut CHAR(5) REFERENCES comunas(cut),
  PRIMARY KEY (org_id, comuna_cut)
);

CREATE TABLE org_users (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  rol        org_role NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE municipal_notices (        -- avisos publicados por la municipalidad
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT REFERENCES organizations(id),
  comuna_cut CHAR(5) REFERENCES comunas(cut),
  tipo       TEXT NOT NULL,             -- 'albergue', 'corte_ruta', 'punto_agua', 'aviso_general'
  titulo     VARCHAR(150) NOT NULL,
  cuerpo     VARCHAR(1000),
  geom       GEOMETRY(Point, 4326),
  vigente_hasta TIMESTAMPTZ,
  autor_id   BIGINT REFERENCES org_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (                -- toda acción del panel queda registrada
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT REFERENCES organizations(id),
  user_id    BIGINT REFERENCES org_users(id),
  accion     TEXT NOT NULL,
  detalle    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE emergency_reports
  ADD COLUMN verificado_por_org BIGINT REFERENCES organizations(id),
  ADD COLUMN verificado_at      TIMESTAMPTZ;
```

- Cada institución ve y modifica **solo sus comunas**. Aplica el filtro en el backend en cada consulta (y evalúa Row Level Security de PostgreSQL).
- Si `vigente_hasta` ya pasó, el panel entra en modo solo lectura y muestra un aviso de renovación. **Los datos públicos que esa municipalidad ya publicó no desaparecen de la app ciudadana de golpe**: los avisos vigentes siguen visibles hasta su fecha de término.

### Acceso

- Login por correo con enlace mágico o contraseña, y **segundo factor obligatorio** para administradores y operadores.
- Roles: `admin` (gestiona usuarios), `operador` (publica y modera), `lector` (solo ve).
- Panel de superadministrador (solo para mí) para crear instituciones, asignar comunas y actualizar plan y vigencia.

### Funciones del panel

1. **Tablero en vivo** de los reportes ciudadanos de sus comunas: lista, mapa y mapa de calor, con filtros por categoría y estado.
2. **Moderación:** marcar reportes como *verificados por la municipalidad*, resueltos u ocultos. Un reporte verificado lleva en la app pública una insignia distinta.
3. **Avisos municipales:** publicar albergues, cortes de ruta, puntos de entrega de agua y avisos generales. Se ven en la app ciudadana con la etiqueta "Municipalidad de X", **con un estilo distinto al de las alertas de SENAPRED**, para que nunca se confundan.
4. **Notificaciones push** de avisos municipales a quienes siguen esa comuna, con confirmación doble antes de enviar y un límite diario configurable.
5. **Informe post-evento:** exportar a CSV y PDF los reportes, tiempos de respuesta y avisos publicados durante un rango de fechas (útil para rendiciones y solicitudes de recursos).
6. **Modo demo:** una comuna ficticia con datos de prueba rotulados como tales, para presentaciones comerciales.

### Confiabilidad

- Página pública de estado del servicio (uptime) y respaldos automáticos diarios de la base de datos.
- Los municipios van a preguntar por disponibilidad: documenta en el `README` la arquitectura, los respaldos y el plan de recuperación.

**Listo cuando:** dos municipalidades de prueba operan en paralelo sin ver los datos de la otra, un aviso publicado aparece en la app pública con su etiqueta, y cada acción queda en `audit_log`.

---

## Fase 6 — Notificaciones por WhatsApp

### Contexto para tus decisiones

- **WhatsApp es un canal complementario, nunca el único.** Toda alerta que salga por WhatsApp también sale por Web Push y queda en la app.
- Meta cobra por cada mensaje de plantilla entregado y limita cuántas personas distintas se pueden contactar cada 24 horas (los niveles parten en 250 y suben con la verificación del negocio y el uso). Por eso el envío se diseña con **cola, prioridades y respaldo**.
- El costo lo absorbe el plan municipal: **WhatsApp está disponible para los vecinos de las comunas cuya municipalidad tiene un plan vigente**. En el resto, la app ofrece Web Push.

### Reglas

1. Usa **solo la API oficial** (WhatsApp Business Platform – Cloud API de Meta). **Prohibido** usar librerías no oficiales que automatizan WhatsApp Web: violan los términos de servicio y el número puede ser bloqueado justo en una emergencia.
2. **Opt-in explícito y verificable.** Nadie recibe mensajes sin haberse suscrito activamente.
3. **Darse de baja tiene que ser inmediato:** respondiendo "BAJA", con un botón en el mensaje o desde la app.
4. Solo se envían **plantillas de categoría utilidad** aprobadas por Meta, nunca contenido promocional. Los reportes vecinales no generan mensajes de WhatsApp.
5. Antes de escribir código, **revisa la documentación oficial vigente** de Cloud API (endpoints, versiones, webhooks, límites y precios para Chile). No asumas valores de memoria.

### Flujo de suscripción

- En la app: la persona ingresa su número, elige una o más comunas y acepta los términos.
- Recibe un código de verificación por WhatsApp (plantilla de autenticación) o, como alternativa más económica, se le pide enviar un mensaje como "ALTA LINARES" al número oficial (conversación iniciada por el usuario).
- Confirmada la verificación, queda activa. El mensaje de bienvenida explica qué va a recibir y cómo darse de baja.

### Plantillas iniciales (en español de Chile, para aprobación de Meta)

| Plantilla | Variables | Uso |
|---|---|---|
| `alerta_oficial` | comuna, nivel, resumen, enlace | Alerta de SENAPRED cargada o recibida |
| `aviso_municipal` | municipalidad, tipo, resumen, enlace | Avisos publicados desde el Panel Municipal |
| `fin_alerta` | comuna, resumen | Cancelación o término de una alerta |
| `codigo_verificacion` | código | Opt-in |

Cada mensaje incluye un enlace a la app para el detalle y el mapa, y un botón de respuesta rápida "Dejar de recibir".

### Datos

```sql
CREATE TYPE wa_status AS ENUM ('pendiente', 'activo', 'baja');

CREATE TABLE whatsapp_subscribers (
  id              BIGSERIAL PRIMARY KEY,
  phone_encrypted BYTEA NOT NULL,        -- cifrado a nivel de aplicación
  phone_hash      TEXT NOT NULL UNIQUE,  -- HMAC con clave secreta, para búsquedas
  status          wa_status NOT NULL DEFAULT 'pendiente',
  opted_in_at     TIMESTAMPTZ,
  opted_out_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_subscriber_comunas (
  subscriber_id BIGINT REFERENCES whatsapp_subscribers(id) ON DELETE CASCADE,
  comuna_cut    CHAR(5) REFERENCES comunas(cut),
  PRIMARY KEY (subscriber_id, comuna_cut)
);

CREATE TABLE whatsapp_messages (
  id            BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT REFERENCES whatsapp_subscribers(id) ON DELETE SET NULL,
  org_id        BIGINT REFERENCES organizations(id),  -- a quién se le imputa el costo
  template      TEXT NOT NULL,
  prioridad     SMALLINT NOT NULL,                     -- 1 = evacuación ... 4 = informativo
  wamid         TEXT UNIQUE,                           -- id que devuelve Meta
  estado        TEXT NOT NULL DEFAULT 'en_cola',       -- en_cola, enviado, entregado, leido, fallido
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wa_messages_org_month_idx ON whatsapp_messages (org_id, created_at);
```

- Los números de teléfono **nunca** se guardan en texto plano ni aparecen en logs. Al darse de baja se conserva solo el hash, para respetar la baja si vuelve a llegar el número.

### Envío

- Cola de trabajos (BullMQ + Redis) con **prioridad**: evacuación y alerta roja salen primero.
- Respeta el límite de envíos de Meta y la tasa por segundo. Si se alcanza el límite diario, se priorizan los mensajes más críticos y **el resto se notifica solo por Web Push**, quedando registrado.
- Reintentos con espera creciente ante errores temporales. Deduplicación: una persona no recibe dos veces la misma alerta aunque siga varias comunas afectadas.
- Webhook para actualizar el estado de cada mensaje (enviado, entregado, leído, fallido), **verificando la firma** de cada llamada de Meta.

### En el Panel Municipal

- Cantidad de suscriptores por WhatsApp en sus comunas.
- Consumo de mensajes del mes versus la cuota de su plan, con aviso al llegar al 80 %.
- Tasa de entrega y lectura por envío.
- El superadministrador define la cuota mensual de cada plan.

### Pruebas

- Desarrolla con el número de prueba que entrega Meta y destinatarios de prueba. **Nunca** envíes a números reales desde desarrollo.

**Listo cuando:** una persona se suscribe y se da de baja por WhatsApp, una alerta llega en menos de un minuto a los suscriptores de prueba de esa comuna, los estados de entrega se reflejan en el panel, y al simular el límite diario el sistema prioriza y deriva el resto a Web Push.

---

## Fuera del alcance del MVP

- Cuentas para la ciudadanía (las cuentas existen solo para instituciones, en la Fase 5).
- Cobro con tarjeta o pasarela de pago.
- Apps nativas.
- Fotos en los reportes (se pueden sumar después, con moderación).
- Integración con el Sistema de Alerta de Emergencia (SAE) de celulares.

## Pruebas mínimas

- Pruebas unitarias de los servicios del backend (límite de envíos, votos, vencimiento, asignación de comuna).
- Una prueba de punta a punta del flujo "crear reporte → aparece en otro cliente".
- Auditoría Lighthouse en móvil al final de cada fase de frontend: PWA instalable y accesibilidad de 90 o más.
