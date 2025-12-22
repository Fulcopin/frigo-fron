import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';
import './TemplateVersionHistoryEnhanced.css';

function TemplateVersionHistoryEnhanced({ templateId, templateName, onClose, variant = 'modal' }) {
  const [versionHistory, setVersionHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState({ old: null, new: null });
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [showStats, setShowStats] = useState(true);

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

  const calculateStats = () => {
    const totalForms = versionHistory.reduce((sum, v) => sum + v.formCount, 0);
    const totalVersions = versionHistory.length;
    const currentVersion = versionHistory.find(v => v.isCurrentVersion);
    
    return {
      totalForms,
      totalVersions,
      currentVersion: currentVersion?.version || 'N/A',
      oldestVersion: versionHistory[versionHistory.length - 1]?.version || 'N/A',
      distribution: versionHistory.map(v => ({
        version: v.version,
        percentage: totalForms > 0 ? ((v.formCount / totalForms) * 100).toFixed(1) : 0,
        count: v.formCount
      }))
    };
  };

  const stats = showStats ? calculateStats() : null;

  const renderStatsPanel = () => (
    <div className="stats-panel">
      <div className="stats-header">
        <h4>📊 Estadísticas</h4>
        <button 
          className="toggle-stats-btn"
          onClick={() => setShowStats(!showStats)}
        >
          {showStats ? '▼' : '▶'}
        </button>
      </div>
      
      {showStats && stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-value">{stats.totalVersions}</div>
            <div className="stat-label">Versiones</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📄</div>
            <div className="stat-value">{stats.totalForms}</div>
            <div className="stat-label">Formularios</div>
          </div>
          
          <div className="stat-card highlight">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.currentVersion}</div>
            <div className="stat-label">Versión Actual</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📜</div>
            <div className="stat-value">{stats.oldestVersion}</div>
            <div className="stat-label">Primera Versión</div>
          </div>
        </div>
      )}
      
      {showStats && stats && (
        <div className="distribution-chart">
          <h5>Distribución de Formularios</h5>
          {stats.distribution.map((item, index) => (
            <div key={item.version} className="distribution-bar">
              <div className="distribution-label">
                <span className="version-tag">{item.version}</span>
                <span className="distribution-count">{item.count} forms</span>
              </div>
              <div className="distribution-track">
                <div 
                  className={`distribution-fill ${index === 0 ? 'current' : 'historical'}`}
                  style={{ width: `${item.percentage}%` }}
                >
                  <span className="percentage-label">{item.percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="version-history-tab enhanced">
      <div className="tab-header">
        <div className="header-left">
          <h3>📚 Historial de Versiones</h3>
          <span className="version-count">{versionHistory.length} versiones</span>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-action ${compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(!compareMode)}
          >
            {compareMode ? '❌ Cancelar Comparación' : '🔍 Comparar Versiones'}
          </button>
        </div>
      </div>

      {renderStatsPanel()}

      {compareMode && (
        <div className="compare-mode-banner">
          <div className="banner-content">
            <div className="banner-icon">⚖️</div>
            <div className="banner-text">
              <strong>Modo Comparación Activo</strong>
              <p>Selecciona dos versiones para comparar sus diferencias</p>
            </div>
          </div>
          <div className="compare-selections">
            <div className="selection-item old">
              <label>Versión Antigua</label>
              <div className="selection-value">{compareVersions.old || 'Ninguna'}</div>
            </div>
            <div className="selection-arrow">→</div>
            <div className="selection-item new">
              <label>Versión Nueva</label>
              <div className="selection-value">{compareVersions.new || 'Ninguna'}</div>
            </div>
            {compareVersions.old && compareVersions.new && (
              <button className="btn-compare-execute" onClick={compareVersionsAction}>
                ▶️ Comparar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="version-timeline enhanced">
        {versionHistory.map((versionItem, index) => (
          <div 
            key={versionItem.version} 
            className={`version-item ${versionItem.isCurrentVersion ? 'current-version' : 'historical-version'} ${compareMode ? 'compare-mode' : ''}`}
          >
            <div className="version-badge">
              {versionItem.isCurrentVersion ? '✅' : '📜'}
            </div>
            
            <div className="version-content">
              <div className="version-header">
                <div className="version-title-group">
                  <h4>Versión {versionItem.version}</h4>
                  {versionItem.isCurrentVersion && <span className="current-tag">ACTUAL</span>}
                </div>
                <div className="version-stats-inline">
                  <span className="stat-badge">
                    📊 {versionItem.formCount} {versionItem.formCount === 1 ? 'formulario' : 'formularios'}
                  </span>
                </div>
              </div>

              <div className="version-dates">
                <div className="date-item">
                  <span className="date-icon">🕐</span>
                  <span className="date-label">Primer uso:</span>
                  <span className="date-value">{formatDate(versionItem.firstUsedDate)}</span>
                </div>
                {versionItem.lastUsedDate && versionItem.lastUsedDate !== versionItem.firstUsedDate && (
                  <div className="date-item">
                    <span className="date-icon">🕑</span>
                    <span className="date-label">Último uso:</span>
                    <span className="date-value">{formatDate(versionItem.lastUsedDate)}</span>
                  </div>
                )}
              </div>

              <div className="version-actions">
                {compareMode ? (
                  <>
                    <button
                      className={`btn-select ${compareVersions.old === versionItem.version ? 'selected old' : ''}`}
                      onClick={() => setCompareVersions({ ...compareVersions, old: versionItem.version })}
                    >
                      {compareVersions.old === versionItem.version ? '✓ Antigua' : 'Versión Antigua'}
                    </button>
                    <button
                      className={`btn-select ${compareVersions.new === versionItem.version ? 'selected new' : ''}`}
                      onClick={() => setCompareVersions({ ...compareVersions, new: versionItem.version })}
                    >
                      {compareVersions.new === versionItem.version ? '✓ Nueva' : 'Versión Nueva'}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-view-details"
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
          <div className="empty-icon">📭</div>
          <p>No hay versiones registradas para esta plantilla</p>
          <small>Los formularios creados registrarán las versiones automáticamente</small>
        </div>
      )}
    </div>
  );

  const renderDetailTab = () => (
    <div className="version-detail-tab enhanced">
      <div className="tab-header">
        <button className="btn-back" onClick={() => setActiveTab('history')}>
          ← Volver al Historial
        </button>
        <h3>📄 Detalles de Versión {selectedVersion}</h3>
      </div>

      {versionDetail && (
        <div className="detail-content">
          <div className="detail-section">
            <h4>📋 Información General</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Código:</strong>
                <span className="code-badge">{versionDetail.codigo}</span>
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
            <h4>📝 Descripción del Formulario</h4>
            <div className="detail-text">
              <p><strong>Objetivo:</strong> {versionDetail.objetivo || 'No especificado'}</p>
              <p><strong>Proceso:</strong> {versionDetail.proceso || 'No especificado'}</p>
            </div>
          </div>

          <div className="detail-section">
            <h4>🔧 Estructura Técnica</h4>
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
              📄 Formularios Asociados 
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
    <div className="version-compare-tab enhanced">
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
              🔸 Cambios Detectados 
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

  const containerClass = variant === 'drawer' 
    ? 'version-history-drawer'
    : 'version-history-modal-overlay';

  return (
    <div className={containerClass}>
      <div className={`version-history-panel ${variant}`}>
        <div className="modal-header enhanced">
          <div className="header-content">
            <h2>📚 Historial de Versiones</h2>
            <p className="template-name">{templateName}</p>
          </div>
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

export default TemplateVersionHistoryEnhanced;
