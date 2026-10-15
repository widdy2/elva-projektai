import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/** Globalus klaidų gaudytojas — viena render klaida neužlauš viso app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Įvyko nenumatyta klaida</h2>
        <p className="text-sm text-gray-600 mb-4 max-w-md text-center">
          {this.state.error?.message || 'Nežinoma klaida'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Perkrauti puslapį
        </button>
      </div>
    )
  }
}
