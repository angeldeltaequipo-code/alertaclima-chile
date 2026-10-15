import { useCallback, useEffect, useState } from 'react'
import * as C from '../services/chat'
import { escuchar, salirChat, unirseChat } from '../services/tiempoReal'

/** Mensajes del chat de una comuna, en tiempo real. Solo se activa con sesión y la pestaña visible. */
export function useChat({ cut, token, activo, enLinea }) {
  const [mensajes, setMensajes] = useState([])
  const [estado, setEstado] = useState('inactivo') // inactivo | cargando | listo | error
  const [error, setError] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [presentes, setPresentes] = useState(null)

  useEffect(() => {
    if (!activo || !token || !cut || !enLinea) return
    let vivo = true
    setEstado('cargando')
    setMensajes([])
    C.leerMensajes(cut)
      .then((m) => {
        if (!vivo) return
        setMensajes(m)
        setHayMas(m.length >= 50)
        setEstado('listo')
      })
      .catch((e) => {
        if (!vivo) return
        setError(e.message)
        setEstado('error')
      })
    unirseChat(cut, token).then((r) => vivo && r?.presentes && setPresentes(r.presentes))
    const quitar = [
      escuchar('chat:mensaje', (m) => {
        if (m.comuna !== cut) return
        setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, C.revivirMensaje(m)]))
      }),
      escuchar('chat:oculto', ({ id }) => setMensajes((prev) => prev.filter((x) => x.id !== id))),
      escuchar('chat:presentes', ({ n }) => setPresentes(n)),
    ]
    return () => {
      vivo = false
      quitar.forEach((f) => f())
      salirChat()
    }
  }, [cut, token, activo, enLinea])

  const cargarAnteriores = useCallback(async () => {
    if (!mensajes.length) return
    const viejos = await C.leerMensajes(cut, mensajes[0].id)
    setHayMas(viejos.length >= 50)
    setMensajes((prev) => [...viejos.filter((v) => !prev.some((p) => p.id === v.id)), ...prev])
  }, [cut, mensajes])

  const enviar = async (texto) => {
    const m = await C.enviarMensaje(cut, texto)
    setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    return m
  }

  const denunciar = async (id) => {
    const r = await C.denunciarMensaje(id)
    if (r.oculto) setMensajes((prev) => prev.filter((x) => x.id !== id))
    return r
  }

  const borrar = async (id) => {
    await C.borrarMensaje(id)
    setMensajes((prev) => prev.filter((x) => x.id !== id))
  }

  return { mensajes, estado, error, hayMas, presentes, cargarAnteriores, enviar, denunciar, borrar }
}
