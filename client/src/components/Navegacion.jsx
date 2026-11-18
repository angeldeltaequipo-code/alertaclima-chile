const ICONOS = {
  ahora: (
    <g fill="none" stroke="currentColor" strokeWidth="inherit" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M9 2.5v1.5M3.5 9H2M4.4 4.4l1 1M13.6 4.4l-1 1" />
      <path d="M8 20h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A2.9 2.9 0 0 0 8 20z" />
    </g>
  ),
  radar: (
    <g fill="none" stroke="currentColor" strokeWidth="inherit" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12l6-6" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </g>
  ),
  riesgos: (
    <g fill="none" stroke="currentColor" strokeWidth="inherit" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l2-6 3 12 3-9 2 3h6" />
    </g>
  ),
  chat: (
    <g fill="none" stroke="currentColor" strokeWidth="inherit" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </g>
  ),
  ajustes: (
    <g fill="none" stroke="currentColor" strokeWidth="inherit" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </g>
  ),
}

const PESTANAS = [
  { id: 'ahora', etiqueta: 'Ahora' },
  { id: 'radar', etiqueta: 'Mapa' },
  { id: 'riesgos', etiqueta: 'Riesgos' },
  { id: 'chat', etiqueta: 'Chat' },
  { id: 'ajustes', etiqueta: 'Ajustes' },
]

/** Barra inferior con cuatro destinos: al alcance del pulgar. */
export default function Navegacion({ vista, onCambiar }) {
  return (
    <nav className="barra-nav safe-bottom relative z-[2] border-t border-linea" aria-label="Secciones">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {PESTANAS.map((p) => {
          const activa = vista === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onCambiar(p.id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-[11.5px] font-medium tracking-[0.01em] ${
                  activa ? 'text-texto' : 'text-texto-2'
                }`}
              >
                <span className={`indicador-nav absolute top-0 h-[2px] w-8 rounded-b-full bg-texto ${activa ? 'opacity-100' : 'scale-x-0 opacity-0'}`} aria-hidden="true" />
                <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" className={activa ? '' : 'opacity-80'} style={{ strokeWidth: activa ? 2 : 1.6 }}>
                  {ICONOS[p.id]}
                </svg>
                {p.etiqueta}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
