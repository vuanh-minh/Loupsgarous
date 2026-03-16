import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: '540px', width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>
              🐺💥
            </span>
            <h1
              style={{
                fontFamily: '"Cinzel", serif',
                color: '#d4a843',
                fontSize: '1.3rem',
                marginBottom: '0.75rem',
              }}
            >
              Le village a rencontre une erreur
            </h1>
            <p style={{ color: '#6b7b9b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Une erreur inattendue s'est produite. Vos donnees sont sauvegardees.
            </p>
            <details
              style={{
                textAlign: 'left',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(212,168,67,0.2)',
              }}
            >
              <summary
                style={{
                  color: '#d4a843',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                Details techniques
              </summary>
              <pre
                style={{
                  color: '#ef4444',
                  fontSize: '0.65rem',
                  marginTop: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {error?.message}
                {'\n\n'}
                {error?.stack}
                {errorInfo?.componentStack && (
                  <>
                    {'\n\nComponent Stack:'}
                    {errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #b8860b, #d4a843)',
                color: '#0a0e1a',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 2rem',
                cursor: 'pointer',
              }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
