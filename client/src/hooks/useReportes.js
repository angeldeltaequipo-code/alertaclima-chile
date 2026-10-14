import { useCallback, useEffect, useState } from 'react'
import {
  crearReporte,
  encolar,
  enviarPendientes,
  listarReportes,
  pendientes,
  reportesDisponibles,
  revivir,
  votarReporte,
} from '../services/reportes'
import { subirFoto } from '../services/fotos'
import { alCambiarConexion, escuchar, seguirComuna } from '../services/tiempoReal'

const POLLING = 60 * 1000

/**
 * Reportes de la comuna en tiempo real: Socket.io cuando se puede,
 * consulta cada 60 s como respaldo, y cola local si no hay señal.
 */
export function useReportes({ comuna, enLinea }) {
  const cut = comuna?.cut
  const [reportes, setReportes] = useState([])
  const [error, setError] = useState(null)
  const [enVivo, setEnVivo] = useState(false)
  const [nPendientes, setNPendientes] = useState(() => pendientes().length)

  const aplicar = useCallback(
    (r) => {
      if (r.comuna_cut !== cut) return
      setReportes((lista) => {
        const sin = lista.filter((x) => x.id !== r.id)
        return r.estado === 'activo' && r.vence > new Date() ? [r, ...sin].sort((a, b) => b.creado - a.creado) : sin
      })
    },
    [cut],
  )

  const cargar = useCallback(async () => {
    if (!reportesDisponibles || !cut) return
    try {
      setReportes(await listarReportes(cut))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [cut])

  // Lista inicial y consulta periódica de respaldo (más espaciada si el tiempo real está vivo).
  useEffect(() => {
    if (!enLinea) return
    setReportes([])
    cargar()
    const id = setInterval(cargar, enVivo ? POLLING * 5 : POLLING)
    return () => clearInterval(id)
  }, [cargar, enLinea, enVivo])

  useEffect(() => alCambiarConexion(setEnVivo), [])

  useEffect(() => {
    if (!reportesDisponibles || !cut || !enLinea) return
    seguirComuna(cut)
    const alLlegar = (r) => aplicar(revivir(r))
    const quitar = ['reporte:nuevo', 'reporte:actualizado', 'reporte:retirado'].map((ev) => escuchar(ev, alLlegar))
    return () => quitar.forEach((q) => q())
  }, [cut, enLinea, aplicar])

  // Al volver la señal, se envía lo que quedó en cola.
  useEffect(() => {
    if (!enLinea || !reportesDisponibles || !pendientes().length) return
    enviarPendientes().then(({ restantes }) => {
      setNPendientes(restantes)
      cargar()
    })
  }, [enLinea, cargar])

  // Los vencidos desaparecen solos aunque no llegue ningún evento.
  useEffect(() => {
    const id = setInterval(() => setReportes((l) => l.filter((r) => r.vence > new Date())), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  /** Crea el reporte y, si viene, le sube la foto. Sin señal, el reporte queda en cola (sin la foto). */
  const reportar = async (datos, foto = null) => {
    if (!enLinea) {
      encolar(datos)
      setNPendientes(pendientes().length)
      return { enCola: true, fotoDescartada: Boolean(foto) }
    }
    let creado
    try {
      creado = await crearReporte(datos)
    } catch (e) {
      if (e.estado === 0) {
        encolar(datos)
        setNPendientes(pendientes().length)
        return { enCola: true, fotoDescartada: Boolean(foto) }
      }
      throw e
    }
    aplicar(creado.reporte)
    if (!foto) return { reporte: creado.reporte }
    try {
      const conFoto = revivir(await subirFoto(creado.reporte.id, creado.clave, foto))
      aplicar(conFoto)
      return { reporte: conFoto }
    } catch (e) {
      // El reporte ya quedó publicado; solo falló la foto.
      return { reporte: creado.reporte, errorFoto: e.message }
    }
  }

  const votar = async (id, voto) => {
    const r = await votarReporte(id, voto)
    aplicar(r)
    return r
  }

  return { disponible: reportesDisponibles, reportes, error, enVivo, nPendientes, reportar, votar, recargar: cargar }
}
