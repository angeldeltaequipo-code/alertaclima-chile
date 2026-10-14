// Íconos del tiempo dibujados a mano en una grilla de 32 px.
// Sol en ámbar, gotas en el azul de lluvia, nubes en el color del texto.

const nube = 'M9 24h14.5a5.5 5.5 0 0 0 .6-10.97A8 8 0 0 0 8.6 15.2 4.5 4.5 0 0 0 9 24z'
const nubeAlta = 'M9 19h14.5a5.5 5.5 0 0 0 .6-10.97A8 8 0 0 0 8.6 10.2 4.5 4.5 0 0 0 9 19z'

function Sol({ cx = 16, cy = 16, r = 6 }) {
  const rayos = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * (r + 3)}
        y1={cy + Math.sin(a) * (r + 3)}
        x2={cx + Math.cos(a) * (r + 6)}
        y2={cy + Math.sin(a) * (r + 6)}
      />
    )
  })
  return (
    <g stroke="var(--sol)" strokeWidth="2.2" strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} fill="var(--sol)" stroke="none" />
      {rayos}
    </g>
  )
}

function Luna({ x = 0, y = 0, s = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M20.5 22.5A9 9 0 0 1 13.2 6.3 9 9 0 1 0 25.7 18.8a9 9 0 0 1-5.2 3.7z"
      fill="var(--luna)"
    />
  )
}

function Gotas({ n = 3, fuerte = false, y = 22 }) {
  const xs = n === 2 ? [12, 20] : [10, 16, 22]
  return (
    <g stroke="var(--lluvia)" strokeWidth={fuerte ? 2.6 : 2.2} strokeLinecap="round">
      {xs.map((x) => (
        <line key={x} x1={x} y1={y} x2={x - 2} y2={y + (fuerte ? 7 : 5)} />
      ))}
    </g>
  )
}

export default function IconoClima({ icono, esDeDia = true, size = 32, titulo }) {
  const comun = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }
  let cuerpo
  switch (icono) {
    case 'despejado':
      cuerpo = esDeDia ? <Sol /> : <Luna x={1} y={1} s={0.95} />
      break
    case 'parcial':
      cuerpo = (
        <>
          {esDeDia ? <Sol cx={12} cy={11} r={5} /> : <Luna x={-3} y={-3} s={0.8} />}
          <path d={nube} {...comun} fill="var(--fondo-icono)" transform="translate(3 2)" />
        </>
      )
      break
    case 'niebla':
      cuerpo = (
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d={nubeAlta} {...comun} />
          <line x1="6" y1="23" x2="26" y2="23" />
          <line x1="9" y1="28" x2="23" y2="28" />
        </g>
      )
      break
    case 'llovizna':
      cuerpo = (
        <>
          <path d={nubeAlta} {...comun} />
          <Gotas n={2} y={23} />
        </>
      )
      break
    case 'lluvia':
      cuerpo = (
        <>
          <path d={nubeAlta} {...comun} />
          <Gotas y={22} />
        </>
      )
      break
    case 'lluvia-fuerte':
      cuerpo = (
        <>
          <path d={nubeAlta} {...comun} fill="currentColor" fillOpacity="0.25" />
          <Gotas y={21} fuerte />
        </>
      )
      break
    case 'nieve':
      cuerpo = (
        <>
          <path d={nubeAlta} {...comun} />
          <g fill="currentColor">
            <circle cx="10" cy="24" r="1.6" />
            <circle cx="16" cy="27" r="1.6" />
            <circle cx="22" cy="24" r="1.6" />
          </g>
        </>
      )
      break
    case 'tormenta':
      cuerpo = (
        <>
          <path d={nubeAlta} {...comun} fill="currentColor" fillOpacity="0.25" />
          <path d="M17 18l-4 7h4l-2 6 6-9h-4l2-4z" fill="var(--sol)" />
        </>
      )
      break
    default:
      cuerpo = <path d={nube} {...comun} />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {cuerpo}
    </svg>
  )
}
