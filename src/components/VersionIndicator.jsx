import React from 'react';
import './VersionIndicator.css';
import { formatSnapshotDate, getVersionMessage } from '../utils/filledFormsUtils';

/**
 * Componente para mostrar indicador de versión de plantilla
 * Muestra si un formulario usa una versión histórica o la actual
 */
const VersionIndicator = ({ versionInfo, templateInfo }) => {
  if (!versionInfo) return null;

  const { templateVersion, isHistorical, createdAt } = versionInfo;
  
  // Si no hay versión, no mostrar nada
  if (!templateVersion) return null;

  // Generar mensaje explicativo
  const message = getVersionMessage(versionInfo);
  const formattedDate = formatSnapshotDate(createdAt);

  return (
    <div className="version-indicator-container">
      {isHistorical ? (
        <div className="version-badge historic">
          <div className="badge-header">
            <span className="badge-icon">📜</span>
            <span className="badge-title">Versión Histórica</span>
            <span className="badge-version">{templateVersion}</span>
          </div>
          <div className="badge-message">
            {message}
          </div>
          <div className="badge-footer">
            <span className="info-label">Creado:</span>
            <span className="info-value">{formattedDate}</span>
          </div>
        </div>
      ) : (
        <div className="version-badge current">
          <div className="badge-header">
            <span className="badge-icon">✅</span>
            <span className="badge-title">Versión Actual</span>
            <span className="badge-version">{templateVersion}</span>
          </div>
          <div className="badge-message">
            Este formulario usa la versión actual de la plantilla.
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Componente compacto para mostrar solo la versión (sin mensaje largo)
 */
export const CompactVersionBadge = ({ versionInfo }) => {
  if (!versionInfo || !versionInfo.templateVersion) return null;

  const { templateVersion, isHistorical } = versionInfo;

  return (
    <span className={`compact-version-badge ${isHistorical ? 'historic' : 'current'}`}>
      {isHistorical ? '📜' : '✅'} v{templateVersion}
    </span>
  );
};

/**
 * Componente inline para mostrar versión en headers
 */
export const InlineVersionBadge = ({ versionInfo }) => {
  if (!versionInfo || !versionInfo.templateVersion) return null;

  const { templateVersion, isHistorical } = versionInfo;

  return (
    <span className={`inline-version-badge ${isHistorical ? 'historic' : 'current'}`}>
      {isHistorical ? (
        <>
          <span className="version-icon">📜</span>
          <span className="version-text">Versión Histórica: {templateVersion}</span>
        </>
      ) : (
        <>
          <span className="version-icon">✅</span>
          <span className="version-text">v{templateVersion}</span>
        </>
      )}
    </span>
  );
};

export default VersionIndicator;
