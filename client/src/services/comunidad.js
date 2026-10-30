// «Lo que se comenta»: noticias y publicaciones públicas sobre emergencias en Chile (NO oficial).
// El servidor junta Google Noticias, GDELT, Reddit, Bluesky y Mastodon; aquí se ubican por región
// y se resumen para la persona y para ZUMI.
import { API_URL } from './reportes'
import { VOLCANES } from './riesgos'
import REGIONES from '../data/comunas.json'

export const TIPOS = {
  sismo: { etiqueta: 'Sismo', color: '#f97316' },
  tsunami: { etiqueta: 'Tsunami', color: '#0ea5e9' },
  volcan: { etiqueta: 'Volcán', color: '#b45309' },
  incendio: { etiqueta: 'Incendio', color: '#dc2626' },
  lluvia: { etiqueta: 'Lluvia y viento', color: '#2563eb' },
  inundacion: { etiqueta: 'Inundación', color: '#0891b2' },
  calor: { etiqueta: 'Calor', color: '#ea580c' },
  corte: { etiqueta: 'Cortes', color: '#64748b' },
}
export const FUENTES = { noticias: 'Prensa', reddit: 'Reddit', bluesky: 'Bluesky', mastodon: 'Mastodon', x: 'X' }

export async function obtenerComunidad({ signal } = {}) {
  const r = await fetch(`${API_URL}/api/comunidad`, { signal })
  if (!r.ok) throw new Error('No se pudo cargar lo que se comenta')
  return r.json()
}

const plano = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Nombres que buscar en el texto: comunas (de 5+ letras, para no confundir «Lota» o «Pica» con palabras
// comunes) y regiones. Cada nombre apunta a su región.
const NOMBRES = (() => {
  const l = []
  const ambiguos = new Set(['lota', 'pica', 'pucon', 'bulnes', 'colina', 'buin', 'alto', 'sierra gorda', 'la cruz', 'la ligua', 'el carmen', 'san pedro', 'hualpen', 'independencia', 'providencia', 'la reina', 'la granja', 'la florida', 'tortel', 'nogales', 'olivar', 'pirque', 'futrono', 'retiro', 'yungay', 'los angeles', 'victoria', 'porvenir', 'primavera', 'timaukel', 'navidad', 'libertad'])
  for (const r of REGIONES) {
    const nr = plano(r.nombre)
    l.push({ re: new RegExp(`\\b${esc(nr)}\\b`), region: r.cut, nombre: r.nombre })
    for (const c of r.comunas) {
      const n = plano(c.nombre)
      if (n.length < 5 || ambiguos.has(n)) continue
      l.push({ re: new RegExp(`\\b${esc(n)}\\b`), region: r.cut, nombre: c.nombre, comuna: c.cut })
    }
  }
  // Nombres largos primero: «Puerto Montt» antes que «Montt».
  return l.sort((a, b) => b.nombre.length - a.nombre.length)
})()

/** Regiones y comunas que nombra un texto. */
export function lugares(texto) {
  const t = plano(texto)
  const out = []
  for (const n of NOMBRES) if (n.re.test(t) && !out.some((o) => o.nombre === n.nombre)) out.push(n)
  return out.slice(0, 4)
}

/** Agrega lugares y si tocan la región/comuna de la persona. */
export function ubicar(items, comuna) {
  const region = comuna?.cut?.slice(0, 2)
  return (items ?? []).map((it) => {
    const ls = lugares(it.texto)
    return {
      ...it,
      lugares: ls.map((l) => l.nombre),
      enMiComuna: Boolean(comuna && ls.some((l) => l.comuna === comuna.cut)),
      enMiRegion: Boolean(region && ls.some((l) => l.region === region)),
    }
  })
}

/** Lista para mostrar: primero lo de mi comuna/región, después lo nacional. */
export function ordenarParaMi(items) {
  const peso = (it) => (it.enMiComuna ? 0 : it.enMiRegion ? 1 : 2)
  return [...items].sort((a, b) => peso(a) - peso(b) || (b.hora ?? 0) - (a.hora ?? 0))
}

/**
 * Picos de conversación: muchas personas hablando de lo mismo en la última hora.
 * Sirve como «alerta temprana» comunitaria (NO oficial): p. ej. un temblor sentido antes de que el CSN publique.
 */
export function picos(tendencias) {
  return Object.entries(tendencias ?? {})
    .filter(([, t]) => t.ultimaHora >= 6 || t.redes >= 4)
    .map(([tipo, t]) => ({ tipo, ...t, etiqueta: TIPOS[tipo]?.etiqueta ?? tipo }))
    .sort((a, b) => b.ultimaHora - a.ultimaHora)
}

const NIVEL = [
  ['roja', 'Roja'],
  ['naranja', 'Naranja'],
  ['amarilla', 'Amarilla'],
  ['verde', 'Verde'],
]
/**
 * Los 31 volcanes vigilados con su nivel: el reporte oficial (Smithsonian/SERNAGEOMIN) cuando existe y,
 * si no, lo que informa la prensa de las últimas horas («alerta técnica amarilla para el Villarrica»).
 */
export function volcanesConNivel(oficiales = [], items = []) {
  const noticiasVolcan = (items ?? []).filter((i) => i.tipo === 'volcan' && i.fuente === 'noticias')
  return VOLCANES.map((v) => {
    const clave = plano(v.nombre).split(/[-\s]/)[0]
    const of = (oficiales ?? []).find((a) => plano(a.nombre).includes(clave))
    if (of?.nivel) return { ...v, nivel: of.nivel, origen: 'oficial', estado: of.estado ?? null }
    const n = noticiasVolcan.find((i) => new RegExp(`\\b${esc(clave)}\\b`).test(plano(i.texto)))
    const nivel = n && NIVEL.find(([k]) => plano(n.texto).includes(`alerta ${k}`) || plano(n.texto).includes(`alerta tecnica ${k}`) || plano(n.texto).includes(`alerta tecnica volcanica ${k}`))
    if (nivel) return { ...v, nivel: nivel[1], origen: 'prensa', noticia: n }
    return { ...v, nivel: of ? 'Verde' : null, origen: of ? 'oficial' : null, estado: of?.estado ?? null, noticia: n ?? null }
  })
}

/** Resumen corto para ZUMI (va dentro de sus <datos>). */
export function resumenParaZumi(items, tendencias) {
  const lista = ordenarParaMi(items ?? []).slice(0, 8)
  return {
    advertencia: 'Información NO oficial de prensa y redes sociales. Puede ser falsa o imprecisa; confirmar con SENAPRED, SHOA o CSN.',
    picos: picos(tendencias).map((p) => `${p.etiqueta}: ${p.ultimaHora} menciones en la última hora`),
    titulares: lista.map((i) => `[${FUENTES[i.fuente] ?? i.fuente}${i.enMiRegion ? ', tu región' : ''}] ${i.texto.slice(0, 140)}`),
  }
}
