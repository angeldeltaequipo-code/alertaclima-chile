// Filtros de seguridad del chat por comuna (se aplican en el servidor: el cliente no puede saltarlos).
//
// 1. Groserías e insultos: se tapan con asteriscos (como en Kick o YouTube), también escritos con
//    trucos tipo «c0nch3tum4re», «c.t.m» o letras repetidas.
// 2. Datos personales: teléfonos, RUT y correos se ocultan para evitar acoso y estafas.
//    Para avisar a la familia está el botón SOS, que envía la ubicación por SMS o WhatsApp.
// 3. Gritos y spam: MAYÚSCULAS sostenidas se pasan a minúsculas y las letras repetidas se acortan.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '¡': 'i', '!': 'i' }

/** Forma comparable de una palabra: sin tildes, sin trucos de números, sin letras repetidas. */
export function normalizarPalabra(p) {
  return p
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$¡!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-zñ]/g, '')
    .replace(/(.)\1+/g, '$1')
}

// Raíces ya normalizadas (sin letras dobles). Se tapan si la palabra EMPIEZA con ellas.
const RAICES = [
  'conchetumare', 'conchetumadre', 'conchesumare', 'conchesumadre', 'conchatumare', 'conchatumadre', 'conchadesumadre',
  'ctm', 'csm', 'ctmre', 'hdp', 'cul', 'culiao', 'culiado', 'culia', 'culo',
  'aweona', 'ahueona', 'aweonao', 'ahueonao', 'hueon', 'weon', 'gueon', 'huevon',
  'maraco', 'maricon', 'marica', 'fleto', 'tortillera',
  'puta', 'puto', 'putit', 'perra', 'zorra', 'pichula', 'pico', 'raja', 'chucha', 'mierda', 'cagao', 'cagon',
  'sacowea', 'wea', 'hueva', 'jil', 'gil', 'imbecil', 'idiota', 'estupid', 'tarad', 'mongol', 'subnormal', 'retrasad',
  'nazi', 'veneco',
]
// Palabras que comparten raíz con un insulto pero son normales (no se tapan).
const PERMITIDAS = new Set([
  'culebra', 'culebras', 'culpa', 'culpable', 'culpables', 'culto', 'cultura', 'cultivo', 'cultivos', 'culmina', 'culminar',
  'picota', 'picor', 'picos', 'picoton', 'picotear', 'pical', 'picante', 'picantes', 'picada', 'picadas',
  'rajadura', 'rajado', 'gilberto', 'gila', 'putaendo', 'chuchada', 'weber', 'jilguero', 'wear', 'mongolia',
])
// Solo se tapan si la palabra es EXACTAMENTE esta (raíces demasiado cortas o comunes).
const EXACTAS = new Set(['ctm', 'csm', 'ctmre', 'hdp', 'cul', 'culo', 'pico', 'raja', 'wea', 'gil', 'jil', 'perra', 'puta', 'puto', 'chucha', 'hueva', 'marica', 'nazi'])

function esGroseria(palabra) {
  const n = normalizarPalabra(palabra)
  if (n.length < 3) return false
  // «Putaendo» es una comuna; «Pucón» también; no se tapan nombres reales.
  if (PERMITIDAS.has(n)) return false
  for (const r of RAICES) {
    if (EXACTAS.has(r)) {
      if (n === r || n === `${r}s`) return true
    } else if (n.startsWith(r)) return true
  }
  return false
}

const tapar = (p) => p[0] + '*'.repeat(Math.max(2, [...p].length - 1))

/** Tapa groserías. Detecta también palabras separadas letra a letra («c.t.m», «c t m»). */
export function taparGroserias(texto) {
  let censurado = false
  // Siglas o palabras escritas con separadores entre letras sueltas.
  let t = texto.replace(/\b(?:[a-zA-Z0-9@$][.\-_*\s]){2,}[a-zA-Z0-9@$]\b/g, (m) => {
    const junta = m.replace(/[.\-_*\s]/g, '')
    if (esGroseria(junta)) {
      censurado = true
      return tapar(junta)
    }
    return m
  })
  t = t.replace(/[\p{L}\p{N}@$¡!]+/gu, (p) => {
    if (esGroseria(p)) {
      censurado = true
      return tapar(p)
    }
    return p
  })
  return { texto: t, censurado }
}

const OCULTO = '[dato oculto]'
const DATOS = [
  // Correos
  /[\w.+-]+\s*(@|\(at\)|\[at\])\s*[\w-]+(\.[\w-]+)+/gi,
  // RUT chileno: 12.345.678-9 o 12345678-K
  /\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b/g,
  // Teléfonos: +56 9 1234 5678, 912345678, 2 2345 6789, y cualquier serie de 8 o más dígitos
  /(\+\s*)?(\d[\s.-]?){8,}\d/g,
]

/** Oculta teléfonos, RUT y correos. Los números de emergencia (131, 132, 133…) quedan visibles. */
export function ocultarDatos(texto) {
  let oculto = false
  let t = texto
  for (const re of DATOS)
    t = t.replace(re, () => {
      oculto = true
      return OCULTO
    })
  return { texto: t, oculto }
}

/** Baja los GRITOS sostenidos y acorta letras repetidas («auxiliooooooo» → «auxiliooo»). */
export function calmarTexto(texto) {
  let t = texto.replace(/(\p{L})\1{3,}/gu, '$1$1$1').replace(/([!?¡¿.])\1{3,}/g, '$1$1$1')
  const letras = t.replace(/[^\p{L}]/gu, '')
  const mayus = letras.replace(/[^\p{Lu}]/gu, '').length
  if (letras.length >= 12 && mayus / letras.length > 0.7) t = t.toLowerCase().replace(/^(\s*\p{L})/u, (c) => c.toUpperCase())
  return t
}

/** Aplica todos los filtros. Devuelve el texto final y qué se cambió (para avisar a quien escribe). */
export function filtrarMensaje(texto) {
  const a = ocultarDatos(texto)
  const b = taparGroserias(a.texto)
  const c = calmarTexto(b.texto)
  return { texto: c, datosOcultos: a.oculto, censurado: b.censurado }
}
