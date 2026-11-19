// Chile según ZUMI: regiones, geografía, historia, comida, fiestas y chilenismos.
const T = { tema: 'chile' }

// Cada región: capital, clima típico y algo que no te puedes perder.
export const REGIONES = [
  ['Arica y Parinacota', 'Arica', 'clima desértico costero, templado todo el año y casi sin lluvia; en el altiplano hace frío y llueve en verano', 'el lago Chungará, el Parque Nacional Lauca y el morro de Arica'],
  ['Tarapacá', 'Iquique', 'desértico con camanchaca en la costa, templado y seco todo el año', 'las playas de Iquique, Humberstone y La Tirana'],
  ['Antofagasta', 'Antofagasta', 'desértico, seco y soleado; en San Pedro de Atacama las noches son muy frías', 'San Pedro de Atacama, el Valle de la Luna, los géiseres del Tatio y La Portada'],
  ['Atacama', 'Copiapó', 'desértico, con días cálidos y noches frescas', 'el desierto florido, Bahía Inglesa y el Parque Nacional Pan de Azúcar'],
  ['Coquimbo', 'La Serena', 'semiárido, templado, con nubosidad matinal en la costa', 'el Valle de Elqui, sus cielos estrellados y el Faro Monumental de La Serena'],
  ['Valparaíso', 'Valparaíso', 'mediterráneo costero, templado, con lluvias en invierno', 'los cerros y ascensores de Valparaíso, Viña del Mar, Rapa Nui y el archipiélago Juan Fernández'],
  ['Metropolitana', 'Santiago', 'mediterráneo, con veranos calurosos y secos e inviernos fríos con algunas lluvias', 'el cerro San Cristóbal, el Cajón del Maipo y el centro histórico'],
  ["O'Higgins", 'Rancagua', 'mediterráneo, cálido en verano y con lluvias en invierno', 'Pichilemu, el Valle de Colchagua y el campamento minero de Sewell'],
  ['Maule', 'Talca', 'mediterráneo, con veranos calurosos e inviernos lluviosos', 'el Parque Nacional Radal Siete Tazas y la costa de Constitución'],
  ['Ñuble', 'Chillán', 'templado mediterráneo, con inviernos lluviosos y fríos', 'las Termas de Chillán y el Nevados de Chillán'],
  ['Biobío', 'Concepción', 'templado lluvioso, con inviernos húmedos', 'el río Biobío, Lota y su historia minera y las playas de la costa'],
  ['La Araucanía', 'Temuco', 'templado lluvioso, con inviernos fríos y veranos agradables', 'Pucón, el volcán Villarrica, los lagos y las araucarias del Parque Conguillío'],
  ['Los Ríos', 'Valdivia', 'templado muy lluvioso, verde todo el año', 'Valdivia con sus lobos marinos, sus fuertes españoles y la Selva Valdiviana'],
  ['Los Lagos', 'Puerto Montt', 'templado lluvioso, con lluvia gran parte del año', 'Chiloé y sus iglesias, Puerto Varas, el lago Llanquihue y el volcán Osorno'],
  ['Aysén', 'Coyhaique', 'frío y lluvioso, con mucho viento; más seco hacia el lado de Argentina', 'la Carretera Austral, las Capillas de Mármol y la laguna San Rafael'],
  ['Magallanes', 'Punta Arenas', 'frío, con viento fuerte, sobre todo en primavera y verano', 'Torres del Paine, el estrecho de Magallanes y los pingüinos'],
]

const porRegion = REGIONES.flatMap(([n, cap, clima, ver]) => {
  const nom = n === 'Metropolitana' ? 'la Región Metropolitana' : `la región de ${n}`
  return [
    [`capital de ${n}|cual es la capital de la region de ${n}|capital regional de ${n}`, `La capital de ${nom} es ${cap}.`, T],
    [`clima de ${n}|como es el clima en la region de ${n}|que tiempo hace en ${n} normalmente`, `En ${nom} el clima es ${clima}. Si quieres el pronóstico de hoy, pregúntame por una comuna, por ejemplo: cómo está el clima en ${cap}.`, T],
    [`que visitar en ${n}|que hacer en la region de ${n}|lugares turisticos de ${n}|que conocer en ${n}`, `En ${nom} no te puedes perder ${ver}. ¡Si quieres, te llevo en Viaja con ZUMI!`, T],
  ]
})

