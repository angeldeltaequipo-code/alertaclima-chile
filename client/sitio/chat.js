// Chat de soporte de zumichile.com: «Hola, soy Angel». La persona escribe aquí y Angel (fundador)
// responde en persona desde zumichile.com/soporte/. Respuestas rápidas al instante para lo más común.
;(function () {
  var API = window.ZUMI_API || 'https://alertaclima-api.onrender.com'
  var K = 'zumi:soporte'
  var leer = function () { try { return JSON.parse(localStorage.getItem(K)) || {} } catch (e) { return {} } }
  var guardar = function () { try { localStorage.setItem(K, JSON.stringify(est)) } catch (e) {} }
  var est = leer() // { id, ultimo, mensajes: [], vistos, contacto }
  est.mensajes = est.mensajes || []

  var RAPIDAS = [
    ['¿Es gratis?', 'Sí. Las alertas, el SOS, el GPS familiar y los viajes guiados son gratis siempre. Durante el lanzamiento todo lo demás también está abierto.'],
    ['¿Funciona en mi comuna?', 'Sí, en las 346 comunas de Chile, de Arica a la Antártica, incluyendo Rapa Nui y Juan Fernández. Elige la tuya al abrir la app.'],
    ['¿Cómo invito a mi familia?', 'En la app toca «Mi familia», escribe tu nombre y luego «Invitar por WhatsApp». Tu familiar abre el enlace, acepta y listo: aparecen en el mapa.'],
    ['¿Quién ve mi ubicación?', 'Solo tu familia. La ubicación se cifra en tu teléfono y la clave va en el enlace de invitación: ni yo puedo verla.'],
    ['¿Cómo la instalo?', 'En iPhone: abre zumichile.com/app en Safari, toca Compartir y «Agregar a pantalla de inicio». En Android: abre la app en Chrome y toca «Instalar».'],
    ['No me llegan los avisos', 'Revisa que aceptaste las notificaciones. En iPhone primero agrega ZUMI a la pantalla de inicio y ábrela desde el ícono. Si sigue sin llegar, escríbeme qué teléfono usas y lo vemos juntos.'],
  ]

  var raiz = document.createElement('div')
  raiz.className = 'soporte'
  raiz.innerHTML =
    '<button type="button" class="soporte-fab" aria-expanded="false" aria-controls="soporte-panel">' +
      '<span class="soporte-cara"><img src="img/angel.webp" alt="" width="44" height="44"><i class="punto" hidden></i></span>' +
      '<span class="soporte-fab-txt">¿Necesitas ayuda?</span><b class="soporte-sin-leer" hidden></b>' +
    '</button>' +
    '<section id="soporte-panel" class="soporte-panel" role="dialog" aria-modal="false" aria-labelledby="soporte-t" hidden>' +
      '<header class="soporte-cab">' +
        '<span class="soporte-cara grande"><img src="img/angel-320.webp" alt="Angel, fundador de ZUMI" width="52" height="52"><i class="punto" hidden></i></span>' +
        '<div><b id="soporte-t">Hola, soy Angel 👋</b><span>Fundador de ZUMI. Te respondo yo, en persona.</span><small class="soporte-estado">Te respondo en cuanto vea tu mensaje</small></div>' +
        '<button type="button" class="soporte-x" aria-label="Cerrar el chat">×</button>' +
      '</header>' +
      '<div class="soporte-hilo" aria-live="polite"></div>' +
      '<div class="soporte-rapidas"></div>' +
      '<form class="soporte-contacto" hidden><label for="soporte-correo">¿Dónde te aviso cuando responda?</label><div><input id="soporte-correo" type="email" placeholder="tu@correo.cl" maxlength="120" autocomplete="email"><button type="submit">Guardar</button></div></form>' +
      '<form class="soporte-escribir"><label class="solo-lector" for="soporte-texto">Tu mensaje para Angel</label>' +
        '<textarea id="soporte-texto" rows="1" maxlength="2000" placeholder="Escríbele a Angel…" required></textarea>' +
        '<button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2-7.5z" fill="currentColor"/></svg></button>' +
      '</form>' +
    '</section>'
  document.body.appendChild(raiz)

  var fab = raiz.querySelector('.soporte-fab'), panel = raiz.querySelector('.soporte-panel'), hilo = raiz.querySelector('.soporte-hilo')
  var rapidas = raiz.querySelector('.soporte-rapidas'), form = raiz.querySelector('.soporte-escribir'), area = raiz.querySelector('#soporte-texto')
  var contacto = raiz.querySelector('.soporte-contacto'), badge = raiz.querySelector('.soporte-sin-leer')
  var abierto = false, enLinea = false

  var hora = function (iso) { var d = iso ? new Date(iso) : new Date(); return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }
  function burbuja(m) {
    var d = document.createElement('div')
    d.className = 'msg msg-' + m.autor
    if (m.autor !== 'visita') d.innerHTML = '<img src="img/angel.webp" alt="" width="28" height="28">'
    var c = document.createElement('div'); c.className = 'msg-c'
    var p = document.createElement('p'); p.textContent = m.texto; c.appendChild(p)
    var s = document.createElement('small')
    s.textContent = m.autor === 'rapida' ? 'Respuesta rápida' : m.pendiente ? 'Enviando…' : m.error ? 'No se envió. Toca para reintentar.' : hora(m.creado_en)
    c.appendChild(s); d.appendChild(c)
    if (m.error) d.addEventListener('click', function () { reintentar(m) }, { once: true })
    return d
  }
  function pintar() {
    hilo.innerHTML = ''
    hilo.appendChild(burbuja({ autor: 'angel', texto: '¡Hola! Cuéntame qué necesitas: una duda de la app, una alerta, tu familia o una idea para ZUMI. Leo todos los mensajes yo mismo.', creado_en: est.creada }))
    est.mensajes.forEach(function (m) { hilo.appendChild(burbuja(m)) })
    var tiene = est.mensajes.some(function (m) { return m.autor === 'visita' && !m.error })
    contacto.hidden = !tiene || !!est.contacto || enLinea
    rapidas.hidden = est.mensajes.length > 6
    hilo.scrollTop = hilo.scrollHeight
  }
  RAPIDAS.forEach(function (r) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = r[0]
    b.addEventListener('click', function () {
      est.mensajes.push({ autor: 'visita', texto: r[0], local: true, creado_en: new Date().toISOString() })
      pintar()
      setTimeout(function () {
        est.mensajes.push({ autor: 'rapida', texto: r[1] + ' ¿Te sirvió? Si no, escríbeme y te respondo yo.', creado_en: new Date().toISOString() })
        guardar(); pintar()
      }, 450)
    })
    rapidas.appendChild(b)
  })

  function pedir(ruta, cuerpo) {
    return fetch(API + '/api/soporte' + ruta, cuerpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : undefined)
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Error'); return d }) })
  }
  function estadoLinea(v) {
    enLinea = !!v
    raiz.querySelectorAll('.punto').forEach(function (p) { p.hidden = !enLinea })
    raiz.querySelector('.soporte-estado').textContent = enLinea ? 'En línea ahora' : 'Te respondo en cuanto vea tu mensaje, normalmente el mismo día'
  }
  function enviar(m) {
    m.pendiente = true; m.error = false; pintar()
    var p = est.id
      ? pedir('/conversaciones/' + est.id + '/mensajes', { texto: m.texto })
      : pedir('/conversaciones', { texto: contexto() + m.texto, pagina: location.pathname + location.hash })
    p.then(function (d) {
      m.pendiente = false
      if (d.id) { est.id = d.id; var ult = d.mensajes[d.mensajes.length - 1]; m.id = ult.id; m.creado_en = ult.creado_en; est.ultimo = ult.id }
      else { m.id = d.mensaje.id; m.creado_en = d.mensaje.creado_en; est.ultimo = Math.max(est.ultimo || 0, d.mensaje.id) }
      estadoLinea(d.angelEnLinea); guardar(); pintar(); vigilar()
    }).catch(function (e) {
      if (/no encontrada/i.test(e.message)) { est.id = null; est.ultimo = 0 }
      m.pendiente = false; m.error = true; guardar(); pintar()
    })
  }
  function reintentar(m) { enviar(m) }
  // Las preguntas rápidas que la persona tocó antes van como contexto del primer mensaje.
  function contexto() {
    var prev = est.mensajes.filter(function (m) { return m.local }).map(function (m) { return m.texto })
    return prev.length ? '(Antes preguntó: ' + prev.join(' / ') + ')\n' : ''
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var t = area.value.trim(); if (!t) return
    area.value = ''; area.style.height = ''
    var m = { autor: 'visita', texto: t, creado_en: new Date().toISOString() }
    est.mensajes.push(m); enviar(m)
  })
  area.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')) } })
  area.addEventListener('input', function () { area.style.height = ''; area.style.height = Math.min(120, area.scrollHeight) + 'px' })
  contacto.addEventListener('submit', function (e) {
    e.preventDefault()
    var v = contacto.querySelector('input').value.trim(); if (!v || !est.id) return
    pedir('/conversaciones/' + est.id + '/contacto', { contacto: v }).then(function () {
      est.contacto = v; guardar()
      est.mensajes.push({ autor: 'rapida', texto: 'Listo, te aviso a ' + v + ' cuando responda.', creado_en: new Date().toISOString() })
      pintar()
    }).catch(function () {})
  })

  // Respuestas de Angel: cada 4 s con el chat abierto, cada 30 s cerrado.
  var reloj = null
  function revisar() {
    if (!est.id) return pedir('/estado').then(function (d) { estadoLinea(d.angelEnLinea) }).catch(function () {})
    return fetch(API + '/api/soporte/conversaciones/' + est.id + '?desde=' + (est.ultimo || 0))
      .then(function (r) { if (r.status === 404) { est.id = null; guardar(); throw 0 } return r.json() })
      .then(function (d) {
        estadoLinea(d.angelEnLinea)
        var nuevos = (d.mensajes || []).filter(function (m) { return m.autor === 'angel' })
        ;(d.mensajes || []).forEach(function (m) { est.ultimo = Math.max(est.ultimo || 0, m.id) })
        if (!nuevos.length) return
        nuevos.forEach(function (m) { est.mensajes.push(m) })
        if (!abierto) sinLeer(nuevos.length)
        guardar(); pintar()
        tin()
      }).catch(function () {})
  }
  // Un «tin» suave cuando llega la respuesta de Angel.
  function tin() {
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain()
      o.frequency.value = 880; o.type = 'sine'; g.gain.setValueAtTime(0.0001, a.currentTime)
      g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5)
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.55)
    } catch (e) {}
  }
  var pendientes = 0
  function sinLeer(n) { pendientes += n; badge.hidden = !pendientes; badge.textContent = pendientes; document.title = (pendientes ? '(' + pendientes + ') ' : '') + document.title.replace(/^\(\d+\) /, '') }
  function vigilar() { clearInterval(reloj); reloj = setInterval(function () { if (!document.hidden) revisar() }, abierto ? 4000 : 30000) }

  function abrir(v) {
    abierto = v
    panel.hidden = !v
    fab.setAttribute('aria-expanded', String(v))
    raiz.classList.toggle('abierto', v)
    if (v) {
      est.creada = est.creada || new Date().toISOString()
      pendientes = 0; sinLeer(0); pintar(); revisar()
      if (matchMedia('(min-width: 700px)').matches) area.focus()
    }
    vigilar()
  }
  fab.addEventListener('click', function () { abrir(!abierto) })
  raiz.querySelector('.soporte-x').addEventListener('click', function () { abrir(false); fab.focus() })
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && abierto) { abrir(false); fab.focus() } })
  document.querySelectorAll('[data-abrir-soporte]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); abrir(true) }) })
  if (location.hash === '#soporte') abrir(true)
  // Si ya había conversación, se revisa de vez en cuando por respuestas nuevas.
  if (est.id) { revisar(); vigilar() } else setTimeout(revisar, 2500)
})()
