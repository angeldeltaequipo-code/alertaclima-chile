import Cosmos from './components/Cosmos'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import BandaEstado from './components/BandaEstado'
import ControlRadar from './components/ControlRadar'
import VistaAhora from './components/VistaAhora'
import Navegacion from './components/Navegacion'
import ListaReportes from './components/ListaReportes'
import DetalleReporte from './components/DetalleReporte'
import { useConexion } from './hooks/useConexion'
import { useAhorro, useComunaGuardada, useLetra, useTema } from './hooks/usePreferencias'
import { useRadar } from './hooks/useRadar'
import { useClima } from './hooks/useClima'
import { useReportes } from './hooks/useReportes'
import { useAlertas } from './hooks/useAlertas'
import { useObservacion } from './hooks/useObservacion'
import { useCamaras, useCamarasChile } from './hooks/useCamaras'
import CamarasCercanas, { FichaCamara, VisorCamara } from './components/Camaras'
import AvisoAlerta from './components/AvisoAlerta'
import Resumen from './components/Resumen'
import { useNotificaciones } from './hooks/useNotificaciones'
import { useCuenta } from './hooks/useCuenta'
import { useRiesgos } from './hooks/useRiesgos'
import { useComunidad } from './hooks/useComunidad'
import { resumenParaZumi, ubicar, volcanesConNivel } from './services/comunidad'
import FichaVolcan from './components/FichaVolcan'
import ZumiTeCuenta from './components/ZumiTeCuenta'
import MiFamilia from './components/MiFamilia'
import { BotonZumi } from './components/Zumi'
import { elegirTraje, modoNarrador } from './services/narrador'
import { InvitacionNotificaciones } from './components/Notificaciones'
import { alertaPrincipal } from './services/alertas'
import { marcarVista, vibrar, yaVista } from './services/aviso'
import { condicionesActuales } from './services/clima'
import { comunaPorCut } from './services/comunas'
import { hhmm } from './services/formato'
import { leer, guardar } from './services/almacen'
import { enlaceStreetView } from './services/fotos'
import ControlesMapa from './components/ControlesMapa'
import PanelRios from './components/PanelRios'
import PanelEvacuacion from './components/PanelEvacuacion'
import { obtenerEvacuacion } from './services/evacuacion'
import { CAMARAS_OBSERVATORIOS } from './services/camarasObservatorios'
import Resguardo from './components/Resguardo'
import TirarParaActualizar from './components/TirarParaActualizar'

// El mapa (Leaflet) se carga aparte y solo al abrir el radar por primera vez.
const Mapa = lazy(() => import('./components/Mapa'))
const FormReporte = lazy(() => import('./components/FormReporte'))
// Lo que no se ve al abrir la app se descarga recién cuando hace falta: la primera carga es más liviana.
const VistaRiesgos = lazy(() => import('./components/VistaRiesgos'))
const VistaChat = lazy(() => import('./components/VistaChat'))
const Ajustes = lazy(() => import('./components/Ajustes'))
const EstudioZumi = lazy(() => import('./components/EstudioZumi'))
const DetalleAlertas = lazy(() => import('./components/DetalleAlertas'))
const Bienvenida = lazy(() => import('./components/Bienvenida'))
const SelectorComuna = lazy(() => import('./components/SelectorComuna'))
const PuertaCuenta = lazy(() => import('./components/PuertaCuenta'))
const PantallaSOS = lazy(() => import('./components/SOS').then((m) => ({ default: m.PantallaSOS })))
const Cargando = () => <div className="grid h-full min-h-40 place-items-center text-texto-2">Cargando…</div>

/** Cámaras cercanas + las del país, sin repetir (las cercanas traen la distancia). */
function unirCamaras(cerca = [], pais = []) {
  const ids = new Set(cerca.map((c) => c.id))
  return [...cerca, ...pais.filter((c) => !ids.has(c.id))]
}

