import { useState } from 'react'
import { useInstalar } from '../hooks/useInstalar'
import { AjustesNotificaciones } from './Notificaciones'
import BotonGoogle from './BotonGoogle'
import { setVibrarActivado, vibracionSoportada, vibrar, vibrarActivado } from '../services/aviso'

function AjusteVibracion() {
  const [activo, setActivo] = useState(vibrarActivado)
  const soportada = vibracionSoportada()
  const cambiar = (v) => {
    setActivo(v)
    setVibrarActivado(v)
  }
  return (
    <>
      <p className="mb-2 text-[16px]">
        Cuando llega una alerta oficial nueva o sube de nivel, la app muestra un aviso a pantalla completa
        {soportada ? ' y hace vibrar el teléfono.' : '.'}
      </p>
      {soportada ? (
        <>
          <Opciones
            nombre="Vibrar con alertas"
            valor={activo}
            onCambiar={cambiar}
            opciones={[
              { valor: true, etiqueta: 'Vibrar' },
              { valor: false, etiqueta: 'No vibrar' },
            ]}
          />
          <button
            type="button"
            onClick={() => vibrar('roja')}
            disabled={!activo}
            className="mt-2 min-h-12 w-full rounded-xl bg-superficie-2 text-[16px] font-bold disabled:opacity-50"
          >
            Probar vibración
          </button>
        </>
      ) : (
        <p className="text-[15px] text-texto-2">Este teléfono o navegador no permite que una página web lo haga vibrar (por ejemplo, el iPhone).</p>
      )}
      <p className="mt-2 text-[14px] text-texto-2">
        Con la app cerrada, el aviso llega como notificación (actívalas arriba).
      </p>
    </>
  )
}

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

function TuCuenta({ cuenta }) {
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState(null)
  if (cuenta.estado === 'sin-sesion')
    return (
      <>
        <p className="mb-3 text-[16px]">Entra con Google para chatear con tus vecinos, reportar y recibir avisos. El clima y las alertas no lo necesitan.</p>
        <BotonGoogle clientId={cuenta.clientId} />
      </>
    )
  const u = cuenta.usuario
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {u.foto ? (
          <img src={u.foto} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full bg-superficie-2 object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-senal font-bold text-sobre-senal">{u.nombre[0]}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold">{u.nombre}</p>
          <p className="text-[14px] text-texto-2">Así te ven los demás en el chat.</p>
        </div>
      </div>
      <button type="button" onClick={cuenta.salir} className="min-h-12 w-full rounded-xl bg-superficie-2 text-[16px] font-bold">
        Cerrar sesión
      </button>
      {!confirmar ? (
        <button type="button" onClick={() => setConfirmar(true)} className="min-h-11 w-full text-[15px] font-bold text-peligro underline">
          Borrar mi cuenta
        </button>
      ) : (
        <div className="rounded-xl border-2 border-peligro p-3">
          <p className="text-[15px]">Se borrarán tu cuenta y todos tus mensajes del chat. No se puede deshacer.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await cuenta.borrar()
                } catch (e) {
                  setError(e.message)
                }
              }}
              className="min-h-11 flex-1 rounded-lg bg-peligro font-bold text-white"
            >
              Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmar(false)} className="min-h-11 flex-1 rounded-lg bg-superficie-2 font-bold">
              Cancelar
            </button>
          </div>
          {error && <p className="mt-2 text-[14px] font-bold text-peligro">{error}</p>}
        </div>
      )}
    </div>
  )
}

export default function Ajustes({ tema, setTema, ahorro, notif, comuna, cuenta }) {
  const { instalada, puedeInstalar, esIOS, instalar } = useInstalar()

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="sr-only">Ajustes</h2>
      {cuenta && (cuenta.estado === 'con-sesion' || cuenta.estado === 'sin-sesion') && (
        <Seccion titulo="Tu cuenta">
          <TuCuenta cuenta={cuenta} />
        </Seccion>
      )}
      <Seccion titulo="Pantalla">
        <Opciones
          nombre="Tema"
          valor={tema}
          onCambiar={setTema}
          opciones={[
            { valor: 'auto', etiqueta: 'Automático' },
            { valor: 'claro', etiqueta: 'Claro' },
            { valor: 'oscuro', etiqueta: 'Oscuro' },
          ]}
        />
        <p className="mt-2 text-[15px] text-texto-2">
          Automático sigue la configuración de tu teléfono. El claro se lee mejor a pleno sol; el oscuro gasta menos batería.
        </p>
      </Seccion>

      <Seccion titulo="Notificaciones de alertas">
        <AjustesNotificaciones notif={notif} comuna={comuna} />
      </Seccion>

      <Seccion titulo="Aviso con la app abierta">
        <AjusteVibracion />
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
