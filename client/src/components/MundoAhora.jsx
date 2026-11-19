// «Tu mundo ahora»: lo que más importa, en tres señales tocables bajo ZUMI.
//  1. Alertas oficiales en tu comuna  2. Lluvia en los próximos minutos  3. Tu familia
import { useEffect, useState } from 'react'
import { NIVELES, alertaPrincipal } from '../services/alertas'
import { lluviaPronto } from '../services/inteligencia'
import { leerGrupo, ultimaFamilia } from '../services/familiaGPS'
import { lugarDe } from '../services/familiaVida'
import { abrirFuncion } from './Funciones'

function useFamilia() {
  const [l, setL] = useState(ultimaFamilia)
  useEffect(() => {
    const f = (e) => setL(e.detail ?? ultimaFamilia())
    window.addEventListener('ac:familia-ubicaciones', f)
    const t = setInterval(() => setL(ultimaFamilia()), 60e3)
    return () => {
      window.removeEventListener('ac:familia-ubicaciones', f)
      clearInterval(t)
    }
  }, [])
  return l
}

function Senal({ tono, rotulo, texto, sub, onClick, vivo = false }) {
  return (
    <button type="button" onClick={onClick} className="senal-ahora min-w-0 flex-1 rounded-[18px] border px-3 py-2.5 text-left" style={{ '--t': tono }}>
      <span className="rotulo flex items-center gap-1.5 !text-[9.5px]" style={{ color: tono }}>
        {vivo && <span className="punto-vivo" style={{ background: tono }} aria-hidden="true" />}
        {rotulo}
      </span>
      <span className="mt-1 block truncate text-[15px] leading-tight font-semibold">{texto}</span>
      {sub && <span className="block truncate text-[12px] text-texto-2">{sub}</span>}
    </button>
  )
}

export default function MundoAhora({ alertas, punto, onIr = () => {} }) {
  const [lluvia, setLluvia] = useState(null)
  const familia = useFamilia()
  const grupo = leerGrupo()

  useEffect(() => {
    if (!punto) return
    let vivo = true
    const leer = () =>
      lluviaPronto(punto)
        .then((r) => vivo && setLluvia(r))
        .catch(() => {})
    leer()
    const t = setInterval(leer, 5 * 60e3)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [punto?.lat, punto?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // 1. Alertas
  const a = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  const nivel = a ? NIVELES[a.nivel] : null
  const alerta = !alertas
    ? { tono: '#9b9ea6', texto: 'Consultando…', sub: 'SENAPRED' }
    : a
      ? { tono: nivel.gravedad >= 3 ? '#ff5a5f' : nivel.gravedad === 2 ? '#ffd23f' : '#3ddc84', texto: nivel.etiqueta.replace('Alerta ', ''), sub: a.amenaza }
      : { tono: '#3ddc84', texto: 'Sin alertas', sub: 'SENAPRED · en vivo' }

  // 2. Lluvia
  const ll =
    lluvia?.estado === 'empieza'
      ? { tono: '#7cc4ff', texto: `En ${lluvia.minutos} min`, sub: `lluvia ${lluvia.intensidad}` }
      : lluvia?.estado === 'lloviendo'
        ? { tono: '#7cc4ff', texto: 'Lloviendo', sub: lluvia.minutos ? `para en ~${lluvia.minutos} min` : lluvia.intensidad }
        : lluvia?.estado === 'seco'
          ? { tono: '#9b9ea6', texto: 'Sin lluvia', sub: 'próximas 3 horas' }
          : { tono: '#9b9ea6', texto: '…', sub: 'radar de lluvia' }

  // 3. Familia
  const otros = familia.filter((m) => !m.yo)
  const enVivo = otros.filter((m) => Date.now() - m.t < 5 * 60e3).length
  const sos = otros.find((m) => m.estado?.v === 'ayuda' && Date.now() - m.estado.t < 24 * 3600e3)
  const viajando = otros.find((m) => m.viaje?.d && !m.viaje.llego && Date.now() - m.viaje.t < 12 * 3600e3)
  const lugares = grupo?.lugares?.l ?? []
  const enLugar = otros.map((m) => ({ m, l: lugarDe(m, lugares) })).find((x) => x.l)
  const fam = !grupo
    ? { tono: '#ff6fb1', texto: 'Tu familia', sub: 'Créala gratis' }
    : sos
      ? { tono: '#ff5a5f', texto: `${sos.nombre} pidió ayuda`, sub: 'toca para ver dónde' }
      : viajando
        ? { tono: '#ff6fb1', texto: `${viajando.nombre} viajando`, sub: `a ${viajando.viaje.d}` }
        : enLugar
          ? { tono: '#ff6fb1', texto: `${enLugar.m.nombre}: ${enLugar.l.n}`, sub: `${enVivo} en vivo` }
          : { tono: '#ff6fb1', texto: otros.length ? `${enVivo} de ${otros.length} en vivo` : 'Invita a los tuyos', sub: otros.length ? 'toca para ver el mapa' : 'GPS familiar cifrado' }

  return (
    <section aria-label="Tu mundo ahora" className="flex gap-2">
      <Senal tono={alerta.tono} rotulo="Alertas" texto={alerta.texto} sub={alerta.sub} onClick={() => onIr('riesgos')} vivo={Boolean(alertas)} />
      <Senal tono={ll.tono} rotulo="Lluvia" texto={ll.texto} sub={ll.sub} onClick={() => onIr('radar')} vivo={lluvia?.estado === 'empieza' || lluvia?.estado === 'lloviendo'} />
      <Senal tono={fam.tono} rotulo="Familia" texto={fam.texto} sub={fam.sub} onClick={() => abrirFuncion('familia')} vivo={enVivo > 0 || Boolean(sos)} />
    </section>
  )
}
