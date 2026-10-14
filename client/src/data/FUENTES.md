# Origen de los datos territoriales

Generado el 14-10-2026.

## `comunas.json` — 16 regiones, 346 comunas

- **Nombres y Código Único Territorial (CUT):** paquete npm `chilean-territorial-divisions@1.0.1`,
  con los códigos vigentes desde la creación de la Región de Ñuble (Decreto Exento 204 de 2018, SUBDERE).
- **Verificación cruzada:** se compararon los códigos con el paquete `chilemapas` (cartografía del
  Censo 2017, recodificada a 16 regiones). Las 345 comunas con cartografía coinciden una a una.
- **Antártica (12202):** no tiene polígono en la cartografía; su recuadro es aproximado (`"aprox": true`).
- Tabla oficial de referencia: https://www.subdere.gov.cl/node/76974

Antes de producción, conviene validar contra la tabla CUT oficial de SUBDERE o INE.

## `public/limites/<región>.json` — límites comunales

- Fuente: paquete `chilemapas` (pachadotdev/chilemapas), cartografía del Censo 2017.
- Simplificados con tolerancia de 0,003° (~300 m) y coordenadas a 4 decimales, para que pesen poco.
- Uso: dibujar el contorno de la comuna y asignar la comuna de un punto. No sirven para cartografía precisa.
