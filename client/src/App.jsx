import { lazy, Suspense, useEffect, useState } from 'react'
import BandaEstado from './components/BandaEstado'
import ControlRadar from './components/ControlRadar'
import SelectorComuna from './components/SelectorComuna'
import Ajustes from './components/Ajustes'
import VistaAhora from './components/VistaAhora'
import Navegacion from './components/Navegacion'
import { useConexion } from './hooks/useConexion'
import { useAhorro, useComunaGuardada, useTema } from './hooks/usePreferencias'
import { useRadar } from './hooks/useRadar'
import { useClima } from './hooks/useClima'
import { comunaPorCut } from './services/comunas'
import { estadoComuna } from './services/alertas'
import { hhmm } from './services/formato'
import { leer, guardar } from './services/almacen'

// El mapa (Leaflet) se carga aparte y solo al abrir el radar por primera vez.
const Mapa = lazy(() => import('./components/Mapa'))

export default function App() {
  const [tema, setTema] = useTema()
  const ahorro = useAhorro()
  const enLinea = useConexion()
  const [cut, setCut] = useComunaGuardada()
  const comuna = cut ? comunaPorCut(cut) : null
  const radar = useRadar({ ahorro: ahorro.activo, enLinea })
  const clima = useClima({ comuna, ahorro: ahorro.activo, enLinea })

  const [vista, setVistaState] = useState(() => leer('vista', 'ahora'))
  const [mapaMontado, setMapaMontado] = useState(vista === 'radar')
  const [selector, setSelector] = useState(!cut)
  const [ubicacion, setUbicacion] = useState(null)
  const [centrarEn, setCentrarEn] = useState(0)
  const [avisoUbicacion, setAvisoUbicacion] = useState(null)
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    if (cut) estadoComuna(cut).then(setEstado)
  }, [cut])

  const setVista = (v) => {
    setVistaState(v)
    guardar('vista', v)
    if (v === 'radar') setMapaMontado(true)
    window.scrollTo(0, 0)
  }

  const elegirComuna = (nuevo, punto) => {
    setCut(nuevo)
    if (punto) setUbicacion(punto)
    setSelector(false)
  }

  const ubicarme = () => {
    setAvisoUbicacion(null)
    if (!navigator.geolocation) return setAvisoUbicacion('Este navegador no permite usar tu ubicación.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacion({ lat: coords.latitude, lng: coords.longitude })
        setCentrarEn((n) => n + 1)
      },
      (err) =>
        setAvisoUbicacion(
          err.code === err.PERMISSION_DENIED ? 'No diste permiso de ubicación.' : 'No se pudo obtener tu ubicación.',
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  const ultimoDato = [clima.datos?.obtenido, radar.ultimaCarga].filter(Boolean).sort((a, b) => b - a)[0]

  return (
    <div className="flex h-full flex-col">
      {!enLinea && (
        <div role="status" className="safe-top bg-senal px-4 py-2 text-[15px] font-bold text-sobre-senal">
          Sin conexión{ultimoDato ? ` — datos de las ${hhmm(ultimoDato)}` : ' — aún no hay datos guardados'}
        </div>
      )}

      <BandaEstado comuna={comuna} estado={estado} ahora={clima.datos?.ahora} onCambiar={() => setSelector(true)} />

      <main className="relative min-h-0 flex-1">
        {/* Ahora */}
        <div hidden={vista !== 'ahora'} className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-xl">
            {comuna && <VistaAhora clima={clima} comuna={comuna} enLinea={enLinea} />}
          </div>
        </div>

        {/* Radar: el mapa se queda montado al cambiar de pestaña para no recargarlo */}
        <div hidden={vista !== 'radar'} className="absolute inset-0">
          {mapaMontado && (
            <Suspense fallback={<div className="grid h-full place-items-center text-texto-2">Cargando mapa…</div>}>
              <Mapa
                tema={tema}
                comuna={comuna}
                cuadros={radar.cuadros}
                indice={radar.indice}
                ubicacion={ubicacion}
                centrarEn={centrarEn}
                visible={vista === 'radar'}
              />
            </Suspense>
          )}
          <button
            type="button"
            onClick={ubicarme}
            aria-label="Centrar el mapa en mi ubicación"
            className="absolute top-3 right-3 z-[500] grid size-12 place-items-center rounded-xl border-2 border-borde bg-superficie text-texto"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="6.5" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </g>
              <circle cx="12" cy="12" r="2.4" fill="currentColor" />
            </svg>
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3">
            <div className="pointer-events-auto mx-auto max-w-xl space-y-2">
              {avisoUbicacion && (
                <p role="alert" className="rounded-lg border-2 border-borde bg-superficie px-3 py-2 text-[15px]">
                  {avisoUbicacion}
                </p>
              )}
              <ControlRadar radar={radar} ahorro={ahorro.activo} enLinea={enLinea} />
            </div>
          </div>
        </div>

        {/* Ajustes */}
        <div hidden={vista !== 'ajustes'} className="h-full overflow-y-auto overscroll-contain">
          <Ajustes tema={tema} setTema={setTema} ahorro={ahorro} />
        </div>
      </main>

      <Navegacion vista={vista} onCambiar={setVista} />

      {selector && <SelectorComuna actual={comuna} onElegir={elegirComuna} onCerrar={() => setSelector(false)} />}
    </div>
  )
}
