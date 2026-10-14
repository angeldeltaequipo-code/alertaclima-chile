import { useEffect, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { svgReporte } from './iconosReporte'
import { nombreCategoria } from '../services/reportes'
import { limiteComuna } from '../services/comunas'
import { radarInfo } from '../services/radar'

const CHILE = [
  [-56.0, -76.0],
  [-17.4, -66.0],
]

// Mapa base: OpenStreetMap, sin clave. Su política exige atribución visible, no
// descargar en masa ni guardar teselas para uso sin conexión, así que el service
// worker NO las guarda (solo la caché normal del navegador).
// Para producción comercial conviene un proveedor propio (ver README).
const BASE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIB_BASE =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

const iconos = new Map()
function iconoPin(categoria, seleccionado) {
  const clave = `${categoria}:${seleccionado}`
  if (!iconos.has(clave)) {
    iconos.set(
      clave,
      L.divIcon({
        className: '',
        html: `<div class="pin-reporte${seleccionado ? ' seleccionado' : ''}">${svgReporte(categoria, 22)}</div>`,
        iconSize: [36, 36],
        iconAnchor: [4, 34],
      }),
    )
  }
  return iconos.get(clave)
}

/** Al elegir un reporte desde la lista, el mapa lo trae a la vista. */
function EnfocarReporte({ reporte, visible }) {
  const map = useMap()
  useEffect(() => {
    if (reporte && visible) map.setView([reporte.lat, reporte.lng], Math.max(map.getZoom(), 15))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporte?.id, visible])
  return null
}

function Encuadre({ comuna, ubicacion, centrarEn, visible }) {
  const map = useMap()
  // El mapa vive oculto en la pestaña Ahora; al mostrarlo hay que recalcular su tamaño.
  useEffect(() => {
    if (visible) {
      map.invalidateSize()
      if (comuna?.bbox) map.fitBounds(comuna.bbox, { padding: [24, 24], maxZoom: 13 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])
  useEffect(() => {
    if (comuna?.bbox) map.fitBounds(comuna.bbox, { padding: [24, 24], maxZoom: 13 })
  }, [comuna, map])
  useEffect(() => {
    if (ubicacion && centrarEn) map.setView([ubicacion.lat, ubicacion.lng], Math.max(map.getZoom(), 13))
  }, [ubicacion, centrarEn, map])
  return null
}

/**
 * Capas de radar: cada cuadro visitado queda montado (invisible) para que la
 * animación no vuelva a descargar imágenes en cada vuelta.
 */
function CapasRadar({ cuadros, indice, opacidad }) {
  const [montados, setMontados] = useState(() => new Set())
  useEffect(() => {
    setMontados((prev) => {
      const actual = cuadros[indice]?.url
      if (!actual || prev.has(actual)) return prev
      const vigentes = new Set(cuadros.map((c) => c.url))
      const sig = new Set([...prev].filter((u) => vigentes.has(u)))
      sig.add(actual)
      return sig
    })
  }, [cuadros, indice])

  const actual = cuadros[indice]?.url
  return [...montados].map((url) => (
    <TileLayer
      key={url}
      url={url}
      opacity={url === actual ? opacidad : 0}
      zIndex={url === actual ? 410 : 400}
      maxNativeZoom={radarInfo.zoomMaximo}
      maxZoom={18}
      attribution={radarInfo.atribucion}
    />
  ))
}

export default function Mapa({
  tema,
  comuna,
  cuadros,
  indice,
  ubicacion,
  centrarEn,
  visible = true,
  reportes = [],
  seleccionado = null,
  onSeleccionar = () => {},
}) {
  const [limite, setLimite] = useState(null)

  useEffect(() => {
    let vigente = true
    setLimite(null)
    if (comuna) {
      limiteComuna(comuna.cut)
        .then((f) => vigente && setLimite(f))
        .catch(() => {})
    }
    return () => {
      vigente = false
    }
  }, [comuna])

  return (
    <MapContainer
      bounds={comuna?.bbox ?? CHILE}
      className="h-full w-full"
      zoomControl
      attributionControl
      preferCanvas
      minZoom={4}
      maxZoom={17}
    >
      <TileLayer url={BASE_URL} attribution={ATRIB_BASE} maxZoom={19} className="capa-base" />
      <CapasRadar cuadros={cuadros} indice={indice} opacidad={0.75} />
      {limite && (
        <GeoJSON
          key={comuna.cut}
          data={limite}
          interactive={false}
          // Ámbar sobre el mapa oscuro; ocre oscuro sobre el claro (contraste ≥ 4,5:1).
          style={{ color: tema === 'claro' ? '#8a5600' : '#ffc93c', weight: 3, fill: false }}
        />
      )}
      {ubicacion && (
        <CircleMarker
          center={[ubicacion.lat, ubicacion.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2f80ff', fillOpacity: 1 }}
        />
      )}
      {reportes.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={iconoPin(r.categoria, seleccionado?.id === r.id)}
          title={nombreCategoria(r.categoria)}
          alt={`Reporte vecinal: ${nombreCategoria(r.categoria)}`}
          keyboard
          zIndexOffset={seleccionado?.id === r.id ? 1000 : 0}
          eventHandlers={{ click: () => onSeleccionar(r) }}
        />
      ))}
      <Encuadre comuna={comuna} ubicacion={ubicacion} centrarEn={centrarEn} visible={visible} />
      {/* Después de Encuadre: si se abrió desde la lista, el reporte gana sobre el encuadre de la comuna */}
      <EnfocarReporte reporte={seleccionado} visible={visible} />
    </MapContainer>
  )
}
