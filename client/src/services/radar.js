// Proveedor de radar de precipitación. Todo lo específico de RainViewer vive aquí,
// para poder cambiar de proveedor sin tocar los componentes.
//
// Condiciones vigentes (revisadas el 14-10-2026 en rainviewer.com/api/transition-faq.html):
// - Solo radar pasado: últimas 2 horas, cada 10 minutos. Ya no hay pronóstico (nowcast).
// - Zoom máximo 7; sobre eso Leaflet amplía el último nivel disponible.
// - Un solo esquema de color (Universal Blue, id 2).
// - Límite: 100 solicitudes por minuto por IP.
// - Uso permitido: personal y educativo. Para uso comercial hay que acordarlo con RainViewer.

const INDICE_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const COLOR = 2
const OPCIONES = '1_1' // suavizado, nieve diferenciada

export const radarInfo = {
  nombre: 'RainViewer',
  atribucion: 'Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>',
  zoomMaximo: 7,
}

/** Devuelve { generado: Date, cuadros: [{ hora: Date, url }] } ordenados del más antiguo al más nuevo. */
export async function obtenerCuadros({ signal } = {}) {
  const r = await fetch(INDICE_URL, { signal, cache: 'no-store' })
  if (!r.ok) throw new Error(`El servicio de radar respondió ${r.status}`)
  const datos = await r.json()
  const pasados = datos?.radar?.past ?? []
  if (!datos.host || pasados.length === 0) throw new Error('El servicio de radar no entregó cuadros')
  return {
    generado: new Date(datos.generated * 1000),
    cuadros: pasados.map((c) => ({
      hora: new Date(c.time * 1000),
      url: `${datos.host}${c.path}/256/{z}/{x}/{y}/${COLOR}/${OPCIONES}.png`,
    })),
  }
}
