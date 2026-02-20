import React from 'react';

/**
 * Error Boundary para capturar errores y evitar pantalla blanca
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Actualizar estado para mostrar UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error
    console.error('❌ Error capturado por ErrorBoundary:', error);
    console.error('📋 Información del error:', errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // UI de fallback cuando hay error
      return (
        <div style={{
          padding: '40px',
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginTop: '50px'
        }}>
          <h1 style={{ 
            color: '#e74a3b', 
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            ⚠️ Oops!
          </h1>
          
          <h2 style={{ 
            color: '#333',
            fontSize: '24px',
            marginBottom: '15px'
          }}>
            Algo salió mal
          </h2>
          
          <p style={{ 
            color: '#666',
            fontSize: '16px',
            marginBottom: '30px',
            lineHeight: '1.6'
          }}>
            El formulario encontró un error inesperado.<br/>
            No te preocupes, tus datos están guardados automáticamente.
          </p>

          <div style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            marginBottom: '30px'
          }}>
            <button
              onClick={() => {
                // Recargar la página
                window.location.reload();
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4e73df',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2e59d9'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#4e73df'}
            >
              🔄 Recargar Página
            </button>

            <button
              onClick={() => {
                // Volver al inicio
                window.location.href = '/';
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#858796',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#6c757d'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#858796'}
            >
              🏠 Volver al Inicio
            </button>
          </div>

          {/* Detalles del error (solo en desarrollo) */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginTop: '30px',
              textAlign: 'left',
              backgroundColor: '#f8f9fc',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e3e6f0'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: '#5a5c69',
                marginBottom: '10px'
              }}>
                🔍 Ver detalles técnicos
              </summary>
              
              <div style={{
                backgroundColor: '#fff',
                padding: '15px',
                borderRadius: '6px',
                border: '1px solid #dddfeb',
                marginTop: '10px'
              }}>
                <p style={{ 
                  color: '#e74a3b',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}>
                  Error:
                </p>
                <pre style={{
                  backgroundColor: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px',
                  color: '#333'
                }}>
                  {this.state.error.toString()}
                </pre>

                {this.state.errorInfo && (
                  <>
                    <p style={{ 
                      color: '#e74a3b',
                      fontWeight: '600',
                      marginTop: '15px',
                      marginBottom: '10px'
                    }}>
                      Stack Trace:
                    </p>
                    <pre style={{
                      backgroundColor: '#f5f5f5',
                      padding: '10px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '11px',
                      color: '#666',
                      maxHeight: '300px'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}

          <p style={{
            marginTop: '30px',
            color: '#858796',
            fontSize: '14px'
          }}>
            Si el problema persiste, contacta al administrador del sistema.
          </p>
        </div>
      );
    }

    // Sin error, renderizar children normalmente
    return this.props.children;
  }
}

export default ErrorBoundary;
