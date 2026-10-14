// Íconos de las categorías de reporte (grilla 24 px, trazo de 2 px).
// Se guardan como texto SVG para usarlos igual en React y en los pines de Leaflet.

const T = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

export const ICONOS_REPORTE = {
  // Agua acumulada sobre la calle
  anegamiento: `<g ${T}><path d="M3 8h18"/><path d="M3 14c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2"/><path d="M3 19c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2"/><path d="M6 8V4M18 8V4"/></g>`,
  // Río que sobrepasa su orilla
  desborde: `<g ${T}><path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M12 22v-4M9 20l3 2 3-2"/></g>`,
  // Barrera de camino cortado
  corte_ruta: `<g ${T}><rect x="3" y="7" width="18" height="6" rx="1"/><path d="M7 7l-3 6M12 7l-3 6M17 7l-3 6M21 9l-2 4"/><path d="M6 13v7M18 13v7"/></g>`,
  // Ampolleta tachada
  corte_luz: `<g ${T}><path d="M9 18h6M10 21h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.6.6-1 1.4-1 2.3V18H9.5v-1.2c0-.9-.4-1.7-1-2.3z"/><path d="M3 3l18 18"/></g>`,
  // Árbol caído sobre el suelo
  arbol_caido: `<g ${T}><path d="M3 20h18"/><path d="M5 17l11-6"/><circle cx="17.5" cy="9" r="3.5"/><path d="M8 15.5l-1-3M11 14l1-3"/></g>`,
  // Triángulo de advertencia
  otro: `<g ${T}><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></g>`,
}

export const svgReporte = (categoria, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS_REPORTE[categoria] ?? ICONOS_REPORTE.otro}</svg>`
