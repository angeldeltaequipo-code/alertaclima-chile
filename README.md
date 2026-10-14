# AlertaClima Chile

App web progresiva (PWA) para seguir la lluvia y las emergencias climáticas de tu comuna desde el celular, con mala señal y poca batería.

**Estado:** fases 0 a 4 listas (incluye notificaciones): app ciudadana (clima, mapa, radar, modo sin conexión), reportes vecinales en tiempo real y alertas oficiales con panel de administración. Los reportes se activan en la app publicada cuando el servidor está desplegado (ver «Desplegar el servidor»). La especificación completa y las fases siguientes están en `docs/especificacion.md`.

## Qué hace hoy

- **En resumen:** arriba de la pestaña Ahora, cuatro frases simples con lo esencial: alertas, cómo está el tiempo ahora, si va a llover y qué reportan los vecinos.
- Pestaña **Ahora**: cuando hay una estación meteorológica a menos de 40 km con datos de la última hora y media, muestra **lo medido** (temperatura, humedad, viento, lluvia), indicando la estación, la distancia y la hora; si no, la estimación del modelo, dicho así. Además: temperatura, sensación térmica, viento y ráfagas, lluvia de la última hora, gráfico de lluvia de las próximas 12 horas con un resumen en palabras, pronóstico hora a hora y de 7 días.
- Pestaña **Radar**: mapa con radar de lluvia y leyenda de intensidad.
- **Fotos en los reportes:** quien reporta puede sacar o elegir una foto. Se achica en el celular, se le borran los datos ocultos (incluida la ubicación GPS de la cámara) y se guarda en la base de datos. Con 2 denuncias de vecinos se oculta hasta que un administrador la revise en el panel.
- **Ver la calle en Google Maps:** cada reporte tiene un botón que abre Street View en ese punto (imágenes de archivo de Google, no en vivo; la app lo aclara).
- **Cámaras cercanas:** cámaras públicas de Windy Webcams a menos de 30 km, en la pestaña Ahora y como pines en el mapa, con crédito y enlace a Windy. Se activa al cargar `WINDY_API_KEY` en el servidor (registro gratuito en api.windy.com).
- **Aviso de alertas:** cuando llega o sube una alerta oficial, aviso a pantalla completa y vibración (en Android; el iPhone no permite que una página vibre).
- **Notificaciones (con la app cerrada):** cada persona elige hasta 5 comunas. Se notifica cuando se publica una alerta oficial, cuando sube de nivel y cuando termina; nunca por reportes de vecinos. En Android vibran según la gravedad y las rojas o de evacuación quedan en pantalla hasta tocarlas. En iPhone funcionan solo con la app agregada a la pantalla de inicio (iOS 16.4+). Las claves del servidor (VAPID) se generan solas y se guardan en la base de datos; el panel permite publicar sin notificar para correcciones menores.
- **Reportes vecinales:** anegamientos, desbordes, caminos cortados, cortes de luz y árboles caídos, con ubicación en el mapa. Aparecen al instante para los vecinos de la comuna, que pueden confirmarlos o avisar que ya no están (3 desmentidos netos los ocultan). Máximo 5 reportes por hora por persona, vencen solos y se guardan en cola si no hay señal.
- Elegir comuna escribiendo su nombre, por región o con la ubicación del celular (346 comunas con su código CUT).
- Mapa con el contorno de la comuna y radar de lluvia de las últimas 2 horas, animado y pausable.
- Abre sin conexión y avisa desde qué hora son los datos que muestra.
- Tema automático (sigue al teléfono), claro u oscuro, modo ahorro manual o automático con batería baja.
- Instalable en Android y iPhone.
- **Alertas oficiales:** la banda superior toma el color del nivel vigente (Preventiva, Amarilla, Roja, Evacuación) con su fuente y hora de verificación, y una ficha con qué hacer y el enlace a la publicación oficial. Si nadie confirma una alerta en 12 horas, se muestra como «sin confirmar». Si no hay alertas cargadas, lo dice así y deriva a senapred.cl: nunca da a entender que no hay alertas.
- **Panel de alertas** en `…/#admin`: cargar, confirmar, corregir y cancelar alertas copiadas de SENAPRED u otra fuente oficial (solo enlaces https de gob.cl o senapred.cl), con bitácora. Se entra con la clave `ADMIN_TOKEN` del servidor (en Render: servicio *alertaclima-api → Environment*).

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

