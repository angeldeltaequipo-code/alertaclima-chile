// ZUMI te recibe: la primera vez del día que abres la app, te saluda con tu informe, te pregunta cómo
// estás y te da opciones grandes y simples (pensado para cualquier edad). Si los avisos están apagados,
// ZUMI explica por qué conviene activarlos y los activa con un toque.
import { useEffect, useState } from 'react'
import { alertaPrincipal, NIVELES } from '../services/alertas'

const K = 'ac:saludo-dia'
const hoyClave = () => new Date().toISOString().slice(0, 10)
export const yaSaludo = () => {
  try {
    return localStorage.getItem(K) === hoyClave()
  } catch {
    return false
  }
}
const marcar = () => {
  try {
    localStorage.setItem(K, hoyClave())
  } catch {
    /* sin almacenamiento */
  }
}
const avisosApagados = () => typeof Notification !== 'undefined' && Notification.permission === 'default'

function informe({ quien, datos }) {
  const h = new Date().getHours()
  const hola = h >= 6 && h < 12 ? 'Buenos días' : h >= 12 && h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const ahora = datos.ahora
  const lugar = datos.comuna?.nombre ?? datos.nombreComuna ?? 'tu comuna'
  const clima = ahora?.temperatura != null ? `En ${lugar} hay ${Math.round(ahora.temperatura)}° y está ${String(ahora.texto ?? '').toLowerCase()}.` : ''
  const p = datos.alertas?.alertas && alertaPrincipal(datos.alertas.alertas)
  const g = p ? NIVELES[p.nivel]?.gravedad ?? 0 : 0
  const alerta = !p
    ? 'No hay alertas oficiales en tu comuna.'
    : g >= 2
      ? `Ojo: hay ${NIVELES[p.nivel].etiqueta} por ${p.amenaza.toLowerCase()}. Te explico qué hacer.`
      : `Hay una alerta preventiva por ${p.amenaza.toLowerCase()}, nada grave por ahora.`
  return `¡${hola}${quien ? `, ${quien}` : ''}! ${clima} ${alerta}`.replace(/\s+/g, ' ').trim()
}

export default function SaludoZumi({ datos, quien, onPreguntar, onEscuchar, onGesto, onCerrar, onFamilia }) {
  const [paso, setPaso] = useState(() => (yaSaludo() ? null : 'hola'))
  const [error, setError] = useState(null)
  useEffect(() => {
    if (paso) onGesto?.(paso)
  }, [paso]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!paso) return null

  const cerrar = () => {
    marcar()
    setPaso(null)
    onCerrar?.()
  }
  const despues = () => (avisosApagados() ? setPaso('avisos') : cerrar())
  const preguntar = (q) => {
    marcar()
    setPaso(null)
    onCerrar?.()
    onPreguntar(q)
  }
  const activarAvisos = async () => {
    setError(null)
    try {
      const n = await import('../services/notificaciones')
      const cut = datos.comuna?.cut
      await n.activar(cut ? [cut] : [])
      setPaso('listo')
      setTimeout(cerrar, 2600)
    } catch (e) {
      setError(e?.message ?? 'No pude activar los avisos.')
    }
  }

  const TEXTO = {
    hola: `${informe({ quien, datos })} ¿Cómo estás hoy?`,
    bien: '¡Me alegra mucho! ¿Te digo qué ponerte hoy? También puedo cuidar a tu familia: te aviso si hay alerta donde están ellos.',
    preocupado: 'Te entiendo. Estoy aquí contigo. ¿Qué te preocupa?',
    avisos: '¿Me dejas avisarte aunque tengas el teléfono en el bolsillo? Solo cuando sea importante: alertas de SENAPRED, sismos fuertes o tsunami.',
    listo: '¡Listo! Desde ahora te aviso al tiro si pasa algo en tu comuna.',
  }
  const OPCIONES = {
    hola: [
      ['Bien', () => setPaso('bien')],
      ['Preocupado', () => setPaso('preocupado')],
      ['Cuéntame el día', () => (marcar(), setPaso(null), onCerrar?.(), onEscuchar())],
    ],
    bien: [
      ['¿Qué me pongo?', () => preguntar('¿Qué me pongo hoy?')],
      ['Cuidar a mi familia', () => (marcar(), setPaso(null), onCerrar?.(), onFamilia?.())],
      ['Gracias, ZUMI', despues],
    ],
    preocupado: [
      ['Un temblor', () => preguntar('¿Qué hago si tiembla?')],
      ['La lluvia', () => preguntar('¿Va a llover mañana?')],
      ['Mi familia', () => (marcar(), setPaso(null), onCerrar?.(), onFamilia?.())],
    ],
    avisos: [
      ['Sí, avísame', activarAvisos],
      ['Ahora no', cerrar],
    ],
    listo: [],
  }

  return (
    <section className="saludo-zumi mb-3" aria-live="polite" aria-label="ZUMI te saluda">
      <p key={paso} className="saludo-globo">{TEXTO[paso]}</p>
      {error && <p className="mt-2 text-[14px] text-[#ffd27a]">{error}</p>}
      {OPCIONES[paso].length > 0 && (
        <div className={`mt-2.5 grid gap-2 ${OPCIONES[paso].length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {OPCIONES[paso].map(([t, f], i) => (
            <button key={t} type="button" onClick={f} className={`saludo-opcion ${i === 0 ? 'principal' : ''}`}>
              {t}
            </button>
          ))}
        </div>
      )}
      {paso !== 'listo' && (
        <button type="button" onClick={cerrar} className="mt-1.5 w-full py-1.5 text-[13px] text-white/60">
          Ahora no, gracias
        </button>
      )}
    </section>
  )
}
