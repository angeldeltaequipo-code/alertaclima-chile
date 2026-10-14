import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { svgReporte } from './iconosReporte'
import { nombreCategoria } from '../services/reportes'
import { limiteComuna } from '../services/comunas'
import { radarInfo } from '../services/radar'
import { caucesCercanos } from '../services/rios'

maplibregl.setWorkerUrl(urlTrabajador)

// Mapa con MapLibre (el mismo tipo de motor vectorial que usan Google Maps y Apple Maps):
// zoom suave, texto nítido a cualquier escala y rotación con dos dedos.
//
// Base «Mapa»: OpenFreeMap (datos de OpenStreetMap). Gratis, también comercial, sin clave.
// Base «Satélite»: Esri World Imagery con las calles y nombres del mapa vectorial encima.
//   Libre con atribución en etapa no comercial; para vender, usar una clave de ArcGIS Location Platform.
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty'
const SATELITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
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
  pedirRios = 0,
  onRios = () => {},
  rioEnfocado = null,
}) {
  const caja = useRef(null)
  const ref = useRef({ mapa: null, listo: false, pendientes: [], reportes: new Map(), camaras: new Map(), radar: new Set() })
  const props = useRef({})
  props.current = { onSeleccionar, onCamara, onCalle, onRios, modoCalle }

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
    const mapa = new maplibregl.Map({
      container: caja.current,
      style: ESTILO,
      bounds: comuna?.bbox ? aBounds(comuna.bbox) : CHILE,
      fitBoundsOptions: { padding: 24 },
      maxZoom: 21,
      minZoom: 3,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar', 'NavigationControl.ResetBearing': 'Apuntar al norte' },
    })
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right')
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
        // En pantallas de alta densidad se piden imágenes un nivel más detalladas.
        tileSize: window.devicePixelRatio >= 1.5 ? 128 : 256,
        // Nivel 19: la foto más detallada disponible. Más cerca se amplía esa misma foto (algo borrosa, pero se acerca).
        maxzoom: 19,
        attribution: ATRIB_ESRI,
      })
      mapa.addLayer({ id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 150 } }, primeraLinea)

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
      ref.current.listo = true
      ref.current.pendientes.splice(0).forEach((fn) => fn(mapa))
    })

    mapa.on('click', (e) => {
      if (props.current.modoCalle) props.current.onCalle({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    return () => {
      mapa.remove()
      ref.current = { mapa: null, listo: false, pendientes: [], reportes: new Map(), camaras: new Map(), radar: new Set() }
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
      if (comuna.bbox) mapa.fitBounds(aBounds(comuna.bbox), { padding: 24, maxZoom: 13, duration: 0 })
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

  // ---- Cámaras ----
  useEffect(() => {
    const mapa = ref.current.mapa
    if (!mapa) return
    sincronizar(
      mapa,
      ref.current.camaras,
      camaras.map((c) => ({ ...c, clave: c.id, firma: `${c.lat},${c.lng}` })),
      (c) => {
        const el = elementoPin(
          '<div class="pin-camara"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h12v10H3z"/><path d="M15 10l6-3v10l-6-3z"/></svg></div>',
          `Cámara pública: ${c.titulo}`,
        )
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          props.current.onCamara(c)
        })
        return new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat])
      },
    )
  }, [camaras])

  // ---- Radar: una capa por cuadro, que quedan cargadas para animar sin volver a descargar ----
  useEffect(() => {
    const actual = cuadros[indice]?.url
    cuandoListo((mapa) => {
      const r = ref.current
      const vigentes = new Set(cuadros.map((c) => c.url))
      // Se mantienen pocas capas montadas (la caché del navegador evita volver a descargar).
      const montadas = [...r.radar]
      for (const url of montadas) {
        if (!vigentes.has(url) || (url !== actual && montadas.length > 4 && montadas.indexOf(url) < montadas.length - 4)) {
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

  // ---- Ríos y quebradas cercanos ----
  useEffect(() => {
    if (!pedirRios) return
    const punto = ubicacion ?? (comuna ? { lat: comuna.centro[0], lng: comuna.centro[1] } : null)
    if (!punto) return
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
  }, [pedirRios])

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

  return <div ref={caja} className={`h-full w-full ${modoCalle ? 'modo-calle' : ''}`} role="region" aria-label="Mapa" />
}
