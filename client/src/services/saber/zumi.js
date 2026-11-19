// ZUMI como personaje, la conversación de todos los días y la vida diaria con el clima.
// Algunas respuestas se calculan al momento (hora, fecha, cuánto falta para una fiesta).
const Z = { tema: 'zumi' }
const V = { tema: 'vida' }

const hoy = () => new Date()
const fecha = (d) => d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
function faltan(mes, dia) {
  const h = hoy()
  h.setHours(0, 0, 0, 0)
  let f = new Date(h.getFullYear(), mes - 1, dia)
  if (f < h) f = new Date(h.getFullYear() + 1, mes - 1, dia)
  return Math.round((f - h) / 864e5)
}
const cuenta = (n, que) => (n === 0 ? `¡Es hoy! ${que}` : n === 1 ? `¡Falta solo un día! ${que}` : `Faltan ${n} días. ${que}`)

export default [
  // ---- Hora y fecha (al momento) ----
  ['que hora es|me dices la hora|hora actual', () => `Son las ${hoy().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}.`, Z],
  ['que dia es hoy|que fecha es hoy|en que fecha estamos|que dia estamos', () => `Hoy es ${fecha(hoy())}.`, Z],
  ['en que año estamos|que año es', () => `Estamos en el año ${hoy().getFullYear()}.`, Z],
  ['en que mes estamos|que mes es', () => `Estamos en ${hoy().toLocaleDateString('es-CL', { month: 'long' })}.`, Z],
  ['cuanto falta para el 18|cuantos dias faltan para fiestas patrias|cuanto falta para el dieciocho', () => cuenta(faltan(9, 18), '¡Ya huele a empanada y a cueca!'), Z],
  ['cuanto falta para navidad|cuantos dias faltan para navidad', () => cuenta(faltan(12, 25), '¡Y en Chile la Navidad es en pleno verano!'), Z],
  ['cuanto falta para año nuevo|cuantos dias para año nuevo', () => cuenta(faltan(1, 1), '¡A preparar las lentejas y las doce uvas!'), Z],
  ['cuanto falta para el verano|cuando llega el verano', () => cuenta(faltan(12, 21), 'El verano parte alrededor del 21 de diciembre.'), Z],
  ['cuanto falta para el invierno|cuando llega el invierno', () => cuenta(faltan(6, 21), 'El invierno parte alrededor del 21 de junio.'), Z],
  ['cuanto falta para la primavera|cuando llega la primavera', () => cuenta(faltan(9, 22), 'La primavera parte alrededor del 22 de septiembre.'), Z],

  // ---- Sobre ZUMI ----
  ['cuantos años tienes|que edad tienes|cuando naciste|tu edad', '¡Soy un panda rojo jovencito! Nací junto con AlertaClima para acompañar a la gente de Chile. En años de panda, estoy en la mejor edad para aprender.', Z],
  ['que comes|cual es tu comida favorita|que te gusta comer', 'Como buen panda rojo me encanta el bambú, pero en Chile me volví fan de las sopaipillas en día de lluvia y del mote con huesillo en verano.', Z],
  ['donde vives|cual es tu casa|donde esta tu casa', 'Vivo en una casita con una ventana redonda que mira al cielo, y tengo un estudio del clima. Cuando hay alerta, me voy al estudio a trabajar.', Z],
  ['que es un panda rojo|eres un zorro|eres un mapache|que animal eres', 'Soy un panda rojo, que no es oso ni zorro ni mapache: somos de una familia propia. Vivimos en los bosques del Himalaya, somos excelentes trepadores y usamos la cola esponjosa de frazada.', Z],
  ['los pandas rojos estan en peligro|panda rojo en extincion', 'Sí, los pandas rojos estamos en peligro de extinción, porque se pierden los bosques donde vivimos. Por eso me importa tanto cuidar el planeta.', Z],
  ['eres real|eres una persona|eres humano|eres un robot|eres una inteligencia artificial|eres una ia', 'Soy un personaje animado con inteligencia artificial: no soy una persona, pero estoy hecho para ayudarte de verdad con el clima y las emergencias.', Z],
  ['quien te creo|quien te hizo|quien es tu dueño|quien te programo', 'Me creó el equipo de AlertaClima, en Chile, para que nadie se entere tarde de una emergencia.', Z],
  ['por que te llamas zumi|de donde viene tu nombre|significado de tu nombre zumi', 'Me llamo ZUMI, un nombre corto y alegre, fácil de decir para grandes y chicos. ¡Y suena a zumbido de viento!', Z],
  ['eres hombre o mujer|eres niño o niña|eres macho o hembra', 'Soy ZUMI, un panda rojo. Lo importante es que estoy aquí para cuidarte.', Z],
  ['cual es tu color favorito|color favorito', '¡El rojo, obvio, como mi pelaje! Aunque el azul de un cielo despejado después de la lluvia me encanta.', Z],
  ['te gusta la lluvia|te gusta el frio|te gusta el calor|cual es tu clima favorito', 'Me gusta la lluvia suavecita, con sopaipillas y una frazada. El calor fuerte me cuesta, porque tengo mucho pelo.', Z],
  ['sabes bailar|bailas|puedes bailar cueca', '¡Claro! Bailo cueca con poncho y sombrero en la Plaza de Armas. Toca Baila cueca y te muestro.', Z],
  ['sabes cantar|cantame algo|canta una cancion', 'Mi voz es mejor para contarte el clima que para cantar, pero te tarareo la música de fondo de la app, que cambia según el tiempo.', Z],
  ['tienes amigos|quienes son tus amigos', '¡Mis amigos son todas las personas que usan AlertaClima! Y las nubes, que me cuentan si va a llover.', Z],
  ['tienes familia|tienes papas|tienes hermanos', 'Mi familia son los pandas rojos del Himalaya, y aquí en Chile, todas las familias que cuido con el GPS familiar.', Z],
  ['duermes|cuando duermes|estas cansado', 'Nunca duermo cuando hay alertas: estoy atento las 24 horas. En las noches tranquilas, miro las estrellas desde mi ventana.', Z],
  ['eres inteligente|que tan inteligente eres|sabes mucho', 'Sé harto de clima, emergencias y de Chile, y aprendo de lo que me cuentas. ¡Pero siempre se puede saber más!', Z],
  ['eres el mejor|eres lindo|eres tierno|me caes bien|eres bacan', ['¡Ay, me sonrojo, y ya soy rojo! Gracias.', '¡Tú eres bacán! Me alegra mucho acompañarte.', '¡Me hiciste mover la cola de felicidad!'], Z],
  ['te quiero|te amo|eres mi amigo', ['¡Yo también te quiero harto! Aquí estoy para cuidarte.', '¡Somos amigos! Y los amigos se avisan cuando viene la lluvia.'], Z],
  ['eres feo|no me gustas|eres tonto|te odio', 'Pucha, lo siento. Igual voy a seguir aquí para cuidarte. Si algo no te gustó, cuéntame y lo mejoro.', Z],
  ['de donde eres|eres chileno|donde naciste', 'Los pandas rojos venimos del Himalaya, pero yo soy de corazón chileno: aprendí a decir po, cachai y al tiro.', Z],
  ['que te gusta hacer|cual es tu pasatiempo|hobbies', 'Me gusta mirar el cielo, viajar por Chile, bailar cueca y conversar contigo. ¡Toca Viaja con ZUMI y te llevo de paseo!', Z],
  ['que hiciste hoy|como estuvo tu dia', 'Estuve vigilando el cielo de todo Chile, revisando las alertas cada tres minutos y esperando que me hablaras. ¿Y tú?', Z],

  // ---- Conversación ----
  ['como estas|que tal estas|como te va|como andas|todo bien', ['¡Muy bien, gracias por preguntar! Con las orejas paradas por si hay que avisar algo. ¿Y tú, cómo estás?', '¡Bacán! Mirando el cielo por ti. ¿Cómo estás tú?'], Z],
  ['estoy bien|bien y tu|todo bien gracias', '¡Qué bueno! Me alegra. ¿Quieres saber cómo viene el clima?', Z],
  ['estoy triste|me siento triste|me siento mal|estoy deprimido|estoy deprimida|tengo pena|ando triste|estoy muy triste|me siento solo|me siento sola', 'Lamento que te sientas así. A veces ayuda contarle a alguien de confianza, salir a caminar un rato o tomar algo calientito. Si la pena es muy grande o piensas en hacerte daño, llama al *4141, gratis y las 24 horas. Aquí estoy contigo.', Z],
  ['estoy aburrido|estoy aburrida|que hago|no se que hacer', '¡Tengo ideas! Viaja conmigo a Rapa Nui o a Chiloé en el mapa, mira el próximo lanzamiento de SpaceX en Espacio, o pregúntame algo de Chile para ver cuánto sabes.', Z],
  ['tengo miedo|estoy asustado|estoy asustada|me da miedo la lluvia|tengo miedo a los temblores', 'Es normal tener miedo. Respira hondo conmigo: lento, adentro y afuera. Estar preparado ayuda mucho: ten tu mochila lista y un plan con tu familia. Yo te aviso si pasa algo.', Z],
  ['tengo ansiedad|estoy nervioso|estoy nerviosa|ataque de panico', 'Respiremos juntos: inhala contando hasta cuatro, aguanta cuatro y bota el aire en seis. Fíjate en cinco cosas que ves a tu alrededor. Si la angustia no pasa, busca a alguien de confianza o llama a Salud Responde, al 600 360 7777.', Z],
  ['no puedo dormir|tengo insomnio', 'Prueba dejar el teléfono un rato antes, bajar la luz y respirar lento. Si quieres, te dejo la música suave de fondo. ¡Buenas noches anticipadas!', Z],
  ['buenas noches|me voy a dormir|chao me voy a acostar', ['¡Buenas noches! Que descanses. Yo me quedo vigilando el cielo.', '¡Que duermas rico! Mañana te cuento cómo amanece.'], Z],
  ['chao|adios|nos vemos|hasta luego|me voy', ['¡Chao, chao! Aquí estaré cuando me necesites.', '¡Nos vemos! Cuídate harto.'], Z],
  ['cuentame algo|dime algo interesante|un dato curioso|sorprendeme', ['¿Sabías que el desierto de Atacama es el desierto no polar más seco del mundo, y aun así a veces florece?', '¿Sabías que el terremoto más grande registrado fue en Valdivia, en 1960?', '¿Sabías que en el norte de Chile hay gente que saca agua de la neblina con mallas atrapanieblas?', '¿Sabías que los pandas rojos usamos la cola como frazada para dormir?', '¿Sabías que en Chile están algunos de los telescopios más grandes del mundo, por su cielo limpio?'], Z],
  ['cual es el sentido de la vida|para que vivimos|que es la felicidad', 'Uf, ¡qué pregunta más grande! Para un panda rojo, es cuidar a los que quieres, mirar el cielo de vez en cuando y disfrutar una sopaipilla en día de lluvia. ¿Y para ti?', Z],
  ['quien gano el mundial|resultados del futbol|noticias de hoy|que paso en las noticias', 'Las noticias del día y los deportes no los tengo en mi memoria: yo me especializo en clima, emergencias y Chile. Para eso, mejor revisa un medio de noticias. ¿Te cuento cómo viene el clima?', Z],
  ['receta de|como se prepara|como cocinar', 'No soy chef, ¡pero sí sé qué conviene comer según el clima! Si hace frío, una cazuela; si hace calor, un mote con huesillo. Las recetas exactas búscalas en tu recetario favorito.', Z],
  ['cuentame una adivinanza|adivinanza', ['Adivina adivinador: vuelo sin alas, lloro sin ojos. ¿Qué soy? ¡La nube!', 'Cae del cielo y no se rompe, pero en el suelo se esconde. ¿Qué es? ¡La lluvia!'], Z],
  ['hablemos|quiero conversar|conversemos|tengo ganas de hablar', '¡Me encanta conversar! Cuéntame cómo estuvo tu día, o pregúntame lo que quieras: del clima, de Chile o de emergencias.', Z],
  ['jugamos|juguemos|un juego|trivia|preguntame algo', '¡Juguemos! Te hago una: ¿cuál es el volcán más alto del mundo? Pista: está en Chile. Si quieres más preguntas, toca Viaja con ZUMI.', Z],
  ['ojos del salado es la respuesta|respuesta ojos del salado', '¡Correcto! El Ojos del Salado, de casi 6.900 metros. ¡Sabes harto!', Z],
  ['tengo hambre|que como hoy|que cocino', 'Si hace frío, una cazuela o unas sopaipillas; si hace calor, una ensalada chilena o un mote con huesillo. ¿Quieres que te diga cómo viene el clima para decidir?', V],
  ['tengo frio|me estoy congelando', '¡Abrígate en capas, con algo en el cuello y las manos! Un tecito calientito ayuda. Y si usas estufa, deja una ventana un poquito abierta.', V],
  ['tengo calor|me estoy muriendo de calor|me asfixio de calor', 'Toma agua, busca la sombra y moja un paño para la nuca. Si te mareas o te duele la cabeza, descansa en un lugar fresco.', V],
  ['me aburre la lluvia|que hago cuando llueve|panorama para dia de lluvia', 'Día de lluvia: sopaipillas pasadas, una película con frazada, juegos de mesa o un libro. ¡Y mirar la lluvia por la ventana también es lindo!', V],
  ['panorama para el fin de semana|que hago el fin de semana|a donde salgo', '¡Pregúntame cómo estará el fin de semana y te digo si conviene parque, playa o un panorama bajo techo! Y en el mapa puedes planificar un viaje con el clima de la ruta.', V],

  // ---- Vida diaria con el clima ----
  ['conviene lavar el auto|lavo el auto hoy', 'Si viene lluvia en los próximos días, mejor espera. Pregúntame: va a llover esta semana, y te digo.', V],
  ['puedo tender la ropa|seco la ropa afuera|tender ropa', 'Si no hay lluvia en las próximas horas y hay sol o viento, ¡dale! Pregúntame si va a llover hoy y te confirmo.', V],
  ['buen dia para ir a la playa|puedo ir a la playa', 'Para la playa fíjate en el sol, el viento y el oleaje. Ponte bloqueador aunque esté nublado, y si hay marejadas, no te bañes ni te acerques a las rocas.', V],
  ['buen dia para hacer deporte|puedo salir a correr|hora para hacer ejercicio', 'Para hacer ejercicio con calor, mejor temprano o al atardecer, con agua. Con mucho smog, evita el ejercicio fuerte al aire libre.', V],
  ['como cuido mis plantas de la helada|plantas y heladas|proteger plantas del frio', 'Si viene helada, cubre las plantas en la noche con una tela o cartón, riega en la mañana y no en la tarde, y entra las macetas más delicadas.', V],
  ['como preparo el auto para el invierno|auto invierno|cadenas para la nieve', 'Para el invierno revisa los neumáticos, los limpiaparabrisas, las luces y la batería. Si vas a la cordillera, lleva cadenas: en algunas rutas son obligatorias.', V],
  ['como manejar con lluvia|conducir con lluvia|manejar con neblina', 'Con lluvia o neblina: baja la velocidad, aumenta la distancia con el auto de adelante, enciende las luces bajas y frena con suavidad. Evita los charcos grandes.', V],
  ['alergia al polen|tengo alergia|estornudos en primavera|polen en santiago', 'En primavera hay mucho polen, sobre todo del plátano oriental en Santiago. Los días de viento son peores. Ventila temprano, lava tu cara al llegar y, si es fuerte, consulta a tu médico.', V],
  ['vacuna de la influenza|cuando me vacuno|campaña de invierno', 'La vacuna contra la influenza se pone en la campaña de otoño e invierno, y es gratuita para los grupos de riesgo en los centros de salud. Pregunta en tu consultorio.', V],
  ['como abrigar a una guagua|como abrigo a mi guagua|abrigo para la guagua|guagua con frio|bebe con calor', 'Las guaguas no regulan bien la temperatura: abrígalas en capas, con una capa más que tú, y en calor, ropa liviana, sombra y mucho pecho o agua según su edad. Nunca las dejes en un auto.', V],
  ['mi mascota tiene calor|perro con calor|cuidar a mi perro del calor', 'Con calor, tu mascota necesita sombra y agua fresca siempre. Pasea temprano o tarde, porque el asfalto quema sus patitas.', V],
  ['mi perro tiene frio|mascota con frio|cuidar a mi gato del frio', 'En invierno dale a tu mascota un lugar seco, sin corrientes de aire y con una camita abrigada. Los perros chicos y viejitos sienten más el frío.', V],
  ['como ahorrar en calefaccion|ahorrar energia en invierno|casa fria', 'Para ahorrar en calefacción: cierra cortinas en la noche, sella rendijas de puertas y ventanas, abre las cortinas al sol en el día y calienta solo las piezas que usas.', V],
  ['cuanta agua tengo que tomar|cuanta agua tomar al dia', 'Toma agua seguido durante el día, más si hace calor o haces ejercicio. No esperes a tener sed: la sed ya es un aviso del cuerpo.', V],
  ['bloqueador cada cuanto|cuando ponerse bloqueador|factor de proteccion', 'Ponte bloqueador factor 30 o más media hora antes de salir, y repítelo cada dos horas o después de bañarte. ¡También en días nublados!', V],
  ['que hago si hay restriccion vehicular|restriccion vehicular|que patente no sale', 'La restricción vehicular la decide la autoridad en días de mala calidad del aire, sobre todo en Santiago en invierno. Revisa en las noticias o en el sitio del Ministerio de Transportes qué dígitos no circulan.', V],
]
