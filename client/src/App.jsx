import { lazy, Suspense, useEffect, useState } from 'react'
import BandaEstado from './components/BandaEstado'
import ControlRadar from './components/ControlRadar'
import SelectorComuna from './components/SelectorComuna'
import Ajustes from './components/Ajustes'
import { useConexion } from './hooks/useConexion'
import { useAhorro, useComunaGuardada, useTema } from './hooks/usePreferencias'
import { useRadar } from './hooks/useRadar'
import { comunaPorCut } from './services/comunas'
import { estadoComuna } from './services/alertas'
import { hhmm } from './services/formato'

// El mapa (Leaflet) se carga aparte para que la banda y los controles aparezcan al tiro.
const Mapa = lazy(() => import('./components/Mapa'))


export default function App() {
  const [tema, setTema] = useTema()
  const ahorro = useAhorro()
  const enLinea = useConexion()
  const [cut, setCut] = useComunaGuardada()
  const comuna = cut ? comunaPorCut(cut) : null
  const radar = useRadar({ ahorro: ahorro.activo, enLinea })

  const [panel, setPanel] = useState(() => (cut ? null : 'comuna'))
  const [ubicacion, setUbicacion] = useState(null)
  const [centrarEn, setCentrarEn] = useState(0)
  const [avisoUbicacion, setAvisoUbicacion] = useState(null)
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    if (cut) estadoComuna(cut).then(setEstado)
  }, [cut])

  const elegirComuna = (nuevo, punto) => {
    setCut(nuevo)
    if (punto) setUbicacion(punto)
    setPanel(null)
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

  return (
    <div className="flex h-full flex-col">
      {!enLinea && (
        <div role="status" className="safe-top bg-senal px-4 py-2 text-[15px] font-bold text-sobre-senal">
          Sin conexión
          {radar.ultimaCarga ? ` — radar de las ${hhmm(radar.ultimaCarga)}` : ' — aún no hay datos guardados'}
        </div>
      )}

      <BandaEstado comuna={comuna} estado={estado} onCambiar={() => setPanel('comuna')} />

      <main className="relative min-h-0 flex-1">
        <Suspense fallback={<div className="grid h-full place-items-center text-texto-2">Cargando mapa…</div>}>
          <Mapa
            tema={tema}
            comuna={comuna}
            cuadros={radar.cuadros}
            indice={radar.indice}
            ubicacion={ubicacion}
            centrarEn={centrarEn}
          />
        </Suspense>
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
      </main>

      <nav className="safe-bottom grid grid-cols-2 gap-2 border-t-2 border-borde bg-fondo px-3 pt-2 pb-2" aria-label="Acciones">
        <button type="button" onClick={ubicarme} className="min-h-12 rounded-lg border-2 border-borde bg-superficie text-[16px] font-bold">
          Mi ubicación
        </button>
        <button
          type="button"
          onClick={() => setPanel('ajustes')}
          className="min-h-12 rounded-lg border-2 border-borde bg-superficie text-[16px] font-bold"
        >
          Ajustes
        </button>
      </nav>

      {panel === 'comuna' && <SelectorComuna actual={comuna} onElegir={elegirComuna} onCerrar={() => setPanel(null)} />}
      {panel === 'ajustes' && <Ajustes tema={tema} setTema={setTema} ahorro={ahorro} onCerrar={() => setPanel(null)} />}
    </div>
  )
}
