// Viajes de ZUMI: lugares históricos y naturales de Chile que ZUMI visita en el mapa 3D.
// Cada lugar trae dónde está, cómo se mira (zoom, rumbo e inclinación de la cámara), un dato verdadero
// que ZUMI cuenta y una pregunta para jugar. Si hay video real de ZUMI ahí, se muestra; si no, ZUMI
// narra desde su burbuja mientras la cámara sobrevuela el lugar.
//
// El «pasaporte» guarda en el teléfono los sellos de los lugares donde acertaste la pregunta.

const BASE = import.meta.env.BASE_URL ?? './'
const V = `${BASE}zumi/viajes/`

export const LUGARES = [
  {
    id: 'rapanui',
    nombre: 'Rapa Nui',
    sub: 'Ahu Tongariki · Región de Valparaíso',
    lat: -27.1257,
    lng: -109.2768,
    zoom: 16.2,
    rumbo: 200,
    video: `${V}rapanui`,
    poster: `${V}rapanui.jpg`,
    dato: 'Ahu Tongariki es la plataforma ceremonial más grande de la isla: tiene 15 moai en fila. Un tsunami los derribó en 1960 y fueron levantados de nuevo en los años noventa.',
    pregunta: '¿Cuántos moai hay en Ahu Tongariki?',
    opciones: ['15', '7', '30'],
    correcta: 0,
  },
  {
    id: 'atacama',
    nombre: 'San Pedro de Atacama',
    sub: 'Región de Antofagasta',
    lat: -22.911,
    lng: -68.2003,
    zoom: 15.6,
    rumbo: 60,
    video: `${V}atacama`,
    poster: `${V}atacama.jpg`,
    dato: 'Su iglesia de adobe es Monumento Nacional y su techo está hecho con madera de cactus cardón. El desierto de Atacama es el desierto no polar más seco del mundo.',
    pregunta: '¿Con qué está hecho el techo de la iglesia de San Pedro?',
    opciones: ['Tejas de greda', 'Madera de cactus', 'Planchas de zinc'],
    correcta: 1,
  },
  {
    id: 'valparaiso',
    nombre: 'Valparaíso',
    sub: 'Cerros y ascensores · Región de Valparaíso',
    lat: -33.0429,
    lng: -71.6264,
    zoom: 15.4,
    rumbo: 330,
    video: `${V}valparaiso`,
    poster: `${V}valparaiso.jpg`,
    dato: 'Su barrio histórico es Patrimonio de la Humanidad desde 2003. Sus ascensores suben los cerros desde fines del siglo diecinueve y algunos siguen funcionando.',
    pregunta: '¿Desde qué año el barrio histórico de Valparaíso es Patrimonio de la Humanidad?',
    opciones: ['1985', '2015', '2003'],
    correcta: 2,
  },
  {
    id: 'santiago',
    nombre: 'Plaza de Armas de Santiago',
    sub: 'Región Metropolitana',
    lat: -33.4378,
    lng: -70.6505,
    zoom: 16.4,
    rumbo: 20,
    video: `${V}santiago`,
    poster: `${V}santiago.jpg`,
    dato: 'Pedro de Valdivia fundó Santiago en 1541 y trazó la ciudad desde esta plaza. Aquí está la Catedral Metropolitana, y con días despejados se ve la cordillera de los Andes.',
    pregunta: '¿En qué año se fundó Santiago?',
    opciones: ['1541', '1810', '1600'],
    correcta: 0,
  },
  {
    id: 'humberstone',
    nombre: 'Humberstone',
    sub: 'Oficina salitrera · Región de Tarapacá',
    lat: -20.2058,
    lng: -69.7953,
    zoom: 16,
    rumbo: 120,
    video: `${V}humberstone`,
    poster: `${V}humberstone.jpg`,
    dato: 'Fue un pueblo minero donde se trabajaba el salitre. Junto a la oficina Santa Laura es Patrimonio de la Humanidad desde 2005 y hoy se recorre como un museo al aire libre.',
    pregunta: '¿Qué se trabajaba en Humberstone?',
    opciones: ['Cobre', 'Salitre', 'Oro'],
    correcta: 1,
  },
  {
    id: 'chiloe',
    nombre: 'Castro, Chiloé',
    sub: 'Palafitos e iglesias · Región de Los Lagos',
    lat: -42.4822,
    lng: -73.7623,
    zoom: 15.6,
    rumbo: 250,
    video: `${V}chiloe`,
    poster: `${V}chiloe.jpg`,
    dato: 'La iglesia San Francisco de Castro es una de las 16 iglesias de madera de Chiloé que son Patrimonio de la Humanidad desde el año 2000. Los palafitos son casas sobre pilotes a orilla del mar.',
    pregunta: '¿Cuántas iglesias de Chiloé son Patrimonio de la Humanidad?',
    opciones: ['4', '16', '50'],
    correcta: 1,
  },
  {
    id: 'paine',
    nombre: 'Torres del Paine',
    sub: 'Región de Magallanes',
    lat: -50.9423,
    lng: -73.0,
    zoom: 11.6,
    rumbo: 270,
    dato: 'Sus torres de granito superan los dos mil metros de altura. El parque es Reserva de la Biosfera de la UNESCO desde 1978 y allí viven pumas, guanacos y cóndores.',
    pregunta: '¿Qué animal NO vive en Torres del Paine?',
    opciones: ['Guanaco', 'Puma', 'Pingüino emperador'],
    correcta: 2,
  },
  {
    id: 'niebla',
    nombre: 'Fuerte de Niebla',
    sub: 'Valdivia · Región de Los Ríos',
    lat: -39.8706,
    lng: -73.4008,
    zoom: 16,
    rumbo: 300,
    dato: 'Los españoles construyeron este fuerte en el siglo diecisiete para proteger la entrada a Valdivia por el río. Era parte de uno de los sistemas de fuertes más grandes de América.',
    pregunta: '¿Qué protegía el Fuerte de Niebla?',
    opciones: ['La entrada a Valdivia', 'Una mina de oro', 'El volcán Osorno'],
    correcta: 0,
  },
]

export const lugarPorId = (id) => LUGARES.find((l) => l.id === id) ?? null
export const NARRADOR = { habla: `${V}narrador-habla`, reposo: `${V}narrador-reposo`, avatar: `${V}avatar.png` }

const CLAVE = 'ac:zumi:pasaporte'
export function leerPasaporte() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '{}')
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}
export function sellar(id) {
  const p = leerPasaporte()
  if (p[id]) return p
  p[id] = Date.now()
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p))
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent('ac:pasaporte'))
  return p
}

/** El clima de ahora en el lugar (Open-Meteo, sin clave). */
export async function climaEn(lugar, { signal } = {}) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat}&longitude=${lugar.lng}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`
  const r = await fetch(u, { signal })
  if (!r.ok) throw new Error('sin clima')
  const d = await r.json()
  return { temp: d.current?.temperature_2m, codigo: d.current?.weather_code, viento: d.current?.wind_speed_10m, dia: d.current?.is_day === 1, hora: d.current?.time }
}

/** Pide a la app abrir el mapa y viajar (desde cualquier pantalla). */
export const viajar = (id = null) => window.dispatchEvent(new CustomEvent('ac:viajar', { detail: id }))
