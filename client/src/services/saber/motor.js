// Motor de la memoria de ZUMI: encuentra la mejor respuesta guardada para una pregunta, aunque esté
// escrita distinto, con faltas de ortografía o con chilenismos.
//
// Cada entrada de la base es [frases, respuesta, opciones?]:
//   - frases: formas de preguntar lo mismo, separadas por «|»
//   - respuesta: texto, lista de textos (elige uno al azar) o función (ctx) => texto
//   - opciones.tema: para el respaldo («¿te refieres a…?») y para sugerir preguntas parecidas
//
// Puntaje: palabras en común ponderadas por lo raras que son (una palabra que aparece en pocas
// preguntas pesa más que «clima»), con tolerancia a una letra de diferencia en palabras largas.

const sinTildes = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Palabras que no ayudan a distinguir una pregunta de otra.
const VACIAS = new Set(
  `a al algo alguien algun alguna algunas alguno algunos ante asi aun bien cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ellos en entre era eres es esa ese eso esta estan estas este esto estos fue fui ha hace han has hay he la las le les lo los mas me mi mis mucho muy nada ni no nos o oye para pero poco por porque pue pues puedo puede que quien se sea ser si sin sobre son su sus tal tambien te ti tiene tienes todo tu tus un una uno unos unas usted ustedes y ya yo zumi hola dime cuentame hago hacer hacen haria hacemos hizo hice hecho debe deberia tener tiene tienen sabes saber quiero quisiera favor porfa porfavor hey ahora oiga oye igual entonces osea`.split(
    /\s+/,
  ),
)

// Sinónimos y chilenismos: se llevan a una palabra común.
const SINONIMOS = {
  temblor: 'sismo', temblores: 'sismo', terremoto: 'sismo', terremotos: 'sismo', tembla: 'sismo', tiembla: 'sismo', temblando: 'sismo', temblar: 'sismo', temblo: 'sismo', sismos: 'sismo', movimiento: 'sismo',
  maremoto: 'tsunami', ola: 'tsunami',
  llueve: 'lluvia', lloviendo: 'lluvia', llover: 'lluvia', llovera: 'lluvia', lluvias: 'lluvia', precipitacion: 'lluvia', precipitaciones: 'lluvia', aguacero: 'lluvia', chubasco: 'lluvia',
  calor: 'calor', caluroso: 'calor', calurosa: 'calor', bochorno: 'calor',
  frio: 'frio', helado: 'frio', helada: 'helada', heladas: 'helada',
  pasos: 'paso', guagua: 'bebe', guaguas: 'bebe', bebes: 'bebe', ninos: 'nino', ninas: 'nino', nina: 'nino', hijos: 'hijo', hija: 'hijo', hijas: 'hijo',
  perro: 'mascota', perros: 'mascota', gato: 'mascota', gatos: 'mascota', mascotas: 'mascota', perrito: 'mascota', gatito: 'mascota', lomito: 'mascota',
  celular: 'telefono', cel: 'telefono', movil: 'telefono', smartphone: 'telefono', iphone: 'telefono', android: 'telefono', telefonos: 'telefono',
  app: 'aplicacion', aplicacion: 'aplicacion', aplicaciones: 'aplicacion', alertaclima: 'aplicacion',
  cuesta: 'precio', vale: 'precio', cobran: 'precio', pagar: 'precio', pago: 'precio', costo: 'precio', gratis: 'gratis', gratuita: 'gratis', gratuito: 'gratis',
  incendios: 'incendio', fuego: 'incendio', quemando: 'incendio',
  volcanes: 'volcan', erupcion: 'volcan', erupciones: 'volcan', volcanica: 'volcan',
  inundacion: 'inundacion', inundaciones: 'inundacion', anegado: 'inundacion', desborde: 'inundacion', inundando: 'inundacion', inunda: 'inundacion', inundo: 'inundacion', inundada: 'inundacion', inundado: 'inundacion',
  aluviones: 'aluvion', huaico: 'aluvion',
  carabinero: 'carabineros', paco: 'carabineros', pacos: 'carabineros', policia: 'carabineros',
  ambulancia: 'samu', bombero: 'bomberos',
  luz: 'electricidad', corte: 'corte', apagon: 'electricidad',
  auto: 'auto', autos: 'auto', carro: 'auto', vehiculo: 'auto', manejar: 'conducir', manejo: 'conducir', conduzco: 'conducir',
  carretera: 'ruta', autopista: 'ruta', camino: 'ruta', rutas: 'ruta',
  mapa: 'mapa', mapas: 'mapa',
  familia: 'familia', familiares: 'familia', pariente: 'familia',
  mochila: 'kit', botiquin: 'kit',
  nieve: 'nieve', nevazon: 'nieve', nevar: 'nieve', nevando: 'nieve', nevara: 'nieve',
  viento: 'viento', ventolera: 'viento', rafagas: 'viento', vientos: 'viento',
  pandas: 'panda',
  lucecita: 'luces', lucecitas: 'luces', satelites: 'satelite',
  acabo: 'acaba', recien: 'acaba',
  internet: 'senal', conexion: 'senal', offline: 'senal',
  abrigar: 'abrigo', abrigo: 'abrigo', abrigarla: 'abrigo', abrigarlo: 'abrigo',
}

