import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clasificar, combinar, interpretarRSS, interpretarReddit, interpretarGDELT, loQueSeComenta, tendencias, _reiniciar } from '../services/comunidad.js'

test('clasifica por tipo de amenaza y descarta ruido', () => {
  assert.equal(clasificar('Fuerte temblor se sintió en Santiago'), 'sismo')
  assert.equal(clasificar('SHOA descarta tsunami tras sismo'), 'tsunami')
  assert.equal(clasificar('Sernageomin declara alerta técnica volcánica amarilla para el Villarrica'), 'volcan')
  assert.equal(clasificar('Incendio forestal amenaza viviendas en Viña del Mar'), 'incendio')
  assert.equal(clasificar('Sistema frontal traerá lluvias al sur'), 'lluvia')
  assert.equal(clasificar('Aluvión en San José de Maipo'), 'inundacion')
  assert.equal(clasificar('Colo-Colo vivió un terremoto en el partido'), null)
  assert.equal(clasificar('Precio del cobre sube'), null)
})

test('lee RSS de Google Noticias y quita el medio del título', () => {
  const xml = `<rss><channel><item><title>Temblor de magnitud 5 sacude Coquimbo - BioBioChile</title><link>https://news.google.com/x</link><pubDate>Wed, 29 Oct 2026 22:00:00 GMT</pubDate><source url="https://biobiochile.cl">BioBioChile</source></item></channel></rss>`
  const [it] = interpretarRSS(xml)
  assert.equal(it.texto, 'Temblor de magnitud 5 sacude Coquimbo')
  assert.equal(it.medio, 'BioBioChile')
  assert.equal(it.hora, Date.UTC(2026, 9, 29, 22))
})

test('combina fuentes, exige Chile en redes mundiales y evita repetidos', () => {
  const ahora = Date.UTC(2026, 9, 29, 23)
  const items = combinar(
    [
      [{ fuente: 'noticias', medio: 'A', texto: 'Temblor de magnitud 5 sacude Coquimbo', url: 'https://a.cl', hora: ahora - 600e3 }],
      [{ fuente: 'noticias', medio: 'B', texto: 'Temblor de magnitud 5 sacude Coquimbo hoy', url: 'https://b.cl', hora: ahora - 500e3 }],
      [{ fuente: 'bluesky', medio: 'Bluesky', texto: 'Está temblando fuerte en Japón', url: 'https://bsky.app/x', hora: ahora - 60e3 }],
      [{ fuente: 'bluesky', medio: 'Bluesky', texto: 'Tembló harto en La Serena recién', url: 'https://bsky.app/y', hora: ahora - 60e3 }],
      [{ fuente: 'noticias', medio: 'C', texto: 'Incendio antiguo de hace días', url: 'https://c.cl', hora: ahora - 72 * 3600e3 }],
      [{ fuente: 'reddit', medio: 'r/chile', texto: 'Alguien sintió el temblor?', url: 'javascript:alert(1)', hora: ahora - 120e3 }],
    ],
    ahora,
  )
  assert.equal(items.length, 3)
  assert.equal(items[0].texto, 'Tembló harto en La Serena recién')
  assert.equal(items.find((i) => i.fuente === 'reddit').url, null)
  const t = tendencias(items, ahora)
  assert.equal(t.sismo.ultimaHora, 3)
  assert.equal(t.sismo.redes, 2)
})

test('lee Reddit y GDELT', () => {
  const r = interpretarReddit({ data: { children: [{ data: { subreddit: 'chile', title: 'Temblor', selftext: '', permalink: '/r/chile/1', created_utc: 1, score: 3, num_comments: 2 } }, { data: { over_18: true, title: 'x' } }] } })
  assert.equal(r.length, 1)
  assert.equal(r[0].url, 'https://www.reddit.com/r/chile/1')
  const g = interpretarGDELT({ articles: [{ title: 'Sismo', url: 'https://x.cl', domain: 'x.cl', seendate: '20261029T221500Z' }] })
  assert.equal(g[0].hora, Date.UTC(2026, 9, 29, 22, 15))
})

test('consulta todas las fuentes, tolera fallas y guarda en caché', async () => {
  _reiniciar()
  let n = 0
  const ahora = new Date().toUTCString()
  const f = async (url) => {
    n++
    if (url.includes('news.google')) return { ok: true, text: async () => `<item><title>Sismo se siente en Valparaíso - Medio</title><link>https://m.cl/1</link><pubDate>${ahora}</pubDate><source>Medio</source></item>` }
    if (url.includes('reddit')) return { ok: false, status: 403 }
    throw new Error('sin red')
  }
  const d = await loQueSeComenta({ fetchFn: f })
  assert.equal(d.items.length, 1)
  assert.equal(d.items[0].tipo, 'sismo')
  assert.equal(d.fuentes.google.ok, true)
  assert.equal(d.fuentes.reddit.motivo, 'HTTP 403')
  const antes = n
  await loQueSeComenta({ fetchFn: f })
  assert.equal(n, antes)
})