Pruebas del servidor: `cd server && npm test`. Las pruebas de reportes necesitan una base con PostGIS: `TEST_DATABASE_URL=postgres://... npm test`.

## Publicarlo en internet

La app ciudadana es un sitio estático: no necesita servidor para funcionar en esta fase.

**GitHub Pages (incluido):** sube el proyecto a un repositorio de GitHub, ve a *Settings → Pages* y elige *GitHub Actions* como origen. Cada cambio en `main` se publica solo.

**Alternativas:** Cloudflare Pages o Netlify. Comando de construcción `npm run build`, carpeta `client`, salida `client/dist`.

La app necesita HTTPS para instalarse y para usar la ubicación; todos estos servicios lo entregan gratis.

## Desplegar el servidor

Los reportes necesitan el servidor (API + base de datos). La app publicada funciona sin él, pero no muestra reportes.

1. Entra a [Render](https://render.com) con tu cuenta de GitHub.
2. *New → Blueprint*, elige este repositorio y confirma. Render lee `render.yaml`, crea la base de datos y el servidor y los conecta solo. Al arrancar, el servidor crea las tablas y carga las comunas.
3. La app publicada usa `https://alertaclima-api.onrender.com` (definida en `.github/workflows/publicar.yml`). Si el servidor cambia de dirección, crea la variable `API_URL` en GitHub (*Settings → Secrets and variables → Actions → Variables*).

Planes gratuitos de Render: el servidor duerme tras 15 minutos sin uso y tarda cerca de un minuto en despertar, y la base de datos gratuita vence a los 30 días. Sirven para probar; para el piloto con un municipio hay que pasar ambos a planes pagados.

## Antes de lanzar públicamente

- **Radar:** RainViewer hoy permite su API gratuita solo para uso personal y educativo, con zoom máximo 7 y solo las últimas 2 horas. Para un uso comercial hay que acordarlo con ellos o cambiar de proveedor (todo está aislado en `client/src/services/radar.js`).
- **Pronóstico:** la API gratuita de Open-Meteo es solo para uso no comercial. Al cobrarle a municipios hay que contratar su plan comercial (todo está en `client/src/services/clima.js`).
- **Mapa base:** hoy usa los mapas de OpenStreetMap, sin clave pero sin garantía de servicio y sin permiso para guardarlos sin conexión. Para producción comercial conviene pasar a OpenFreeMap (gratuito, permite uso comercial, requiere MapLibre) o a un proveedor con contrato.
- **Comunas:** validar los códigos contra la tabla CUT oficial de SUBDERE (ver `client/src/data/FUENTES.md`).

## Fuentes oficiales: estado de la investigación (Fase 3)

- **SENAPRED:** no se encontró una API, RSS ni datos abiertos de alertas. Su página de alertas se arma con JavaScript desde un servicio interno no documentado. Usarlo sin autorización sería *scraping*, así que no se integró. Propuesta: pedir acceso formal (convenio o solicitud por Ley de Transparencia) y, mientras tanto, cargar las alertas a mano desde el panel. El código ya tiene la interfaz `AlertSource` (`server/services/alertas.js`) para sumar una integración oficial sin cambiar la app.
- **Dirección Meteorológica de Chile:** publica servicios JSON en su portal climatológico (datos de estaciones automáticas, entre otros), pero no se encontró un servicio de avisos, alertas y alarmas meteorológicas. Vale la pena consultarles directamente.
- **DGA (niveles de ríos):** unas 650 estaciones transmiten en línea caudal, nivel y lluvia, y la información es gratuita, pero no tiene API documentada. Propuesta: contactar al Departamento de Información de Recursos Hídricos para acceso a datos en tiempo real antes de integrar.

## Mediciones reales

- **Hoy:** estaciones de unos 24 aeropuertos y aeródromos chilenos (METAR de la DGAC, vía aviationweather.gov, sin registro). El servidor las consulta cada 10 minutos (`server/services/observaciones.js`). Cubren solo las comunas cercanas a un aeropuerto.
- **Siguiente paso:** la red de estaciones automáticas de la Dirección Meteorológica de Chile, con muchas más estaciones. Requiere registrarse en climatologia.meteochile.gob.cl para obtener usuario y clave (`DMC_USUARIO`, `DMC_TOKEN`). Se suma como otra fuente en el mismo archivo.

## Fuentes de datos

Ver `client/src/data/FUENTES.md`.
