// ZUMI dentro de su «portal»: un dije redondo de vidrio negro (como un charm) donde ZUMI respira,
// parpadea y se cambia de traje según el clima. Los trajes son dibujos vectoriales calzados sobre la
// foto (coordenadas en un lienzo de 512 × 512 donde los ojos de ZUMI están en 198,210 y 318,206).
const BASE = import.meta.env.BASE_URL

function Paraguas() {
  return (
    <g>
      <g className="zumi-lluvia">
        {[40, 110, 440, 480, 70, 420].map((x, i) => (
          <line key={i} x1={x} y1={200 + (i % 3) * 70} x2={x - 8} y2={232 + (i % 3) * 70} stroke="#bae6fd" strokeWidth="6" strokeLinecap="round" style={{ animationDelay: `${i * 0.23}s` }} />
        ))}
      </g>
      <g transform="rotate(-10 256 90)">
        <path d="M30 120 Q256 -70 482 120 Z" fill="url(#zp-tela)" />
        <path d="M30 120 q37 -22 75 0 q38 -22 75 0 q38 -22 76 0 q38 -22 75 0 q38 -22 75 0 q38 -22 76 0" fill="none" stroke="#7c2d12" strokeWidth="5" opacity=".35" />
        <path d="M256 25 L256 120 M143 40 L180 120 M369 40 L332 120" stroke="#7c2d12" strokeWidth="4" opacity=".35" />
        <circle cx="256" cy="20" r="9" fill="#78350f" />
        <path d="M256 120 L256 140" stroke="#44403c" strokeWidth="9" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Lentes() {
  return (
    <g>
      <path d="M92 196 L146 202 M370 198 L424 188" stroke="#111827" strokeWidth="9" strokeLinecap="round" />
      <rect x="140" y="172" width="118" height="78" rx="34" fill="url(#zp-vidrio)" stroke="#0f172a" strokeWidth="8" />
      <rect x="262" y="166" width="118" height="78" rx="34" fill="url(#zp-vidrio)" stroke="#0f172a" strokeWidth="8" />
      <path d="M252 206 Q260 196 268 204" stroke="#0f172a" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M160 188 l26 -6 M282 182 l26 -6" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".7" />
    </g>
  )
}

function Gorro() {
  return (
    <g>
      <path d="M108 150 C108 40 404 30 414 146 Z" fill="#0d9488" />
      <path d="M150 60 C200 40 320 38 370 62" stroke="#14b8a6" strokeWidth="10" fill="none" opacity=".6" />
      <rect x="96" y="128" width="330" height="46" rx="22" fill="#0f766e" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={116 + i * 32} y1={134} x2={116 + i * 32} y2={168} stroke="#115e59" strokeWidth="6" strokeLinecap="round" />
      ))}
      <circle cx="262" cy="34" r="30" fill="#f8fafc" />
      <circle cx="252" cy="26" r="10" fill="#fff" />
      {/* bufanda */}
      <path d="M118 372 C200 410 320 410 398 368 L404 420 C320 462 196 462 112 424 Z" fill="#dc2626" />
      <path d="M150 396 l0 40 M190 404 l0 44 M230 408 l0 44 M270 408 l0 44 M310 404 l0 44 M350 396 l0 40" stroke="#fca5a5" strokeWidth="7" opacity=".55" />
      <path d="M330 420 L360 512 L410 512 L384 414 Z" fill="#b91c1c" />
    </g>
  )
}

function Astronauta() {
  return (
    <g>
      <circle cx="256" cy="256" r="236" fill="url(#zp-casco)" stroke="#e2e8f0" strokeWidth="18" />
      <path d="M86 150 A190 190 0 0 1 200 66" stroke="#fff" strokeWidth="16" strokeLinecap="round" fill="none" opacity=".55" />
      <path d="M110 190 A160 160 0 0 1 140 140" stroke="#fff" strokeWidth="10" strokeLinecap="round" fill="none" opacity=".4" />
      <path d="M40 420 Q256 520 472 420 L512 512 L0 512 Z" fill="#f1f5f9" />
      <rect x="208" y="452" width="96" height="40" rx="10" fill="#1d4ed8" />
      <circle cx="232" cy="472" r="7" fill="#f87171" />
      <circle cx="256" cy="472" r="7" fill="#fbbf24" />
      <circle cx="280" cy="472" r="7" fill="#34d399" />
    </g>
  )
}