export default [
  ...porRegion,
  ['cuantas regiones tiene chile|cuales son las regiones de chile|regiones de chile', 'Chile tiene 16 regiones. De norte a sur: Arica y Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Valparaíso, Metropolitana, O’Higgins, Maule, Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén y Magallanes.', T],
  ['cuantas comunas tiene chile|numero de comunas', 'Chile tiene 346 comunas, y yo te puedo contar el clima de todas. Pregúntame, por ejemplo: cómo está el clima en Castro.', T],
  ['cual es la region mas nueva|cuando se creo ñuble|region mas reciente', 'La región más nueva es Ñuble, creada en 2018, con capital en Chillán.', T],
  ['cual es la capital de chile|capital de chile', 'La capital de Chile es Santiago.', T],
  ['cuanto mide chile|largo de chile|que tan largo es chile|cuantos kilometros tiene chile de largo', 'Chile continental mide más de 4.200 kilómetros de largo, y en promedio unos 180 kilómetros de ancho. ¡Es uno de los países más largos y angostos del mundo!', T],
  ['cual es el cerro mas alto de chile|montaña mas alta de chile|ojos del salado|volcan mas alto', 'La montaña más alta de Chile es el volcán Ojos del Salado, de casi 6.900 metros, en la región de Atacama. ¡Es el volcán más alto del mundo!', T],
  ['el aconcagua es de chile|donde esta el aconcagua', 'El Aconcagua, el cerro más alto de América, está en Argentina, muy cerca de la frontera con Chile. Desde la ruta a Los Andes se ve imponente.', T],
  ['cual es el rio mas largo de chile|rio loa|rio mas grande de chile', 'El río más largo de Chile es el Loa, en la región de Antofagasta, con unos 440 kilómetros. El más caudaloso es el Baker, en Aysén.', T],
  ['cual es el lago mas grande de chile|lago general carrera|lago llanquihue', 'El lago más grande de Chile es el General Carrera, en Aysén, que compartimos con Argentina. El más grande que está entero en Chile es el Llanquihue.', T],
  ['cuantos habitantes tiene chile|poblacion de chile|cuanta gente vive en chile', 'Según el Censo 2024, en Chile viven cerca de 18,5 millones de personas, y casi 4 de cada 10 en la Región Metropolitana.', T],
  ['con que paises limita chile|vecinos de chile|fronteras de chile', 'Chile limita con Perú al norte, con Bolivia y Argentina al este, y con el océano Pacífico al oeste. Al sur, llega hasta la Antártica.', T],
  ['que es rapa nui|isla de pascua|donde queda isla de pascua', 'Rapa Nui, o Isla de Pascua, está en medio del Pacífico, a unos 3.700 kilómetros de la costa de Chile. Es famosa por sus moai y por la cultura rapanui.', T],
  ['que son los moai|cuantos moai hay', 'Los moai son estatuas gigantes de piedra que tallaron los rapanui para honrar a sus ancestros. Hay cerca de mil en la isla, y en Ahu Tongariki hay 15 en fila.', T],
  ['juan fernandez|isla robinson crusoe', 'El archipiélago Juan Fernández está frente a Valparaíso. La isla Robinson Crusoe se llama así por la historia de un marinero que vivió solo ahí, que inspiró la novela.', T],
  ['chile tiene antartica|territorio antartico chileno|base en la antartica', 'Sí, Chile reclama un territorio en la Antártica y tiene bases ahí, como la Base Presidente Eduardo Frei y Villa Las Estrellas, en la isla Rey Jorge.', T],
  ['que son los glaciares|campos de hielo|glaciares de chile', 'Chile tiene la mayor cantidad de glaciares de Sudamérica, sobre todo en los Campos de Hielo Norte y Sur, en la Patagonia. Son reservas gigantes de agua dulce.', T],

  // ---- Historia ----
  ['cuando fue la independencia de chile|independencia de chile|que se celebra el 18 de septiembre|por que se celebra el 18', 'El 18 de septiembre de 1810 se formó la Primera Junta Nacional de Gobierno, el primer paso a la independencia. La independencia se declaró oficialmente el 12 de febrero de 1818.', T],
  ['quien fue bernardo ohiggins|quien fue o higgins|quien fue ohiggins|bernardo o higgins|padre de la patria', 'Bernardo O’Higgins es considerado el Padre de la Patria: fue uno de los líderes de la independencia y el primer Director Supremo de Chile.', T],
  ['quien fundo santiago|cuando se fundo santiago|pedro de valdivia', 'Santiago lo fundó Pedro de Valdivia el 12 de febrero de 1541, a los pies del cerro Santa Lucía, que los mapuche llamaban Huelén.', T],
  ['quien fue arturo prat|21 de mayo|combate naval de iquique|glorias navales', 'El 21 de mayo se recuerda el Combate Naval de Iquique de 1879, en la Guerra del Pacífico, donde el capitán Arturo Prat murió al abordar el Huáscar. Es feriado: el Día de las Glorias Navales.', T],
  ['quienes son los mapuche|pueblo mapuche|mapudungun', 'Los mapuche son el pueblo originario más numeroso de Chile. Su lengua es el mapudungun y su nombre significa gente de la tierra. Muchos nombres de lugares de Chile vienen de su idioma.', T],
  ['pueblos originarios de chile|pueblos indigenas de chile', 'En Chile hay muchos pueblos originarios, entre ellos aymara, quechua, atacameño o lickanantay, colla, diaguita, rapanui, mapuche, kawésqar, yagán y chango.', T],
  ['que premios nobel tiene chile|gabriela mistral|pablo neruda', 'Chile tiene dos Premios Nobel de Literatura: Gabriela Mistral, en 1945, la primera latinoamericana en ganarlo, y Pablo Neruda, en 1971.', T],

  // ---- Fiestas y feriados ----
  ['feriados de chile|cuales son los feriados|dias feriados del año', 'Los feriados fijos de Chile incluyen: Año Nuevo, el 1 de enero; el Día del Trabajador, el 1 de mayo; las Glorias Navales, el 21 de mayo; la Virgen del Carmen, el 16 de julio; la Asunción, el 15 de agosto; Fiestas Patrias, el 18 y 19 de septiembre; Todos los Santos, el 1 de noviembre; la Inmaculada Concepción, el 8 de diciembre; y Navidad, el 25 de diciembre. Otros, como Semana Santa y algunos que se mueven a lunes, cambian cada año.', T],
  ['que se celebra el 19 de septiembre|glorias del ejercito|parada militar', 'El 19 de septiembre es el Día de las Glorias del Ejército, y se celebra con la Gran Parada Militar en el Parque O’Higgins de Santiago.', T],
  ['que es una fonda|fondas|ramadas', 'Las fondas y ramadas son los lugares de fiesta de Fiestas Patrias: hay cueca, empanadas, anticuchos, chicha y juegos típicos como el emboque y el trompo.', T],
  ['cual es el baile nacional|que es la cueca|como se baila la cueca', 'La cueca es el baile nacional de Chile. Se baila en pareja con un pañuelo, dibujando círculos y medias lunas, con zapateo y escobillado. ¡Y yo la bailo en la Plaza de Armas!', T],
  ['juegos tipicos chilenos|emboque|trompo|volantin', 'Algunos juegos típicos chilenos son el emboque, el trompo, el volantín, la rayuela, el palo encebado y la carrera de sacos. ¡Volantines en septiembre, pero lejos de los cables!', T],
  ['dia del patrimonio|que es el dia del patrimonio', 'El Día del Patrimonio Cultural se celebra en mayo: se abren gratis edificios, museos y lugares históricos de todo Chile.', T],
  ['año nuevo en valparaiso|fuegos artificiales en año nuevo', 'El Año Nuevo en el Mar de Valparaíso es una de las celebraciones más famosas de Chile, con fuegos artificiales sobre la bahía. Ojo con tus mascotas: el ruido las asusta mucho.', T],
  ['que es we tripantu|año nuevo mapuche|año nuevo indigena', 'El We Tripantu es el año nuevo mapuche, que se celebra en el solsticio de invierno, alrededor del 21 de junio, cuando el sol empieza a volver. Hoy es feriado: el Día Nacional de los Pueblos Indígenas.', T],

  // ---- Comida ----
  ['comidas tipicas de chile|que se come en chile|plato tipico chileno|comida chilena', 'Algunas comidas típicas chilenas: empanadas de pino, pastel de choclo, cazuela, porotos granados, humitas, charquicán, curanto en el sur, sopaipillas, completos y, de postre, mote con huesillo.', T],
  ['que es una empanada de pino|empanada de pino|como se hace la empanada', 'La empanada de pino lleva carne picada con cebolla, una aceituna, huevo duro y pasas, envuelta en masa y horneada. ¡Es la reina de las Fiestas Patrias!', T],
  ['que es el mote con huesillo|mote con huesillo', 'El mote con huesillo es una bebida-postre de verano: jugo dulce de duraznos deshidratados, los huesillos, con trigo cocido, el mote. ¡Refrescante para el calor!', T],
  ['que es un completo|completo italiano|completo', 'El completo es el hot dog chileno: vienesa en pan con palta, tomate y mayo; ese es el italiano, por los colores de la bandera de Italia.', T],
  ['que es el curanto|curanto en hoyo', 'El curanto es una preparación de Chiloé: mariscos, carnes, papas y milcaos cocidos en un hoyo en la tierra con piedras calientes, tapado con hojas de nalca.', T],
  ['que son las sopaipillas|sopaipillas pasadas|que se come cuando llueve', 'Las sopaipillas son masas fritas de zapallo. Cuando llueve, ¡son tradición! Pasadas, en chancaca caliente, son el abrazo de un día de lluvia.', T],
  ['que es la once|tomar once|por que se llama once', 'La once es la comida de la tarde en Chile: té o café con pan, palta, queso, jamón o lo que haya. Hay quienes dicen que el nombre viene de las once letras de aguardiente.', T],
  ['que es el pebre|pebre', 'El pebre es una salsa chilena de tomate, cebolla, cilantro, ají y aceite. Va perfecta con el pan amasado o las sopaipillas.', T],
  ['que es una chorrillana|chorrillana', 'La chorrillana es un plato de Valparaíso: una montaña de papas fritas con carne, cebolla y huevo frito. Para compartir.', T],
  ['que es el pastel de choclo|pastel de choclo', 'El pastel de choclo es pino de carne con pollo, aceituna y huevo, cubierto con pasta de choclo y azúcar, horneado en pocillo de greda. ¡Plato de verano!', T],

  // ---- Chilenismos ----
  ['que significa cachai|que es cachai', 'Cachai significa ¿entiendes? o ¿te das cuenta?. Viene del inglés catch, atrapar. ¿Cachai?', T],
  ['que significa po|por que los chilenos dicen po', 'El po es un pues abreviado que los chilenos ponemos para dar énfasis: sí po, ya po, no po. ¡Es marca registrada chilena!', T],
  ['que significa al tiro|que es al tiro', 'Al tiro significa de inmediato, ahora mismo. Si hay una alerta, ¡te aviso al tiro!', T],
  ['que significa fome|que es fome', 'Fome es aburrido o sin gracia. Un día de lluvia puede ser fome... ¡a menos que haya sopaipillas!', T],
  ['que significa bacan|que es bacan', 'Bacán significa genial, buenísimo. ¡Tú eres bacán!', T],
  ['que significa pololo|polola|pololear', 'Pololo o polola es el novio o la novia, y pololear es estar de novios.', T],
  ['que significa luca|que es una luca|cuanto es una luca|cuanta plata es una luca', 'Una luca son mil pesos chilenos. Diez lucas son diez mil pesos.', T],
  ['que significa guagua|que es una guagua', 'Guagua es un bebé, viene del quechua. ¡A las guaguas hay que cuidarlas mucho del calor y del frío!', T],
  ['que significa carrete|carretear', 'Carrete es una fiesta o una salida con amigos, y carretear es ir de fiesta.', T],
  ['que significa cuico|flaite|cuico', 'Cuico se le dice a alguien de clase alta o que se cree mucho, y flaite a alguien vulgar o de mal comportamiento. Ojo, que pueden sonar ofensivos.', T],
  ['que significa la raja|esta la raja', 'Estar la raja significa estar buenísimo, excelente. ¡Un día despejado después de la lluvia está la raja!', T],
  ['que significa weon|weon chilenismo', 'Weón es la palabra más famosa del chileno: puede ser insulto o tratamiento de amistad, según el tono. Yo prefiero decirte amigo.', T],
  ['que significa pucha|que es pucha', 'Pucha es una expresión de pena o molestia suave, como ¡qué lástima!. Pucha, se largó a llover.', T],
  ['que significa harto|que significa harta|que es harto', 'Harto significa mucho: hace harto frío. ¡Y te quiero harto!', T],
  ['que significa sapear|sapo', 'Sapear es mirar o copuchar lo que hacen otros, y sapo es el que lo hace. También es avisar a escondidas.', T],
  ['que significa copucha|copuchento', 'Copucha es un chisme, y copuchento el que anda contando chismes.', T],
  ['que significa pega|que es la pega', 'La pega es el trabajo. ¿Cómo estuvo la pega hoy?', T],
  ['que significa wena|wena wena', 'Wena es un saludo bien chileno, como ¡hola! o ¡qué bueno!. ¡Wena!', T],
  ['que significa choro|que es choro', 'Choro tiene varios significados: alguien valiente o atrevido, algo bacán, o un marisco, el chorito.', T],
  ['que significa cabro chico|cabros chicos', 'Los cabros chicos son los niños. ¡Hay que tenerlos abrigados en invierno!', T],

  // ---- Deporte y cultura ----
  ['deporte mas popular en chile|futbol en chile|la roja', 'El deporte más popular en Chile es el fútbol. La selección, La Roja, ganó la Copa América en 2015 y en 2016.', T],
  ['que es la teleton|teleton chile', 'La Teletón es una campaña solidaria que nació en Chile en 1978 para apoyar la rehabilitación de niños y jóvenes con discapacidad.', T],
  ['moneda de chile|peso chileno|que moneda se usa en chile', 'La moneda de Chile es el peso chileno. Un billete de mil pesos es una luca.', T],
  ['que es la flor nacional|copihue', 'La flor nacional de Chile es el copihue, una flor roja con forma de campana que crece en los bosques del sur.', T],
  ['animal nacional de chile|huemul|condor', 'En el escudo de Chile están el cóndor y el huemul, un ciervo del sur que hoy está en peligro de extinción.', T],
  ['que significa chile|de donde viene el nombre chile', 'Hay varias teorías: puede venir del aymara chilli, donde se acaba la tierra, o del quechua chiri, frío. ¡Ninguna está confirmada!', T],
  ['bandera de chile|colores de la bandera|que significa la bandera chilena', 'La bandera de Chile tiene tres colores: el azul del cielo, el blanco de la nieve de la cordillera y el rojo de la sangre de quienes lucharon por la independencia.', T],
]
