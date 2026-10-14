// Llamadas del panel de administración. La clave se guarda solo mientras la pestaña
// está abierta (sessionStorage), nunca en el almacenamiento permanente.
import { API_URL, ErrorApi } from './reportes'

const CLAVE = 'ac:admin'

export const claveGuardada = () => {
  try {
    return sessionStorage.getItem(CLAVE)
  } catch {
    return null
  }
}
export const guardarClave = (v) => {
  try {
    if (v) sessionStorage.setItem(CLAVE, v)
    else sessionStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento */
  }
}

async function pedir(ruta, clave, opciones = {}) {
  let r
  try {
    r = await fetch(`${API_URL}/api/admin${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Si estuvo inactivo, puede tardar un minuto en despertar.', 0)
  }
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorApi(cuerpo.error ?? `El servidor respondió ${r.status}`, r.status)
  return cuerpo
}

export const verificar = (clave) => pedir('/sesion', clave)
export const listar = (clave) => pedir('/alertas', clave)
export const crear = (clave, datos) => pedir('/alertas', clave, { method: 'POST', body: JSON.stringify(datos) })
export const actualizar = (clave, id, datos) =>
  pedir(`/alertas/${id}`, clave, { method: 'PATCH', body: JSON.stringify(datos) })
export const bitacora = (clave) => pedir('/bitacora', clave)
