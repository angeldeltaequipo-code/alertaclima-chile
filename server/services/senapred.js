// Alertas oficiales de SENAPRED, en tiempo real.
//
// SENAPRED no tiene una API documentada, pero su sitio (senapred.cl/alertas) se arma con una API pública
// de AWS AppSync a la que entra cualquier visitante con credenciales de invitado (Cognito). El servidor
// la consulta igual que lo hace el sitio, cada pocos minutos, y guarda lo último bueno: si SENAPRED
// cambia su sitio o no responde, se sigue mostrando lo último confirmado con su hora, nunca se inventa.
//
// Cada publicación de SENAPRED es una cadena (declara → monitorea → modifica → cancela). La vigente es
// la última de cada cadena, salvo que diga que se cancela. Las comunas se leen del título (SENAPRED deja
// vacío ese campo); si el título habla de una región o provincia completa, aplica a todas sus comunas.
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const REGION = 'us-east-1'
const POOL = 'us-east-1:17c696bc-53e1-49a2-991f-f1b65f752fda'
const ENDPOINT = new URL('https://rz2uv7ifxbgflh2bqmp6kmh4le.appsync-api.us-east-1.amazonaws.com/graphql')
const CADA_MS = 3 * 60e3
const NIVEL = { v: 'preventiva', a: 'amarilla', r: 'roja' }
// Días sin novedades tras los que una alerta deja de mostrarse aunque SENAPRED no la haya cancelado
const VENCE_DIAS = { preventiva: 30, amarilla: 12, roja: 10 }

const CAT = JSON.parse(readFileSync(new URL('../data/senapred-catalogo.json', import.meta.url), 'utf8'))
const norm = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
// índices del catálogo
const regionDeProvincia = Object.fromEntries(Object.entries(CAT.provincias).map(([id, [, reg]]) => [id, reg]))
const COMUNAS = CAT.comunas.map(([cut, nombre, prov]) => ({ cut, nombre, n: norm(nombre), prov, reg: regionDeProvincia[prov] }))
const PROVINCIAS = Object.entries(CAT.provincias).map(([id, [nombre, reg]]) => ({ id, n: norm(nombre), reg }))
const REGIONES = Object.entries(CAT.regiones).map(([id, nombre]) => ({ id, n: norm(nombre).replace(/^region (de |del )?/, ''), nombre }))

