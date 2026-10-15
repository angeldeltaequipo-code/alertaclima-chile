/** Controles sobre el mapa: tipo de mapa (Mapa / Satélite) y «Ver la calle». */
export default function ControlesMapa({ base, onBase, modoCalle, onModoCalle, onRios, riosActivo, onSismos, sismosActivo }) {
  return (
    <>
      <div className="absolute top-3 left-3 z-[500] flex flex-col items-start gap-2">
        <div role="radiogroup" aria-label="Tipo de mapa" className="flex rounded-xl bg-superficie/95 p-1 shadow-lg ring-1 ring-linea backdrop-blur">
          {[
            ['mapa', 'Mapa'],
            ['satelite', 'Satélite'],
          ].map(([k, t]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={base === k}
              onClick={() => onBase(k)}
              className={`min-h-11 rounded-lg px-3.5 text-[15px] font-bold ${base === k ? 'bg-senal text-sobre-senal' : 'text-texto'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={modoCalle}
          onClick={() => onModoCalle(!modoCalle)}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-bold shadow-lg ring-1 ring-linea backdrop-blur ${
            modoCalle ? 'bg-senal text-sobre-senal' : 'bg-superficie/95 text-texto'
          }`}
        >
          {/* Monito de «ver la calle» */}
          <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
            <circle cx="10" cy="4" r="3.2" fill="#f5b400" stroke="#7a5600" strokeWidth="1" />
            <path d="M5.5 9.5Q10 7 14.5 9.5L14 15h-1.6l-.6 6H8.2l-.6-6H6z" fill="#f5b400" stroke="#7a5600" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          {modoCalle ? 'Cancelar' : 'Ver la calle'}
        </button>
        <button
          type="button"
          aria-pressed={riosActivo}
          onClick={onRios}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-bold shadow-lg ring-1 ring-linea backdrop-blur ${
            riosActivo ? 'bg-[#1a73e8] text-white' : 'bg-superficie/95 text-texto'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={riosActivo ? 'currentColor' : '#1a73e8'} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
          </svg>
          Ríos cercanos
        </button>
        <button
          type="button"
          aria-pressed={sismosActivo}
          onClick={onSismos}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-bold shadow-lg ring-1 ring-linea backdrop-blur ${
            sismosActivo ? 'bg-[#f97316] text-white' : 'bg-superficie/95 text-texto'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sismosActivo ? 'currentColor' : '#f97316'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12h4l2-6 3 12 3-9 2 3h6" />
          </svg>
          Sismos
        </button>
      </div>
      {modoCalle && (
        <p role="status" className="absolute top-[13.6rem] right-16 left-3 z-[500] max-w-sm rounded-xl bg-senal px-3 py-2 text-center text-[15px] font-bold text-sobre-senal shadow-lg">
          Toca un lugar del mapa para verlo como si estuvieras en la calle.
        </p>
      )}
    </>
  )
}
