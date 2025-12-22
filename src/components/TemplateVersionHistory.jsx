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
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'detail', 'compare'

  useEffect(() => {
    loadVersionHistory();
  }, [templateId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/history`);
      
      if (!response.ok) {
        throw new Error('Error al cargar el historial de versiones');
      }

      const data = await response.json();
      const historyArray = Array.isArray(data) ? data : data.$values || [];
      setVersionHistory(historyArray);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading version history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionDetail = async (version) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/${version}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar detalles de la versión');
      }

      const data = await response.json();
      setVersionDetail(data);
      setSelectedVersion(version);
      setActiveTab('detail');
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading version detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const compareVersionsAction = async () => {
    if (!compareVersions.old || !compareVersions.new) {
      alert('Por favor selecciona dos versiones para comparar');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/Templates/${templateId}/versions/compare?oldVersion=${compareVersions.old}&newVersion=${compareVersions.new}`
      );
      
      if (!response.ok) {
        throw new Error('Error al comparar versiones');
      }

      const data = await response.json();
      setComparisonResult(data);
      setActiveTab('compare');
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error comparing versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderHistoryTab = () => (
    <div className="version-history-tab">
      <div className="tab-header">
        <h3>📚 Historial de Versiones</h3>
        <button 
          className="btn-secondary-small"
          onClick={() => setCompareMode(!compareMode)}
        >
          {compareMode ? '❌ Cancelar Comparación' : '🔍 Comparar Versiones'}
        </button>
      </div>

      {compareMode && (
        <div className="compare-mode-banner">
          <p>
            <strong>Modo Comparación:</strong> Selecciona dos versiones para comparar
          </p>
          <div className="compare-selections">
            <span>
              Versión Antigua: 
              <strong className={compareVersions.old ? 'version-selected' : 'version-empty'}>
                {compareVersions.old || 'Ninguna'}
              </strong>
            </span>
            <span>
              Versión Nueva: 
              <strong className={compareVersions.new ? 'version-selected' : 'version-empty'}>
                {compareVersions.new || 'Ninguna'}
              </strong>
            </span>
            {compareVersions.old && compareVersions.new && (
              <button className="btn-primary-small" onClick={compareVersionsAction}>
                ▶️ Comparar Ahora
              </button>
            )}
          </div>
          {(!compareVersions.old || !compareVersions.new) && (
            <div className="compare-hint">
              💡 Haz clic en "Versión Antigua" en una versión, luego en "Versión Nueva" en otra
            </div>
          )}
        </div>
      )}

      <div className="version-timeline">
        {versionHistory.map((versionItem, index) => (
          <div 
            key={versionItem.version} 
            className={`version-item ${versionItem.isCurrentVersion ? 'current-version' : 'historical-version'}`}
          >
            <div className="version-badge">
              {versionItem.isCurrentVersion ? '✅' : '📜'}
            </div>
            
            <div className="version-content">
              <div className="version-header">
                <h4>
                  Versión {versionItem.version}
                  {versionItem.isCurrentVersion && <span className="current-tag">ACTUAL</span>}
                </h4>
                <span className="version-form-count">
                  {versionItem.formCount} {versionItem.formCount === 1 ? 'formulario' : 'formularios'}
                </span>
              </div>

              <div className="version-dates">
                <p>
                  <strong>Primer uso:</strong> {formatDate(versionItem.firstUsedDate)}
                </p>
                {versionItem.lastUsedDate && versionItem.lastUsedDate !== versionItem.firstUsedDate && (
                  <p>
                    <strong>Último uso:</strong> {formatDate(versionItem.lastUsedDate)}
                  </p>
                )}
              </div>

              <div className="version-actions">
                {compareMode ? (
                  <>
                    <button
                      className={`btn-compare ${compareVersions.old === versionItem.version ? 'selected-old' : ''}`}
                      onClick={() => setCompareVersions({ ...compareVersions, old: versionItem.version })}
                    >
                      {compareVersions.old === versionItem.version ? '✓ Seleccionada (Antigua)' : 'Versión Antigua'}
                    </button>
                    <button
                      className={`btn-compare ${compareVersions.new === versionItem.version ? 'selected-new' : ''}`}
                      onClick={() => setCompareVersions({ ...compareVersions, new: versionItem.version })}
                    >
                      {compareVersions.new === versionItem.version ? '✓ Seleccionada (Nueva)' : 'Versión Nueva'}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-secondary-small"
                    onClick={() => loadVersionDetail(versionItem.version)}
                  >
                    👁️ Ver Detalles
                  </button>
                )}
              </div>
            </div>

            {index < versionHistory.length - 1 && <div className="timeline-connector"></div>}
          </div>
        ))}
      </div>

      {versionHistory.length === 0 && !loading && (
        <div className="empty-state">
          <p>📭 No hay versiones registradas para esta plantilla</p>
        </div>
      )}
    </div>
  );

  const renderDetailTab = () => (
    <div className="version-detail-tab">
      <div className="tab-header">
        <button className="btn-back" onClick={() => setActiveTab('history')}>
          ← Volver al Historial
        </button>
        <h3>📄 Detalles de Versión {selectedVersion}</h3>
      </div>

      {versionDetail && (
        <div className="detail-content">
          <div className="detail-section">
            <h4>Información General</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Código:</strong>
                <span>{versionDetail.codigo}</span>
              </div>
              <div className="detail-item">
                <strong>Nombre:</strong>
                <span>{versionDetail.nombre}</span>
              </div>
              <div className="detail-item">
                <strong>Versión:</strong>
                <span className="version-badge-inline">{versionDetail.version}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>Descripción del Formulario</h4>
            <div className="detail-text">
              <p><strong>Objetivo:</strong> {versionDetail.objetivo || 'No especificado'}</p>
              <p><strong>Proceso:</strong> {versionDetail.proceso || 'No especificado'}</p>
            </div>
          </div>

          <div className="detail-section">
            <h4>Estructura Técnica</h4>
            <div className="structure-info">
              <div className="structure-item">
                <strong>Header Fields:</strong>
                <span className={versionDetail.headerFields ? 'available' : 'not-available'}>
                  {versionDetail.headerFields ? '✅ Disponible' : '❌ No disponible'}
                </span>
              </div>
              <div className="structure-item">
                <strong>Body Elements:</strong>
                <span className={versionDetail.bodyElements ? 'available' : 'not-available'}>
                  {versionDetail.bodyElements ? '✅ Disponible' : '❌ No disponible'}
                </span>
              </div>
              <div className="structure-item">
                <strong>Firmas:</strong>
                <span className={versionDetail.firmas ? 'available' : 'not-available'}>
                  {versionDetail.firmas ? '✅ Disponible' : '❌ No disponible'}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>
              Formularios Asociados 
              <span className="forms-count-badge">{versionDetail.associatedForms?.length || 0}</span>
            </h4>
            {versionDetail.associatedForms && versionDetail.associatedForms.length > 0 ? (
              <div className="associated-forms-list">
                {versionDetail.associatedForms.map(form => (
                  <div key={form.formID} className="form-item">
                    <div className="form-header">
                      <span className="form-id">#{form.formID}</span>
                      <span className="form-date">{formatDate(form.createdAt)}</span>
                    </div>
                    {form.headerData && (
                      <div className="form-preview">
                        <small>{form.headerData.substring(0, 100)}...</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-forms">No hay formularios asociados a esta versión</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompareTab = () => (
    <div className="version-compare-tab">
      <div className="tab-header">
        <button className="btn-back" onClick={() => setActiveTab('history')}>
          ← Volver al Historial
        </button>
        <h3>🔍 Comparación de Versiones</h3>
      </div>

      {comparisonResult && (
        <div className="comparison-content">
          <div className="comparison-header">
            <div className="comparison-version old-version">
              <span className="version-label">Versión Antigua</span>
              <span className="version-number">{comparisonResult.oldVersion}</span>
            </div>
            <div className="comparison-arrow">→</div>
            <div className="comparison-version new-version">
              <span className="version-label">Versión Nueva</span>
              <span className="version-number">{comparisonResult.newVersion}</span>
            </div>
          </div>

          <div className="comparison-date">
            <small>Comparación realizada: {formatDate(comparisonResult.comparisonDate)}</small>
          </div>

          <div className="changes-section">
            <h4>
              Cambios Detectados 
              <span className="changes-count-badge">{comparisonResult.changes?.length || 0}</span>
            </h4>
            
            {comparisonResult.changes && comparisonResult.changes.length > 0 ? (
              <ul className="changes-list">
                {comparisonResult.changes.map((change, index) => (
                  <li key={index} className="change-item">
                    <span className="change-icon">🔸</span>
                    <span className="change-text">{change}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-changes">✅ No se detectaron cambios entre estas versiones</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="version-history-modal-overlay">
      <div className="version-history-modal">
        <div className="modal-header">
          <h2>📚 Historial de Versiones</h2>
          <p className="template-name">{templateName}</p>
          <button className="close-button" onClick={onClose}>✖️</button>
        </div>

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando información...</p>
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
