// Hora en formato 24 h, como se usa en Chile en avisos y radio: "14:30".
export const hhmm = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
