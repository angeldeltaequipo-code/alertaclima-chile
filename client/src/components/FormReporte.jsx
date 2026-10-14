import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import Hoja from './Hoja'
import IconoReporte from './IconoReporte'
import { CATEGORIAS } from '../services/reportes'
import { comprimirFoto } from '../services/fotos'

const BASE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

/** Sigue el centro del mapa: el reporte se ubica donde apunta la mira. */
function Mira({ onMover }) {
  const map = useMapEvents({
    move: () => {
      const c = map.getCenter()
      onMover({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

function Recentrar({ punto, token }) {
  const map = useMap()
  useEffect(() => {
    if (token) map.setView([punto.lat, punto.lng], Math.max(map.getZoom(), 16))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  return null
}

/**
 * Formulario rápido: qué pasa (un toque), dónde (mover el mapa bajo la mira) y,
 * si se quiere, un detalle. Pensado para hacerse en menos de 20 segundos.
 */
export default function FormReporte({ inicio, onEnviar, onCerrar }) {
  const [categoria, setCategoria] = useState(null)
  const [punto, setPunto] = useState(inicio.punto)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [gps, setGps] = useState(inicio.esGps ? 'listo' : 'sin')
  const [recentrar, setRecentrar] = useState(0)
  const [foto, setFoto] = useState(null) // { blob, url }
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState(null)

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setErrorFoto(null)
    setProcesandoFoto(true)
    try {
      const blob = await comprimirFoto(archivo)
      if (foto) URL.revokeObjectURL(foto.url)
      setFoto({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      setErrorFoto(err.message)
    } finally {
      setProcesandoFoto(false)
    }
  }
  const quitarFoto = () => {
    if (foto) URL.revokeObjectURL(foto.url)
    setFoto(null)
  }
  const ubicacionPedida = useRef(false)

  const usarGps = () => {
    if (!navigator.geolocation) return setGps('error')
    setGps('buscando')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPunto({ lat: coords.latitude, lng: coords.longitude })
        setRecentrar((n) => n + 1)
        setGps('listo')
      },
      () => setGps('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  // Al abrir, se intenta ubicar el GPS una vez si aún no se tiene.
  useEffect(() => {
    if (!ubicacionPedida.current && gps === 'sin') {
      ubicacionPedida.current = true
      usarGps()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enviar = async (e) => {
    e.preventDefault()
    if (!categoria) return setError('Elige qué está pasando.')
    setEnviando(true)
    setError(null)
    try {
      await onEnviar({ categoria, titulo: titulo || undefined, descripcion: descripcion || undefined, ...punto }, foto?.blob ?? null)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Hoja titulo="Reportar un problema" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-5 px-4 py-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-[18px] font-bold">¿Qué está pasando?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIAS.map((c) => {
              const activa = categoria === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => {
                    setCategoria(c.id)
                    setError(null)
                  }}
                  className={`flex min-h-16 items-center gap-3 rounded-xl border-2 px-3 text-left text-[16px] leading-tight font-bold ${
                    activa ? 'border-senal bg-senal text-sobre-senal' : 'border-borde bg-superficie text-texto'
                  }`}
                >
                  <IconoReporte categoria={c.id} size={28} />
                  {c.nombre}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-[18px] font-bold">¿Dónde?</legend>
          <p className="mb-2 text-[15px] text-texto-2">Mueve el mapa hasta que la mira quede sobre el problema.</p>
          <div className="relative h-64 overflow-hidden rounded-xl border-2 border-borde">
            <MapContainer
              center={[punto.lat, punto.lng]}
              zoom={inicio.esGps ? 16 : 14}
              className="h-full w-full"
              attributionControl
              zoomControl={false}
            >
              <TileLayer url={BASE_URL} attribution={ATRIB} maxZoom={19} className="capa-base" />
              <Mira onMover={setPunto} />
              <Recentrar punto={punto} token={recentrar} />
            </MapContainer>
            {/* Mira fija en el centro */}
            <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" className="-translate-y-[2px]">
                <circle cx="22" cy="22" r="13" fill="none" stroke="#0e1a24" strokeWidth="6" />
                <circle cx="22" cy="22" r="13" fill="none" stroke="#ffc93c" strokeWidth="3" />
                <circle cx="22" cy="22" r="3" fill="#ffc93c" stroke="#0e1a24" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
          <button
            type="button"
            onClick={usarGps}
            disabled={gps === 'buscando'}
            className="mt-2 min-h-11 rounded-lg border-2 border-borde bg-superficie px-4 text-[15px] font-bold disabled:opacity-70"
          >
            {gps === 'buscando' ? 'Buscando tu ubicación…' : 'Ir a mi ubicación'}
          </button>
          {gps === 'error' && (
            <p className="mt-1 text-[14px] text-senal-texto">No se pudo usar tu ubicación. Ubica el problema moviendo el mapa.</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-[18px] font-bold">
            Foto <span className="font-normal text-texto-2">(opcional, muy útil)</span>
          </legend>
          <p className="mb-2 text-[15px] text-texto-2">
            Muestra a tus vecinos cómo está el lugar ahora. No fotografíes personas ni patentes.
          </p>
          {foto ? (
            <div className="space-y-2">
              <img src={foto.url} alt="Foto que se enviará con el reporte" className="max-h-64 w-full rounded-2xl object-cover" />
              <button type="button" onClick={quitarFoto} className="min-h-11 rounded-xl border border-borde px-4 text-[15px] font-bold">
                Quitar foto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-superficie-2 px-3 text-[16px] font-bold">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                {procesandoFoto ? 'Preparando…' : 'Tomar foto'}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegirFoto} />
              </label>
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-superficie-2 px-3 text-[16px] font-bold">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 16l5-5 4 4 3-3 6 6" />
                </svg>
                Desde la galería
                <input type="file" accept="image/*" className="sr-only" onChange={elegirFoto} />
              </label>
            </div>
          )}
          {errorFoto && (
            <p role="alert" className="mt-1 text-[14px] font-bold text-peligro">
              {errorFoto}
            </p>
          )}
        </fieldset>

        <div className="space-y-3">
          <div>
            <label htmlFor="rep-titulo" className="mb-1 block text-[16px] font-bold">
              Lugar o referencia <span className="font-normal text-texto-2">(opcional)</span>
            </label>
            <input
              id="rep-titulo"
              value={titulo}
              maxLength={150}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Esquina Independencia con Maipú"
              className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-3 text-[17px] text-texto placeholder:text-texto-2"
            />
          </div>
          <div>
            <label htmlFor="rep-desc" className="mb-1 block text-[16px] font-bold">
              Detalle <span className="font-normal text-texto-2">(opcional)</span>
            </label>
            <textarea
              id="rep-desc"
              value={descripcion}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: El agua cubre toda la calzada, los autos no pasan."
              className="w-full rounded-lg border-2 border-borde bg-superficie px-3 py-2 text-[17px] text-texto placeholder:text-texto-2"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[16px] font-bold text-peligro">
            {error}
          </p>
        )}

        <div className="space-y-2 pb-2">
          <button
            type="submit"
            disabled={enviando}
            className="min-h-14 w-full rounded-xl bg-senal text-[18px] font-bold text-sobre-senal disabled:opacity-70"
          >
            {enviando ? 'Enviando…' : 'Enviar reporte'}
          </button>
          <p className="text-[14px] text-texto-2">
            El reporte es anónimo: solo se guarda la ubicación del problema. Los vecinos pueden confirmarlo o avisar que
            ya no está, y desaparece solo después de unas horas.
          </p>
        </div>
      </form>
    </Hoja>
  )
}
