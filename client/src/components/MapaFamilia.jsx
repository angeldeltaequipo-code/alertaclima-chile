// El mapa vivo de la familia: cada integrante con su inicial y un anillo que dice si está en vivo,
// los lugares seguros como círculos, y el recorrido de hoy del que elijas.
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { rastroDe } from '../services/familiaVida'
import { colorDe } from './colorFamilia'

const ESTILO = 'https://tiles.openfreemap.org/styles/liberty'

function circulo(lat, lng, km, n = 48) {
  const c = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    c.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)])
  }
  return c
}

export default function MapaFamilia({ miembros = [], lugares = [], elegido = null, onElegir = () => {} }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const marcas = useRef(new Map())
  const listo = useRef(false)
  const encuadrado = useRef(false)
  const enfocado = useRef(null)

  useEffect(() => {
    const m = new maplibregl.Map({
      container: caja.current,
      style: ESTILO,
      center: [-70.65, -33.45],
      zoom: 10,
      attributionControl: { compact: true },
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      fadeDuration: 0,
    })
    m.dragRotate.disable()
    m.touchZoomRotate.disableRotation()
    m.on('load', () => {
      m.addSource('lugares', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'lugares-relleno', type: 'fill', source: 'lugares', paint: { 'fill-color': '#3ddc84', 'fill-opacity': 0.12 } })
      m.addLayer({ id: 'lugares-borde', type: 'line', source: 'lugares', paint: { 'line-color': '#3ddc84', 'line-width': 1.5, 'line-dasharray': [2, 2] } })
      m.addSource('rastro', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'rastro', type: 'line', source: 'rastro', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 } })
      listo.current = true
      m.fire('ac:datos')
    })
    mapa.current = m
    return () => {
      marcas.current.forEach((x) => x.remove())
      marcas.current.clear()
      m.remove()
      listo.current = false
    }
  }, [])

  // integrantes, lugares y recorrido
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const pintar = () => {
      const vivos = new Set()
      for (const x of miembros) {
        if (x.lat == null) continue
        vivos.add(x.id)
        let mk = marcas.current.get(x.id)
        const enVivo = Date.now() - x.t < 5 * 60e3
        if (!mk) {
          const el = document.createElement('button')
          el.type = 'button'
          el.className = 'pin-fam'
          el.addEventListener('click', () => onElegir(x.id))
          mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([x.lng, x.lat]).addTo(m)
          marcas.current.set(x.id, mk)
        }
        const el = mk.getElement()
        el.style.setProperty('--c', colorDe(x.id))
        el.classList.toggle('vivo', enVivo)
        el.classList.toggle('sos', x.estado?.v === 'ayuda' && Date.now() - x.estado.t < 24 * 3600e3)
        el.classList.toggle('elegido', elegido === x.id)
        el.setAttribute('aria-label', `${x.yo ? 'Tú' : x.nombre}${enVivo ? ', en vivo' : ''}`)
        el.innerHTML = `<b>${(x.yo ? 'Tú' : x.nombre).slice(0, x.yo ? 2 : 1).toUpperCase()}</b>${x.vel ? `<i>${x.vel}</i>` : ''}`
        mk.setLngLat([x.lng, x.lat])
      }
      for (const [id, mk] of marcas.current) if (!vivos.has(id)) (mk.remove(), marcas.current.delete(id))
      if (!listo.current) return
      m.getSource('lugares').setData({
        type: 'FeatureCollection',
        features: lugares.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circulo(l.lat, l.lng, l.r ?? 0.15)] } })),
      })
      const r = elegido ? rastroDe(elegido) : []
      m.getSource('rastro').setData({
        type: 'FeatureCollection',
        features: r.length > 1 ? [{ type: 'Feature', properties: { color: colorDe(elegido) }, geometry: { type: 'LineString', coordinates: r.map((p) => [p[2], p[1]]) } }] : [],
      })
      // encuadre: a todos al principio; al elegido cuando lo eligen
      const pts = miembros.filter((x) => x.lat != null)
      if (elegido) {
        const x = pts.find((p) => p.id === elegido)
        if (x && enfocado.current !== elegido) {
          enfocado.current = elegido
          const b = new maplibregl.LngLatBounds([x.lng, x.lat], [x.lng, x.lat])
          r.forEach((p) => b.extend([p[2], p[1]]))
          m.fitBounds(b, { padding: 60, maxZoom: 15.5, duration: 900 })
        }
      } else if (!elegido) enfocado.current = null
      if (!elegido && !encuadrado.current && pts.length) {
        const b = new maplibregl.LngLatBounds()
        pts.forEach((p) => b.extend([p.lng, p.lat]))
        lugares.forEach((l) => b.extend([l.lng, l.lat]))
        m.fitBounds(b, { padding: 60, maxZoom: 14.5, duration: 0 })
        encuadrado.current = true
      }
    }
    pintar()
    m.on('ac:datos', pintar)
    return () => m.off('ac:datos', pintar)
  }, [miembros, lugares, elegido]) // eslint-disable-line react-hooks/exhaustive-deps

  const recentrar = () => {
    encuadrado.current = false
    onElegir(null)
  }
  return (
    <div className="mapa-familia relative overflow-hidden rounded-[26px] border border-linea">
      <div ref={caja} className="mapa-familia-lienzo h-[19rem] w-full" />
      <button type="button" onClick={recentrar} className="vidrio absolute right-3 bottom-3 z-10 grid size-11 place-items-center rounded-full" aria-label="Ver a toda la familia">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </div>
  )
}
