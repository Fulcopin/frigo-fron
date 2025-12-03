import { useState, useEffect } from "react"
import "./FormHeader.css"
import logoUrl from "../assets/logo.png"; 

export default function FormHeader({ title, code, version, date }) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Empezar colapsado para ahorrar espacio
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-ocultar/mostrar al hacer scroll (desactivado - solo control manual)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Mantener colapsado si el usuario lo colapsó manualmente
      // Solo auto-expandir si está al inicio de la página
      if (currentScrollY < 10 && isCollapsed) {
        // No hacer nada, dejar que el usuario controle manualmente
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isCollapsed]);

  return (
    <div className={`form-header ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Botón grande y visible para toggle */}
      <button 
        className="header-toggle-btn-main" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Mostrar información de Frigolab' : 'Ocultar información de Frigolab'}
      >
        <span className="toggle-icon">{isCollapsed ? '▼' : '▲'}</span>
        <span className="toggle-text">{isCollapsed ? 'Mostrar Encabezado' : 'Ocultar Encabezado'}</span>
      </button>

      <div className="form-header-content">
        <div className="form-header-left">
          <div className="company-logo">
            <div className="logo-text">Frigolab "San Mateo"</div>
            <div className="logo-subtitle">Exportadores de mariscos frescos y congelados</div>
            
            <img 
              src={logoUrl} 
              className="logo-icon" 
              alt="Logo de Frigolab San Mateo" 
            />
            <div className="company-contact">
              <div>📍 Avenida San Vía a Rocafuerte - Parque del Atún</div>
              <div>📞 593-5-3701161 ✉️ frigolab@frigolab.com.ec</div>
            </div>
          </div>
        </div>

        <div className="form-header-center">
          <h1 className="form-title">{title}</h1>
        </div>

        <div className="form-header-right">
          <div className="form-metadata">
            <div className="metadata-row">
              <span className="metadata-label">Código:</span>
              <span className="metadata-value">{code}</span>
            </div>
            <div className="metadata-row">
              <span className="metadata-label">Versión:</span>
              <span className="metadata-value">{version}</span>
            </div>
            <div className="metadata-row">
              <span className="metadata-label">Fecha:</span>
              <span className="metadata-value">{date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Versión compacta cuando está colapsado */}
      <div className="header-collapsed-info">
        <div className="collapsed-left">
          <span className="collapsed-icon">📋</span>
          <span className="collapsed-title">{title}</span>
        </div>
        <div className="collapsed-right">
          <span className="collapsed-meta">{code} - v{version}</span>
          <span className="collapsed-date">{date}</span>
        </div>
      </div>
    </div>
  )
}
