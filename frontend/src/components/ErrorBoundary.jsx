import { Component } from "react";

// Sin esto, cualquier error de render en cualquier parte de la app desmonta TODO el
// árbol de React y deja la pantalla completamente en blanco, sin ninguna pista de qué
// pasó. Con esto, al menos se ve un mensaje y el detalle técnico para poder diagnosticar.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de render capturado por ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <h1 className="text-lg font-bold text-aha-navy">Algo salió mal en esta pantalla</h1>
          <p className="mt-2 text-sm text-slate-500">
            No se pudo mostrar esta vista. Puedes intentar recargar la página; si el problema
            sigue, este detalle técnico ayuda a diagnosticarlo:
          </p>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-left text-xs text-slate-600">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
