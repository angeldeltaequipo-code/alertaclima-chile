import { useEffect, useState } from 'react'
import L from 'leaflet'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import { svgReporte } from './iconosReporte'
import { nombreCategoria } from '../services/reportes'
import { limiteComuna } from '../services/comunas'
import { radarInfo } from '../services/radar'

const CHILE = [
  [-56.0, -76.0],
  [-17.4, -66.0],
]

// ---- Mapas base ----
// «Mapa»: OpenFreeMap (datos de OpenStreetMap dibujados en vectores, con edificios, parques,
// nombres de calles y números). Gratis, también para uso comercial, sin clave; exige atribución.
const ESTILO = {
  claro: 'https://tiles.openfreemap.org/styles/liberty',
  // El estilo oscuro de OpenFreeMap es casi negro y poco legible: se usa el claro en ambos temas, como Google Maps.
  oscuro: 'https://tiles.openfreemap.org/styles/liberty',
}
const ATRIB_OFM =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

// «Satélite»: imágenes de Esri World Imagery, con calles y nombres encima.
// Uso libre con atribución en etapa no comercial; para venderlo hay que usar una clave
// gratuita de ArcGIS Location Platform (ver README).
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const SATELITE = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`
const CALLES = `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`
const NOMBRES = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`
const ATRIB_ESRI = 'Imágenes: Esri, Vantor, Earthstar Geographics'

/** Capa vectorial de MapLibre dentro de Leaflet (cambia de estilo con el tema). */
function MapaVectorial({ estilo }) {
  const map = useMap()
  useEffect(() => {
    const capa = maplibreGL({ style: estilo, attributionControl: false, interactive: false })
    capa.addTo(map)
    // Diagnóstico: con ?depurar en la dirección, el mapa queda accesible desde la consola.
    if (location.search.includes('depurar')) window.__mapa = { map, capa }
    map.attributionControl?.addAttribution(ATRIB_OFM)
    return () => {
      map.attributionControl?.removeAttribution(ATRIB_OFM)
      capa.remove()
    }
  }, [estilo, map])
  return null
}

/** Modo «ver la calle»: el siguiente toque en el mapa abre la vista a nivel de calle de ese punto. */
function ToqueCalle({ activo, onElegir }) {
  const map = useMapEvents({
    click(e) {
      if (activo) onElegir(e.latlng)
    },
  })
  useEffect(() => {
    map.getContainer().classList.toggle('modo-calle', activo)
  }, [activo, map])
  return null
}

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

const ICONO_CAMARA = L.divIcon({
  className: '',
  html: '<div class="pin-camara"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h12v10H3z"/><path d="M15 10l6-3v10l-6-3z"/></svg></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

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
  camaras = [],
  onCamara = () => {},
  base = 'mapa',
  modoCalle = false,
  onCalle = () => {},
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
      attributionControl
      preferCanvas
      minZoom={4}
      maxZoom={19}
      zoomControl={false}
    >
      {base === 'satelite' ? (
        <>
          <TileLayer key="sat" url={SATELITE} attribution={ATRIB_ESRI} maxNativeZoom={18} maxZoom={19} />
          <TileLayer key="calles" url={CALLES} maxNativeZoom={18} maxZoom={19} opacity={0.9} />
          <TileLayer key="nombres" url={NOMBRES} maxNativeZoom={18} maxZoom={19} />
        </>
      ) : (
        <MapaVectorial estilo={tema === 'claro' ? ESTILO.claro : ESTILO.oscuro} />
      )}
      <ZoomControl position="topright" zoomInTitle="Acercar" zoomOutTitle="Alejar" />
      <ToqueCalle activo={modoCalle} onElegir={onCalle} />
      <CapasRadar cuadros={cuadros} indice={indice} opacidad={0.75} />
      {limite && (
        <GeoJSON
          key={comuna.cut}
          data={limite}
          interactive={false}
          // Ámbar sobre el mapa oscuro; ocre oscuro sobre el claro (contraste ≥ 4,5:1).
          style={{ color: base === 'satelite' || tema !== 'claro' ? '#ffc93c' : '#8a5600', weight: 3, fill: false, dashArray: '8 6' }}
        />
      )}
      {ubicacion && (
        <CircleMarker
          center={[ubicacion.lat, ubicacion.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2f80ff', fillOpacity: 1 }}
        />
      )}
      {camaras.map((c) => (
        <Marker
          key={`cam-${c.id}`}
          position={[c.lat, c.lng]}
          icon={ICONO_CAMARA}
          title={`Cámara: ${c.titulo}`}
          alt={`Cámara pública: ${c.titulo}`}
          keyboard
          eventHandlers={{ click: () => onCamara(c) }}
        />
      ))}
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
