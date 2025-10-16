import "./FormHeader.css"
import logoUrl from "../assets/logo.png"; 
export default function FormHeader({ title, code, version, date }) {
  return (
    <div className="form-header">
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
  )
}
