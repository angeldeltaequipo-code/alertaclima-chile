// Un color fijo por integrante (el mismo en el mapa y en su tarjeta).
export const COLORES = ['#7cc4ff', '#ff6fb1', '#3ddc84', '#ffc53d', '#b9a4ff', '#ff8a5b', '#5ee7df', '#f5f5f5']
export const colorDe = (id) => COLORES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length]
