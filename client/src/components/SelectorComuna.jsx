import { useState } from 'react'
import Hoja from './Hoja'
import { buscarComunas, comunaEnPunto, regiones } from '../services/comunas'

const boton =
  'flex min-h-12 w-full items-center justify-between gap-3 border-b border-borde/60 px-4 py-2 text-left text-[17px] hover:bg-superficie focus-visible:bg-superficie'

/**
 * Elegir comuna: escribir el nombre es lo más rápido bajo estrés,
 * por eso la búsqueda va primero; la lista por región queda como respaldo.
 */
export default function SelectorComuna({ actual, onElegir, onCerrar }) {
  const [texto, setTexto] = useState('')
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const resultados = buscarComunas(texto)

  const usarUbicacion = () => {
    if (!navigator.geolocation) {
      setMensaje('Este navegador no permite usar tu ubicación. Busca tu comuna por nombre.')
      return
    }
    setBuscandoUbicacion(true)
    setMensaje(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const c = await comunaEnPunto(coords.latitude, coords.longitude)
          if (c) onElegir(c.cut, { lat: coords.latitude, lng: coords.longitude })
          else setMensaje('Tu ubicación no está dentro de una comuna de Chile. Búscala por nombre.')
        } catch {
          setMensaje('No se pudieron cargar los límites comunales. Revisa tu conexión o busca por nombre.')
        } finally {
          setBuscandoUbicacion(false)
        }
      },
      (err) => {
        setBuscandoUbicacion(false)
        setMensaje(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Puedes activarlo en tu navegador o buscar por nombre.'
            : 'No se pudo obtener tu ubicación. Busca tu comuna por nombre.',
        )
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }

  return (
    <Hoja titulo={actual ? 'Cambiar comuna' : 'Elige tu comuna'} onCerrar={onCerrar} puedeCerrar>
      <div className="sticky top-0 z-10 space-y-3 border-b-2 border-borde bg-fondo px-4 py-3">
        <label htmlFor="buscar-comuna" className="block text-[15px] text-texto-2">
          Escribe el nombre de tu comuna
        </label>
        <input
          id="buscar-comuna"
          data-autofocus
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Ej: Linares"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-3 text-[18px] text-texto placeholder:text-texto-2"
        />
        <button
          type="button"
          onClick={usarUbicacion}
          disabled={buscandoUbicacion}
          className="min-h-12 w-full rounded-lg bg-senal px-4 text-[17px] font-bold text-sobre-senal disabled:opacity-70"
        >
          {buscandoUbicacion ? 'Buscando tu comuna…' : 'Usar mi ubicación'}
        </button>
        {mensaje && (
          <p role="alert" className="text-[15px] text-senal-texto">
            {mensaje}
          </p>
        )}
      </div>

      {texto ? (
        <ul aria-label="Resultados">
          {resultados.length === 0 && (
            <li className="px-4 py-4 text-texto-2">No hay comunas con ese nombre. Revisa cómo está escrito.</li>
          )}
          {resultados.map((c) => (
            <li key={c.cut}>
              <button type="button" className={boton} onClick={() => onElegir(c.cut)}>
                <span className="font-bold">{c.nombre}</span>
                <span className="text-[14px] text-texto-2">{c.region.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="px-4 pt-4 pb-2 text-[15px] text-texto-2">O busca por región, de norte a sur</p>
          {regiones.map((r) => (
            <details key={r.cut} className="border-b border-borde/60" open={actual?.region.cut === r.cut}>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[17px] font-bold">
                {r.nombre}
                <span className="text-[14px] font-normal text-texto-2">{r.comunas.length} comunas</span>
              </summary>
              <ul>
                {r.comunas.map((c) => (
                  <li key={c.cut}>
                    <button
                      type="button"
                      className={`${boton} pl-8`}
                      aria-current={actual?.cut === c.cut ? 'true' : undefined}
                      onClick={() => onElegir(c.cut)}
                    >
                      <span>{c.nombre}</span>
                      {actual?.cut === c.cut && <span className="text-[14px] font-bold text-senal-texto">Actual</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </Hoja>
  )
}
