// «ZUMI te lo muestra»: al bajar por la página, el teléfono reproduce la parte de la app de la que
// se habla (grabaciones reales) y ZUMI cambia de pose y explica con su globo.
;(function () {
  var pasos = [].slice.call(document.querySelectorAll('.paso-h'))
  var tel = document.getElementById('h-tel')
  if (!pasos.length || !tel) return
  var pose = document.getElementById('h-pose')
  var dice = document.getElementById('h-dice')
  var medios = [].slice.call(tel.children)
  var actual = null
  var calma = matchMedia('(prefers-reduced-motion: reduce)').matches

  function mostrar(paso) {
    if (paso === actual) return
    actual = paso
    pasos.forEach(function (p) { p.classList.toggle('activo', p === paso) })
    var demo = paso.dataset.demo
    medios.forEach(function (m) {
      var si = m.dataset.demo === demo
      m.classList.toggle('activo', si)
      if (m.tagName === 'VIDEO') {
        if (si) {
          if (m.preload === 'none') m.preload = 'auto'
          if (!calma) m.play().catch(function () {})
        } else m.pause()
      }
    })
    pose.style.opacity = '0'
    setTimeout(function () {
      pose.src = 'img/poses/' + paso.dataset.pose + '.webp'
      pose.style.opacity = '1'
    }, 160)
    dice.textContent = paso.dataset.dice
  }

  // El paso activo es el que cruza la línea a un 45 % de la altura de la pantalla
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) mostrar(e.target) })
  }, { rootMargin: '-45% 0px -50% 0px' })
  pasos.forEach(function (p) { io.observe(p) })
  mostrar(pasos[0])

  // Los videos sueltos (portada, ciudades 3D) solo corren cuando se ven: ahorra batería y datos
  var vistos = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target
      if (e.isIntersecting && !calma) {
        if (v.preload === 'none') v.preload = 'auto'
        v.play().catch(function () {})
      } else v.pause()
    })
  }, { threshold: 0.2 })
  document.querySelectorAll('video[autoplay]').forEach(function (v) { vistos.observe(v) })
})()
