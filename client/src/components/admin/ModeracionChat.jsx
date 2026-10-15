import { useCallback, useEffect, useState } from 'react'
import { bloquearUsuario, chatDenunciados, moderarMensaje } from '../../services/admin'
import { comunaPorCut } from '../../services/comunas'

/** Mensajes del chat denunciados en los últimos 7 días: ocultar, restaurar o bloquear al autor. */
export default function ModeracionChat({ clave }) {
  const [mensajes, setMensajes] = useState(null)
  const [error, setError] = useState(null)
  const cargar = useCallback(async () => {
    try {
      setMensajes((await chatDenunciados(clave)).mensajes)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [clave])
  useEffect(() => {
    cargar()
  }, [cargar])
  const hacer = async (fn) => {
    try {
      await fn()
      await cargar()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <section>
      <h2 className="mb-1 text-[20px] font-bold">Chat: mensajes denunciados</h2>
      <p className="mb-2 text-[15px] text-texto-2">Con 3 denuncias se ocultan solos. Aquí puedes ocultar, restaurar o bloquear a quien abusa.</p>
      {error && <p className="font-bold text-peligro">{error}</p>}
      {mensajes?.length === 0 && <p className="text-[16px]">No hay mensajes denunciados.</p>}
      <ul className="space-y-2">
        {mensajes?.map((m) => (
          <li key={m.id} className="rounded-2xl border-2 border-borde bg-superficie p-3">
            <p className="text-[14px] text-texto-2">
              {m.autor.nombre} · {comunaPorCut(m.comuna)?.nombre ?? m.comuna} · {new Date(m.hora).toLocaleString('es-CL')} · {m.oculto ? 'oculto' : 'visible'}
            </p>
            <p className="my-1 text-[16px] whitespace-pre-wrap">{m.texto}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => hacer(() => moderarMensaje(clave, m.id, !m.oculto))} className="min-h-11 rounded-lg bg-superficie-2 px-3 font-bold">
                {m.oculto ? 'Restaurar' : 'Ocultar'}
              </button>
              <button
                type="button"
                onClick={() => window.confirm(`¿Bloquear a ${m.autor.nombre}? No podrá volver a escribir.`) && hacer(() => bloquearUsuario(clave, m.autor.id, true, 'Moderación del chat'))}
                className="min-h-11 rounded-lg border-2 border-peligro px-3 font-bold text-peligro"
              >
                Bloquear autor
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