export default function App() {
  const [tema, setTema, temaVisible] = useTema()
  const [letra, setLetra] = useLetra()
  const ahorro = useAhorro()
  const enLinea = useConexion()
  const [cut, setCut] = useComunaGuardada()
  const comuna = cut ? comunaPorCut(cut) : null
  const radar = useRadar({ ahorro: ahorro.activo, enLinea })
  const clima = useClima({ comuna, ahorro: ahorro.activo, enLinea })
  const rep = useReportes({ comuna, enLinea })
  const alertas = useAlertas({ comuna, enLinea, ahorro: ahorro.activo })
  const obs = useObservacion({ cut, punto: clima.datos?.punto, enLinea, ahorro: ahorro.activo })
  const camaras = useCamaras({ punto: clima.datos?.punto, enLinea })
  // Todas las cámaras públicas del país (para el mapa y el contador).
  const camarasChile = useCamarasChile({ activo: true, enLinea })
  const camarasMapa = useMemo(() => unirCamaras(camaras.camaras, [...camarasChile.camaras, ...CAMARAS_OBSERVATORIOS]), [camaras.camaras, camarasChile.camaras])
  const cuenta = useCuenta({ enLinea })
  const riesgos = useRiesgos({ enLinea })
  const [capaSismos, setCapaSismos] = useState(false)
  const comunidad = useComunidad({ enLinea })
  const comunidadItems = useMemo(() => ubicar(comunidad.datos?.items, comuna), [comunidad.datos, comuna])
  const volcanesNivel = useMemo(() => volcanesConNivel(riesgos.datos?.volcanes, comunidadItems), [riesgos.datos, comunidadItems])
  const [capaVolcanes, setCapaVolcanes] = useState(false)
  const [volcanSel, setVolcanSel] = useState(null)
  const [capaNubes, setCapaNubes] = useState(() => leer('mapa:nubes', false))
  const [capaCamaras, setCapaCamaras] = useState(() => leer('mapa:camaras', true))
  // Vías de evacuación: { estado: 'cargando' | 'listo' | 'error', datos, error }
  const [evac, setEvac] = useState(null)
  const notifBase = useNotificaciones({ enLinea })
  // Participar (notificaciones, reportes, votos, chat) pide cuenta cuando el inicio de sesión está activo.
  const notif = {
    ...notifBase,
    activar: async (cuts) => {
      if (cuenta.activa && !cuenta.token) {
        cuenta.pedir('notificaciones')
        return false
      }
      return notifBase.activar(cuts)
    },
  }
  const [camaraSel, setCamaraSel] = useState(null)
  const [camaraVisor, setCamaraVisor] = useState(null)
  const [zumi, setZumi] = useState(false)
  const [sos, setSos] = useState(false)
  const [narradoUnaVez, setNarradoUnaVez] = useState(false)
  useEffect(() => {
    // En la página de registro no se abre el reporte encima (taparía la bienvenida).
    if (!narradoUnaVez && modoNarrador() && clima.datos && comuna && !new URLSearchParams(location.search).has('registro')) {
      setNarradoUnaVez(true)
      setZumi(true)
    }
  }, [clima.datos, comuna, narradoUnaVez])
  const [baseMapa, setBaseMapaState] = useState(() => leer('mapa:base', 'mapa'))
  const setBaseMapa = (b) => {
    setBaseMapaState(b)
    guardar('mapa:base', b)
  }
  const [modoCalle, setModoCalle] = useState(false)
  const [pedirRios, setPedirRios] = useState(null) // { n, punto, origen }
  const [rios, setRios] = useState(null)
  const [rioEnfocado, setRioEnfocado] = useState(null)
  const verCalle = ({ lat, lng }) => {
    setModoCalle(false)
    window.open(enlaceStreetView(lat, lng), '_blank', 'noopener')
  }

  // Alerta nueva (o que subió de nivel) que esta persona todavía no ha visto: aviso grande y vibración.
  const [, setVistas] = useState(0)
  const principal = alertaPrincipal(alertas.estado?.alertas ?? [])
  const avisoPendiente = principal && !yaVista(principal) ? principal : null
  useEffect(() => {
    if (avisoPendiente) vibrar(avisoPendiente.nivel)
  }, [avisoPendiente?.id, avisoPendiente?.nivel]) // eslint-disable-line react-hooks/exhaustive-deps
  const cerrarAviso = (verDetalle) => {
    marcarVista(avisoPendiente)
    setVistas((n) => n + 1)
    if (verDetalle) setVerAlertas(true)
  }
  const [verAlertas, setVerAlertas] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [formulario, setFormulario] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [vista, setVistaState] = useState(() => leer('vista', 'ahora'))
  const [mapaMontado, setMapaMontado] = useState(vista === 'radar')
  // Pestañas ya abiertas: se montan la primera vez que se visitan y quedan vivas después.
  const [visitadas, setVisitadas] = useState(() => new Set([vista]))
  useEffect(() => {
    setVisitadas((v) => (v.has(vista) ? v : new Set([...v, vista])))
  }, [vista])
  const [selector, setSelector] = useState(false)
  // Enlace directo a la página de registro: …/alertaclima-chile/?registro
  const [verRegistro, setVerRegistro] = useState(() => new URLSearchParams(location.search).has('registro'))
  const [ubicacion, setUbicacion] = useState(null)
  const [centrarEn, setCentrarEn] = useState(0)
  const [avisoUbicacion, setAvisoUbicacion] = useState(null)

  // Punto de búsqueda de ríos: la localidad de la comuna elegida, o la ubicación de la persona
  // (por defecto, la ubicación solo si está dentro o cerca de la comuna que está mirando).
  const puntoComuna = comuna ? clima.datos?.punto ?? { lat: comuna.centro[0], lng: comuna.centro[1] } : null
  const ubicacionEnComuna =
    ubicacion && comuna?.bbox &&
    ubicacion.lat >= comuna.bbox[0][0] - 0.05 && ubicacion.lat <= comuna.bbox[1][0] + 0.05 &&
    ubicacion.lng >= comuna.bbox[0][1] - 0.05 && ubicacion.lng <= comuna.bbox[1][1] + 0.05
  const buscarRios = (origen = ubicacionEnComuna ? 'ubicacion' : 'comuna') => {
    const punto = origen === 'ubicacion' && ubicacion ? ubicacion : puntoComuna
    if (!punto) return
    setRioEnfocado(null)
    setCamaraSel(null)
    setSeleccionado(null)
    setVista('radar')
    setPedirRios((p) => ({ n: (p?.n ?? 0) + 1, punto, origen: origen === 'ubicacion' && ubicacion ? 'ubicacion' : 'comuna' }))
  }

  const setVista = (v) => {
    setVistaState(v)
    guardar('vista', v)
    if (v === 'radar') setMapaMontado(true)
    window.scrollTo(0, 0)
  }

  // La ficha abierta se actualiza si llegan votos nuevos, y se cierra si el reporte se retira.
  const fichaActual = seleccionado ? rep.reportes.find((r) => r.id === seleccionado.id) ?? null : null

  const verReporte = (r) => {
    setSeleccionado(r)
    setVista('radar')
  }

  const abrirFormulario = () => cuenta.conCuenta('reportar', abrirFormularioYa)
  const abrirFormularioYa = () => {
    const punto = ubicacion ?? (comuna ? clima.datos?.punto ?? { lat: comuna.centro[0], lng: comuna.centro[1] } : { lat: -33.45, lng: -70.66 })
    setFormulario({ punto: { lat: punto.lat, lng: punto.lng }, esGps: Boolean(ubicacion) })
  }

  const enviarReporte = async (datos, foto) => {
    const res = await rep.reportar(datos, foto)
    setFormulario(null)
    if (res.enCola)
      setAviso(
        res.fotoDescartada
          ? 'Sin señal: tu reporte se enviará apenas vuelva la conexión (sin la foto, que no se puede guardar).'
          : 'Sin señal: tu reporte se enviará apenas vuelva la conexión.',
      )
    else {
      setAviso(res.errorFoto ? `Reporte enviado, pero la foto no se pudo subir: ${res.errorFoto}` : 'Reporte enviado. Gracias por avisar a tus vecinos.')
      setSeleccionado(res.reporte)
      setVista('radar')
    }
    setTimeout(() => setAviso(null), 6000)
  }

  const elegirComuna = (nuevo, punto) => {
    setCut(nuevo)
    setSeleccionado(null)
    setRios(null)
    setRioEnfocado(null)
    document.getElementById('vista-ahora')?.scrollTo(0, 0)
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
        // Con la lista de ríos abierta, se vuelve a buscar desde donde está la persona.
        if (rios) setPedirRios((p) => ({ n: (p?.n ?? 0) + 1, punto: { lat: coords.latitude, lng: coords.longitude }, origen: 'ubicacion' }))
      },
      (err) =>
        setAvisoUbicacion(
          err.code === err.PERMISSION_DENIED ? 'No diste permiso de ubicación.' : 'No se pudo obtener tu ubicación.',
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  const datosZumi = {
    comuna,
    ahora: condicionesActuales(clima.datos?.ahora, obs),
    horas: clima.datos?.horas,
    dias: clima.datos?.dias,
    alertas: alertas.estado,
    reportes: rep.reportes,
    sismos: riesgos.datos?.sismos,
    comunidad: comunidad.datos ? resumenParaZumi(comunidadItems, comunidad.datos.tendencias) : null,
  }
  const traje = elegirTraje({ ...datosZumi, hoy: clima.datos?.dias?.[0], vista })
  const ultimoDato = [clima.datos?.obtenido, radar.ultimaCarga].filter(Boolean).sort((a, b) => b - a)[0]

  return (
    <div className="con-cosmos relative isolate flex h-full flex-col">
      <Cosmos vista={vista} ahora={clima.datos?.ahora} />
      {!enLinea && (
        <div role="status" className="safe-top bg-senal px-4 py-2 text-[15px] font-bold text-sobre-senal">
          Sin conexión{ultimoDato ? ` — datos de las ${hhmm(ultimoDato)}` : ' — aún no hay datos guardados'}
        </div>
      )}

      <BandaEstado
        comuna={comuna}
        estado={alertas.estado}
        ahora={condicionesActuales(clima.datos?.ahora, obs)}
        onCambiar={() => setSelector(true)}
        onVerAlertas={() => setVerAlertas(true)}
        onSOS={comuna ? () => setSos(true) : null}
      />

      <main className="relative z-[1] min-h-0 flex-1">
        {/* Ahora */}
        {vista === 'ahora' && (
          <TirarParaActualizar
            idContenedor="vista-ahora"
            onActualizar={() => Promise.allSettled([clima.recargar(), alertas.recargar?.(), rep.recargar?.(), riesgos.recargar?.()])}
          />
        )}
        <div id="vista-ahora" hidden={vista !== 'ahora'} className="h-full overflow-y-auto overscroll-contain">
          <div className="escala-letra mx-auto max-w-xl">
            {comuna && (
              <VistaAhora
                clima={clima}
                sismos={riesgos.datos?.sismos}
                reportesLista={rep.reportes}
                comuna={comuna}
                nombre={cuenta.usuario?.nombre}
                enLinea={enLinea}
                obs={obs}
                resumen={
                  <Resumen
                    alertas={alertas.estado}
                    ahora={condicionesActuales(clima.datos?.ahora, obs)}
                    horas={clima.datos?.horas}
                    reportes={rep.reportes}
                    reportesDisponibles={rep.disponible}
                    comuna={comuna}
                    nombre={cuenta.usuario?.nombre}
                    onVerAlertas={() => setVerAlertas(true)}
                    onVerMapa={() => setVista('radar')}
                    onIr={(id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  />
                }
                invitacion={<InvitacionNotificaciones notif={notif} comuna={comuna} />}
                zumi={clima.datos && <ZumiTeCuenta datos={{ ...datosZumi, nombre: cuenta.usuario?.nombre }} onEscuchar={() => setZumi(true)} />}
                familia={<MiFamilia />}
                reportes={rep.disponible ? <ListaReportes datos={rep} onVer={verReporte} onReportar={abrirFormulario} /> : null}
                camaras={<CamarasCercanas datos={camaras} comuna={comuna} onAbrir={setCamaraVisor} totalChile={camarasChile.total ? camarasChile.total + CAMARAS_OBSERVATORIOS.length : 0} onVerMapa={() => setVista('radar')} />}
                onVerRios={() => buscarRios()}
              />
            )}
          </div>
        </div>

        {/* Radar: el mapa se queda montado al cambiar de pestaña para no recargarlo */}
        <div hidden={vista !== 'radar'} className="absolute inset-0">
          {mapaMontado && (
            <Resguardo mensaje="El mapa tuvo un problema.">
            <Suspense fallback={<div className="grid h-full place-items-center text-texto-2">Cargando mapa…</div>}>
              <Mapa
                comuna={comuna}
                cuadros={radar.cuadros}
                indice={radar.indice}
                ubicacion={ubicacion}
                centrarEn={centrarEn}
                visible={vista === 'radar'}
                reportes={rep.reportes}
                seleccionado={fichaActual}
                onSeleccionar={(r) => {
                  setCamaraSel(null)
                  setSeleccionado(r)
                }}
                camaras={camarasMapa}
                onCamara={(c) => {
                  setSeleccionado(null)
                  setCamaraSel(c)
                }}
                base={baseMapa}
                modoCalle={modoCalle}
                onCalle={verCalle}
                pedirRios={pedirRios}
                onRios={(r) => setRios({ ...r, origen: pedirRios?.origen, comuna: comuna?.nombre, hayUbicacion: Boolean(ubicacion) })}
                rioEnfocado={rioEnfocado}
                sismos={capaSismos ? riesgos.datos?.sismos : null}
                evacuacion={evac?.estado === 'listo' ? evac.datos : null}
                verCamaras={capaCamaras}
                volcanes={capaVolcanes ? volcanesNivel : null}
                onVolcan={(v) => {
                  setSeleccionado(null)
                  setCamaraSel(null)
                  setVolcanSel(v)
                }}
                nubes={capaNubes}
              />
            </Suspense>
            </Resguardo>
          )}
          <ControlesMapa
            base={baseMapa}
            onBase={setBaseMapa}
            modoCalle={modoCalle}
            onModoCalle={setModoCalle}
            onRios={rios ? () => setRios(null) : () => buscarRios()}
            riosActivo={Boolean(rios)}
            sismosActivo={capaSismos}
            onSismos={() => setCapaSismos(!capaSismos)}
            camarasActivo={capaCamaras}
            onCamaras={() => {
              guardar('mapa:camaras', !capaCamaras)
              setCapaCamaras(!capaCamaras)
              setCamaraSel(null)
            }}
            volcanesActivo={capaVolcanes}
            onVolcanes={() => {
              setCapaVolcanes(!capaVolcanes)
              setVolcanSel(null)
            }}
            nubesActivo={capaNubes}
            onNubes={() => {
              guardar('mapa:nubes', !capaNubes)
              setCapaNubes(!capaNubes)
            }}
            evacActivo={Boolean(evac)}
            onEvac={() => {
              if (evac) return setEvac(null)
              const p = ubicacion ?? clima.datos?.punto ?? (comuna ? { lat: comuna.centro[0], lng: comuna.centro[1] } : null)
              if (!p) return
              setRios(null)
              setEvac({ estado: 'cargando' })
              obtenerEvacuacion(p)
                .then((datos) => setEvac((e) => (e ? { estado: 'listo', datos, punto: p } : e)))
                .catch((err) => setEvac((e) => (e ? { estado: 'error', error: err.message } : e)))
            }}
          />
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
          {rep.disponible && (
            <button
              type="button"
              onClick={abrirFormulario}
              aria-label="Reportar un problema en el mapa"
              className="absolute top-[4.25rem] right-3 z-[500] flex w-12 flex-col items-center rounded-xl border-2 border-sobre-senal bg-senal pt-1 pb-0.5 text-sobre-senal shadow-lg"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] leading-tight font-black" aria-hidden="true">Avisar</span>
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3">
            <div className="pointer-events-auto mx-auto max-w-xl space-y-2">
              {avisoUbicacion && (
                <p role="alert" className="rounded-lg border-2 border-borde bg-superficie px-3 py-2 text-[15px]">
                  {avisoUbicacion}
                </p>
              )}
              {evac ? (
                <PanelEvacuacion evac={evac} punto={evac.punto ?? ubicacion} comuna={comuna?.nombre} onCerrar={() => setEvac(null)} />
              ) : rios ? (
                <PanelRios
                  rios={rios}
                  enfocado={rioEnfocado}
                  onEnfocar={setRioEnfocado}
                  onOrigen={buscarRios}
                  onCerrar={() => {
                    setRios(null)
                    setRioEnfocado(null)
                  }}
                />
              ) : volcanSel ? (
                <FichaVolcan volcan={volcanSel} punto={ubicacion ?? clima.datos?.punto} onCerrar={() => setVolcanSel(null)} />
              ) : camaraSel ? (
                <FichaCamara camara={camaraSel} onCerrar={() => setCamaraSel(null)} onAbrir={setCamaraVisor} />
              ) : fichaActual ? (
                <DetalleReporte key={fichaActual.id} reporte={fichaActual} onVotar={(id, voto) => (cuenta.activa && !cuenta.token ? (cuenta.pedir('votar'), Promise.resolve(null)) : rep.votar(id, voto))} onCerrar={() => setSeleccionado(null)} />
              ) : (
                <ControlRadar radar={radar} ahorro={ahorro.activo} enLinea={enLinea} />
              )}
            </div>
          </div>
        </div>

        {/* Riesgos: sismos, tsunamis y volcanes */}
        <div hidden={vista !== 'riesgos'} className="h-full overflow-y-auto overscroll-contain">
          <div className="escala-letra mx-auto max-w-xl">
            {visitadas.has('riesgos') && (
            <Suspense fallback={<Cargando />}>
            <VistaRiesgos
              riesgos={riesgos}
              comuna={comuna}
              punto={clima.datos?.punto ?? (comuna ? { lat: comuna.centro[0], lng: comuna.centro[1] } : null)}
              onVerMapa={() => {
                setCapaSismos(true)
                setVista('radar')
              }}
              onVerVolcanes={() => {
                setCapaVolcanes(true)
                setVista('radar')
              }}
              comunidad={comunidad}
              comunidadItems={comunidadItems}
              volcanesNivel={volcanesNivel}
            />
            </Suspense>
            )}
          </div>
        </div>

        {/* Chat de la comuna */}
        <div hidden={vista !== 'chat'} className="h-full">
          <div className="mx-auto h-full max-w-xl">
            {visitadas.has('chat') && (
              <Suspense fallback={<Cargando />}>
                <VistaChat cuenta={cuenta} comuna={comuna} enLinea={enLinea} visible={vista === 'chat'} />
              </Suspense>
            )}
          </div>
        </div>

        {/* Ajustes */}
        <div hidden={vista !== 'ajustes'} className="h-full overflow-y-auto overscroll-contain">
          {visitadas.has('ajustes') && (
            <Suspense fallback={<Cargando />}>
              <div className="escala-letra">
                <Ajustes tema={tema} setTema={setTema} letra={letra} setLetra={setLetra} ahorro={ahorro} notif={notif} comuna={comuna} cuenta={cuenta} />
              </div>
            </Suspense>
          )}
        </div>
      </main>

      <Navegacion vista={vista} onCambiar={setVista} />

      {cuenta.puerta && cuenta.clientId && <Suspense fallback={null}><PuertaCuenta cuenta={cuenta} /></Suspense>}

      {sos && <Suspense fallback={null}><PantallaSOS nombre={cuenta.usuario?.nombre} onCerrar={() => setSos(false)} /></Suspense>}
      {comuna && vista !== 'chat' && !zumi && !avisoPendiente && !(vista === 'radar' && (evac || rios || fichaActual || camaraSel)) && <BotonZumi traje={traje} onAbrir={() => setZumi(true)} />}
      {zumi && comuna && (
        <Suspense fallback={<div className="fixed inset-0 z-[1150] grid place-items-center bg-[#050a18] text-white/80">Llamando a ZUMI…</div>}>
          <EstudioZumi
            nombreCuenta={cuenta.usuario?.nombre?.split(' ')[0]}
            conCuenta={cuenta.estado === 'con-sesion'}
            traje={traje}
            onCerrar={() => setZumi(false)}
            datos={datosZumi}
          />
        </Suspense>
      )}

      {camaraVisor && <VisorCamara camara={camaraVisor} onCerrar={() => setCamaraVisor(null)} />}

      {aviso && (
        <div role="status" className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex justify-center px-4">
          <p className="max-w-md rounded-xl border-2 border-sobre-senal bg-senal px-4 py-3 text-[16px] font-bold text-sobre-senal shadow-lg">
            {aviso}
          </p>
        </div>
      )}

      {formulario && (
        <Suspense fallback={null}>
          <FormReporte inicio={formulario} onEnviar={enviarReporte} onCerrar={() => setFormulario(null)} />
        </Suspense>
      )}

      {avisoPendiente && comuna && !verAlertas && (
        <AvisoAlerta
          alerta={avisoPendiente}
          comuna={comuna}
          nombre={cuenta.usuario?.nombre?.split(' ')[0]}
          onVerDetalle={() => cerrarAviso(true)}
          onEntendido={() => cerrarAviso(false)}
        />
      )}

      {verAlertas && comuna && (
        <Suspense fallback={null}><DetalleAlertas comuna={comuna} estado={alertas.estado} onCerrar={() => setVerAlertas(false)} /></Suspense>
      )}

      {(!cut || verRegistro) && !selector && (
        <Suspense fallback={null}>
          <Bienvenida
            cuenta={cuenta}
            onElegir={(c, p) => {
              setVerRegistro(false)
              history.replaceState(null, '', location.pathname)
              elegirComuna(c, p)
            }}
            onBuscar={() => {
              setVerRegistro(false)
              history.replaceState(null, '', location.pathname)
              setSelector(true)
            }}
          />
        </Suspense>
      )}
      {selector && <Suspense fallback={null}><SelectorComuna actual={comuna} onElegir={elegirComuna} onCerrar={() => setSelector(false)} /></Suspense>}
    </div>
  )
}
