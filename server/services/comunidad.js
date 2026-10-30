// «Lo que se comenta»: señales de la comunidad y la prensa, además de los organismos oficiales.
//
// Fuentes abiertas, sin claves:
// - Google Noticias (RSS en español de Chile): titulares de medios chilenos e internacionales.
// - GDELT: monitor mundial de noticias (artículos de las últimas horas).
// - Reddit: publicaciones públicas recientes de r/chile y r/Santiago.
// - Bluesky y Mastodon: publicaciones públicas con palabras como «temblor» o «sismo».
// - X (Twitter): solo si se define X_BEARER_TOKEN (su API es de pago).
//
// Todo esto es NO OFICIAL: sirve para detectar rápido que «algo está pasando» (por ejemplo, mucha
// gente diciendo que tembló) y para dar contexto, pero nunca reemplaza a SENAPRED, SHOA o CSN.
// No se guardan nombres de usuario ni fotos de perfil: solo el texto, la fuente y el enlace.

const CABECERAS = { 'User-Agent': 'AlertaClima-Chile/1.0 (+https://angeldeltaequipo-code.github.io/alertaclima-chile/)', Accept: '*/*' }
const CACHE_MS = 5 * 60 * 1000
const MAX_EDAD_H = 36

// El orden importa: «SHOA descarta tsunami tras sismo» es una noticia de tsunami.
export const TIPOS = {
  tsunami: { etiqueta: 'Tsunami', palabras: ['tsunami', 'maremoto', 'marejada', 'shoa', 'evacuación costera', 'borde costero'] },
  volcan: { etiqueta: 'Volcán', palabras: ['volcán', 'volcan', 'erupción', 'erupcion', 'alerta técnica volcánica', 'sernageomin', 'fumarola', 'ceniza volcánica'] },
  inundacion: { etiqueta: 'Inundación o aluvión', palabras: ['inundación', 'inundacion', 'inundaciones', 'aluvión', 'aluvion', 'desborde', 'crecida', 'remoción en masa', 'deslizamiento', 'anegamiento'] },
  incendio: { etiqueta: 'Incendio', palabras: ['incendio', 'incendios', 'conaf', 'fuego', 'humo', 'quema'] },
  sismo: { etiqueta: 'Sismo', palabras: ['sismo', 'temblor', 'terremoto', 'tembló', 'temblo', 'esta temblando', 'está temblando', 'earthquake', 'csn'] },
  lluvia: { etiqueta: 'Lluvia y viento', palabras: ['sistema frontal', 'temporal', 'lluvia', 'lluvias', 'precipitaciones', 'viento fuerte', 'ráfagas', 'tornado', 'tromba', 'granizo', 'tormenta eléctrica', 'nevazón', 'nieve'] },
  calor: { etiqueta: 'Calor extremo', palabras: ['ola de calor', 'calor extremo', 'altas temperaturas'] },
  corte: { etiqueta: 'Cortes de servicios', palabras: ['corte de luz', 'sin luz', 'sin agua', 'corte de agua', 'apagón', 'apagon', 'sin señal'] },
}

const quitarTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const PALABRAS = Object.entries(TIPOS).map(([tipo, d]) => [tipo, d.palabras.map((p) => new RegExp(`(^|[^a-z])${quitarTildes(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`))])

/** Tipo de amenaza de un texto (o null si no habla de ninguna). */
export function clasificar(texto) {
  const t = quitarTildes(texto)
  // Ruido común: deportes («terremoto en el estadio»), política, farándula, tragos («terremoto» es un trago chileno).
  if (/(futbol|gol |golazo|partido|colo.colo|la roja|tragos?|pipeño|helado de pina|elecciones?|candidat|reality|farandula)/.test(t)) return null
  for (const [tipo, res] of PALABRAS) if (res.some((r) => r.test(t))) return tipo
  return null
}

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export const decodificar = (s) =>
  String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (entidades[e.toLowerCase()] ?? m)))
    .replace(/\s+/g, ' ')
    .trim()

