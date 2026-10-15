// Fondo «universo» de la app: un cielo profundo con estrellas y una nebulosa cuyo color cambia
// según la sección y el tiempo (lluvia en cian, noche en violeta, riesgos en rojo, chat en turquesa).
// Es solo CSS (gradientes y transformaciones), sin imágenes ni canvas: no gasta datos ni batería, y
// se queda quieto si la persona pidió reducir el movimiento.

function ambiente(vista, ahora) {
  if (vista === 'riesgos') return 'riesgos'
  if (vista === 'chat') return 'chat'
  if (vista === 'ajustes') return 'ajustes'
  const i = ahora?.icono
  if (i === 'tormenta') return 'tormenta'
  if (i === 'lluvia' || i === 'lluvia-fuerte' || i === 'llovizna') return 'lluvia'
  if (ahora && ahora.esDeDia === false) return 'noche'
  if (i === 'nublado' || i === 'niebla') return 'nublado'
  return 'despejado'
}

export default function Cosmos({ vista, ahora }) {
  if (vista === 'radar') return null // el mapa ocupa toda la pantalla
  return (
    <div className="cosmos" data-ambiente={ambiente(vista, ahora)} aria-hidden="true">
      <div className="cosmos-nebulosa cosmos-nebulosa-a" />
      <div className="cosmos-nebulosa cosmos-nebulosa-b" />
      <div className="cosmos-estrellas" />
      <div className="cosmos-estrellas cosmos-estrellas-lejos" />
    </div>
  )
}
