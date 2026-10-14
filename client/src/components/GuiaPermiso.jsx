import { useState } from 'react'

// Guía visual para volver a encender las notificaciones. Pocas palabras, un dibujo por paso
// que muestra dónde tocar, y lo raro escondido en «¿Sigue sin funcionar?».

const DIBUJO = 'block h-[58px] w-full'

/** Barra de direcciones con el ícono de la izquierda resaltado y un dedo tocándolo. */
function BarraDireccion() {
  return (
    <svg viewBox="0 0 200 58" className={DIBUJO} aria-hidden="true">
      <rect x="6" y="14" width="188" height="30" rx="15" fill="var(--superficie)" stroke="var(--linea)" strokeWidth="1.5" />
      <circle cx="24" cy="29" r="12" fill="var(--senal)" opacity="0.3" />
      <circle cx="24" cy="29" r="12" fill="none" stroke="var(--senal)" strokeWidth="2.5" />
      <g stroke="var(--texto)" strokeWidth="2" strokeLinecap="round">
        <path d="M18 25.5h5M27 25.5h3M18 32.5h3M25 32.5h5" />
        <circle cx="25" cy="25.5" r="2" fill="var(--superficie)" />
        <circle cx="23" cy="32.5" r="2" fill="var(--superficie)" />
      </g>
      <rect x="44" y="25" width="96" height="8" rx="4" fill="var(--grilla)" />
      <path d="M30 54c-1-5 2-8 5-8l1-7c.3-2 3-2 3.2 0l.3 5 4 .8c2 .4 3 2 2.6 4L45 56z" fill="var(--texto)" stroke="var(--superficie)" strokeWidth="1.5" />
    </svg>
  )
}

/** Fila «Notificaciones» con el interruptor encendido. */
function Interruptor({ texto = 'Notificaciones' }) {
  return (
    <svg viewBox="0 0 200 58" className={DIBUJO} aria-hidden="true">
      <rect x="6" y="8" width="188" height="42" rx="12" fill="var(--superficie)" stroke="var(--linea)" strokeWidth="1.5" />
      <path d="M22 35v-6a6 6 0 0 1 12 0v6l1.5 2h-15z M26 39.5a2 2 0 0 0 4 0" fill="none" stroke="var(--texto)" strokeWidth="1.8" strokeLinejoin="round" />
      <text x="44" y="34" fontSize="13" fontWeight="700" fill="var(--texto)">
        {texto}
      </text>
      <rect x="146" y="19" width="36" height="20" rx="10" fill="var(--ok)" />
      <circle cx="172" cy="29" r="7.5" fill="#fff" />
    </svg>
  )
}

