import { useCallback, useEffect, useRef, useState } from 'react'
import { obtenerCuadros } from '../services/radar'
import { guardar, leer } from '../services/almacen'

const CADA_NORMAL = 5 * 60 * 1000
const CADA_AHORRO = 20 * 60 * 1000
const PASO_ANIMACION = 700

/**
 * Cuadros de radar con actualización periódica y animación.
 * En modo ahorro: no anima y actualiza con menos frecuencia.
 */
// Los últimos cuadros se guardan para poder mostrarlos sin conexión
// (sus imágenes quedan en la caché del service worker).
function cuadrosGuardados() {
  const g = leer('radar:cuadros', [])
  return Array.isArray(g) ? g.map((c) => ({ hora: new Date(c.hora), url: c.url })) : []
}

export function useRadar({ ahorro, enLinea }) {
  const [cuadros, setCuadros] = useState(cuadrosGuardados)
  const [indice, setIndice] = useState(() => Math.max(0, cuadrosGuardados().length - 1))
  const [reproduciendo, setReproduciendo] = useState(!ahorro)
  const [error, setError] = useState(null)
  const [ultimaCarga, setUltimaCarga] = useState(() => {
    const t = leer('radar:ultimaCarga')
    return t ? new Date(t) : null
  })
  const cargando = useRef(false)

  const cargar = useCallback(async () => {
    if (cargando.current) return
    cargando.current = true
    try {
      const { cuadros: nuevos } = await obtenerCuadros()
      setCuadros(nuevos)
      setIndice(nuevos.length - 1)
      setError(null)
      const ahora = new Date()
      setUltimaCarga(ahora)
      guardar('radar:ultimaCarga', ahora.toISOString())
      guardar(
        'radar:cuadros',
        nuevos.map((c) => ({ hora: c.hora.toISOString(), url: c.url })),
      )
    } catch (e) {
      setError(e instanceof TypeError ? 'No hubo respuesta del servicio de radar. Revisa tu conexión' : e.message)
    } finally {
      cargando.current = false
    }
  }, [])

  useEffect(() => {
    if (!enLinea) return
    cargar()
    const id = setInterval(cargar, ahorro ? CADA_AHORRO : CADA_NORMAL)
    return () => clearInterval(id)
  }, [cargar, ahorro, enLinea])

  // Al entrar en modo ahorro se detiene la animación en el cuadro más reciente.
  useEffect(() => {
    if (ahorro) {
      setReproduciendo(false)
      setIndice((i) => (cuadros.length ? cuadros.length - 1 : i))
    }
  }, [ahorro, cuadros.length])

  useEffect(() => {
    if (!reproduciendo || cuadros.length < 2) return
    const id = setInterval(() => {
      setIndice((i) => (i + 1) % cuadros.length)
    }, PASO_ANIMACION)
    return () => clearInterval(id)
  }, [reproduciendo, cuadros.length])

  return {
    cuadros,
    indice,
    setIndice: (i) => {
      setReproduciendo(false)
      setIndice(i)
    },
    reproduciendo,
    setReproduciendo,
    error,
    ultimaCarga,
    recargar: cargar,
  }
}