const etiqueta = (xml, nombre) => {
  const m = new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`, 'i').exec(xml)
  return m ? decodificar(m[1]) : null
}

/** RSS de Google Noticias → elementos. El título trae « - Medio» al final. */
export function interpretarRSS(xml) {
  const items = []
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]
    const medio = etiqueta(b, 'source')
    let titulo = etiqueta(b, 'title') ?? ''
    if (medio && titulo.endsWith(` - ${medio}`)) titulo = titulo.slice(0, -(medio.length + 3))
    const fecha = Date.parse(etiqueta(b, 'pubDate') ?? '')
    items.push({ fuente: 'noticias', medio: medio ?? 'Google Noticias', texto: titulo, url: etiqueta(b, 'link'), hora: Number.isFinite(fecha) ? fecha : null })
  }
  return items
}

/** GDELT (formato JSON artlist). */
export function interpretarGDELT(d) {
  return (d?.articles ?? []).map((a) => {
    // seendate: 20261029T221500Z
    const s = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate ?? '')
    return { fuente: 'noticias', medio: a.domain ?? 'Prensa', texto: decodificar(a.title), url: a.url, hora: s ? Date.UTC(+s[1], s[2] - 1, +s[3], +s[4], +s[5], +s[6]) : null }
  })
}

export function interpretarReddit(d) {
  return (d?.data?.children ?? [])
    .map((c) => c.data)
    .filter((p) => p && !p.over_18 && !p.stickied)
    .map((p) => ({
      fuente: 'reddit',
      medio: `r/${p.subreddit}`,
      texto: decodificar([p.title, (p.selftext ?? '').slice(0, 240)].filter(Boolean).join(' — ')),
      url: `https://www.reddit.com${p.permalink}`,
      hora: p.created_utc * 1000,
      apoyo: (p.score ?? 0) + (p.num_comments ?? 0),
    }))
}

export function interpretarBluesky(d) {
  return (d?.posts ?? []).map((p) => {
    const rkey = String(p.uri ?? '').split('/').pop()
    return {
      fuente: 'bluesky',
      medio: 'Bluesky',
      texto: decodificar(p.record?.text).slice(0, 300),
      url: p.author?.handle && rkey ? `https://bsky.app/profile/${p.author.handle}/post/${rkey}` : null,
      hora: Date.parse(p.record?.createdAt ?? p.indexedAt ?? '') || null,
      apoyo: (p.likeCount ?? 0) + (p.repostCount ?? 0) + (p.replyCount ?? 0),
    }
  })
}

export function interpretarMastodon(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((p) => !p.sensitive && (!p.language || p.language === 'es'))
    .map((p) => ({ fuente: 'mastodon', medio: 'Mastodon', texto: decodificar(p.content).slice(0, 300), url: p.url, hora: Date.parse(p.created_at) || null, apoyo: (p.favourites_count ?? 0) + (p.reblogs_count ?? 0) }))
}

export function interpretarX(d) {
  return (d?.data ?? []).map((t) => ({
    fuente: 'x',
    medio: 'X',
    texto: decodificar(t.text).slice(0, 300),
    url: `https://x.com/i/web/status/${t.id}`,
    hora: Date.parse(t.created_at) || null,
    apoyo: (t.public_metrics?.like_count ?? 0) + (t.public_metrics?.retweet_count ?? 0),
  }))
}

const CONSULTA = '(sismo OR temblor OR terremoto OR tsunami OR incendio OR "sistema frontal" OR temporal OR aluvión OR inundación OR volcán OR erupción)'
const enc = encodeURIComponent

/** Cada fuente: URL y cómo leerla. Las redes se filtran después para quedarse con lo de Chile. */
export function fuentes() {
  const lista = [
    { id: 'google', nombre: 'Google Noticias', url: `https://news.google.com/rss/search?q=${enc(`${CONSULTA} Chile when:1d`)}&hl=es-419&gl=CL&ceid=CL:es-419`, tipo: 'xml', leer: interpretarRSS },
    { id: 'gdelt', nombre: 'GDELT', url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc(`${CONSULTA} sourcecountry:CI`)}&mode=artlist&format=json&maxrecords=60&timespan=24h&sort=datedesc`, tipo: 'json', leer: interpretarGDELT },
    { id: 'reddit', nombre: 'Reddit', url: `https://www.reddit.com/r/chile+Santiago+chilecomunidad/search.json?q=${enc('sismo OR temblor OR terremoto OR tsunami OR incendio OR lluvia OR temporal OR inundación OR volcán OR "sin luz"')}&restrict_sr=1&sort=new&t=day&limit=50&raw_json=1`, tipo: 'json', leer: interpretarReddit },
    { id: 'bluesky', nombre: 'Bluesky', url: `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${enc('temblor chile')}&lang=es&sort=latest&limit=50`, tipo: 'json', leer: interpretarBluesky },
    { id: 'mastodon', nombre: 'Mastodon', url: 'https://mastodon.social/api/v1/timelines/tag/temblor?limit=40', tipo: 'json', leer: interpretarMastodon },
  ]
  if (process.env.X_BEARER_TOKEN) {
    lista.push({
      id: 'x',
      nombre: 'X',
      url: `https://api.x.com/2/tweets/search/recent?query=${enc('(temblor OR sismo OR tsunami OR incendio OR temporal OR aluvión) chile lang:es -is:retweet')}&max_results=50&tweet.fields=created_at,public_metrics`,
      tipo: 'json',
      leer: interpretarX,
      cabeceras: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
    })
  }
  return lista
}