/** Flecha circular de «volver a cargar». */
function Recargar() {
  return (
    <svg viewBox="0 0 200 58" className={DIBUJO} aria-hidden="true">
      <circle cx="100" cy="29" r="22" fill="var(--superficie)" stroke="var(--linea)" strokeWidth="1.5" />
      <path d="M109 22a11 11 0 1 0 2.5 9" fill="none" stroke="var(--texto)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M103.5 20.5l7-1 1 7" fill="none" stroke="var(--texto)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Ícono de una app (Ajustes del iPhone o AlertaClima) con un dedo. */
function IconoApp({ ajustes = false }) {
  return (
    <svg viewBox="0 0 200 58" className={DIBUJO} aria-hidden="true">
      <rect x="78" y="4" width="44" height="44" rx="11" fill={ajustes ? '#8e8e93' : '#0f1b26'} />
      {ajustes ? (
        <g fill="none" stroke="#fff" strokeWidth="2.5">
          <circle cx="100" cy="26" r="9" />
          <circle cx="100" cy="26" r="3.5" />
        </g>
      ) : (
        <path d="M89 32h20a6 6 0 0 0 .5-12 9 9 0 0 0-17-1.5A5.5 5.5 0 0 0 89 32z" fill="#fff" />
      )}
      <path d="M112 57c-1-5 2-8 5-8l1-7c.3-2 3-2 3.2 0l.3 5 4 .8c2 .4 3 2 2.6 4L127 59z" fill="var(--texto)" stroke="var(--superficie)" strokeWidth="1.5" />
    </svg>
  )
}

/** Los pasos (máximo 3) según dónde está abierta la app. */
function pasos({ navegador, sistema, instalada }) {
  if (sistema === 'ios')
    return [
      [<IconoApp ajustes key="a" />, 'Abre «Ajustes» en tu iPhone.'],
      [<Interruptor texto="AlertaClima" key="b" />, 'Toca «Notificaciones», busca AlertaClima y enciéndelas.'],
      [<IconoApp key="c" />, 'Vuelve a AlertaClima.'],
    ]
  if (sistema === 'android' && instalada)
    return [
      [<IconoApp key="a" />, 'Deja el dedo apretado sobre el ícono de AlertaClima.'],
      [<Interruptor key="b" />, 'Toca la «i» y enciende las notificaciones.'],
      [<IconoApp key="c" />, 'Vuelve a AlertaClima.'],
    ]
  if (navegador === 'safari')
    return [
      [<Interruptor texto="Safari › Configuración" key="a" />, 'Arriba, en el menú «Safari», abre «Configuración».'],
      [<Interruptor texto="Sitios web › Notificaciones" key="b" />, 'Entra a «Sitios web» y luego a «Notificaciones».'],
      [<Interruptor texto="AlertaClima: Permitir" key="c" />, 'Elige «Permitir» para esta página.'],
    ]
  const celular = sistema === 'android'
  return [
    [<BarraDireccion key="a" />, `${celular ? 'Toca' : 'Haz clic en'} el ícono que está al lado de la dirección de la página.`],
    [<Interruptor key="b" />, navegador === 'firefox' ? 'Quita el bloqueo de «Notificaciones».' : 'Enciende «Notificaciones» (o elige «Permitir»).'],
    [<Recargar key="c" />, celular ? 'Vuelve a esta página.' : 'Vuelve a cargar la página.'],
  ]
}

function ayudaExtra({ navegador, sistema }) {
  const nombre = navegador === 'edge' ? 'Edge' : navegador === 'brave' ? 'Brave' : navegador === 'firefox' ? 'Firefox' : 'Chrome'
  if (sistema === 'mac') return `Revisa que tu Mac deje mostrar avisos de ${nombre}: menú Apple › Configuración del Sistema › Notificaciones › ${nombre}.`
  if (sistema === 'windows') return `Revisa que Windows deje mostrar avisos de ${nombre}: Inicio › Configuración › Sistema › Notificaciones.`
  if (sistema === 'android') return `Revisa que tu teléfono deje mostrar avisos de ${nombre}: Ajustes › Notificaciones › ${nombre}.`
  return 'Revisa que el modo «No molestar» esté apagado.'
}

/** Aviso de notificaciones apagadas con una guía de 3 pasos que se abre al tocar. */
export function GuiaPermiso({ entorno }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="rounded-2xl bg-superficie-2 p-3">
      <p className="text-[16px] font-bold">Las notificaciones están apagadas en este navegador.</p>
      {!abierta ? (
        <>
          <p className="mt-1 text-[15px] text-texto-2">Puedes encenderlas en 3 pasos.</p>
          <button
            type="button"
            onClick={() => setAbierta(true)}
            aria-expanded="false"
            className="mt-3 min-h-12 w-full rounded-full bg-senal px-4 text-[16px] font-bold text-sobre-senal"
          >
            Muéstrame cómo
          </button>
        </>
      ) : (
        <>
          <ol className="mt-3 space-y-2">
            {pasos(entorno).map(([dibujo, texto], i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-superficie p-2 pr-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-senal text-[16px] font-bold text-sobre-senal">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  {dibujo}
                  <span className="mt-1 block text-[16px] leading-snug">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[15px] text-texto-2">Cuando termines, este aviso desaparece solo.</p>
          <details className="mt-2 text-[15px]">
            <summary className="min-h-11 cursor-pointer py-2 font-bold">¿Sigue sin funcionar?</summary>
            <p className="pb-1 text-texto-2">{ayudaExtra(entorno)}</p>
          </details>
        </>
      )}
    </div>
  )
}

/** Para quien abrió la app dentro de WhatsApp, Instagram u otra: copiar el enlace y abrirlo en el navegador. */
export function AbrirEnNavegador() {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0])
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <div className="rounded-2xl bg-superficie-2 p-3">
      <p className="text-[16px] font-bold">Para recibir avisos, abre AlertaClima en tu navegador.</p>
      <p className="mt-1 text-[15px] text-texto-2">Dentro de esta app no se pueden recibir. Copia el enlace y pégalo en Chrome o Safari.</p>
      <button type="button" onClick={copiar} className="mt-3 min-h-12 w-full rounded-full bg-senal px-4 text-[16px] font-bold text-sobre-senal">
        {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
      </button>
    </div>
  )
}
