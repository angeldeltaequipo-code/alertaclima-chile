// Escala de colores del radar (esquema "Universal Blue" de RainViewer, por dBZ),
// agrupada en las intensidades que la gente entiende. Los mm/h son aproximados
// (relación de Marshall-Palmer) y sirven solo como orientación.
const TRAMOS = [
  { nombre: 'Débil', detalle: '< 2,5 mm/h', colores: ['#88ddee', '#00a3e0', '#0077aa', '#005588'] },
  { nombre: 'Moderada', detalle: '2,5–10 mm/h', colores: ['#ffee00', '#ffaa00'] },
  { nombre: 'Fuerte', detalle: '10–50 mm/h', colores: ['#ff4400', '#c10000'] },
  { nombre: 'Muy fuerte', detalle: '> 50 mm/h', colores: ['#ffaaff', '#ff77ff'] },
]

export default function LeyendaRadar() {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1" aria-label="Intensidad de la lluvia en el radar">
      {TRAMOS.map((t) => (
        <div key={t.nombre} className="min-w-0">
          <div className="flex h-2 overflow-hidden rounded-sm" aria-hidden="true">
            {t.colores.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <p className="mt-1 truncate text-[12px] leading-tight font-bold">{t.nombre}</p>
          <p className="truncate text-[11px] leading-tight text-texto-2">{t.detalle}</p>
        </div>
      ))}
    </div>
  )
}
