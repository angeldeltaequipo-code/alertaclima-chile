import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { svgReporte } from './iconosReporte'
import { nombreCategoria } from '../services/reportes'
import { limiteComuna } from '../services/comunas'
import { radarInfo } from '../services/radar'
import { caucesCercanos } from '../services/rios'
import { COLOR_VOLCAN } from '../services/riesgos'

import { registrarEsri } from '../services/satelite'

maplibregl.setWorkerUrl(urlTrabajador)

// Nubes: imagen infrarroja del satélite GOES-Este (NASA GIBS), renovada cada ~10 minutos.
// El infrarrojo muestra las nubes blancas sobre un suelo gris; se convierte cada píxel para que el
// suelo quede transparente y las nubes se vean como nubes (más altas y frías = más blancas y opacas).
const URLS_NUBES = (z, y, x) => [
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/default/GoogleMapsCompatible_Level6/${z}/${y}/${x}.png?t=${Math.floor(Date.now() / 600e3)}`,
]
async function teselaNubes(z, y, x, signal) {
  let blob
  for (const url of URLS_NUBES(z, y, x)) {
    try {
      const r = await fetch(url, { signal })
      if (r.ok) {
        blob = await r.blob()
        break
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e
    }
  }
  if (!blob) throw new Error('Sin imagen de nubes')
  const img = await createImageBitmap(blob)
  const lienzo = new OffscreenCanvas(img.width, img.height)
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const datos = ctx.getImageData(0, 0, img.width, img.height)
  const px = datos.data
  for (let i = 0; i < px.length; i += 4) {
    const v = (px[i] + px[i + 1] + px[i + 2]) / 3
    // En la paleta de GIBS: < 138 suelo o mar (transparente); 138-215 nubes cada vez más altas y frías.
    const a = Math.max(0, Math.min(1, (v - 138) / 77))
    const tono = 215 + Math.round(a * 40)
    px[i] = tono
    px[i + 1] = tono
    px[i + 2] = Math.min(255, tono + 8)
    px[i + 3] = Math.round(Math.sqrt(a) * 225)
  }
  ctx.putImageData(datos, 0, 0)
  return await (await lienzo.convertToBlob({ type: 'image/png' })).arrayBuffer()
}

let protocoloListo = false
function registrarProtocolo() {
  if (protocoloListo) return
  protocoloListo = true
  registrarEsri(maplibregl)
  maplibregl.addProtocol('nubes', async (params, abort) => {
    const [z, y, x] = params.url.replace('nubes://', '').split('?')[0].split('/').map(Number)
    return { data: await teselaNubes(z, y, x, abort.signal) }
  })
}

// Íconos dibujados en un lienzo (nítidos en pantallas de alta densidad).
function icono(dibujar, lado = 28) {
  const k = 2
  const c = document.createElement('canvas')
  c.width = c.height = lado * k
  const ctx = c.getContext('2d')
  ctx.scale(k, k)
  dibujar(ctx, lado)
  return { imagen: ctx.getImageData(0, 0, lado * k, lado * k), pixelRatio: k }
}
const iconoCamara = () =>
  icono((ctx, l) => {
    ctx.beginPath()
    ctx.arc(l / 2, l / 2, l / 2 - 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#10202e'
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.fillRect(7, 10, 9.5, 8)
    ctx.beginPath()
    ctx.moveTo(16.5, 12.5)
    ctx.lineTo(21.5, 10)
    ctx.lineTo(21.5, 18)
    ctx.lineTo(16.5, 15.5)
    ctx.closePath()
    ctx.fill()
  }, 28)
const iconoVolcan = (color) =>
  icono((ctx, l) => {
    ctx.beginPath()
    ctx.moveTo(l / 2, 3)
    ctx.lineTo(l - 2.5, l - 4)
    ctx.lineTo(2.5, l - 4)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2.4
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1c1917'
    ctx.stroke()
    // cráter
    ctx.beginPath()
    ctx.moveTo(l / 2 - 4, 9)
    ctx.lineTo(l / 2 + 4, 9)
    ctx.strokeStyle = '#1c1917'
    ctx.lineWidth = 2
    ctx.stroke()
  }, 28)

// Mapa con MapLibre (el mismo tipo de motor vectorial que usan Google Maps y Apple Maps):
// zoom suave, texto nítido a cualquier escala y rotación con dos dedos.
//
// Base «Mapa»: OpenFreeMap (datos de OpenStreetMap). Gratis, también comercial, sin clave.
// Base «Satélite»: Esri World Imagery con las calles y nombres del mapa vectorial encima.
//   Libre con atribución en etapa no comercial; para vender, usar una clave de ArcGIS Location Platform.
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty'
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const calma = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const SATELITE = 'esri://{z}/{y}/{x}'
const ATRIB_ESRI = 'Imágenes © Esri, Vantor, Earthstar Geographics'
const CHILE = [
  [-76.0, -56.0],
  [-66.0, -17.4],
]
const AMBAR = '#ffc93c'
const RIO = '#1a73e8'

// Identificador corto y estable para cada cuadro de radar (las URL solo difieren en el medio).
function idRadar(url) {
  let h = 5381
  for (let i = 0; i < url.length; i++) h = ((h * 33) ^ url.charCodeAt(i)) >>> 0
  return `radar-${h.toString(36)}`
}

// Márgenes para encuadrar sin que la lista de abajo tape lo importante.
const margen = (mapa) => ({ top: 150, left: 30, right: 70, bottom: Math.round(Math.min(mapa.getContainer().clientHeight * 0.52, 440)) })

const aBounds = (bbox) => [
  [bbox[0][1], bbox[0][0]],
  [bbox[1][1], bbox[1][0]],
]

function elementoPin(html, etiqueta) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'pin-boton'
  el.setAttribute('aria-label', etiqueta)
  el.innerHTML = html
  return el
}

/** Sincroniza un conjunto de marcadores con una lista (agrega, mueve, quita). */
function sincronizar(mapa, guardados, lista, crear) {
  const vivos = new Set()
  for (const item of lista) {
    vivos.add(item.clave)
    const m = guardados.get(item.clave)
    if (m && m.firma === item.firma) continue
    m?.marcador.remove()
    const marcador = crear(item).addTo(mapa)
    guardados.set(item.clave, { marcador, firma: item.firma })
  }
  for (const [k, m] of guardados) {
    if (!vivos.has(k)) {
      m.marcador.remove()
      guardados.delete(k)
    }
  }
}

export default function Mapa({
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
  pedirRios = null,
  onRios = () => {},
  rioEnfocado = null,
  sismos = null,
  evacuacion = null,
  verCamaras = true,
  volcanes = null,
  onVolcan = () => {},
  onSismo = () => {},
  enfocar = null,
  nubes = false,
  relieve3d = false,
  lugares = [],
  onLugar = () => {},
  viaje = null,
  familia = [],
  ruta = null,
  seguir = null,
}) {
  const caja = useRef(null)
  const ref = useRef({ mapa: null, listo: false, pendientes: [], reportes: new Map(), radar: new Set() })
  const props = useRef({})
  props.current = { onSeleccionar, onCamara, onCalle, onRios, modoCalle, onVolcan, onSismo, camaras, volcanes, sismos, onLugar, base, relieve3d, viaje, nubes }

  // Ejecuta cuando el estilo esté cargado.
  const cuandoListo = (fn) => {
    const r = ref.current
    const seguro = (m) => {
      try {
        fn(m)
      } catch (e) {
        console.error('Mapa:', e)
      }
    }
    if (r.listo) seguro(r.mapa)
    else r.pendientes.push(seguro)
  }

  // ---- Crear el mapa una sola vez ----
  useEffect(() => {
    registrarProtocolo()
    const mapa = new maplibregl.Map({
      container: caja.current,
      style: ESTILO,
      bounds: comuna?.bbox ? aBounds(comuna.bbox) : CHILE,
      fitBoundsOptions: { padding: 24 },
      maxZoom: 21,
      minZoom: 1.2,
      attributionControl: false,
      // Rapidez: pantallas «retina 3x» dibujan a 2x (la diferencia no se ve y el mapa va el doble de fluido)
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      fadeDuration: 120,
      refreshExpiredTiles: false,
      dragRotate: true,
      pitchWithRotate: false,
      locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar', 'NavigationControl.ResetBearing': 'Apuntar al norte' },
    })
    // En el teléfono se acerca con dos dedos: los botones + y − sobran y tapaban el mapa.
    const tactil = window.matchMedia?.('(pointer: coarse)').matches
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: !tactil, visualizePitch: false }), 'top-right')
    mapa.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: [radarInfo.atribucion] }), 'bottom-right')
    mapa.touchZoomRotate.enableRotation()
    ref.current.mapa = mapa
    if (location.search.includes('depurar')) window.__mapa = mapa

    mapa.on('load', () => {
      // Satélite: bajo las calles y los nombres, sobre los rellenos del mapa.
      const primeraLinea = mapa.getStyle().layers.find((l) => l.type === 'line')?.id
      mapa.addSource('satelite', {
        type: 'raster',
        tiles: [SATELITE],
        // 256: pedir imágenes «un nivel más detalladas» cuadruplicaba las descargas y hacía lento el mapa
        tileSize: 256,
        // Nivel 19: la foto más detallada disponible. Más cerca se amplía esa misma foto (algo borrosa, pero se acerca).
        maxzoom: 19,
        attribution: ATRIB_ESRI,
      })
      mapa.addLayer({ id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 150 } }, primeraLinea)
      // De lejos (globo terráqueo) el planeta se ve con su foto satelital real, y se funde con el mapa al acercarse.
      mapa.addLayer(
        { id: 'satelite-globo', type: 'raster', source: 'satelite', maxzoom: 7.2, layout: { visibility: props.current.base === 'satelite' ? 'none' : 'visible' }, paint: { 'raster-fade-duration': 150, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 1, 7, 0] } },
        primeraLinea,
      )

      // Relieve real de la Tierra (Mapzen/AWS, libre): sombras de montañas y 3D, solo en modo 3D o viajes.
      mapa.addSource('dem', { type: 'raster-dem', tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: 'terrarium', attribution: 'Relieve: Mapzen, AWS Terrain Tiles' })
      mapa.addLayer(
        { id: 'relieve', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.38, 'hillshade-shadow-color': '#3a2f28', 'hillshade-highlight-color': '#fffaf0', 'hillshade-accent-color': '#5b4636' } },
        primeraLinea,
      )
      // Globo terráqueo al alejarse y cielo con atmósfera (como Google Earth).
      try {
        mapa.setProjection({ type: 'globe' })
        mapa.setSky({ 'sky-color': '#0d2a55', 'horizon-color': '#9cc3ea', 'fog-color': '#cfe0f2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.6, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.6, 10, 0] })
      } catch {
        /* versión sin globo: mapa plano */
      }

      mapa.addSource('nubes', { type: 'raster', tiles: ['nubes://{z}/{y}/{x}'], tileSize: 256, maxzoom: 6, attribution: 'Nubes: GOES-Este, NASA GIBS' })
      // Bajo los nombres de ciudades, para que se sigan leyendo.
      const primerTexto = mapa.getStyle().layers.find((l) => l.type === 'symbol')?.id
      mapa.addLayer({ id: 'nubes', type: 'raster', source: 'nubes', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 300 } }, primerTexto)

      mapa.addSource('comuna', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      mapa.addLayer({ id: 'comuna-halo', type: 'line', source: 'comuna', paint: { 'line-color': '#000', 'line-opacity': 0.35, 'line-width': 5 } })
      mapa.addLayer({ id: 'comuna', type: 'line', source: 'comuna', paint: { 'line-color': AMBAR, 'line-width': 3, 'line-dasharray': [2, 1.5] } })

      mapa.addSource('rios', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      mapa.addLayer({ id: 'rios-halo', type: 'line', source: 'rios', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': ['case', ['get', 'enfocado'], 11, 8], 'line-opacity': 0.9 } })
      mapa.addLayer({ id: 'rios', type: 'line', source: 'rios', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': RIO, 'line-width': ['case', ['get', 'enfocado'], 7, 4.5] } })
      mapa.addLayer({
        id: 'rios-nombre',
        type: 'symbol',
        source: 'rios',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'nombre'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 14,
          'symbol-spacing': 280,
        },
        paint: { 'text-color': '#0b3d91', 'text-halo-color': '#fff', 'text-halo-width': 2 },
      })

      // La atribución parte plegada (botón «i») para no tapar el mapa en pantallas chicas.
      caja.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      // Cámaras: agrupadas en burbujas con el número cuando el mapa está lejos, y SIEMPRE bajo los sismos.
      mapa.addImage('icono-camara', iconoCamara().imagen, { pixelRatio: 2 })
      for (const [k, c] of Object.entries(COLOR_VOLCAN)) mapa.addImage(`volcan-${k}`, iconoVolcan(c).imagen, { pixelRatio: 2 })
      mapa.addSource('camaras', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 42, clusterMaxZoom: 10 })
      mapa.addLayer({
        id: 'camaras-grupo',
        type: 'circle',
        source: 'camaras',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#10202e',
          'circle-opacity': 0.82,
          'circle-radius': ['step', ['get', 'point_count'], 13, 10, 16, 30, 20],
          'circle-stroke-color': '#7dd3fc',
          'circle-stroke-width': 2,
        },
      })
      mapa.addLayer({
        id: 'camaras-n',
        type: 'symbol',
        source: 'camaras',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
        paint: { 'text-color': '#e0f2fe' },
      })
      mapa.addLayer({
        id: 'camaras-pin',
        type: 'symbol',
        source: 'camaras',
        filter: ['!', ['has', 'point_count']],
        layout: { 'icon-image': 'icono-camara', 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 12, 1], 'icon-allow-overlap': true },
      })
      // Volcanes: triángulos con el color del nivel de alerta técnica.
      mapa.addSource('volcanes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      mapa.addLayer({
        id: 'volcanes',
        type: 'symbol',
        source: 'volcanes',
        layout: {
          'icon-image': ['concat', 'volcan-', ['get', 'nivel']],
          'icon-size': ['case', ['==', ['get', 'nivel'], 'sin'], 0.75, 1.05],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['get', 'orden'],
          'text-field': ['step', ['zoom'], ['case', ['==', ['get', 'nivel'], 'sin'], '', ['get', 'nombre']], 6, ['get', 'nombre']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#1c1917', 'text-halo-width': 1.6 },
      })
      // Sismos: círculos con tamaño y color según la magnitud (encima de cámaras y volcanes).
      mapa.addSource('sismos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      mapa.addLayer({
        id: 'sismos',
        type: 'circle',
        source: 'sismos',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 4, 4, 8, 5, 13, 6, 20, 7, 30],
          'circle-color': ['step', ['get', 'mag'], '#94a3b8', 3, '#38bdf8', 4, '#f59e0b', 5, '#f97316', 6, '#e11d48'],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'edadH'], 0, 0.85, 168, 0.35],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      })
      mapa.addLayer({
        id: 'sismos-mag',
        type: 'symbol',
        source: 'sismos',
        filter: ['>=', ['get', 'mag'], 4],
        layout: { 'text-field': ['to-string', ['get', 'mag']], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 },
      })
      // Evacuación: rutas en verde con borde blanco y zonas de encuentro como círculos verdes.
      mapa.addSource('evac', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      mapa.addLayer({ id: 'evac-borde', type: 'line', source: 'evac', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': 0.9 } })
      mapa.addLayer({ id: 'evac-ruta', type: 'line', source: 'evac', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#16a34a', 'line-width': 4, 'line-dasharray': [2, 1] } })
      mapa.addLayer({ id: 'evac-zona-halo', type: 'circle', source: 'evac', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 13, 'circle-color': '#22c55e', 'circle-opacity': 0.25 } })
      mapa.addLayer({ id: 'evac-zona', type: 'circle', source: 'evac', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#16a34a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } })
      mapa.addLayer({
        id: 'evac-nombre',
        type: 'symbol',
        source: 'evac',
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: 14,
        layout: { 'text-field': ['coalesce', ['get', 'nombre'], 'Zona segura'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 10 },
        paint: { 'text-color': '#14532d', 'text-halo-color': '#fff', 'text-halo-width': 1.6 },
      })
      ref.current.listo = true
      ref.current.pendientes.splice(0).forEach((fn) => fn(mapa))
    })

    mapa.on('click', (e) => {
      if (props.current.modoCalle) props.current.onCalle({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    mapa.on('click', 'camaras-grupo', async (e) => {
      if (props.current.modoCalle) return
      const f = e.features?.[0]
      if (!f) return
      const zoom = await mapa.getSource('camaras').getClusterExpansionZoom(f.properties.cluster_id)
      mapa.easeTo({ center: f.geometry.coordinates, zoom: Math.min(zoom + 0.3, 14) })
    })
    mapa.on('click', 'camaras-pin', (e) => {
      if (props.current.modoCalle) return
      const id = e.features?.[0]?.properties?.id
      const c = props.current.camaras.find((x) => String(x.id) === String(id))
      if (c) props.current.onCamara(c)
    })
    mapa.on('click', 'volcanes', (e) => {
      if (props.current.modoCalle) return
      const n = e.features?.[0]?.properties?.nombre
      const v = props.current.volcanes?.find((x) => x.nombre === n)
      if (v) props.current.onVolcan(v)
    })
    mapa.on('click', 'sismos', (e) => {
      if (props.current.modoCalle) return
      // Si hay varios encima, el más fuerte
      const ids = (e.features ?? []).map((f) => f.properties?.id)
      const lista = (props.current.sismos ?? []).filter((x) => ids.includes(x.id))
      const s = lista.sort((a, b) => b.magnitud - a.magnitud)[0]
      if (s) props.current.onSismo(s)
    })
    for (const capa of ['camaras-grupo', 'camaras-pin', 'volcanes', 'sismos']) {
      mapa.on('mouseenter', capa, () => (mapa.getCanvas().style.cursor = 'pointer'))
      mapa.on('mouseleave', capa, () => (mapa.getCanvas().style.cursor = ''))
    }

    return () => {
      mapa.remove()
      ref.current = { mapa: null, listo: false, pendientes: [], reportes: new Map(), radar: new Set() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Al mostrarse la pestaña, recalcular tamaño ----
  useEffect(() => {
    if (visible) ref.current.mapa?.resize()
  }, [visible])

  // ---- Base: mapa o satélite ----
  useEffect(() => {
    cuandoListo((mapa) => {
      const sat = base === 'satelite'
      mapa.setLayoutProperty('satelite', 'visibility', sat ? 'visible' : 'none')
      if (mapa.getLayer('satelite-globo')) mapa.setLayoutProperty('satelite-globo', 'visibility', sat ? 'none' : 'visible')
      // En satélite se ocultan los rellenos (parques, edificios, agua) para ver la foto.
      for (const l of mapa.getStyle().layers) {
        if ((l.type === 'fill' || l.type === 'fill-extrusion') && l.id !== 'satelite') {
          mapa.setLayoutProperty(l.id, 'visibility', sat ? 'none' : 'visible')
        }
      }
      mapa.setMaxZoom(21)
    })
  }, [base])

  // ---- Comuna: contorno y encuadre ----
  useEffect(() => {
    let vigente = true
    if (!comuna) return
    cuandoListo((mapa) => {
      if (comuna.bbox && !props.current.viaje) mapa.fitBounds(aBounds(comuna.bbox), { padding: 24, maxZoom: 13, duration: 0 })
      mapa.getSource('comuna').setData({ type: 'FeatureCollection', features: [] })
      mapa.getSource('rios').setData({ type: 'FeatureCollection', features: [] })
      ref.current.rios = null
    })
    limiteComuna(comuna.cut)
      .then((f) => vigente && f && cuandoListo((mapa) => mapa.getSource('comuna').setData(f)))
      .catch(() => {})
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comuna?.cut])

  // ---- Mi ubicación ----
  const marcaUbicacion = useRef(null)
  useEffect(() => {
    const mapa = ref.current.mapa
    if (!mapa || !ubicacion) return
    if (!marcaUbicacion.current) {
      const el = document.createElement('div')
      el.className = 'punto-ubicacion'
      el.setAttribute('aria-label', 'Tu ubicación')
      marcaUbicacion.current = new maplibregl.Marker({ element: el })
    }
    marcaUbicacion.current.setLngLat([ubicacion.lng, ubicacion.lat]).addTo(mapa)
  }, [ubicacion])
  useEffect(() => {
    if (ubicacion && centrarEn) ref.current.mapa?.flyTo({ center: [ubicacion.lng, ubicacion.lat], zoom: Math.max(ref.current.mapa.getZoom(), 14) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEn])

  // ---- Reportes vecinales ----
  useEffect(() => {
    const mapa = ref.current.mapa
    if (!mapa) return
    sincronizar(
      mapa,
      ref.current.reportes,
      reportes.map((r) => ({ ...r, clave: r.id, firma: `${r.lat},${r.lng},${r.categoria},${seleccionado?.id === r.id}` })),
      (r) => {
        const el = elementoPin(
          `<div class="pin-reporte${seleccionado?.id === r.id ? ' seleccionado' : ''}">${svgReporte(r.categoria, 22)}</div>`,
          `Reporte vecinal: ${nombreCategoria(r.categoria)}`,
        )
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          props.current.onSeleccionar(r)
        })
        if (seleccionado?.id === r.id) el.style.zIndex = '2'
        return new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [-4, 2] }).setLngLat([r.lng, r.lat])
      },
    )
  }, [reportes, seleccionado?.id])

  useEffect(() => {
    if (seleccionado && visible) ref.current.mapa?.flyTo({ center: [seleccionado.lng, seleccionado.lat], zoom: Math.max(ref.current.mapa.getZoom(), 15) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado?.id, visible])

  // ---- Cámaras (capa del mapa, agrupada) ----
  useEffect(() => {
    cuandoListo((mapa) => {
      mapa.getSource('camaras').setData({
        type: 'FeatureCollection',
        features: (verCamaras ? camaras : []).map((c) => ({ type: 'Feature', properties: { id: String(c.id) }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } })),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaras, verCamaras])

  // ---- Volcanes ----
  const volcanesAntes = useRef(null)
  useEffect(() => {
    const recien = volcanes && !volcanesAntes.current
    volcanesAntes.current = volcanes
    cuandoListo((mapa) => {
      const ORDEN = { Roja: 0, Naranja: 1, Amarilla: 2, noticia: 3, Verde: 4, sin: 5 }
      mapa.getSource('volcanes').setData({
        type: 'FeatureCollection',
        features: (volcanes ?? []).map((v) => ({
          type: 'Feature',
          properties: { nombre: v.nombre, nivel: v.nivel ?? (v.noticia ? 'noticia' : 'sin'), orden: ORDEN[v.nivel ?? (v.noticia ? 'noticia' : 'sin')] ?? 5 },
          geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
        })),
      })
      if (recien && !props.current.viaje) mapa.flyTo({ center: [-70.5, -33], zoom: 3.7 })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volcanes])

  // ---- Nubes ----
  useEffect(() => {
    cuandoListo((mapa) => {
      mapa.setLayoutProperty('nubes', 'visibility', nubes ? 'visible' : 'none')
      if (!nubes) return
      // Renovar la imagen cada 10 minutos (el satélite entrega una nueva).
      const t = setInterval(() => mapa.getSource('nubes')?.setTiles([`nubes://{z}/{y}/{x}?t=${Math.floor(Date.now() / 600e3)}`]), 600e3)
      ref.current.relojNubes = t
    })
    return () => clearInterval(ref.current.relojNubes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nubes])

  // ---- Radar: una capa por cuadro, que quedan cargadas para animar sin volver a descargar ----
  useEffect(() => {
    const actual = cuadros[indice]?.url
    cuandoListo((mapa) => {
      const r = ref.current
      const vigentes = new Set(cuadros.map((c) => c.url))
      // Cada cuadro queda montado mientras siga vigente: así la animación no vuelve a descargar
      // imágenes en cada vuelta (RainViewer limita a 100 pedidos por minuto).
      for (const url of [...r.radar]) {
        if (!vigentes.has(url)) {
          const id = idRadar(url)
          if (mapa.getLayer(id)) mapa.removeLayer(id)
          if (mapa.getSource(id)) mapa.removeSource(id)
          r.radar.delete(url)
        }
      }
      if (actual && !r.radar.has(actual)) {
        const id = idRadar(actual)
        if (!mapa.getSource(id)) mapa.addSource(id, { type: 'raster', tiles: [actual], tileSize: 256, maxzoom: radarInfo.zoomMaximo })
        if (!mapa.getLayer(id)) mapa.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } }, 'comuna-halo')
        r.radar.add(actual)
      }
      for (const url of r.radar) {
        const id = idRadar(url)
        if (mapa.getLayer(id)) mapa.setPaintProperty(id, 'raster-opacity', url === actual ? 0.75 : 0)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuadros, indice])

  // ---- Evacuación ----
  const evacAntes = useRef(null)
  useEffect(() => {
    const recien = evacuacion && !evacAntes.current
    evacAntes.current = evacuacion
    cuandoListo((mapa) => {
      const fs = []
      for (const r of evacuacion?.rutas ?? []) fs.push({ type: 'Feature', properties: { tsunami: r.tsunami }, geometry: { type: 'LineString', coordinates: r.coords } })
      for (const p of evacuacion?.puntos ?? []) fs.push({ type: 'Feature', properties: { nombre: p.nombre, tsunami: p.tsunami }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })
      mapa.getSource('evac').setData({ type: 'FeatureCollection', features: fs })
      if (recien && fs.length) {
        let o = 180, s = 90, e = -180, n = -90
        const ver = ([x, y]) => ((o = Math.min(o, x)), (e = Math.max(e, x)), (s = Math.min(s, y)), (n = Math.max(n, y)))
        for (const f of fs) (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(ver)
        mapa.fitBounds([[o, s], [e, n]], { padding: margen(mapa), maxZoom: 15, duration: 900 })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evacuacion])

  // ---- Enfocar un punto (p. ej. un sismo abierto desde Riesgos) ----
  useEffect(() => {
    if (!enfocar) return
    cuandoListo((mapa) => mapa.flyTo({ center: [enfocar.lng, enfocar.lat], zoom: enfocar.zoom ?? Math.max(mapa.getZoom(), 6.5), duration: 1200 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfocar])

  // ---- Sismos ----
  const sismosAntes = useRef(null)
  useEffect(() => {
    const recienActivada = sismos && !sismosAntes.current
    sismosAntes.current = sismos
    cuandoListo((mapa) => {
      const ahora = Date.now()
      mapa.getSource('sismos').setData({
        type: 'FeatureCollection',
        features: (sismos ?? []).map((s) => ({
          type: 'Feature',
          properties: { id: s.id, mag: s.magnitud, edadH: (ahora - s.hora) / 3600e3 },
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        })),
      })
      // Al activar la capa se muestra todo Chile; en las actualizaciones no se mueve el mapa.
      if (recienActivada && !props.current.viaje) mapa.flyTo({ center: [-71, -32], zoom: 3.6 })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sismos])

  // ---- Ríos y quebradas cercanos ----
  useEffect(() => {
    if (!pedirRios?.punto) return
    const punto = pedirRios.punto
    props.current.onRios({ estado: 'buscando' })
    cuandoListo((mapa) => {
      mapa.jumpTo({ center: [punto.lng, punto.lat], zoom: Math.min(mapa.getZoom(), 12) < 11 ? 12 : Math.min(mapa.getZoom(), 12) })
      const buscar = () => {
        const fuentes = mapa.querySourceFeatures('openmaptiles', { sourceLayer: 'waterway' })
        const lista = caucesCercanos(fuentes, punto)
        mapa.getSource('rios').setData({
          type: 'FeatureCollection',
          features: lista.map((c, i) => ({ type: 'Feature', id: i, properties: { nombre: c.nombre, enfocado: false }, geometry: c.geometria })),
        })
        if (lista.length) {
          // Encuadre: el punto y el cauce más cercano.
          const b = new maplibregl.LngLatBounds([punto.lng, punto.lat], [punto.lng, punto.lat])
          for (const linea of lista[0].geometria.coordinates) for (const c of linea) b.extend(c)
          mapa.fitBounds(b, { padding: margen(mapa), maxZoom: 15 })
        }
        ref.current.rios = lista
        props.current.onRios({ estado: lista.length ? 'listo' : 'vacio', lista, punto })
      }
      // Se busca cuando el mapa termina de cargar los cauces de la zona (con un respaldo por si ya estaba quieto).
      let hecho = false
      const una = () => {
        if (hecho) return
        hecho = true
        buscar()
      }
      mapa.once('idle', una)
      setTimeout(() => mapa.areTilesLoaded() && una(), 1500)
      setTimeout(una, 8000)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedirRios?.n])

  // Enfocar un cauce de la lista
  useEffect(() => {
    cuandoListo((mapa) => {
      const lista = ref.current.rios
      if (!lista) return
      mapa.getSource('rios').setData({
        type: 'FeatureCollection',
        features: lista.map((c, i) => ({
          type: 'Feature',
          id: i,
          properties: { nombre: c.nombre, enfocado: rioEnfocado?.nombre === c.nombre },
          geometry: c.geometria,
        })),
      })
      if (rioEnfocado) {
        const b = new maplibregl.LngLatBounds()
        for (const linea of rioEnfocado.geometria.coordinates) for (const c of linea) b.extend(c)
        mapa.fitBounds(b, { padding: margen(mapa), maxZoom: 15 })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rioEnfocado])

  // ---- Entrada de cine: la primera vez que se abre el mapa, baja desde el espacio hasta tu comuna ----
  const entro = useRef(false)
  useEffect(() => {
    if (!visible || entro.current || viaje) return
    entro.current = true
    cuandoListo((mapa) => {
      if (calma()) return
      const fin = mapa.cameraForBounds(comuna?.bbox ? aBounds(comuna.bbox) : CHILE, { padding: 40 })
      if (!fin) return
      mapa.jumpTo({ center: [-72, -36], zoom: 1.4, pitch: 0, bearing: 0 })
      mapa.flyTo({ ...fin, zoom: Math.min(fin.zoom ?? 10, 13), pitch: 42, bearing: -12, duration: 2800, curve: 1.5, essential: true })
      mapa.once('moveend', () => !props.current.relieve3d && !props.current.viaje && mapa.easeTo({ pitch: 0, bearing: 0, duration: 1600 }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // ---- Relieve 3D: montañas de verdad (la cordillera se levanta) ----
  useEffect(() => {
    cuandoListo((mapa) => {
      const en3d = relieve3d || Boolean(viaje)
      // Sombras y 3D solo cuando se piden (son lo más pesado del mapa: así el mapa normal vuela)
      mapa.setLayoutProperty('relieve', 'visibility', en3d ? 'visible' : 'none')
      try {
        mapa.setTerrain(en3d ? { source: 'dem', exaggeration: viaje ? 1.25 : 1.6 } : null)
      } catch {
        /* sin soporte */
      }
      if (!viaje) mapa.easeTo({ pitch: relieve3d ? 62 : 0, bearing: relieve3d ? mapa.getBearing() || -18 : 0, duration: 1200 })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relieve3d, Boolean(viaje)])

  // ---- Lugares de los viajes de ZUMI: su carita flotando sobre cada lugar ----
  const pinesLugar = useRef(new Map())
  useEffect(() => {
    cuandoListo((mapa) =>
      sincronizar(
        mapa,
        pinesLugar.current,
        lugares.map((l) => ({ ...l, clave: l.id, firma: `${l.id}${l.sellado ? 1 : 0}` })),
        (l) => {
          const el = document.createElement('button')
          el.type = 'button'
          el.className = `pin-zumi ${l.sellado ? 'sellado' : ''}`
          el.setAttribute('aria-label', `Viajar con ZUMI a ${l.nombre}`)
          el.innerHTML = `<img src="${l.avatar}" alt=""><span>${l.nombre.split(',')[0]}</span>`
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            props.current.onLugar(l)
          })
          return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat])
        },
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lugares])

  // ---- GPS familiar: cada integrante con su inicial ----
  const pinesFamilia = useRef(new Map())
  useEffect(() => {
    cuandoListo((mapa) =>
      sincronizar(
        mapa,
        pinesFamilia.current,
        familia.map((m) => ({ ...m, clave: m.id, firma: `${m.lat.toFixed(5)}${m.lng.toFixed(5)}${m.t}` })),
        (m) => {
          const el = document.createElement('div')
          el.className = `pin-familia ${m.yo ? 'yo' : ''}`
          el.setAttribute('role', 'img')
          el.setAttribute('aria-label', `${m.yo ? 'Tú' : m.nombre}`)
          const b = document.createElement('b')
          b.textContent = (m.nombre || '?').slice(0, 1).toUpperCase()
          const s = document.createElement('span')
          s.textContent = m.yo ? 'Tú' : m.nombre
          el.append(b, s)
          return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat])
        },
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familia])

  // ---- Ruta ZUMI: el camino pintado por tramos según el riesgo, con el clima en cada punto ----
  const marcasRuta = useRef([])
  const claveRuta = useRef(null)
  useEffect(() => {
    cuandoListo((mapa) => {
      marcasRuta.current.forEach((m) => m.remove())
      marcasRuta.current = []
      const vacio = { type: 'FeatureCollection', features: [] }
      if (!mapa.getSource('ruta')) {
        mapa.addSource('ruta', { type: 'geojson', data: vacio, lineMetrics: true })
        mapa.addLayer({ id: 'ruta-borde', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 12, 12], 'line-opacity': 0.55 } })
        mapa.addLayer({
          id: 'ruta-linea',
          type: 'line',
          source: 'ruta',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['match', ['get', 'nivel'], 2, '#ff5a5f', 1, '#ffc53d', '#3ddc84'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 12, 7] },
        })
      }
      if (!ruta) {
        mapa.getSource('ruta').setData(vacio)
        claveRuta.current = null
        return
      }
      mapa.getSource('ruta').setData({
        type: 'FeatureCollection',
        features: ruta.segmentos.map((g) => ({ type: 'Feature', properties: { nivel: g.nivel }, geometry: { type: 'LineString', coordinates: g.coords } })),
      })
      const marca = (lng, lat, el, anchor = 'center') => marcasRuta.current.push(new maplibregl.Marker({ element: el, anchor }).setLngLat([lng, lat]).addTo(mapa))
      // temperatura en los puntos de control
      ruta.puntos.slice(1, -1).forEach((p) => {
        if (p.temp == null) return
        const el = document.createElement('div')
        el.className = `ruta-punto nivel-${p.nivel}`
        el.textContent = `${Math.round(p.temp)}°`
        marca(p.lng, p.lat, el)
      })
      ruta.paradas.forEach((p) => {
        const el = document.createElement('div')
        el.className = 'ruta-parada'
        el.textContent = '☕'
        el.title = `Descanso en ${p.lugar}`
        marca(p.lng, p.lat, el)
      })
      const fin = document.createElement('div')
      fin.className = 'ruta-destino'
      fin.innerHTML = '<b></b>'
      fin.append(Object.assign(document.createElement('span'), { textContent: ruta.destino.nombre }))
      marca(ruta.destino.lng, ruta.destino.lat, fin, 'bottom')
      const ini = document.createElement('div')
      ini.className = 'ruta-origen'
      marca(ruta.origen.lng, ruta.origen.lat, ini)
      // encuadra todo el viaje, dejando espacio para el panel de abajo
      const b = new maplibregl.LngLatBounds()
      ruta.segmentos.forEach((g) => g.coords.forEach((c) => b.extend(c)))
      if (!b.isEmpty() && claveRuta.current !== ruta.clave) mapa.fitBounds(b, { padding: { top: 90, bottom: Math.round(window.innerHeight * 0.52), left: 40, right: 40 }, pitch: 0, bearing: 0, duration: calma() ? 0 : 1400, maxZoom: 12 })
      claveRuta.current = ruta.clave
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta])

  // ---- Navegación: la cámara te sigue, inclinada y girando con tu rumbo, con tu flecha ----
  const marcaNav = useRef(null)
  useEffect(() => {
    cuandoListo((mapa) => {
      if (!seguir) {
        marcaNav.current?.remove()
        marcaNav.current = null
        return
      }
      if (!marcaNav.current) {
        const el = document.createElement('div')
        el.className = 'nav-yo'
        el.innerHTML = '<b></b>'
        marcaNav.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([seguir.lng, seguir.lat]).addTo(mapa)
      }
      marcaNav.current.setLngLat([seguir.lng, seguir.lat]).setRotation(0)
      mapa.easeTo({
        center: [seguir.lng, seguir.lat],
        bearing: seguir.rumbo ?? mapa.getBearing(),
        pitch: 58,
        zoom: 16.6,
        padding: { top: Math.round(window.innerHeight * 0.3), bottom: Math.round(window.innerHeight * 0.18), left: 0, right: 0 },
        duration: calma() ? 0 : 950,
        easing: (t) => t,
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguir?.lat, seguir?.lng, seguir?.rumbo, Boolean(seguir)])

  // ---- Viaje: vuela al lugar en 3D, con satélite, y gira lento alrededor (como un dron) ----
  useEffect(() => {
    if (!viaje) return
    let vivo = true
    let girando = null
    // un instante después de cargar, para que ningún otro ajuste de cámara le gane al vuelo
    cuandoListo((mapa) => setTimeout(() => despegar(mapa), 350))
    // el mapa puede estar recién mostrándose (venía de otra pestaña): esperar a que tenga tamaño
    function despegar(mapa, intento = 0) {
      if (!vivo) return
      if (!mapa.getContainer().clientWidth && intento < 20) return setTimeout(() => despegar(mapa, intento + 1), 100)
      mapa.resize()
      mapa.setLayoutProperty('satelite', 'visibility', 'visible')
      mapa.setLayoutProperty('nubes', 'visibility', 'none') // las nubes del satélite taparían el lugar
      mapa.flyTo({ center: [viaje.lng, viaje.lat], zoom: viaje.zoom ?? 15, pitch: 68, bearing: viaje.rumbo ?? 0, duration: calma() ? 0 : 3400, curve: 1.6, essential: true })
      const girar = () => {
        if (!vivo || calma()) return
        mapa.easeTo({ bearing: mapa.getBearing() + 40, duration: 16000, easing: (x) => x })
      }
      const alTerminar = () => vivo && girar()
      mapa.once('moveend', () => {
        if (!vivo) return
        girar()
        girando = alTerminar
        mapa.on('moveend', girando)
      })
      // si la persona toca o arrastra el mapa, el dron se detiene
      const parar = () => {
        if (girando) mapa.off('moveend', girando)
        girando = null
      }
      mapa.once('dragstart', parar)
      mapa.once('touchstart', parar)
      ref.current.pararViaje = () => {
        parar()
        mapa.stop()
      }
    }
    return () => {
      vivo = false
      ref.current.pararViaje?.()
      cuandoListo((mapa) => {
        const sat = props.current.base === 'satelite'
        mapa.setLayoutProperty('satelite', 'visibility', sat ? 'visible' : 'none')
        mapa.setLayoutProperty('nubes', 'visibility', props.current.nubes ? 'visible' : 'none')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaje?.id])

  // Al terminar el viaje vuelve a tu comuna.
  const viajeAntes = useRef(null)
  useEffect(() => {
    if (viajeAntes.current && !viaje && comuna?.bbox)
      cuandoListo((mapa) => mapa.fitBounds(aBounds(comuna.bbox), { padding: 40, pitch: relieve3d ? 55 : 0, bearing: 0, duration: calma() ? 0 : 3500 }))
    viajeAntes.current = viaje
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaje])

  return <div ref={caja} className={`h-full w-full ${modoCalle ? 'modo-calle' : ''}`} role="region" aria-label="Mapa" />
}
