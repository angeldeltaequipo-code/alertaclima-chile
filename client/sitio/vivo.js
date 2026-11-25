// Lo vivo de zumichile.com: ZUMI que cambia de escena en la portada y el mapa de Chile con
// el clima real de cada comuna (Open-Meteo) y las alertas activas de SENAPRED (servidor de ZUMI).
;(function () {
  var API = (function () { try { return localStorage.getItem('zumi:api') } catch (e) { return null } })() || 'https://alertaclima-api.onrender.com'
  window.ZUMI_API = API
  var calma = matchMedia('(prefers-reduced-motion: reduce)').matches
  var $ = function (s) { return document.querySelector(s) }

  // ---------- Escenas de ZUMI en la portada ----------
  var ESCENAS = {
    hola: { texto: '¡Hola! Soy ZUMI. Te cuento el clima de tu comuna y te aviso si pasa algo.', tel: 'img/ahora.webp' },
    lluvia: { texto: 'Viene lluvia a las 15:00. Lleva paraguas y chaqueta.', tel: 'img/ahora.webp' },
    sismo: { texto: 'Si tiembla: agáchate, cúbrete y afírmate. Cuando pase, avisa a tu familia que estás bien.', tel: 'img/estoybien.webp' },
    calor: { texto: 'Mañana pasa los 30°. Toma agua, usa bloqueador y evita el sol de 12 a 16.', tel: 'img/riesgos.webp' },
    mochila: { texto: 'Tu mochila de emergencia: agua, linterna, radio, botiquín y copia de tus documentos.', tel: 'img/alerta.webp' },
  }
  var orden = Object.keys(ESCENAS)
  var video = $('#esc-video'), texto = $('#esc-texto'), tel = $('#esc-tel'), sonido = $('#esc-sonido')
  var actual = 'hola', tocado = false, reloj = null
  function escribir(t) {
    if (calma) { texto.textContent = t; return }
    texto.textContent = ''
    var i = 0
    clearInterval(escribir.r)
    escribir.r = setInterval(function () { texto.textContent = t.slice(0, ++i); if (i >= t.length) clearInterval(escribir.r) }, 18)
  }
  function mostrar(n) {
    if (!ESCENAS[n] || !video) return
    actual = n
    var e = ESCENAS[n]
    document.querySelectorAll('.escenas button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.escena === n ? 'true' : 'false') })
    video.poster = '/app/zumi/cine/' + n + '.webp'
    video.src = '/app/zumi/cine/' + n + '.mp4'
    if (!calma || !video.muted) video.play().catch(function () {})
    tel.src = e.tel
    escribir(e.texto)
  }
  if (video) {
    document.querySelectorAll('.escenas button').forEach(function (b) {
      b.addEventListener('click', function () { tocado = true; clearInterval(reloj); mostrar(b.dataset.escena) })
    })
    sonido.addEventListener('click', function () {
      tocado = true; clearInterval(reloj)
      video.muted = !video.muted
      sonido.setAttribute('aria-pressed', String(!video.muted))
      sonido.querySelector('span').textContent = video.muted ? 'Escuchar a ZUMI' : 'Silenciar'
      if (!video.muted) { video.currentTime = 0; video.play().catch(function () {}) }
    })
    if (calma) video.removeAttribute('autoplay')
    else reloj = setInterval(function () { if (!tocado && !document.hidden) mostrar(orden[(orden.indexOf(actual) + 1) % orden.length]) }, 9000)
  }

  // ---------- Mapa de Chile en vivo ----------
  var C = window.COMUNAS || []
  var svg = $('#mapa-svg'), g = $('#puntos'), ficha = $('#ficha'), tip = $('#mapa-tip'), buscar = $('#buscar-comuna')
  if (!svg || !C.length) return
  var NS = 'http://www.w3.org/2000/svg', porCut = {}, nodos = {}
  C.forEach(function (c) {
    porCut[c[0]] = c
    if (c[5] == null) return
    var p = document.createElementNS(NS, 'circle')
    p.setAttribute('cx', c[5]); p.setAttribute('cy', c[6]); p.setAttribute('r', 3.2)
    p.setAttribute('class', 'p'); p.dataset.cut = c[0]
    p.style.setProperty('--d', (c[5] / 992 * 1.6).toFixed(2) + 's')
    g.appendChild(p); nodos[c[0]] = p
  })
  var opciones = $('#lista-comunas')
  C.slice().sort(function (a, b) { return a[1].localeCompare(b[1], 'es') }).forEach(function (c) {
    var o = document.createElement('option'); o.value = c[1] + ', ' + c[2]; opciones.appendChild(o)
  })

  // Puntos: pasar el dedo o el mouse muestra el nombre; tocar abre el clima en vivo.
  function cercano(ev) {
    var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY
    var q = pt.matrixTransform(svg.getScreenCTM().inverse()), mejor = null, dm = 14 * 14
    C.forEach(function (c) { if (c[5] == null) return; var d = (c[5] - q.x) * (c[5] - q.x) + (c[6] - q.y) * (c[6] - q.y); if (d < dm) { dm = d; mejor = c } })
    return mejor
  }
  var marcado = null
  function resaltar(c) {
    if (marcado) marcado.classList.remove('sobre')
    marcado = c && nodos[c[0]]
    if (marcado) marcado.classList.add('sobre')
  }
  svg.addEventListener('pointermove', function (ev) {
    var c = cercano(ev); resaltar(c)
    if (!c) { tip.hidden = true; return }
    var r = svg.getBoundingClientRect(), caja = svg.parentNode.getBoundingClientRect()
    tip.hidden = false; tip.textContent = c[1]
    tip.style.left = (r.left - caja.left + svg.parentNode.scrollLeft + (c[5] / 992) * r.width) + 'px'
    tip.style.top = (r.top - caja.top + (c[6] / 199) * r.height) + 'px'
  })
  svg.addEventListener('pointerleave', function () { tip.hidden = true; resaltar(null) })
  svg.addEventListener('click', function (ev) { var c = cercano(ev); if (c) elegir(c[0], true) })
  buscar.addEventListener('change', function () {
    var v = buscar.value.split(',')[0].trim().toLowerCase()
    var c = C.find(function (x) { return x[1].toLowerCase() === v }) || C.find(function (x) { return x[1].toLowerCase().indexOf(v) === 0 })
    if (c) { elegir(c[0], true); buscar.blur() }
  })

  // Alertas activas: los puntos de las comunas con alerta se pintan por nivel.
  var alertas = [], alertasCargadas = false
  var NIVEL = { preventiva: 'Alerta Temprana Preventiva', amarilla: 'Alerta Amarilla', roja: 'Alerta Roja', evacuacion: 'Evacuación' }
  var PESO = { preventiva: 1, amarilla: 2, roja: 3, evacuacion: 4 }
  function cargarAlertas() {
    return fetch(API + '/api/alertas', { signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined })
      .then(function (r) { return r.json() })
      .then(function (d) {
        alertas = d.alertas || []; alertasCargadas = true
        var peor = {}
        alertas.forEach(function (a) { (a.comunas || []).forEach(function (cut) { if (!peor[cut] || PESO[a.nivel] > PESO[peor[cut]]) peor[cut] = a.nivel }) })
        Object.keys(nodos).forEach(function (cut) { nodos[cut].dataset.nivel = peor[cut] || '' })
        var n = Object.keys(peor).length
        $('#mapa-estado').textContent = alertas.length
          ? 'Ahora: ' + alertas.length + (alertas.length === 1 ? ' alerta activa' : ' alertas activas') + ' de SENAPRED en ' + n + (n === 1 ? ' comuna' : ' comunas') + '.'
          : 'Ahora: sin alertas activas de SENAPRED en Chile.'
        if (elegida) pintarAlertas(elegida)
      })
      .catch(function () { $('#mapa-estado').textContent = 'Las alertas no respondieron ahora. En la app siempre ves el último estado.' })
  }

  // Clima real de la comuna elegida
  var CODIGOS = [[0, 'Despejado', '☀️'], [2, 'Parcial nublado', '⛅'], [3, 'Nublado', '☁️'], [48, 'Neblina', '🌫️'], [57, 'Llovizna', '🌦️'], [67, 'Lluvia', '🌧️'], [77, 'Nieve', '🌨️'], [82, 'Chubascos', '🌦️'], [86, 'Chubascos de nieve', '🌨️'], [99, 'Tormenta eléctrica', '⛈️']]
  var cond = function (w) { for (var i = 0; i < CODIGOS.length; i++) if (w <= CODIGOS[i][0]) return CODIGOS[i]; return CODIGOS[CODIGOS.length - 1] }
  var elegida = null, pedido = 0
  function consejo(a, lluvia12, max12) {
    var t = a.temperature_2m, cosas = []
    if (lluvia12 >= 0.5) cosas.push('paraguas')
    if (t < 10 || a.apparent_temperature < 8) cosas.push('abrigo')
    if (max12 >= 28) cosas.push('agua')
    if ((a.uv_index || 0) >= 6 && a.is_day && lluvia12 < 0.5) cosas.push('bloqueador')
    if (!cosas.length) return 'Día tranquilo. Sal sin preocuparte.'
    return 'Lleva ' + (cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1] : cosas[0]) + '.'
  }
  function pintarAlertas(cut) {
    var caja = $('#ficha-alertas')
    if (!alertasCargadas) { caja.innerHTML = '<span class="nivel-sin">Revisando alertas…</span>'; return }
    var mias = alertas.filter(function (a) { return (a.comunas || []).indexOf(cut) >= 0 })
    caja.innerHTML = ''
    if (!mias.length) { caja.innerHTML = '<span class="nivel-ok">Sin alertas de SENAPRED para esta comuna</span>'; return }
    mias.slice(0, 3).forEach(function (a) {
      var s = document.createElement('span'); s.className = 'nivel nivel-' + a.nivel
      s.textContent = (NIVEL[a.nivel] || 'Alerta') + (a.amenaza ? ': ' + a.amenaza : a.titulo ? ': ' + a.titulo : '')
      caja.appendChild(s)
    })
  }
  function elegir(cut, porPersona) {
    var c = porCut[cut]; if (!c) return
    elegida = cut
    try { if (porPersona) localStorage.setItem('zumi:comuna', cut) } catch (e) {}
    resaltar(c)
    Object.keys(nodos).forEach(function (k) { nodos[k].classList.toggle('elegida', k === cut) })
    var m = $('#marcador'), h = $('#halo')
    if (c[5] != null) { m.setAttribute('cx', c[5]); m.setAttribute('cy', c[6]); h.setAttribute('cx', c[5]); h.setAttribute('cy', c[6]) }
    ficha.classList.add('cargando')
    $('#ficha-nombre').textContent = c[1]
    $('#ficha-region').textContent = c[2] === 'Metropolitana' ? 'Región Metropolitana' : (c[2] === 'Maule' || c[2] === 'Biobío' ? 'Región del ' : 'Región de ') + c[2]
    pintarAlertas(cut)
    var n = ++pedido
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c[3] + '&longitude=' + c[4] +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,is_day&hourly=precipitation,temperature_2m&forecast_hours=12&timezone=America%2FSantiago'
    fetch(url).then(function (r) { return r.json() }).then(function (d) {
      if (n !== pedido) return
      var a = d.current, k = cond(a.weather_code)
      var lluvia = d.hourly.precipitation, horas = d.hourly.time
      var total = lluvia.reduce(function (s, x) { return s + (x || 0) }, 0)
      var max12 = Math.max.apply(null, d.hourly.temperature_2m)
      $('#ficha-temp').textContent = Math.round(a.temperature_2m) + '°'
      $('#ficha-cond').textContent = (a.is_day || k[1] !== 'Despejado' ? k[2] : '🌙') + ' ' + k[1]
      $('#ficha-detalle').textContent = 'Sensación ' + Math.round(a.apparent_temperature) + '° · viento ' + Math.round(a.wind_speed_10m) + ' km/h'
      $('#ficha-zumi').textContent = consejo(a, total, max12)
      // Barras de lluvia de las próximas 12 horas
      var tope = Math.max(2, Math.max.apply(null, lluvia)), barras = $('#ficha-barras')
      barras.innerHTML = ''
      lluvia.forEach(function (x, i) {
        var b = document.createElement('div'); b.className = 'barra'
        b.innerHTML = '<i style="height:' + Math.max(3, (x / tope) * 100) + '%" class="' + (x >= 0.2 ? 'moja' : '') + '"></i><small>' + (i % 3 === 0 ? horas[i].slice(11, 13) + 'h' : '') + '</small>'
        b.title = horas[i].slice(11, 16) + ': ' + x.toFixed(1) + ' mm'
        barras.appendChild(b)
      })
      $('#ficha-lluvia').textContent = total >= 0.2 ? 'Lluvia en las próximas 12 horas: ' + total.toFixed(1) + ' mm' : 'Sin lluvia en las próximas 12 horas'
      ficha.classList.remove('cargando')
    }).catch(function () {
      if (n !== pedido) return
      $('#ficha-zumi').textContent = 'No pude traer el clima ahora. Inténtalo de nuevo en un momento.'
      ficha.classList.remove('cargando')
    })
  }

  // Arranca cuando el mapa aparece: se encienden los puntos de norte a sur y se carga lo vivo.
  var chile = $('#chile'), partido = false
  function partir() {
    if (partido) return; partido = true
    chile.classList.add('ver')
    var guardada = null; try { guardada = localStorage.getItem('zumi:comuna') } catch (e) {}
    elegir(porCut[guardada] ? guardada : '07401')
    cargarAlertas()
    setInterval(function () { if (!document.hidden) cargarAlertas() }, 5 * 60e3)
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { partir(); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(chile)
  } else partir()
})()
