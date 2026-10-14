# AlertaClima Chile

App web progresiva (PWA) para seguir la lluvia y las emergencias climáticas de tu comuna desde el celular, con mala señal y poca batería.

**Estado:** fases 0 y 1 listas (base del proyecto y app ciudadana con mapa, comunas, radar y modo sin conexión). La especificación completa y las fases siguientes están en `docs/especificacion.md`.

## Qué hace hoy

- Pestaña **Ahora**: temperatura, sensación térmica, viento y ráfagas, lluvia de la última hora, gráfico de lluvia de las próximas 12 horas con un resumen en palabras, pronóstico hora a hora y de 7 días.
- Pestaña **Radar**: mapa con radar de lluvia y leyenda de intensidad.
- Elegir comuna escribiendo su nombre, por región o con la ubicación del celular (346 comunas con su código CUT).
- Mapa con el contorno de la comuna y radar de lluvia de las últimas 2 horas, animado y pausable.
- Abre sin conexión y avisa desde qué hora son los datos que muestra.
- Tema oscuro (por defecto) y claro, modo ahorro manual o automático con batería baja.
- Instalable en Android y iPhone.
- Dice claramente que las alertas oficiales **todavía no están conectadas** y deriva a senapred.cl. Nunca muestra alertas inventadas.

## Estructura

```
alertaclima-chile/
├── client/                 App ciudadana (React + Vite + Tailwind + Leaflet)
│   ├── src/components/     Banda de estado, mapa, radar, selector, ajustes
│   ├── src/hooks/          Conexión, radar, preferencias, instalación
│   ├── src/services/       Comunas, radar (RainViewer), alertas, almacenamiento
│   ├── src/data/           comunas.json y FUENTES.md (origen de los datos)
│   └── public/limites/     Límites comunales por región (se cargan bajo demanda)
├── server/                 API (Express + Socket.io + PostgreSQL/PostGIS)
│   ├── db/migrations/      Migraciones SQL versionadas
│   └── scripts/            Migrar y cargar comunas
├── docker-compose.yml      PostGIS + API
└── .github/workflows/      Publicación automática en GitHub Pages
```

## Correrlo en tu computador

Requisitos: Node.js 22 y, para el servidor, Docker.

```bash
# App ciudadana
cd client
npm install
npm run dev          # http://localhost:5173

# Base de datos y API
cp .env.example .env # y cambia POSTGRES_PASSWORD
docker compose up -d # PostGIS en :5432, API en :3000
docker compose exec api node scripts/sembrar-comunas.js
curl http://localhost:3000/api/salud
```

Pruebas del servidor: `cd server && npm test`.

## Publicarlo en internet

La app ciudadana es un sitio estático: no necesita servidor para funcionar en esta fase.

**GitHub Pages (incluido):** sube el proyecto a un repositorio de GitHub, ve a *Settings → Pages* y elige *GitHub Actions* como origen. Cada cambio en `main` se publica solo.

**Alternativas:** Cloudflare Pages o Netlify. Comando de construcción `npm run build`, carpeta `client`, salida `client/dist`.

La app necesita HTTPS para instalarse y para usar la ubicación; todos estos servicios lo entregan gratis.

## Antes de lanzar públicamente

- **Radar:** RainViewer hoy permite su API gratuita solo para uso personal y educativo, con zoom máximo 7 y solo las últimas 2 horas. Para un uso comercial hay que acordarlo con ellos o cambiar de proveedor (todo está aislado en `client/src/services/radar.js`).
- **Pronóstico:** la API gratuita de Open-Meteo es solo para uso no comercial. Al cobrarle a municipios hay que contratar su plan comercial (todo está en `client/src/services/clima.js`).
- **Mapa base:** CARTO permite uso gratuito con límites; con mucho tráfico conviene un plan o un servidor de mapas propio.
- **Comunas:** validar los códigos contra la tabla CUT oficial de SUBDERE (ver `client/src/data/FUENTES.md`).

## Fuentes de datos

Ver `client/src/data/FUENTES.md`.
