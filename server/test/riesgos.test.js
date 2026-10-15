import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarSismo, interpretarTsunami, interpretarVolcanes, limpiarCacheRiesgos, lugarEnEspanol, sismos } from '../services/riesgos.js'

test('traduce la ubicación de un sismo', () => {
  assert.equal(lugarEnEspanol('34 km NNE of Ovalle, Chile'), 'a 34 km al norte de Ovalle')
  assert.equal(lugarEnEspanol('12 km SW of San Pedro de Atacama, Chile'), 'a 12 km al suroeste de San Pedro de Atacama')
  assert.equal(lugarEnEspanol('off the coast of Aisen, Chile'), 'frente a la costa de Aisen')
})

test('interpreta un sismo de USGS', () => {
  const s = interpretarSismo({ id: 'us7000x', properties: { mag: 5.43, place: '50 km W of Iquique, Chile', time: 1760000000000, tsunami: 0, url: 'https://earthquake.usgs.gov/x' }, geometry: { coordinates: [-70.6, -20.2, 35.2] } })
  assert.deepEqual([s.magnitud, s.lugar, s.profundidadKm, s.alertaTsunami], [5.4, 'a 50 km al oeste de Iquique', 35, false])
})

test('consulta USGS con los límites de Chile y guarda en caché', async () => {
  limpiarCacheRiesgos()
  let n = 0
  let url
  const fetchFn = async (u) => {
    n++
    url = String(u)
    return { ok: true, json: async () => ({ features: [{ id: 'a', properties: { mag: 3.1, place: '10 km S of Talca, Chile', time: 1 }, geometry: { coordinates: [-71.6, -35.5, 10] } }] }) }
  }
  const a = await sismos({ fetchFn })
  await sismos({ fetchFn })
  assert.equal(n, 1)
  assert.match(url, /minlatitude=-56\.5/)
  assert.equal(a[0].lugar, 'a 10 km al sur de Talca')
})

test('lee boletines de tsunami (PTWC) y volcanes chilenos (Smithsonian)', () => {
  const xml = `<feed><entry><title>NEAR COAST OF NORTHERN CHILE</title><updated>2026-10-13T12:34:39Z</updated><geo:lat>-20.1</geo:lat><geo:long>-70.9</geo:long><summary type="xhtml"><div>Category: Threat Magnitude: 7.8(Mwp)</div></summary><link rel="alternate" href="https://www.tsunami.gov/x.txt"/></entry></feed>`
  const [b] = interpretarTsunami(xml)
  assert.deepEqual([b.zona, b.nivel, b.magnitud, b.lat], ['NEAR COAST OF NORTHERN CHILE', 'amenaza', 7.8, -20.1])
  const rss = `<rss><item><title>Nevados de Chillan (Chile) - Report for 24 September-30 September 2026 - New Activity</title><description>The Alert Level remained at Yellow (the second lowest level on a four-color scale).</description><georss:point>-36.868 -71.378</georss:point><link>https://volcano.si.edu/x</link></item><item><title>Etna (Italy)</title><description>x</description></item></rss>`
  const v = interpretarVolcanes(rss)
  assert.equal(v.length, 1)
  assert.deepEqual([v[0].nombre, v[0].nivel, v[0].lat], ['Nevados de Chillan', 'Amarilla', -36.868])
})