function Casco() {
  return (
    <g>
      <path d="M112 150 C112 40 404 34 412 150 Z" fill="url(#zp-amarillo)" />
      <path d="M248 46 L248 150 M276 46 L276 150" stroke="#ca8a04" strokeWidth="10" />
      <path d="M82 158 Q256 120 440 156 Q446 176 430 180 Q256 150 92 184 Q74 178 82 158 Z" fill="#eab308" />
      <path d="M150 70 C190 54 230 50 240 52" stroke="#fef9c3" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".8" />
      {/* chaleco reflectante */}
      <path d="M60 470 Q120 400 190 410 L210 512 L40 512 Z M452 470 Q392 400 322 410 L302 512 L472 512 Z" fill="#f97316" />
      <path d="M70 470 L196 452 M444 470 L316 452" stroke="#e2e8f0" strokeWidth="14" />
    </g>
  )
}

function Presentador() {
  return (
    <g>
      <path d="M96 236 C80 60 440 50 424 230" stroke="#1e293b" strokeWidth="12" fill="none" strokeLinecap="round" />
      <rect x="74" y="204" width="40" height="66" rx="18" fill="#0f172a" />
      <rect x="404" y="198" width="40" height="66" rx="18" fill="#0f172a" />
      <rect x="82" y="224" width="8" height="26" rx="4" fill="#22d3ee" className="zumi-led" />
      <path d="M100 262 C110 320 160 336 206 318" stroke="#1e293b" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="212" cy="316" r="12" fill="#0f172a" />
      <circle cx="212" cy="316" r="5" fill="#22d3ee" className="zumi-led" />
    </g>
  )
}

const TRAJE = { paraguas: Paraguas, lentes: Lentes, gorro: Gorro, astronauta: Astronauta, casco: Casco, presentador: Presentador }

/**
 * @param traje presentador | paraguas | gorro | lentes | astronauta | casco
 * @param hablando anima el anillo y las ondas de voz
 */
export default function PortalZumi({ tam = 200, traje = 'presentador', hablando = false, className = '' }) {
  const Traje = TRAJE[traje] ?? Presentador
  return (
    <span className={`portal-zumi ${hablando ? 'hablando' : ''} ${className}`} style={{ width: tam, height: tam }} aria-hidden="true">
      <span className="portal-zumi-lente">
        <span key={traje} className="portal-zumi-escena">
          <img src={`${BASE}zumi/${tam > 140 ? 'zumi-portal.webp' : 'zumi-portal-256.webp'}`} alt="" draggable="false" />
          <svg viewBox="0 0 512 512" className="portal-zumi-traje">
            <defs>
              <linearGradient id="zp-tela" x1="0" x2="1">
                <stop offset="0" stopColor="#facc15" />
                <stop offset=".5" stopColor="#f97316" />
                <stop offset="1" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="zp-vidrio" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#1e293b" />
                <stop offset=".6" stopColor="#0f172a" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
              <radialGradient id="zp-casco" cx=".35" cy=".3" r=".8">
                <stop offset="0" stopColor="#bae6fd" stopOpacity=".18" />
                <stop offset=".7" stopColor="#38bdf8" stopOpacity=".06" />
                <stop offset="1" stopColor="#0ea5e9" stopOpacity=".3" />
              </radialGradient>
              <linearGradient id="zp-amarillo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fde047" />
                <stop offset="1" stopColor="#eab308" />
              </linearGradient>
              <linearGradient id="zp-parpado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9a4a26" />
                <stop offset="1" stopColor="#c9703f" />
              </linearGradient>
            </defs>
            {/* párpados: parpadea cada pocos segundos */}
            <g className="zumi-parpados">
              <ellipse cx="198" cy="210" rx="31" ry="29" fill="url(#zp-parpado)" />
              <ellipse cx="318" cy="206" rx="31" ry="29" fill="url(#zp-parpado)" />
            </g>
            <Traje />
          </svg>
        </span>
        <span className="portal-zumi-brillo" />
      </span>
    </span>
  )
}
