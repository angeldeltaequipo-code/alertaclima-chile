// Acceso seguro a localStorage: en modo privado o con datos bloqueados puede fallar,
// y la app tiene que seguir funcionando igual.
const PREFIJO = 'ac:'

export function leer(clave, porDefecto = null) {
  try {
    const v = localStorage.getItem(PREFIJO + clave)
    return v === null ? porDefecto : JSON.parse(v)
  } catch {
    return porDefecto
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: se ignora */
  }
}

export function guardarTexto(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, valor)
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
