import { useInstalar } from '../hooks/useInstalar'

function Seccion({ titulo, children }) {
  return (
    <section className="border-b-2 border-borde px-4 py-4">
      <h3 className="mb-2 text-[19px] font-bold">{titulo}</h3>
      {children}
    </section>
  )
}

function Opciones({ nombre, valor, opciones, onCambiar }) {
  return (
    <div role="radiogroup" aria-label={nombre} className="grid grid-flow-col gap-2">
      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambiar(o.valor)}
            className={`min-h-12 rounded-lg border-2 px-2 text-[16px] font-bold ${
              activo ? 'border-senal bg-senal text-sobre-senal' : 'border-borde bg-superficie text-texto'
            }`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export default function Ajustes({ tema, setTema, ahorro }) {
  const { instalada, puedeInstalar, esIOS, instalar } = useInstalar()

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="sr-only">Ajustes</h2>
      <Seccion titulo="Pantalla">
        <Opciones
          nombre="Tema"
          valor={tema}
          onCambiar={setTema}
          opciones={[
            { valor: 'oscuro', etiqueta: 'Oscuro' },
            { valor: 'claro', etiqueta: 'Claro' },
          ]}
        />
        <p className="mt-2 text-[15px] text-texto-2">El tema oscuro gasta menos batería. El claro se lee mejor a pleno sol.</p>
      </Seccion>

      <Seccion titulo="Modo ahorro">
        <Opciones
          nombre="Modo ahorro"
          valor={ahorro.manual}
          onCambiar={ahorro.setManual}
          opciones={[
            { valor: null, etiqueta: 'Automático' },
            { valor: true, etiqueta: 'Siempre' },
            { valor: false, etiqueta: 'Nunca' },
          ]}
        />
        <p className="mt-2 text-[15px] text-texto-2">
          Pausa la animación del radar y lo actualiza cada 20 minutos en vez de cada 5. En automático se activa con
          batería bajo 20 %.
          {ahorro.activo && <strong className="text-texto"> Ahora está activo.</strong>}
        </p>
      </Seccion>

      <Seccion titulo="Instalar en tu celular">
        {instalada ? (
          <p className="text-[16px]">La app ya está instalada en este dispositivo.</p>
        ) : puedeInstalar ? (
          <>
            <p className="mb-3 text-[16px]">Queda en tu pantalla de inicio y abre aunque no tengas señal.</p>
            <button type="button" onClick={instalar} className="min-h-12 w-full rounded-lg bg-senal px-4 font-bold text-sobre-senal">
              Instalar AlertaClima
            </button>
          </>
        ) : esIOS ? (
          <ol className="list-decimal space-y-1 pl-5 text-[16px]">
            <li>Abre esta página en Safari.</li>
            <li>Toca el botón Compartir (el cuadrado con una flecha hacia arriba).</li>
            <li>Elige «Agregar a inicio».</li>
          </ol>
        ) : (
          <p className="text-[16px]">Abre el menú de tu navegador y elige «Instalar app» o «Agregar a pantalla de inicio».</p>
        )}
      </Seccion>

      <Seccion titulo="De dónde vienen los datos">
        <ul className="space-y-2 text-[15px] text-texto-2">
          <li>
            <strong className="text-texto">Radar de lluvia:</strong> RainViewer, últimas 2 horas cada 10 minutos. La
            cobertura de radar en Chile es parcial: que no se vea lluvia no garantiza que no esté lloviendo.
          </li>
          <li>
            <strong className="text-texto">Clima y pronóstico:</strong> Open-Meteo (licencia CC BY 4.0), calculado para
            la localidad principal de tu comuna.
          </li>
          <li>
            <strong className="text-texto">Comunas:</strong> 346 comunas con su código único territorial. Límites
            comunales simplificados, solo como referencia.
          </li>
          <li>
            <strong className="text-texto">Mapa:</strong> © colaboradores de OpenStreetMap.
          </li>
          <li>
            <strong className="text-texto">Alertas oficiales:</strong> aún no conectadas. Ante una emergencia, sigue
            siempre las instrucciones de SENAPRED y de tu municipalidad.
          </li>
        </ul>
      </Seccion>
    </div>
  )
}
