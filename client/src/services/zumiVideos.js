// Videos reales de ZUMI (hechos con Google Flow a partir de su pose de descanso de cada escena; empiezan
// y terminan en ese mismo cuadro, así el bucle y los cambios entre videos no se notan). Cubren la escena
// completa (900×1613). «reposo» se repite mientras está quieto; «habla*» son tomas de él conversando;
// los demás son gestos que se reproducen una vez.
export const VIDEOS = {
  sala: ['reposo', 'saludo', 'saludo2', 'celebrar', 'senalar', 'pensar', 'curioso', 'verano', 'invierno', 'habla', 'habla2', 'habla3', 'habla4'],
  noche: ['reposo', 'saludo', 'habla', 'habla2'],
  lluvia: ['reposo', 'saludo'],
  alerta: ['reposo', 'calma'],
  estudio: ['reposo'],
}
export const ESCENA = { ancho: 900, alto: 1613 }
// Clips que no vuelven a la pose de reposo (se cambia de ropa): solo cuando el clima los pide, y con
// un fundido más largo al terminar.
export const ESPECIALES = ['verano', 'invierno']
export const ahorroDatos = () => typeof navigator !== 'undefined' && !!navigator.connection?.saveData
export const RUTA_VIDEOS = `${import.meta.env.BASE_URL}zumi/marioneta/`
export const POSTER = (escena) => `${import.meta.env.BASE_URL}zumi/referencias/${escena}.jpg`
