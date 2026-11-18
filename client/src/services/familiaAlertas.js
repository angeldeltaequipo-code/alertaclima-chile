// Vigía familiar: cada 3 minutos (con la app abierta) revisa si algún integrante de tu familia está
// en una comuna con alerta oficial Amarilla o Roja de SENAPRED. Si aparece una nueva, te avisa con
// una notificación: «Tomás está en Providencia, con Alerta Roja por incendio forestal».
import { leerFamilia, leerGrupo } from './familiaGPS'
import { comunaEnPunto } from './comunas'
import { NIVELES, alertaPrincipal, estadoComuna } from './alertas'

const VISTOS = 'ac:familia-avisadas'
const vistos = () => {
  try {
    return JSON.parse(localStorage.getItem(VISTOS) ?? '{}')
  } catch {
    return {}
  }
}

async function avisar(titulo, cuerpo) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker?.ready
    if (reg) await reg.showNotification(titulo, { body: cuerpo, icon: `${import.meta.env.BASE_URL}zumi/viajes/avatar.png`, tag: `familia-${titulo}`, vibrate: [200, 100, 200] })
    else new Notification(titulo, { body: cuerpo })
    return true
  } catch {
    return false
  }
}

export async function revisarFamilia() {
  if (!leerGrupo()) return []
  const lista = await leerFamilia()
  const v = vistos()
  const avisos = []
  for (const m of lista.filter((x) => !x.yo && Date.now() - x.t < 6 * 3600e3)) {
    const c = await comunaEnPunto(m.lat, m.lng).catch(() => null)
    if (!c) continue
    const e = await estadoComuna(c.cut).catch(() => null)
    const a = e?.tipo === 'ok' ? alertaPrincipal(e.alertas) : null
    if (!a || NIVELES[a.nivel].gravedad < 2) continue
    const clave = `${m.id}:${a.id}`
    if (v[clave]) continue
    v[clave] = Date.now()
    const texto = `${m.nombre} está en ${c.nombre}, con ${NIVELES[a.nivel].etiqueta} por ${String(a.amenaza).toLowerCase()}.`
    avisos.push(texto)
    await avisar(`⚠ ${m.nombre} está en zona de alerta`, `${texto} Revisa «Mi familia».`)
  }
  try {
    localStorage.setItem(VISTOS, JSON.stringify(v))
  } catch {
    /* sin almacenamiento */
  }
  if (avisos.length) window.dispatchEvent(new CustomEvent('ac:familia-alerta', { detail: avisos }))
  return avisos
}

let reloj = null
export function vigiaFamiliar() {
  if (reloj) return
  const correr = () => !document.hidden && revisarFamilia().catch(() => {})
  setTimeout(correr, 8000)
  reloj = setInterval(correr, 3 * 60e3)
}
