// Música de fondo de ZUMI, compuesta en vivo por la app (Web Audio): sin archivos, sin derechos de autor
// y sin gastar datos. Cambia con el clima de tu comuna:
//   despejado → alegre y con ritmo: bajo, arpegios de marimba y percusión suave
//   nublado   → con ritmo pero más relajado, sin batería
//   lluvia    → acordes menores, lluvia suave y gotas
//   viento    → acordes abiertos y viento que sube y baja
//   noche     → acordes lentos, notas espaciadas y grillos
//   alerta    → silencio (nada debe distraer en una emergencia)
// Baja sola cuando ZUMI habla. Parte con el primer toque (los navegadores no dejan sonar antes) y
// se puede apagar con el botón de nota musical o en Ajustes.
import { alCambiarNarrador } from './narrador'

const CLAVE = 'ac:musica'
const VOLUMEN = 0.16
const leerActiva = () => {
  try {
    return localStorage.getItem(CLAVE) !== 'false'
  } catch {
    return true
  }
}

let ctx = null
let maestro = null // volumen general (encendido/apagado y fundidos)
let duck = null // baja cuando ZUMI habla
let eco = null
let activa = leerActiva()
let ambiente = 'despejado'
let reloj = null
let capas = [] // ruidos del ambiente (lluvia, viento, grillos)
const oyentes = new Set()
const avisar = () => oyentes.forEach((f) => f(activa))

export const musicaActiva = () => activa
export function alCambiarMusica(fn) {
  oyentes.add(fn)
  fn(activa)
  return () => oyentes.delete(fn)
}

// ---------- teoría musical mínima ----------
const nota = (midi) => 440 * 2 ** ((midi - 69) / 12)
// Progresiones (grados en semitonos desde la tónica) y escalas para la melodía, por ambiente
const ESTILOS = {
  // Con sol: alegre y con ritmo (I–V–vi–IV en Re mayor, 112 pulsos por minuto, bajo, arpegios y percusión suave)
  despejado: { tonica: 62, acordes: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], escala: [0, 2, 4, 7, 9, 12, 14, 16], paso: [1.4, 3.2], brillo: 2600, ritmo: { bpm: 112, bateria: true } },
  // Nublado: con ritmo, pero más tranquilo (sin batería)
  nublado: { tonica: 60, acordes: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], escala: [0, 2, 4, 7, 9, 12], paso: [2.2, 4.5], brillo: 1900, ritmo: { bpm: 96, bateria: false } },
  lluvia: { tonica: 57, acordes: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], escala: [0, 3, 5, 7, 10, 12, 15], paso: [2.4, 5], brillo: 1300 },
  viento: { tonica: 55, acordes: [[0, 7, 14, 19], [5, 12, 17, 24], [-2, 5, 12, 17], [3, 10, 15, 22]], escala: [0, 2, 7, 9, 12, 14], paso: [2.8, 5.5], brillo: 1200 },
  noche: { tonica: 53, acordes: [[0, 4, 7, 14], [-3, 4, 9, 12], [5, 9, 12, 16], [2, 5, 9, 14]], escala: [0, 4, 7, 11, 12, 16, 19], paso: [3, 6.5], brillo: 1000 },
}

function crear() {
  if (ctx) return true
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return false
  ctx = new AC({ latencyHint: 'playback' })
  maestro = ctx.createGain()
  maestro.gain.value = 0
  duck = ctx.createGain()
  duck.gain.value = 1
  // eco suave (da espacio, como una sala grande)
  eco = ctx.createDelay(1.5)
  eco.delayTime.value = 0.42
  const vuelta = ctx.createGain()
  vuelta.gain.value = 0.32
  const filtroEco = ctx.createBiquadFilter()
  filtroEco.type = 'lowpass'
  filtroEco.frequency.value = 1800
  eco.connect(filtroEco).connect(vuelta).connect(eco)
  filtroEco.connect(duck)
  duck.connect(maestro).connect(ctx.destination)

  // ZUMI habla → la música baja; termina → vuelve despacio
  alCambiarNarrador((e) => {
    if (!ctx) return
    const t = ctx.currentTime
    duck.gain.cancelScheduledValues(t)
    duck.gain.setTargetAtTime(e?.hablando ? 0.22 : 1, t, e?.hablando ? 0.15 : 1.2)
  })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend().catch(() => {})
    else if (activa) ctx.resume().catch(() => {})
  })
  return true
}

// ---------- instrumentos ----------
function acorde(semis, tonica, dur, brillo, t = ctx.currentTime) {
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(brillo * 0.5, t)
  f.frequency.linearRampToValueAtTime(brillo, t + dur * 0.5)
  f.frequency.linearRampToValueAtTime(brillo * 0.5, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35)
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5)
  f.connect(g)
  g.connect(duck)
  g.connect(eco)
  for (const s of semis) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = nota(tonica + s - 12)
      o.detune.value = det
      o.connect(f)
      o.start(t)
      o.stop(t + dur + 1.6)
    }
  }
}

