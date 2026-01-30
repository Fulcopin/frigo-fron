import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';
import './TemplateVersionHistory.css';

function TemplateVersionHistory({ templateId, templateName, onClose }) {
  const [versionHistory, setVersionHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState({ old: null, new: null });
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('history');

  // Resetear estados cuando cambia el template
  useEffect(() => { 
    setCompareVersions({ old: null, new: null });
    setComparisonResult(null);
    setCompareMode(false);
    setActiveTab('history');
    loadVersionHistory(); 
  }, [templateId]);

  const normalizeArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.$values && Array.isArray(data.$values)) return data.$values;
    return [];
  };

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/history`);
      if (!response.ok) throw new Error('Error al obtener el historial');
      const data = await response.json();
      setVersionHistory(normalizeArray(data));
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionDetail = async (version) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/${version}`);
      if (!response.ok) throw new Error('Error al cargar detalles');
      const data = await response.json();
      
      setVersionDetail(data);
      setSelectedVersion(version);
      setActiveTab('detail');
      setError(null);
    } catch (err) {
      setError('Error al cargar los detalles técnicos');
    } finally {
      setLoading(false);
    }
  };

  const compareVersionsAction = async () => {
    if (!compareVersions.old || !compareVersions.new) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/compare?oldVersion=${compareVersions.old}&newVersion=${compareVersions.new}`);
      const data = await response.json();
      
      // Normalización profunda del resultado de comparación
      if (data.detailedChanges) {
        data.detailedChanges.headerFieldsChanges = normalizeArray(data.detailedChanges.headerFieldsChanges);
        data.detailedChanges.bodyElementsChanges = normalizeArray(data.detailedChanges.bodyElementsChanges);
        data.detailedChanges.metadataChanges = normalizeArray(data.detailedChanges.metadataChanges);
        data.detailedChanges.signaturesChanges = normalizeArray(data.detailedChanges.signaturesChanges);
      }
      setComparisonResult(data);
      setActiveTab('compare');
    } catch (err) {
      alert('Error en la comparación');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ds) => ds ? new Date(ds).toLocaleString('es-ES') : 'N/A';

  const safeJsonParse = (data) => {
    if (!data) return [];
    // Si ya es un objeto (o array), normalizar directamente
    if (typeof data === 'object') return normalizeArray(data);
    try {
      // Si es un string, intentar parsear
      const parsed = JSON.parse(data);
      return normalizeArray(parsed);
    } catch (e) {
      console.error("Error parseando JSON técnico:", e);
      return [];
    }
  };

  const renderHistoryTab = () => (
    <div className="version-history-tab">
      <div className="tab-header">
        <h3>📚 Línea de Tiempo</h3>
        <button className={`btn-secondary-small ${compareMode ? 'active' : ''}`} onClick={() => setCompareMode(!compareMode)}>
          {compareMode ? '❌ Cancelar Comparación' : '🔍 Modo Comparar'}
        </button>
      </div>

      {compareMode && (
        <div className="compare-mode-banner">
          <div className="compare-selections">
            <span>Antigua: <strong className="v-num">{compareVersions.old || '---'}</strong></span>
            <span>Nueva: <strong className="v-num">{compareVersions.new || '---'}</strong></span>
            <button 
              className="btn-primary-small" 
              disabled={!compareVersions.old || !compareVersions.new}
              onClick={compareVersionsAction}
            >
              ¡Comparar!
            </button>
          </div>
          <p className="hint">Selecciona dos versiones de la lista inferior</p>
        </div>
      )}

      <div className="version-timeline">
        {versionHistory.length === 0 && <p className="empty-msg">No hay historial disponible.</p>}
        {versionHistory.map((v) => (
          <div key={v.version} className={`version-item ${v.isCurrentVersion ? 'current-version' : ''}`}>
            <div className="version-badge">{v.isCurrentVersion ? '✅' : '📜'}</div>
            <div className="version-content">
              <h4>v{v.version} {v.isCurrentVersion && <span className="label-actual">ACTUAL</span>}</h4>
              <p>Formularios: {v.formCount} | Creada: {formatDate(v.versionCreatedAt)}</p>
              <div className="version-actions">
                {compareMode ? (
                  <div className="btn-group-compare">
                    <button 
                       className={compareVersions.old === v.version ? 'selected' : ''}
                       onClick={() => setCompareVersions({...compareVersions, old: v.version})}
                    >Antigua</button>
                    <button 
                       className={compareVersions.new === v.version ? 'selected' : ''}
                       onClick={() => setCompareVersions({...compareVersions, new: v.version})}
                    >Nueva</button>
                  </div>
                ) : (
                  <button className="btn-secondary-small" onClick={() => loadVersionDetail(v.version)}>Ver Estructura</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailTab = () => {
    if (!versionDetail) return null;

    return (
      <div className="version-detail-tab">
        <button className="btn-back" onClick={() => setActiveTab('history')}>← Volver al historial</button>
        <div className="detail-content">
          <header className="detail-header">
             <h3>Estructura Técnica - v{selectedVersion}</h3>
             <span className="date-tag">{formatDate(versionDetail.createdAt)}</span>
          </header>
          
          <div className="detail-section">
            <h4>📝 Campos de Encabezado</h4>
            <div className="fields-grid">
              {safeJsonParse(versionDetail.headerFields).map((f, i) => (
                <div key={i} className="field-card">
                  <span className="field-label">{f.label || 'Sin etiqueta'}</span>
                  <span className="field-type">{f.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h4>📊 Cuerpo y Tablas</h4>
            {safeJsonParse(versionDetail.bodyElements).map((el, i) => (
              <div key={i} className="table-summary">
                <strong>{el.title || 'Sección'}</strong>
                <div className="mini-tags">
                  {normalizeArray(el.columns || el.fields).map((c, j) => (
                    <span key={j} className="mini-tag">{c.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="detail-section">
            <h4>✍️ Firmas</h4>
            <div className="mini-tags">
              {safeJsonParse(versionDetail.firmas).map((f, i) => (
                <span key={i} className="mini-tag blue">{f.puesto}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompareTab = () => {
    if (!comparisonResult) return null;
    const { detailedChanges } = comparisonResult;

    return (
      <div className="version-compare-tab">
        <button className="btn-back" onClick={() => setActiveTab('history')}>← Volver</button>
        <div className="comparison-content">
          <h3>Comparativa: v{comparisonResult.oldVersion} vs v{comparisonResult.newVersion}</h3>
          
          <div className="comparison-scroll-area">
            {detailedChanges.metadataChanges.length > 0 && (
               <div className="change-group">
                 <h5>Cambios Generales</h5>
                 {detailedChanges.metadataChanges.map((m, i) => <div key={i} className="change-item modified">✏️ {m}</div>)}
               </div>
            )}

            <div className="change-group">
              <h5>Cambios en Estructura</h5>
              {[
                ...detailedChanges.headerFieldsChanges, 
                ...detailedChanges.bodyElementsChanges, 
                ...detailedChanges.signaturesChanges
              ].map((c, i) => (
                <div key={i} className={`change-item ${c.changeType.toLowerCase()}`}>
                  <span className="change-icon">
                    {c.changeType === 'Added' ? '➕' : c.changeType === 'Removed' ? '🗑️' : '✏️'}
                  </span>
                  {c.description}
                </div>
              ))}
              {detailedChanges.headerFieldsChanges.length === 0 && 
               detailedChanges.bodyElementsChanges.length === 0 && <p className="no-changes">No se detectaron cambios estructurales.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="version-history-modal-overlay">
      <div className="version-history-modal">
        <div className="modal-header">
          <div>
            <h2>Historial de Versiones</h2>
            <p className="subtitle">{templateName}</p>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {error && <div className="error-banner">⚠️ {error}</div>}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Procesando datos técnicos...</p>
            </div>
          ) : (
            <>
              {activeTab === 'history' && renderHistoryTab()}
              {activeTab === 'detail' && renderDetailTab()}
              {activeTab === 'compare' && renderCompareTab()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateVersionHistory;