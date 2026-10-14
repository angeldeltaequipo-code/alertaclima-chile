import { ICONOS_REPORTE } from './iconosReporte'

export default function IconoReporte({ categoria, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONOS_REPORTE[categoria] ?? ICONOS_REPORTE.otro }}
    />
  )
}