function pluck(midi, fuerza = 1, t = ctx.currentTime) {
  const o = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  o.type = 'sine'
  o2.type = 'sine'
  o.frequency.value = nota(midi)
  o2.frequency.value = nota(midi) * 4.01 // brillo de marimba
  const g = ctx.createGain()
  const g2 = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.07 * fuerza, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
  g2.gain.setValueAtTime(0.012 * fuerza, t)
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
  o.connect(g)
  o2.connect(g2)
  for (const x of [g, g2]) {
    x.connect(duck)
    x.connect(eco)
  }
  o.start(t)
  o2.start(t)
  o.stop(t + 2)
  o2.stop(t + 0.3)
}

// ---------- percusión y bajo (días de sol) ----------
let bufRuido = null
function golpeRuido(t, { dur = 0.05, vol = 0.03, tipo = 'highpass', f = 7000 } = {}) {
  bufRuido ??= (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  })()
  const s = ctx.createBufferSource()
  s.buffer = bufRuido
  const fl = ctx.createBiquadFilter()
  fl.type = tipo
  fl.frequency.value = f
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fl).connect(g).connect(duck)
  s.start(t, Math.random() * 0.4)
  s.stop(t + dur + 0.02)
}
function bombo(t) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.14)
  g.gain.setValueAtTime(0.16, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
  o.connect(g).connect(duck)
  o.start(t)
  o.stop(t + 0.3)
}
function bajo(midi, t, dur) {
  const o = ctx.createOscillator()
  const f = ctx.createBiquadFilter()
  const g = ctx.createGain()
  o.type = 'triangle'
  o.frequency.value = nota(midi)
  f.type = 'lowpass'
  f.frequency.value = 700
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(f).connect(g).connect(duck)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function ruido(segundos = 2, marron = false) {
  const n = ctx.sampleRate * segundos
  const b = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = b.getChannelData(0)
  let ultimo = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    if (marron) {
      ultimo = (ultimo + 0.02 * w) / 1.02
      d[i] = ultimo * 3.5
    } else d[i] = w
  }
  const s = ctx.createBufferSource()
  s.buffer = b
  s.loop = true
  return s
}

function lluvia() {
  const s = ruido(3)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 6500
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setTargetAtTime(0.05, ctx.currentTime, 2)
  s.connect(hp).connect(lp).connect(g).connect(duck)
  s.start()
  // gotas sueltas
  const gotas = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const gg = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(1800 + Math.random() * 1600, t)
    o.frequency.exponentialRampToValueAtTime(500, t + 0.06)
    gg.gain.setValueAtTime(0.012, t)
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    o.connect(gg).connect(duck)
    o.start(t)
    o.stop(t + 0.1)
  }, 180 + Math.random() * 200)
  return { parar: (t) => (g.gain.setTargetAtTime(0, t, 0.8), setTimeout(() => (s.stop(), clearInterval(gotas)), 3500)) }
}

function viento() {
  const s = ruido(4, true)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 500
  bp.Q.value = 0.8
  const lfo = ctx.createOscillator()
  const prof = ctx.createGain()
  lfo.frequency.value = 0.07
  prof.gain.value = 300
  lfo.connect(prof).connect(bp.frequency)
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setTargetAtTime(0.06, ctx.currentTime, 2)
  s.connect(bp).connect(g).connect(duck)
  s.start()
  lfo.start()
  return { parar: (t) => (g.gain.setTargetAtTime(0, t, 0.8), setTimeout(() => (s.stop(), lfo.stop()), 3500)) }
}

function grillos() {
  const id = setInterval(() => {
    if (!ctx || ctx.state !== 'running' || Math.random() < 0.35) return
    const t = ctx.currentTime
    const f = 4200 + Math.random() * 600
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      const t0 = t + k * 0.07
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.006, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
      o.connect(g).connect(duck)
      o.start(t0)
      o.stop(t0 + 0.06)
    }
  }, 700)
  return { parar: () => clearInterval(id) }
}

// ---------- el director: compone mientras suena ----------
function componer() {
  clearTimeout(reloj)
  if (!ctx || !activa || ambiente === 'alerta') return
  const e = ESTILOS[ambiente] ?? ESTILOS.despejado
  if (e.ritmo) return componerConRitmo()
  let i = 0
  let siguienteAcorde = 0
  let siguienteNota = 0
  const tic = () => {
    if (!ctx || !activa || ambiente === 'alerta') return
    const t = ctx.currentTime
    if (ESTILOS[ambiente]?.ritmo) return componerConRitmo()
    if (ctx.state === 'running') {
      const est = ESTILOS[ambiente] ?? e
      if (t >= siguienteAcorde) {
        const dur = ambiente === 'noche' ? 10 : 8
        acorde(est.acordes[i % est.acordes.length], est.tonica, dur, est.brillo)
        i += 1
        siguienteAcorde = t + dur
      }
      if (t >= siguienteNota) {
        const base = est.acordes[(i - 1 + est.acordes.length) % est.acordes.length][0]
        const s = est.escala[Math.floor(Math.random() * est.escala.length)]
        pluck(est.tonica + 12 + ((s + (Math.random() < 0.5 ? base : 0)) % 24), 0.6 + Math.random() * 0.5)
        if (Math.random() < 0.25) setTimeout(() => ctx && pluck(est.tonica + 12 + est.escala[Math.floor(Math.random() * est.escala.length)], 0.5), 220)
        siguienteNota = t + est.paso[0] + Math.random() * (est.paso[1] - est.paso[0])
      }
    }
    reloj = setTimeout(tic, 250)
  }
  tic()
}