// Raíz simple: quita plurales y algunas terminaciones (para que «alertas» y «alerta» sean lo mismo).
function raiz(p) {
  if (SINONIMOS[p]) return SINONIMOS[p]
  let r = p
  if (r.length > 5 && r.endsWith('es')) r = r.slice(0, -2)
  else if (r.length > 4 && r.endsWith('s')) r = r.slice(0, -1)
  return SINONIMOS[r] ?? r
}

export function palabras(texto) {
  const todas = sinTildes(texto)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const utiles = todas.filter((w) => !VACIAS.has(w))
  // Frases hechas solo de palabras comunes («¿cómo estás?»): se comparan completas.
  return (utiles.length ? utiles : todas).map(raiz)
}

function distancia1(a, b) {
  // ¿a y b difieren en a lo más una letra (cambio, falta o sobra)?
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  let j = 0
  let dif = 0
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++dif > 1) return false
    if (la > lb) i++
    else if (lb > la) j++
    else {
      i++
      j++
    }
  }
  return dif + (la - i) + (lb - j) <= 1
}

/** Prepara una base: índice de palabras y su peso. */
export function indexar(entradas) {
  const frases = []
  const df = new Map()
  entradas.forEach(([texto, respuesta, op = {}], id) => {
    for (const f of String(texto).split('|')) {
      const w = [...new Set(palabras(f))]
      if (!w.length) continue
      frases.push({ id, w, texto: f.trim(), estricta: Boolean(op.estricta) })
      for (const x of w) df.set(x, (df.get(x) ?? 0) + 1)
    }
    void respuesta
    void op
  })
  const n = frases.length
  const peso = new Map([...df].map(([w, c]) => [w, Math.log(1 + n / c)]))
  const propios = new Set(frases.filter((f) => f.estricta).flatMap((f) => f.w))
  return { entradas, frases, peso, vocab: [...df.keys()], propios }
}

// Corrige faltas de una letra solo en palabras largas, y nunca hacia nombres propios (comunas).
function corregir(w, base) {
  if (base.peso.has(w) || w.length < 6) return w
  for (const v of base.vocab) if (Math.abs(v.length - w.length) <= 1 && v[0] === w[0] && v[1] === w[1] && !base.propios.has(v) && distancia1(v, w)) return v
  return w
}

/** Las mejores entradas para la pregunta: [{ id, puntaje, frase }]. */
export function buscar(base, pregunta, n = 3) {
  const q = [...new Set(palabras(pregunta).map((w) => corregir(w, base)))]
  if (!q.length) return []
  const pw = (w) => base.peso.get(w) ?? 1.2
  const pq = q.reduce((s, w) => s + pw(w), 0)
  const mejor = new Map()
  for (const f of base.frases) {
    let comun = 0
    let n = 0
    for (const w of f.w) if (q.includes(w)) (comun += pw(w), n++)
    if (!comun) continue
    // las frases «estrictas» (por ejemplo, las de cada comuna) exigen todas sus palabras
    if (f.estricta && n < f.w.length) continue
    const pf = f.w.reduce((s, w) => s + pw(w), 0)
    let puntaje = 0.55 * (comun / pf) + 0.45 * (comun / pq)
    // una sola palabra en común, de una pregunta más larga, no basta para estar seguro
    if (n === 1 && q.length >= 2) puntaje *= globalThis.__ZUMI_UNA ?? 0.85
    const previo = mejor.get(f.id)
    if (!previo || puntaje > previo.puntaje) mejor.set(f.id, { id: f.id, puntaje, frase: f.texto })
  }
  return [...mejor.values()].sort((a, b) => b.puntaje - a.puntaje).slice(0, n)
}

/** Texto final de una entrada (elige al azar si hay varias; las funciones reciben el contexto). */
export function respuestaDe(entrada, ctx) {
  const r = entrada[1]
  if (typeof r === 'function') return r(ctx)
  if (Array.isArray(r)) return r[Math.floor(Math.random() * r.length)]
  return r
}

export { sinTildes }