const contiene = (texto, frase) => new RegExp(`(^| )${frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(texto)

/** Comunas (CUT) que cubre una alerta, leídas de su título y de sus regiones. */
export function cobertura(titulo, regionesIds = []) {
  const t = norm(titulo)
  // lo que va entre «para …» y «por …» es la cobertura
  const tramo = (t.match(/ para (.+?)(?: por |$)/)?.[1] ?? t).trim()
  if (/\bnacional\b/.test(t)) return COMUNAS.map((c) => c.cut)
  const regs = new Set(regionesIds.filter((r) => CAT.regiones[r]))
  const cuts = new Set()
  // regiones completas nombradas en la cobertura («para la Región de Ñuble»)
  if (/\bregion(es)? (de |del )?/.test(tramo)) {
    const nombradas = REGIONES.filter((r) => tramo.includes(r.n))
    for (const r of nombradas.length ? nombradas : REGIONES.filter((x) => regs.has(x.id))) for (const c of COMUNAS) if (c.reg === r.id) cuts.add(c.cut)
  }
  // provincias completas («provincia de Huasco»)
  for (const m of tramo.matchAll(/provincias? (?:de |del )?([a-zñ ]+?)(?= y | e |,|$)/g)) {
    const p = PROVINCIAS.find((x) => (m[1].startsWith(x.n) || x.n.startsWith(m[1].trim())) && (!regs.size || regs.has(x.reg)))
    if (p) for (const c of COMUNAS) if (c.prov === p.id) cuts.add(c.cut)
  }
  // comunas nombradas (dentro de las regiones de la alerta, para no confundir nombres repetidos)
  const sinRegiones = tramo.replace(/\bregion(es)? (de |del )?[a-zñ ]+/g, ' ')
  for (const c of COMUNAS) if ((!regs.size || regs.has(c.reg)) && contiene(sinRegiones, c.n)) cuts.add(c.cut)
  // nada reconocible: toda la región de la alerta
  if (!cuts.size) for (const c of COMUNAS) if (regs.has(c.reg)) cuts.add(c.cut)
  return [...cuts]
}

const sinHtml = (h) =>
  String(h ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()

const CANCELADA = /^\s*(se\s+)?(cancela|finaliza|levanta|deja sin efecto|termina)/i

/** De la lista cruda de SENAPRED a las alertas vigentes, ya con sus comunas. */
export function vigentes(filas, ahora = Date.now()) {
  const cadenas = new Map()
  for (const f of filas ?? []) {
    if (!f || f.isDeleted) continue
    // urlAccess agrupa las publicaciones de un mismo aviso (declara, monitorea, modifica, cancela)
    const clave = f.urlAccess || (!f.parentId || f.parentId === 'parent' ? f.id : f.parentId)
    const previa = cadenas.get(clave)
    if (!previa || String(f.fechaHora) > String(previa.fechaHora)) cadenas.set(clave, f)
  }
  const out = []
  for (const f of cadenas.values()) {
    if (!f.isActive || CANCELADA.test(f.titulo ?? '')) continue
    let meta = {}
    try {
      meta = JSON.parse(f.metaData || '{}')
    } catch {
      /* sin metadatos */
    }
    const nivel = NIVEL[meta.codigoAlertaEvento] ?? (/roja/i.test(f.titulo) ? 'roja' : /amarilla/i.test(f.titulo) ? 'amarilla' : 'preventiva')
    const fecha = new Date(f.fechaHora ?? f.updatedAt)
    if (Number.isNaN(fecha.getTime()) || ahora - fecha.getTime() > VENCE_DIAS[nivel] * 86400e3) continue
    const amenaza = (f.titulo.match(/ por (.+)$/i)?.[1] ?? meta.nombreVariable ?? 'Evento').trim().replace(/\.$/, '')
    const texto = sinHtml(f.contenido)
    out.push({
      id: `senapred-${f.id}`,
      nivel,
      amenaza: amenaza.charAt(0).toUpperCase() + amenaza.slice(1),
      titulo: f.titulo.trim().slice(0, 300),
      descripcion: texto.slice(0, 1200) || null,
      instrucciones: null,
      fuente_nombre: 'SENAPRED',
      fuente_url: f.urlAccess ? `https://senapred.cl/alerta/${f.urlAccess}` : 'https://senapred.cl/alertas',
      origen: 'senapred',
      estado: 'vigente',
      vigente_desde: fecha.toISOString(),
      vigente_hasta: null,
      confirmada_en: new Date(f.updatedAt ?? f.fechaHora).toISOString(),
      actualizada_en: new Date(f.updatedAt ?? f.fechaHora).toISOString(),
      sin_confirmar: false,
      comunas: cobertura(f.titulo, f.regionesIds ?? []),
    })
  }
  return out
}

// ---------- conexión con la API del sitio de SENAPRED ----------
const sha = (d) => createHash('sha256').update(d).digest('hex')
const hm = (k, d) => createHmac('sha256', k).update(d).digest()
let credenciales = null // { AccessKeyId, SecretKey, SessionToken, Expiration }

async function cognito(objetivo, cuerpo, fetchFn) {
  const r = await fetchFn(`https://cognito-identity.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityService.${objetivo}` },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`Cognito ${objetivo}: ${r.status}`)
  return r.json()
}

async function credencialesInvitado(fetchFn) {
  const vence = credenciales?.Expiration ? credenciales.Expiration * 1000 : 0
  if (credenciales && vence - Date.now() > 5 * 60e3) return credenciales
  const { IdentityId } = await cognito('GetId', { IdentityPoolId: POOL }, fetchFn)
  credenciales = (await cognito('GetCredentialsForIdentity', { IdentityId }, fetchFn)).Credentials
  return credenciales
}

