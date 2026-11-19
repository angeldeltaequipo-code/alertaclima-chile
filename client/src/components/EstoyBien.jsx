// «Estoy bien» / «Necesito ayuda»: un toque y toda la familia lo sabe, cifrado de punta a punta.
import { useState } from 'react'
import { haceCuanto, marcarEstado, miEstado } from '../services/familiaGPS'

export default /** «Estoy bien» / «Necesito ayuda»: un toque y toda la familia lo sabe (cifrado). */
function EstoyBien({ compacto = false }) {
  const [estado, setEstado] = useState(miEstado)
  const [enviando, setEnviando] = useState(null)
  const marcar = async (v) => {
    if (v === 'ayuda' && !window.confirm('¿Enviar a tu familia que necesitas ayuda, con tu ubicación?')) return
    setEnviando(v)
    navigator.vibrate?.(30)
    await marcarEstado(v)
    setEstado(miEstado())
    setEnviando(null)
  }
  return (
    <div className={`rounded-[22px] border border-linea ${compacto ? 'px-3.5 py-3' : 'px-4 py-3.5'}`}>
      <p className="rotulo">Avisa a tu familia · cifrado</p>
      {estado && (
        <p className="mt-1 text-[14px] text-texto-2">
          Último aviso: <strong className={estado.v === 'ayuda' ? 'text-peligro' : 'text-[#3ddc84]'}>{estado.v === 'ayuda' ? 'necesito ayuda' : 'estoy bien'}</strong> · {haceCuanto(estado.t)}
        </p>
      )}
      <div className="mt-2.5 grid grid-cols-[1.4fr_1fr] gap-2">
        <button type="button" disabled={Boolean(enviando)} onClick={() => marcar('bien')} className="boton-primario min-h-13 text-[16px] disabled:opacity-60">
          {enviando === 'bien' ? 'Avisando…' : '✓ Estoy bien'}
        </button>
        <button type="button" disabled={Boolean(enviando)} onClick={() => marcar('ayuda')} className="min-h-13 rounded-full border border-peligro text-[15px] font-semibold text-peligro disabled:opacity-60">
          {enviando === 'ayuda' ? 'Enviando…' : 'Necesito ayuda'}
        </button>
      </div>
    </div>
  )
}

