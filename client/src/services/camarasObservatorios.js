// Cámaras públicas de los observatorios en Chile (ESO y socios). Se publican para que cualquiera
// las vea, se renuevan cada pocos minutos y se suman a las cámaras del mapa.
const ESO = 'https://www.eso.org/public/outreach/webcams/'
const sitio = (base, lat, lng, lugar, lista) =>
  lista.map(([id, titulo, url], i) => ({
    id: `obs-${id}`,
    titulo,
    lugar,
    // pequeñas separaciones para que los marcadores del mismo cerro no queden uno encima de otro
    lat: lat + Math.sin(i * 1.3) * 0.006,
    lng: lng + Math.cos(i * 1.3) * 0.006,
    imagen: url,
    miniatura: url,
    enlace: ESO,
    reproductor: null,
    actualizada: null,
    observatorio: base,
  }))

export const CAMARAS_OBSERVATORIOS = [
  ...sitio('Paranal', -24.6272, -70.4042, 'Observatorio Paranal (ESO), Antofagasta', [
    ['paranal-pano', 'Paranal: panorámica del VLT', 'https://www.eso.org/public/archives/static/pano/latest/pano_PV_960x.jpg'],
    ['paranal-armazones', 'Paranal: vista al cerro Armazones', 'https://www.eso.org/public/archives/static/pano/latest/POI/460x/preset_1.jpg'],
    ['paranal-vst', 'Paranal: telescopio VST', 'https://www.eso.org/public/archives/static/pano/latest/POI/460x/preset_2.jpg'],
    ['paranal-ut3', 'Paranal: telescopio Melipal (UT3)', 'https://www.eso.org/public/archives/static/pano/latest/POI/460x/preset_6.jpg'],
    ['paranal-llullaillaco', 'Paranal: vista al volcán Llullaillaco', 'https://www.eso.org/public/archives/static/pano/latest/POI/460x/preset_7.jpg'],
    ['paranal-cielo', 'Paranal: cielo completo', 'https://www.eso.org/public/archives/static/allsky/latest/460x/preset_101.jpg'],
  ]),
  ...sitio('Armazones', -24.5895, -70.192, 'Cerro Armazones (ESO), Antofagasta', [
    ['elt-sur', 'Construcción del ELT, el telescopio más grande del mundo', 'https://www.eso.org/public/archive_webcams/armazonespanosouth/public/pano_PV_960x.jpg'],
    ['elt-cupula', 'ELT: cámara en lo alto de la cúpula', 'https://www.eso.org/public/archive_webcams/armazones_dome_1/public/pano_PV_960x.jpg'],
    ['elt-cupula-baja', 'ELT: cámara en la base de la cúpula', 'https://www.eso.org/public/archive_webcams/armazones_dome_2/public/pano_PV_960x.jpg'],
  ]),
  ...sitio('ALMA', -23.0193, -67.7532, 'Llano de Chajnantor, San Pedro de Atacama', [
    ['alma-pano', 'ALMA: panorámica a 5.000 m de altura', 'https://www.eso.org/public/archives/static/almapano/latest/pano_PV_960x.jpg'],
    ['alma-licancabur', 'ALMA: vista al volcán Licancabur', 'https://www.eso.org/public/archives/static/almapano/latest/POI/460x/preset_2.jpg'],
    ['alma-antenas', 'ALMA: antenas del radiotelescopio', 'https://www.eso.org/public/archives/static/almapano/latest/POI/460x/preset_4.jpg'],
    ['alma-llano', 'ALMA: llano de Chajnantor', 'https://www.eso.org/public/archives/static/almapano/latest/POI/460x/preset_5.jpg'],
    ['alma-apex', 'ALMA: telescopio APEX', 'https://www.eso.org/public/archives/static/almapano/latest/POI/460x/preset_3.jpg'],
  ]),
  ...sitio('La Silla', -29.2567, -70.7346, 'Observatorio La Silla (ESO), Coquimbo', [
    ['lasilla-cielo', 'La Silla: cielo nocturno', 'https://allsky-dk154.asu.cas.cz/AllSkyCurrentImage.JPG'],
    ['lasilla-rem-norte', 'La Silla: vista al norte', 'https://images.weserv.nl/?url=http://www.rem.inaf.it/remwbc/remwbcx.jpg'],
  ]),
]
