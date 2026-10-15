// El cielo: fase de la Luna, qué tan buena está la noche para mirar estrellas y cámaras
// públicas de los observatorios de Chile.

const SINODICO = 29.530588853 // días entre dos lunas nuevas
const LUNA_NUEVA_REF = Date.UTC(2000, 0, 6, 18, 14) // una luna nueva conocida

/** Fase lunar: edad en días (0–29,5), iluminación (0–1) y nombre en español. */
export function faseLunar(fecha = new Date()) {
  const dias = (fecha.getTime() - LUNA_NUEVA_REF) / 864e5
  const edad = ((dias % SINODICO) + SINODICO) % SINODICO
  const iluminacion = (1 - Math.cos((2 * Math.PI * edad) / SINODICO)) / 2
  const f = edad / SINODICO
  let nombre
  if (f < 0.0339 || f >= 0.9661) nombre = 'Luna nueva'
  else if (f < 0.2161) nombre = 'Luna creciente'
  else if (f < 0.2839) nombre = 'Cuarto creciente'
  else if (f < 0.4661) nombre = 'Gibosa creciente'
  else if (f < 0.5339) nombre = 'Luna llena'
  else if (f < 0.7161) nombre = 'Gibosa menguante'
  else if (f < 0.7839) nombre = 'Cuarto menguante'
  else nombre = 'Luna menguante'
  const llena = new Date(fecha.getTime() + (((0.5 - f + 1) % 1) * SINODICO) * 864e5)
  return { edad, iluminacion, fraccion: f, nombre, creciente: f < 0.5, proximaLlena: llena }
}

/**
 * Qué tan buena está la próxima noche para mirar el cielo, con la nubosidad prevista
 * (horas de noche dentro de las próximas 24) y la luz de la Luna.
 */
export function calidadNoche(horas, fecha = new Date()) {
  const noche = (horas ?? []).filter((h) => !h.esDeDia && h.nubes != null).slice(0, 8)
  if (!noche.length) return null
  const nubes = noche.reduce((s, h) => s + h.nubes, 0) / noche.length
  const luna = faseLunar(fecha).iluminacion
  let nivel
  if (nubes < 20 && luna < 0.5) nivel = { texto: 'Excelente', detalle: 'Cielo despejado y oscuro: ideal para ver la Vía Láctea lejos de las luces.', puntos: 4 }
  else if (nubes < 30) nivel = { texto: 'Buena', detalle: luna >= 0.5 ? 'Despejado, pero la Luna ilumina mucho el cielo.' : 'Pocas nubes: buena noche para mirar estrellas.', puntos: 3 }
  else if (nubes < 65) nivel = { texto: 'Regular', detalle: 'Habrá nubes por momentos.', puntos: 2 }
  else nivel = { texto: 'Nublada', detalle: 'Las nubes taparán casi todo el cielo.', puntos: 1 }
  return { ...nivel, nubes: Math.round(nubes), desde: noche[0].hora }
}

// Cámaras públicas de observatorios en Chile. ESO permite incrustar estas imágenes en otras
// páginas usando su URL (eso.org/public/outreach/webcams). Imágenes de ESO, CC BY 4.0.
export const CAMARAS_CIELO = [
  {
    id: 'paranal-cielo',
    nombre: 'Cielo completo de Paranal',
    lugar: 'Observatorio Paranal (ESO), Antofagasta',
    descripcion: 'Una cámara mira todo el cielo sobre el Very Large Telescope. De noche se ven las estrellas y la Vía Láctea.',
    url: 'https://www.eso.org/public/archives/static/allsky/latest/460x/preset_101.jpg',
    credito: 'ESO',
    enlace: 'https://www.eso.org/public/outreach/webcams/',
    tipo: 'cielo',
  },
  {
    id: 'la-silla-cielo',
    nombre: 'Cielo nocturno de La Silla',
    lugar: 'Observatorio La Silla (ESO), Coquimbo',
    descripcion: 'Cámara de todo el cielo del telescopio danés de 1,54 m. Se actualiza durante la noche.',
    url: 'https://allsky-dk154.asu.cas.cz/AllSkyCurrentImage.JPG',
    credito: 'Instituto Astronómico ASU (República Checa) / ESO',
    enlace: 'https://www.eso.org/public/outreach/webcams/',
    tipo: 'cielo',
  },
  {
    id: 'paranal-pano',
    nombre: 'Panorámica de Paranal',
    lugar: 'Cerro Paranal, desierto de Atacama',
    descripcion: 'Vista de 360° de los telescopios del VLT. Desliza hacia el lado para mirar alrededor.',
    url: 'https://www.eso.org/public/archives/static/pano/latest/pano_PV_960x.jpg',
    credito: 'ESO',
    enlace: 'https://www.eso.org/public/outreach/webcams/',
    tipo: 'panorama',
  },
  {
    id: 'alma-pano',
    nombre: 'ALMA en el llano de Chajnantor',
    lugar: 'A 5.000 m de altura, San Pedro de Atacama',
    descripcion: 'Vista de 360° de las antenas de ALMA, el radiotelescopio más grande del mundo.',
    url: 'https://www.eso.org/public/archives/static/almapano/latest/pano_PV_960x.jpg',
    credito: 'ESO',
    enlace: 'https://www.eso.org/public/outreach/webcams/',
    tipo: 'panorama',
  },
]

/** URL con un parámetro que cambia cada minuto, para traer la imagen nueva (las cámaras se renuevan cada 1 a 5 min). */
export const urlFresca = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`
