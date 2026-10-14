import { Component } from 'react'

/** Si una parte de la app falla (por ejemplo, el mapa), el resto sigue funcionando. */
export default class Resguardo extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error) {
    console.error('Resguardo:', error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-[17px] font-bold">{this.props.mensaje ?? 'Esta sección tuvo un problema.'}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 min-h-12 rounded-full bg-senal px-5 text-[16px] font-bold text-sobre-senal"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }
}
