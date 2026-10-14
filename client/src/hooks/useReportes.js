import { useCallback, useEffect, useRef, useState } from 'react'
import {
  API_URL,
  crearReporte,
  encolar,
  enviarPendientes,
  listarReportes,
  pendientes,
  reportesDisponibles,
  revivir,
  votarReporte,
} from '../services/reportes'

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
  const socketRef = useRef(null)

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

  // Lista inicial y consulta periódica de respaldo (más espaciada si el socket está vivo).
  useEffect(() => {
    if (!enLinea) return
    setReportes([])
    cargar()
    const id = setInterval(cargar, enVivo ? POLLING * 5 : POLLING)
    return () => clearInterval(id)
  }, [cargar, enLinea, enVivo])

  // Tiempo real. Socket.io se carga aparte para no pesar en el arranque.
  useEffect(() => {
    if (!reportesDisponibles || !cut || !enLinea) return
    let cancelado = false
    let socket
    import('socket.io-client').then(({ io }) => {
      if (cancelado) return
      socket = io(API_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 30000 })
      socketRef.current = socket
      const unirse = () => {
        socket.emit('seguir-comuna', cut)
        setEnVivo(true)
      }
      socket.on('connect', unirse)
      socket.on('disconnect', () => setEnVivo(false))
      const alLlegar = (r) => aplicar(revivir(r))
      socket.on('reporte:nuevo', alLlegar)
      socket.on('reporte:actualizado', alLlegar)
      socket.on('reporte:retirado', alLlegar)
    })
    return () => {
      cancelado = true
      socket?.disconnect()
      socketRef.current = null
      setEnVivo(false)
    }
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

  const reportar = async (datos) => {
    if (!enLinea) {
      encolar(datos)
      setNPendientes(pendientes().length)
      return { enCola: true }
    }
    try {
      const r = await crearReporte(datos)
      aplicar(r)
      return { reporte: r }
    } catch (e) {
      if (e.estado === 0) {
        encolar(datos)
        setNPendientes(pendientes().length)
        return { enCola: true }
      }
      throw e
    }
  }

  const votar = async (id, voto) => {
    const r = await votarReporte(id, voto)
    aplicar(r)
    return r
  }

  return { disponible: reportesDisponibles, reportes, error, enVivo, nPendientes, reportar, votar, recargar: cargar }
}
