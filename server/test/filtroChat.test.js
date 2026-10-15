import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calmarTexto, filtrarMensaje, ocultarDatos, taparGroserias } from '../services/filtroChat.js'

test('tapa groserías chilenas, incluso con trucos', () => {
  for (const t of ['conchetumare', 'CONCHETUMAREEE', 'c0nch3tum4r3', 'ctm', 'c.t.m', 'c t m', 'culiao', 'weón', 'aweonao', 'hdp', 'Maricón'])
    assert.equal(taparGroserias(`oye ${t} ya`).censurado, true, t)
  assert.equal(taparGroserias('ctm se cayó el árbol').texto, 'c** se cayó el árbol')
})

test('no tapa palabras normales ni comunas', () => {
  for (const t of ['Putaendo', 'Pucón', 'culebra', 'cultura', 'la culpa', 'picante', 'computador', 'disputa', 'Mongolia', 'a la casa', 'huevos', 'picos nevados'])
    assert.equal(taparGroserias(t).censurado, false, t)
})

test('oculta teléfonos, RUT y correos pero deja los números de emergencia', () => {
  assert.equal(ocultarDatos('llámame al +56 9 8765 4321').texto, 'llámame al [dato oculto]')
  assert.equal(ocultarDatos('mi rut 12.345.678-K').texto, 'mi rut [dato oculto]')
  assert.equal(ocultarDatos('escribe a ana.perez@gmail.com').texto, 'escribe a [dato oculto]')
  assert.equal(ocultarDatos('llamen al 133 o al 132').oculto, false)
  assert.equal(ocultarDatos('el 15.10.2026 a las 14:30 cayeron 23.5 mm').oculto, false)
})

test('baja los gritos y acorta letras repetidas', () => {
  assert.equal(calmarTexto('AUXILIOOOOOOO SE INUNDA LA CALLE'), 'Auxiliooo se inunda la calle')
  assert.equal(calmarTexto('Corte de luz en la RUTA 5'), 'Corte de luz en la RUTA 5')
  assert.equal(filtrarMensaje('!!!!!!').texto, '!!!')
})
