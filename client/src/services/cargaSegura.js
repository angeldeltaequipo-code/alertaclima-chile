// Después de publicar una versión nueva, un teléfono con la versión anterior en caché puede pedir un
// trozo de la app que ya no existe (y la pantalla queda en blanco). Aquí: si falla la carga de una
// parte, se recarga la app una vez para tomar la versión nueva.
import { lazy } from 'react'

export function lazySeguro(importar) {
  return lazy(() =>
    importar().catch((err) => {
      const clave = 'ac:recarga-version'
      let ya = null
      try {
        ya = sessionStorage.getItem(clave)
      } catch {
        /* sin almacenamiento */
      }
      if (!ya) {
        try {
          sessionStorage.setItem(clave, String(Date.now()))
        } catch {
          /* sin almacenamiento */
        }
        window.location.reload()
        return new Promise(() => {}) // espera la recarga
      }
      throw err
    }),
  )
}
