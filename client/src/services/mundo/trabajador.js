// Hilo aparte: baja la tesela y genera el barrio (casas, calles, árboles) sin trabar la pantalla.
import { cargarTesela, proyector } from './teselas'
import { generarTesela } from './construir'

self.onmessage = async (e) => {
  const { id, tx, ty, lat0, lng0 } = e.data
  try {
    const t = await cargarTesela(tx, ty, proyector(lat0, lng0))
    const d = generarTesela(t)
    const trans = [d.cables.buffer]
    for (const l of Object.values(d.lotes)) trans.push(l.p.buffer, l.n.buffer, l.c.buffer, l.uv.buffer)
    self.postMessage({ id, d }, trans)
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) })
  }
}