async function graphql(query, variables, fetchFn) {
  const c = await credencialesInvitado(fetchFn)
  const body = JSON.stringify({ query, variables })
  const amz = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const dia = amz.slice(0, 8)
  const alcance = `${dia}/${REGION}/appsync/aws4_request`
  const firmadas = 'host;x-amz-date;x-amz-security-token'
  const canonica = ['POST', ENDPOINT.pathname, '', `host:${ENDPOINT.host}\nx-amz-date:${amz}\nx-amz-security-token:${c.SessionToken}\n`, firmadas, sha(body)].join('\n')
  let k = hm(`AWS4${c.SecretKey}`, dia)
  for (const p of [REGION, 'appsync', 'aws4_request']) k = hm(k, p)
  const firma = createHmac('sha256', k).update(['AWS4-HMAC-SHA256', amz, alcance, sha(canonica)].join('\n')).digest('hex')
  const r = await fetchFn(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-amz-date': amz,
      'x-amz-security-token': c.SessionToken,
      authorization: `AWS4-HMAC-SHA256 Credential=${c.AccessKeyId}/${alcance}, SignedHeaders=${firmadas}, Signature=${firma}`,
    },
    body,
    signal: AbortSignal.timeout(15000),
  })
  const d = await r.json().catch(() => null)
  if (!r.ok || !d?.data || d.errors?.length) {
    if (r.status === 401 || r.status === 403) credenciales = null
    throw new Error(`SENAPRED ${r.status}`)
  }
  return d.data
}

const CAMPOS = 'id titulo fechaHora createdAt updatedAt urlAccess parentId isPrincipal isActive isDeleted regionesIds metaData contenido'
export async function descargarAlertas({ fetchFn = fetch } = {}) {
  const filas = []
  let nextToken = null
  for (let pagina = 0; pagina < 4; pagina++) {
    const d = await graphql(
      `query ($type: String!, $nextToken: String) { alertasByDate(type: $type, sortDirection: DESC, limit: 400, nextToken: $nextToken) { items { ${CAMPOS} } nextToken } }`,
      { type: 'Alerta', nextToken },
      fetchFn,
    )
    filas.push(...(d.alertasByDate?.items ?? []))
    nextToken = d.alertasByDate?.nextToken
    // basta con los últimos ~45 días
    const masVieja = filas.at(-1)?.fechaHora
    if (!nextToken || (masVieja && Date.now() - new Date(masVieja).getTime() > 45 * 86400e3)) break
  }
  return filas
}

// ---------- caché: lo último bueno ----------
const estado = { alertas: null, revisado: null, ok: null, error: null, cargando: null }

export async function actualizar({ fetchFn = fetch } = {}) {
  if (estado.cargando) return estado.cargando
  estado.cargando = (async () => {
    try {
      const filas = await descargarAlertas({ fetchFn })
      if (!filas.length) throw new Error('SENAPRED devolvió una lista vacía')
      estado.alertas = vigentes(filas)
      estado.ok = new Date()
      estado.error = null
    } catch (e) {
      estado.error = e.message
      console.error('SENAPRED:', e.message)
    } finally {
      estado.revisado = new Date()
      estado.cargando = null
    }
  })()
  return estado.cargando
}

export function iniciarSenapred() {
  actualizar()
  const t = setInterval(actualizar, CADA_MS)
  t.unref?.()
}

export const estadoSenapred = () => ({ ok: estado.ok, revisado: estado.revisado, error: estado.error, total: estado.alertas?.length ?? null })

/** Fuente de alertas para services/alertas.js */
export const fuenteSenapred = {
  nombre: 'senapred',
  async alertasDeComuna(_db, cut) {
    if (!estado.alertas) {
      if (!estado.cargando) actualizar()
      await Promise.race([estado.cargando, new Promise((r) => setTimeout(r, 12000))])
    }
    if (!estado.alertas) throw new Error(estado.error ?? 'SENAPRED aún no responde')
    if (Date.now() - estado.ok.getTime() > CADA_MS * 1.5 && !estado.cargando) actualizar() // por si el reloj se durmió
    return estado.alertas.filter((a) => a.comunas.includes(cut)).map(({ comunas, ...a }) => ({ ...a, revisada_en: estado.ok.toISOString() }))
  },
}