const huella = (t) => quitarTildes(t).replace(/[^a-z0-9 ]/g, '').split(' ').filter((p) => p.length > 3).slice(0, 8).join(' ')
const mencionaChile = (t) => /chile|santiago|valparaiso|concepcion|antofagasta|iquique|arica|la serena|coquimbo|temuco|valdivia|puerto montt|rancagua|talca|chillan|calama|copiapo|osorno|punta arenas|vina del mar|biobio|araucania|atacama|maule|nuble|aysen|magallanes|los lagos|los rios|tarapaca|ohiggins|metropolitana/.test(quitarTildes(t))

/** Une, clasifica, filtra y ordena (lo más reciente primero, sin repetidos). */
export function combinar(listas, ahora = Date.now()) {
  const vistos = new Set()
  const salida = []
  for (const it of listas.flat()) {
    if (!it?.texto || it.texto.length < 12) continue
    if (it.hora && (ahora - it.hora > MAX_EDAD_H * 3600e3 || it.hora - ahora > 3600e3)) continue
    const tipo = clasificar(it.texto)
    if (!tipo) continue
    // Las redes sociales son mundiales: se exige que nombre a Chile o una ciudad chilena.
    // (Los resultados de Google/GDELT/Reddit ya vienen acotados a Chile.)
    if ((it.fuente === 'bluesky' || it.fuente === 'mastodon' || it.fuente === 'x') && !mencionaChile(it.texto)) continue
    const h = huella(it.texto)
    if (vistos.has(h)) continue
    vistos.add(h)
    salida.push({ ...it, tipo, url: /^https:\/\//.test(it.url ?? '') ? it.url : null })
  }
  salida.sort((a, b) => (b.hora ?? 0) - (a.hora ?? 0))
  return salida.slice(0, 120)
}

/** Cuántas menciones de cada tipo en la última hora y en las últimas 6 horas: sirve para detectar «picos». */
export function tendencias(items, ahora = Date.now()) {
  const t = {}
  for (const it of items) {
    if (!it.hora) continue
    const edad = ahora - it.hora
    const r = (t[it.tipo] ??= { ultimaHora: 0, seisHoras: 0, redes: 0 })
    if (edad <= 3600e3) r.ultimaHora++
    if (edad <= 6 * 3600e3) r.seisHoras++
    if (edad <= 3600e3 && it.fuente !== 'noticias') r.redes++
  }
  return t
}

let cache = null // { hasta, datos }
let enCurso = null

export async function loQueSeComenta({ fetchFn = fetch, ahora = Date.now() } = {}) {
  if (cache && ahora < cache.hasta) return cache.datos
  if (enCurso) return enCurso
  enCurso = (async () => {
    const estado = {}
    const listas = await Promise.all(
      fuentes().map(async (f) => {
        try {
          const r = await fetchFn(f.url, { headers: { ...CABECERAS, ...(f.cabeceras ?? {}) }, signal: AbortSignal.timeout(12000) })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const datos = f.tipo === 'xml' ? await r.text() : await r.json()
          const items = f.leer(datos)
          estado[f.id] = { ok: true, n: items.length }
          return items
        } catch (e) {
          estado[f.id] = { ok: false, motivo: String(e.cause?.code ?? e.message).slice(0, 80) }
          return []
        }
      }),
    )
    const items = combinar(listas, Date.now())
    const datos = { hora: new Date().toISOString(), items, tendencias: tendencias(items), fuentes: estado, x: Boolean(process.env.X_BEARER_TOKEN) }
    // Si todo falló, se conserva lo anterior unos minutos más.
    if (!items.length && cache?.datos.items.length) {
      cache.hasta = Date.now() + 60e3
      return { ...cache.datos, fuentes: estado }
    }
    cache = { hasta: Date.now() + CACHE_MS, datos }
    return datos
  })().finally(() => (enCurso = null))
  return enCurso
}

export const _reiniciar = () => ((cache = null), (enCurso = null))
