// SpaceX y la nueva carrera espacial: el próximo lanzamiento con cuenta regresiva (Falcon 9, Falcon
// Heavy, Starship), las últimas noticias de SpaceX y Starship, cómo ver los trenes de Starlink desde
// Chile y accesos directos a lo que publican SpaceX y Elon Musk en X.
// Fuentes abiertas: The Space Devs (Launch Library 2) y Spaceflight News API. Se guardan 1 hora.
import { useEffect, useState } from 'react'

const LANZAMIENTOS = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?lsp__name=SpaceX&limit=6&mode=normal'
const NOTICIAS = 'https://api.spaceflightnewsapi.net/v4/articles/?search=SpaceX&limit=6&ordering=-published_at'
const HORA = 3600e3

async function conCache(clave, url) {
  try {
    const c = JSON.parse(localStorage.getItem(clave) ?? 'null')
    if (c && Date.now() - c.t < HORA) return c.d
  } catch {
    /* sin caché */
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json()
  try {
    localStorage.setItem(clave, JSON.stringify({ t: Date.now(), d }))
  } catch {
    /* lleno */
  }
  return d
}

function Cuenta({ fecha }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  let s = Math.max(0, Math.floor((new Date(fecha) - ahora) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const dos = (n) => String(n).padStart(2, '0')
  return (
    <p className="mt-2 font-mono text-[30px] leading-none font-black tabular-nums" aria-label={`Faltan ${d} días, ${h} horas y ${m} minutos`}>
      T−{d > 0 ? `${d}d ` : ''}
      {dos(h)}:{dos(m)}:{dos(s)}
    </p>
  )
}

const fechaChile = (iso) => new Date(iso).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const X = [
  ['SpaceX', 'https://x.com/SpaceX'],
  ['Elon Musk', 'https://x.com/elonmusk'],
  ['Starlink', 'https://x.com/Starlink'],
  ['Starship', 'https://x.com/search?q=Starship%20SpaceX&f=live'],
]

export default function EspacioSpaceX() {
  const [lanz, setLanz] = useState(null)
  const [noticias, setNoticias] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    conCache('ac:spacex:lanz', LANZAMIENTOS)
      .then((d) => setLanz(d.results ?? []))
      .catch((e) => setError(e.message))
    conCache('ac:spacex:noticias', NOTICIAS)
      .then((d) => setNoticias(d.results ?? []))
      .catch(() => setNoticias([]))
  }, [])
  const proximo = lanz?.find((l) => new Date(l.net) > Date.now() - 2 * 3600e3)
  const starship = lanz?.find((l) => /starship/i.test(l.rocket?.configuration?.name ?? l.name))

  return (
    <section aria-labelledby="t-spacex" className="space-y-3">
      <div className="spacex-hero overflow-hidden rounded-[26px] p-4 text-white">
        <p className="text-[12px] font-black tracking-[0.22em] text-sky-300 uppercase">SpaceX · próximo lanzamiento</p>
        {proximo ? (
          <>
            <h3 id="t-spacex" className="mt-1 text-[22px] leading-tight font-black">
              {proximo.rocket?.configuration?.name ?? 'Cohete'} · {proximo.mission?.name ?? proximo.name.split('|')[1]?.trim() ?? proximo.name}
            </h3>
            <p className="text-[14px] text-white/80">
              {fechaChile(proximo.net)} (hora de Chile) · {proximo.pad?.location?.name ?? proximo.pad?.name}
            </p>
            <Cuenta fecha={proximo.net} />
            <p className="mt-1 text-[13px] text-white/70">Estado: {proximo.status?.name ?? 'por confirmar'}</p>
            {proximo.mission?.description && <p className="mt-2 line-clamp-3 text-[14px] text-white/85">{proximo.mission.description}</p>}
          </>
        ) : (
          <h3 id="t-spacex" className="mt-1 text-[20px] font-black">{error ? 'No pudimos cargar los lanzamientos ahora.' : 'Buscando el próximo lanzamiento…'}</h3>
        )}
        {starship && starship !== proximo && (
          <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[14px]">
            🚀 <strong>Starship</strong>: próximo vuelo {fechaChile(starship.net)}
          </p>
        )}
      </div>

      {lanz?.length > 1 && (
        <ul className="space-y-1.5" aria-label="Próximos lanzamientos de SpaceX">
          {lanz
            .filter((l) => l !== proximo)
            .slice(0, 4)
            .map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-superficie-2 px-3 py-2">
                <span className="text-[22px]" aria-hidden="true">
                  {/starship/i.test(l.rocket?.configuration?.name ?? '') ? '🚀' : '🛰️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{l.name}</span>
                  <span className="block text-[13px] text-texto-2">{fechaChile(l.net)}</span>
                </span>
              </li>
            ))}
        </ul>
      )}

      <div>
        <p className="mb-1.5 text-[15px] font-bold">En vivo en X</p>
        <div className="grid grid-cols-2 gap-2">
          {X.map(([n, u]) => (
            <a key={n} href={u} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-black text-[15px] font-bold text-white">
              <span aria-hidden="true">𝕏</span> {n}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-superficie-2 px-4 py-3">
        <p className="text-[16px] font-bold">✨ ¿Viste un «tren» de luces en el cielo?</p>
        <p className="mt-1 text-[15px]">
          Son satélites Starlink recién lanzados, en fila. Se ven en Chile al anochecer o antes del amanecer, unos días después de cada lanzamiento. Mira hacia el oeste al atardecer y hacia el este al amanecer.
        </p>
      </div>

      {noticias?.length > 0 && (
        <div>
          <p className="mb-1.5 text-[15px] font-bold">Lo último de SpaceX y Starship</p>
          <ul className="space-y-2">
            {noticias.slice(0, 5).map((n) => (
              <li key={n.id}>
                <a href={n.url} target="_blank" rel="noopener" className="flex gap-3 rounded-2xl bg-superficie-2 p-2.5">
                  {n.image_url && <img src={n.image_url} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[15px] leading-snug font-bold">{n.title}</span>
                    <span className="block text-[12px] text-texto-2">
                      {n.news_site} · {new Date(n.published_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} (en inglés)
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[12px] text-texto-2">Datos: The Space Devs (Launch Library 2) y Spaceflight News API.</p>
    </section>
  )
}
