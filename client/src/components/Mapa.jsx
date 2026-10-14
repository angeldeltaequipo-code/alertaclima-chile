import { useEffect, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { limiteComuna } from '../services/comunas'
import { radarInfo } from '../services/radar'

const CHILE = [
  [-56.0, -76.0],
  [-17.4, -66.0],
]

const BASE = {
  oscuro: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  claro: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
}
const ATRIB_BASE =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

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

export default function Mapa({ tema, comuna, cuadros, indice, ubicacion, centrarEn, visible = true }) {
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
      <TileLayer key={tema} url={BASE[tema]} attribution={ATRIB_BASE} subdomains="abcd" maxZoom={19} />
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
      <Encuadre comuna={comuna} ubicacion={ubicacion} centrarEn={centrarEn} visible={visible} />
    </MapContainer>
  )
}
