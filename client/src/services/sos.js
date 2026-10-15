// SOS: llamar a emergencias y avisar a los contactos de confianza con la ubicación exacta.
//
// Todo se guarda solo en este teléfono (contactos y rastro). Nada se envía a nuestro servidor:
// la persona decide a quién mandarlo (WhatsApp, SMS o compartir). El SMS a veces pasa cuando
// los datos móviles no funcionan.
import { guardar, leer } from './almacen'

export const NUMEROS = [
  { numero: '133', nombre: 'Carabineros', color: '#16a34a' },
  { numero: '132', nombre: 'Bomberos', color: '#dc2626' },
  { numero: '131', nombre: 'SAMU (ambulancia)', color: '#2563eb' },
]

export const contactos = () => leer('sos:contactos', [])
export function guardarContactos(lista) {
  guardar(
    'sos:contactos',
    lista
      .map((c) => ({ nombre: String(c.nombre ?? '').trim().slice(0, 40), telefono: normalizarTelefono(c.telefono) }))
      .filter((c) => c.nombre && c.telefono)
      .slice(0, 5),
  )
}

/** Deja el número en formato internacional chileno (+569…) cuando se puede. */
export function normalizarTelefono(t) {
  let d = String(t ?? '').replace(/[^\d+]/g, '')
  if (!d) return ''
  if (d.startsWith('+')) return d
  if (d.startsWith('56')) return `+${d}`
  if (d.length === 9 && d.startsWith('9')) return `+56${d}`
  if (d.length === 8) return `+569${d}`
  return d
}

/** Ubicación precisa (GPS). Devuelve { lat, lng, precision, hora }. */
export function ubicacionPrecisa() {
  return new Promise((ok, no) => {
    if (!navigator.geolocation) return no(new Error('Este teléfono no permite compartir la ubicación desde el navegador.'))
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => ok({ lat: coords.latitude, lng: coords.longitude, precision: Math.round(coords.accuracy), hora: timestamp }),
      (e) => no(new Error(e.code === e.PERMISSION_DENIED ? 'No diste permiso de ubicación. Actívalo para poder enviarla.' : 'No se pudo obtener tu ubicación. Sal a un lugar abierto e inténtalo otra vez.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

// ---- Rastro: últimas ubicaciones, solo en este teléfono, para que tus contactos sepan por dónde ibas ----
export const rastro = () => leer('sos:rastro', [])
export function anotarRastro(p) {
  const lista = [...rastro(), { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), precision: p.precision, hora: p.hora }]
  guardar('sos:rastro', lista.slice(-20))
}
export const borrarRastro = () => guardar('sos:rastro', [])

const hhmm = (t) => new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const enlaceMapa = (p) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

export function mensajeSOS(p, { nombre } = {}) {
  const lineas = [
    `🆘 SOS${nombre ? ` de ${nombre}` : ''}: necesito ayuda.`,
    `Mi ubicación (${hhmm(p.hora)}, precisión ±${p.precision} m): ${enlaceMapa(p)}`,
  ]
  const previos = rastro().filter((r) => r.hora < p.hora - 60000).slice(-3)
  if (previos.length) lineas.push(`Antes estuve en: ${previos.map((r) => `${hhmm(r.hora)} ${enlaceMapa(r)}`).join(' · ')}`)
  lineas.push('Si no respondo, llama al 133. Enviado desde AlertaClima.')
  return lineas.join('\n')
}

export const enlaceWhatsApp = (telefono, texto) => `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
export const enlaceSMS = (telefonos, texto) => {
  const dest = telefonos.join(',')
  // iPhone usa "&body", Android "?body"
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return `sms:${dest}${ios ? '&' : '?'}body=${encodeURIComponent(texto)}`
}
