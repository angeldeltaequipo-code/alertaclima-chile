import { useState } from 'react'
import ZumiAvatar3D, { puede3D } from './ZumiAvatar3D'
import ZumiVivo from './ZumiVivo'

/**
 * ZUMI de cuerpo entero: en 3D (modelo animado) si el teléfono puede; si no, o mientras carga,
 * el ZUMI «vivo» en 2,5D. Así nunca queda un hueco vacío en pantalla.
 */
export default function ZumiPersonaje({ alto, estado = 'reposo', gesto = null, luz = 'normal', encuadre = 'cuerpo', traje = null }) {
  const [modo, setModo] = useState(() => (puede3D() ? 'cargando' : '2d'))
  return (
    <div className="relative" style={{ height: alto }}>
      {modo !== '2d' && (
        <ZumiAvatar3D
          alto={alto}
          estado={estado}
          gesto={gesto}
          luz={luz}
          encuadre={encuadre}
          onListo={() => setModo('3d')}
          onFalla={() => setModo('2d')}
          className={`transition-opacity duration-500 ${modo === '3d' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {modo !== '3d' && (
        <div className={modo === 'cargando' ? 'absolute inset-x-0 bottom-0 flex justify-center' : ''}>
          <ZumiVivo alto={alto} traje={traje} saludar={gesto === 'saludo'} luz={luz} encuadre={encuadre} />
        </div>
      )}
    </div>
  )
}
