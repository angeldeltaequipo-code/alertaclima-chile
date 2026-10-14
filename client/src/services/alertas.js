// Alertas oficiales (SENAPRED). Se conectan en la Fase 3.
//
// Regla del proyecto: nunca se inventa una alerta. Mientras no exista una fuente
// oficial integrada y aprobada, la app dice explícitamente que no tiene el dato
// y deriva a la fuente oficial.

export const NIVELES = {
  sin_fuente: { etiqueta: 'Alertas oficiales no conectadas', clave: 'sin' },
  sin_alerta: { etiqueta: 'Sin alerta vigente', clave: 'sin' },
  preventiva: { etiqueta: 'Alerta Temprana Preventiva', clave: 'preventiva' },
  amarilla: { etiqueta: 'Alerta Amarilla', clave: 'amarilla' },
  roja: { etiqueta: 'Alerta Roja', clave: 'roja' },
  evacuacion: { etiqueta: 'Evacuación', clave: 'evacuacion' },
}

export const FUENTE_OFICIAL = { nombre: 'SENAPRED', url: 'https://senapred.cl/' }

// eslint-disable-next-line no-unused-vars
export async function estadoComuna(cut) {
  return { nivel: 'sin_fuente', fuente: FUENTE_OFICIAL, actualizado: null }
}