// Días de sol y nublados: compases de 4 tiempos, un acorde por compás, arpegio en corcheas.
function componerConRitmo() {
  let paso = 0 // corchea número
  let proximo = ctx.currentTime + 0.1
  const tic = () => {
    if (!ctx || !activa || ambiente === 'alerta') return
    const est = ESTILOS[ambiente]
    if (!est?.ritmo) return componer() // cambió a un ambiente tranquilo
    const corchea = 60 / est.ritmo.bpm / 2
    if (ctx.state === 'running') {
      while (proximo < ctx.currentTime + 0.35) {
        const compas = Math.floor(paso / 8)
        const enCompas = paso % 8
        const ac = est.acordes[compas % est.acordes.length]
        const raiz = est.tonica + ac[0]
        if (enCompas === 0) acorde(ac, est.tonica + 12, corchea * 8, est.brillo * 0.8, proximo)
        // bajo: tiempos 1 y 3, con una nota de paso
        if (enCompas === 0 || enCompas === 4) bajo(raiz - 24, proximo, corchea * 3.6)
        if (enCompas === 7 && Math.random() < 0.5) bajo(raiz - 24 + 7, proximo, corchea * 0.9)
        // arpegio: notas del acorde subiendo y bajando, a veces se salta una
        const patron = [0, 1, 2, 1, 0, 2, 1, 2]
        if (Math.random() < 0.85) pluck(raiz + 12 + ac[patron[enCompas]] - ac[0] + (enCompas >= 4 ? 12 : 0), 0.45 + Math.random() * 0.2, proximo)
        if (est.ritmo.bateria) {
          if (enCompas === 0 || enCompas === 4) bombo(proximo)
          if (enCompas === 2 || enCompas === 6) golpeRuido(proximo, { dur: 0.12, vol: 0.05, tipo: 'bandpass', f: 1800 })
          golpeRuido(proximo, { dur: enCompas % 2 ? 0.05 : 0.03, vol: enCompas % 2 ? 0.025 : 0.012 })
        }
        proximo += corchea
        paso += 1
      }
    } else proximo = ctx.currentTime + 0.1
    reloj = setTimeout(tic, 90)
  }
  tic()
}

function ponerCapas() {
  const t = ctx.currentTime
  capas.forEach((c) => c.parar(t))
  capas = []
  if (!activa) return
  if (ambiente === 'lluvia') capas.push(lluvia())
  if (ambiente === 'viento') capas.push(viento())
  if (ambiente === 'noche') capas.push(grillos())
}

function fundir(a, seg = 2.5) {
  if (!ctx) return
  const t = ctx.currentTime
  maestro.gain.cancelScheduledValues(t)
  maestro.gain.setValueAtTime(maestro.gain.value, t)
  maestro.gain.linearRampToValueAtTime(a, t + seg)
}

/** Llamar en un toque de la persona: crea el audio y empieza a sonar (si está activa). */
export function despertarMusica() {
  if (!activa || ambiente === 'alerta') return
  if (!crear()) return
  ctx.resume().catch(() => {})
  if (maestro.gain.value < 0.01) {
    ponerCapas()
    componer()
    fundir(VOLUMEN, 4)
  }
}

/** El ambiente sigue al clima: despejado, nublado, lluvia, viento, noche o alerta (silencio). */
export function fijarAmbiente(a) {
  if (!a || a === ambiente) return
  ambiente = a
  if (!ctx || !activa) return
  if (a === 'alerta') {
    fundir(0, 1)
    capas.forEach((c) => c.parar(ctx.currentTime))
    capas = []
    clearTimeout(reloj)
    return
  }
  ponerCapas()
  componer()
  fundir(VOLUMEN, 3)
}

export function activarMusica(v) {
  activa = Boolean(v)
  try {
    localStorage.setItem(CLAVE, String(activa))
  } catch {
    /* sin almacenamiento */
  }
  avisar()
  if (activa) despertarMusica()
  else if (ctx) {
    fundir(0, 0.8)
    clearTimeout(reloj)
    setTimeout(() => {
      if (activa) return
      capas.forEach((c) => c.parar(ctx.currentTime))
      capas = []
    }, 900)
  }
}

// El primer toque en cualquier parte de la app enciende la música (si la persona no la apagó).
if (typeof window !== 'undefined') {
  const primero = () => {
    despertarMusica()
    if (ctx) ['pointerdown', 'keydown'].forEach((ev) => window.removeEventListener(ev, primero, true))
  }
  ;['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, primero, true))
}
