import { useState, useEffect } from 'react';
import authService from '../services/authService';
import { fetchUsers, findUserByName } from '../services/userService';
import { Link } from 'react-router-dom';
import { API_BASE_URL, API_EXTERNAL_BASE_URL } from '../apiConfig';
import './AlertManagement.css';

// 🔧 Configuración por defecto guardada en localStorage hasta que el backend esté listo
const ALERT_CONFIG_KEY = 'frigolab_alert_config';
const ALERT_HISTORY_KEY = 'frigolab_alert_history';

const DEFAULT_CONFIG = {
  enableMissingFormAlerts: true,
  enableSignatureAlerts: true,
  dailyCheckTime: '18:00',
  signatureAlertDelay: 24,
  missingFormRecipients: [],
  signatureRecipients: [],
  senderEmail: '',
  senderPassword: '',
  senderName: 'Frigolab Alertas',
  smtpServer: 'smtp.gmail.com',
  smtpPort: 587,
};

export default function AlertManagement() {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertConfig, setAlertConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [testEmail, setTestEmail] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [loadingFirmantes, setLoadingFirmantes] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isSGI = currentUser?.rol === 'admin' || currentUser?.rol === 'sgi' || currentUser?.rol === 'supervisor';

  useEffect(() => {
    loadData();
  }, []);

  // 🔐 Obtener token de la API externa
  const getExternalToken = async () => {
    try {
      const response = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username: "l-admin", password: "Infor-Web001" }),
      });
      if (!response.ok) throw new Error('Auth failed');
      const data = await response.json();
      return data.token || data.accessToken || data;
    } catch (error) {
      console.error('Error obteniendo token externo:', error);
      return null;
    }
  };

  // 📥 Cargar emails de usuarios firmantes desde los formularios llenos
  const loadEmailsFromFirmantes = async (targetField) => {
    try {
      setLoadingFirmantes(true);

      // 1. Obtener todos los formularios llenos
      const formsResponse = await fetch(`${API_BASE_URL}/FilledForms`);
      if (!formsResponse.ok) throw new Error('No se pudieron cargar los formularios');
      let formsData = await formsResponse.json();
      formsData = Array.isArray(formsData) ? formsData : formsData.$values || [];

      // 2. Extraer nombres únicos de firmasData de todos los formularios
      const nombresUnicos = new Set();
      formsData.forEach(form => {
        let firmasData = form.firmasData;
        if (!firmasData) return;
        if (typeof firmasData === 'string') {
          try { firmasData = JSON.parse(firmasData); } catch { return; }
        }
        // firmasData es { "Puesto": { nombre, fecha, firma } }
        Object.values(firmasData).forEach(firmaInfo => {
          if (firmaInfo && firmaInfo.nombre && firmaInfo.nombre.trim()) {
            nombresUnicos.add(firmaInfo.nombre.trim());
          }
        });
      });

      if (nombresUnicos.size === 0) {
        alert('⚠️ No se encontraron firmantes en los formularios llenos.');
        return;
      }

      // 3. Obtener lista de usuarios de la API externa
      const token = await getExternalToken();
      const users = await fetchUsers(token);

      if (!users || users.length === 0) {
        alert('⚠️ No se pudo obtener la lista de usuarios de la API.');
        return;
      }

      // 4. Mapear nombres a emails
      const emailsEncontrados = new Set();
      nombresUnicos.forEach(nombre => {
        const user = findUserByName(users, nombre);
        if (user && user.email) {
          emailsEncontrados.add(user.email.toLowerCase());
        }
      });

      if (emailsEncontrados.size === 0) {
        alert(`⚠️ Se encontraron ${nombresUnicos.size} firmantes pero ninguno tiene email asociado en el sistema.\n\nNombres encontrados:\n${[...nombresUnicos].join('\n')}`);
        return;
      }

      // 5. Actualizar el campo correspondiente (missingFormRecipients o signatureRecipients)
      const nuevosEmails = [...emailsEncontrados];
      const currentEmails = Array.isArray(alertConfig[targetField]) 
        ? alertConfig[targetField].filter(e => e && e.trim()) 
        : [];
      
      // Merge: agregar nuevos emails sin duplicar los existentes
      const merged = [...new Set([...currentEmails, ...nuevosEmails])];
      
      setAlertConfig(prev => ({ ...prev, [targetField]: merged }));

      alert(`✅ Se cargaron ${nuevosEmails.length} emails de firmantes:\n\n${nuevosEmails.join('\n')}\n\n💡 Recuerda guardar la configuración para aplicar los cambios.`);

    } catch (error) {
      console.error('Error al cargar emails de firmantes:', error);
      alert('❌ Error al cargar emails de firmantes: ' + error.message);
    } finally {
      setLoadingFirmantes(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 1. Cargar configuración desde backend real
      try {
        const configResponse = await fetch(`${API_BASE_URL}/Alerts/config`);
        if (configResponse.ok) {
          const configData = await configResponse.json();
          // 🔧 El backend guarda recipients como JSON string ("[]"), convertir a array real
          const parsed = { ...configData };
          parsed.missingFormRecipients = parseRecipientsToArray(configData.missingFormRecipients);
          parsed.signatureRecipients = parseRecipientsToArray(configData.signatureRecipients);
          setAlertConfig(parsed);
        } else {
          const savedConfig = localStorage.getItem(ALERT_CONFIG_KEY);
          setAlertConfig(savedConfig ? JSON.parse(savedConfig) : DEFAULT_CONFIG);
        }
      } catch {
        const savedConfig = localStorage.getItem(ALERT_CONFIG_KEY);
        setAlertConfig(savedConfig ? JSON.parse(savedConfig) : DEFAULT_CONFIG);
      }

      // 2. Cargar alertas activas SOLO del usuario logueado
      try {
        const userEmail = currentUser?.email || currentUser?.username;
        
        if (!userEmail) {
          console.warn('⚠️ No se pudo obtener el email del usuario logueado');
          setActiveAlerts([]);
        } else {
          console.log('📧 Cargando alertas para:', userEmail);
          
          const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/active`);
          if (alertsResponse.ok) {
            const alertsData = await alertsResponse.json();
            const alerts = Array.isArray(alertsData) ? alertsData : alertsData.$values || [];
            
            // ✅ Filtrar solo alertas para este usuario
            const userAlerts = alerts.filter(alert => 
              alert.targetEmail && alert.targetEmail.toLowerCase() === userEmail.toLowerCase()
            );
            
            console.log(`✅ Alertas filtradas: ${userAlerts.length} de ${alerts.length} totales`);
            setActiveAlerts(userAlerts);
          }
        }
      } catch (error) {
        console.error('Error cargando alertas:', error);
        setActiveAlerts([]);
      }

      // 3. Cargar historial desde backend real
      try {
        const historyResponse = await fetch(`${API_BASE_URL}/Alerts/history`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setAlertHistory(Array.isArray(historyData) ? historyData : historyData.$values || []);
        }
      } catch {
        const savedHistory = localStorage.getItem(ALERT_HISTORY_KEY);
        setAlertHistory(savedHistory ? JSON.parse(savedHistory) : []);
      }

      // 4. Cargar estadísticas desde backend real
      try {
        const statsResponse = await fetch(`${API_BASE_URL}/Alerts/stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            activeCount: statsData.activeCount || 0,
            sentToday: statsData.sentToday || 0,
            pendingForms: statsData.totalSent || 0,
            pendingSignatures: statsData.failedCount || 0,
          });
        }
      } catch {
        setStats({ activeCount: 0, sentToday: 0, pendingForms: 0, pendingSignatures: 0 });
      }

    } catch (error) {
      console.error('Error al cargar datos:', error);
      setAlertConfig(DEFAULT_CONFIG);
      setActiveAlerts([]);
      setAlertHistory([]);
      setStats({ activeCount: 0, sentToday: 0, pendingForms: 0, pendingSignatures: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/Alerts/mark-read/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (error) {
      console.error('Error al marcar alerta:', error);
      // Fallback: quitar de la lista local
      setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  };

  const handleSaveConfig = async () => {
    try {
      // 🔧 Convertir arrays de recipients a JSON string para el backend
      // y solo enviar campos que el backend acepta
      const configToSend = {
        id: alertConfig.id || 0,
        enableMissingFormAlerts: alertConfig.enableMissingFormAlerts ?? true,
        dailyCheckTime: alertConfig.dailyCheckTime || '18:00',
        missingFormRecipients: JSON.stringify(
          Array.isArray(alertConfig.missingFormRecipients) 
            ? alertConfig.missingFormRecipients.filter(e => e && e.trim()) 
            : []
        ),
        enableSignatureAlerts: alertConfig.enableSignatureAlerts ?? true,
        signatureAlertDelay: alertConfig.signatureAlertDelay || 24,
        signatureRecipients: JSON.stringify(
          Array.isArray(alertConfig.signatureRecipients) 
            ? alertConfig.signatureRecipients.filter(e => e && e.trim()) 
            : []
        ),
        senderEmail: alertConfig.senderEmail || '',
        senderName: alertConfig.senderName || 'Frigolab Alertas',
      };

      const response = await fetch(`${API_BASE_URL}/Alerts/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSend),
      });

      if (response.ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 3000);
        alert('✅ Configuración guardada exitosamente en el servidor.');
      } else {
        throw new Error('Error del servidor');
      }
    } catch (error) {
      console.error('Error al guardar en backend, usando localStorage:', error);
      // Fallback a localStorage
      localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(alertConfig));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      alert('✅ Configuración guardada localmente.\n⚠️ No se pudo conectar con el servidor.');
    }
  };

  const handleSendTestAlert = async () => {
    if (!testEmail) {
      alert('Por favor ingresa un email de destino');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/Alerts/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ ' + (data.message || 'Email de prueba enviado exitosamente. Revisa tu bandeja de entrada.'));
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('❌ Error al enviar: ' + (errorData.message || 'El servidor no pudo enviar el email.\n\nVerifica:\n1. La contraseña de aplicación de Gmail en appsettings.json\n2. Que la verificación en 2 pasos esté activa en Gmail'));
      }
    } catch (error) {
      console.error('Error al enviar email de prueba:', error);
      alert('❌ No se pudo conectar con el servidor.\nVerifica que el backend esté corriendo en ' + API_BASE_URL);
    }
    setTestEmail('');
  };

  if (loading) {
    return (
      <div className="alert-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando alertas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-management">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>🔔 Gestión de Alertas</h1>
          <p className="subtitle">Sistema automático de notificaciones por email</p>
        </div>
        <div className="header-actions">
          {isSGI && (
            <button
              onClick={() => setActiveTab('config')}
              className="btn-primary"
            >
              ⚙️ Configurar Alertas
            </button>
          )}
          <Link to="/" className="btn-secondary">
            ← Volver al Inicio
          </Link>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card active">
            <div className="stat-icon">🔔</div>
            <div className="stat-content">
              <h3>{stats.activeCount || 0}</h3>
              <p>Alertas Activas</p>
            </div>
          </div>
          <div className="stat-card sent">
            <div className="stat-icon">📧</div>
            <div className="stat-content">
              <h3>{stats.sentToday || 0}</h3>
              <p>Enviadas Hoy</p>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon">⏰</div>
            <div className="stat-content">
              <h3>{stats.pendingForms || 0}</h3>
              <p>Registros Pendientes</p>
            </div>
          </div>
          <div className="stat-card signatures">
            <div className="stat-icon">✍️</div>
            <div className="stat-content">
              <h3>{stats.pendingSignatures || 0}</h3>
              <p>Firmas Pendientes</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab('active')}
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
        >
          🔔 Alertas Activas ({activeAlerts.length})
        </button>
       
        <button
          onClick={() => setActiveTab('history')}
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          📜 Historial
        </button>
      </div>

      {/* Contenido según tab activo */}
      <div className="tab-content">
        {activeTab === 'active' && (
          <div className="active-alerts-section">
            {activeAlerts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>No hay alertas activas</h3>
                <p>Todo está al día, no hay registros pendientes ni firmas por realizar</p>
              </div>
            ) : (
              <div className="alerts-grid">
                {activeAlerts.map(alert => (
                  <div key={alert.id} className={`alert-card ${alert.priority}`}>
                    <div className="alert-header">
                      <div className="alert-type">
                        {alert.type === 'missing_form' && '📝'}
                        {alert.type === 'pending_signature' && '✍️'}
                        {alert.type === 'overdue' && '⚠️'}
                        {alert.type === 'system' && '⚙️'}
                        <span className="type-label">{getAlertTypeLabel(alert.type)}</span>
                      </div>
                      <span className={`priority-badge ${alert.priority}`}>
                        {alert.priority === 'high' && '🔴 Alta'}
                        {alert.priority === 'medium' && '🟡 Media'}
                        {alert.priority === 'low' && '🟢 Baja'}
                      </span>
                    </div>

                    <div className="alert-body">
                      <h3>{alert.title}</h3>
                      <p className="alert-message">{alert.message}</p>
                      
                      <div className="alert-details">
                        <div className="alert-detail">
                          <span className="detail-label">📅 Fecha:</span>
                          <span className="detail-value">
                            {new Date(alert.createdDate).toLocaleString('es-ES')}
                          </span>
                        </div>
                        
                        {alert.targetEmail && (
                          <div className="alert-detail">
                            <span className="detail-label">📧 Destinatario:</span>
                            <span className="detail-value">{formatTargetEmail(alert.targetEmail)}</span>
                          </div>
                        )}

                        {alert.formId && (
                          <div className="alert-detail">
                            <span className="detail-label">📋 Formulario:</span>
                            <span className="detail-value">{alert.formCode || alert.formId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="alert-actions">
                      <button
                        onClick={() => handleMarkAsRead(alert.id)}
                        className="btn-mark-read"
                      >
                        ✅ Marcar como Leída
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-section">
            <div className="config-container">
              <h2>⚙️ Configuración de Alertas</h2>
              
              {alertConfig && (
                <div className="config-content">
                  <div className="config-group">
                    <h3>📝 Alertas por Falta de Llenado</h3>
                    <div className="config-item">
                      <label className="config-label">
                        <input
                          type="checkbox"
                          checked={alertConfig.enableMissingFormAlerts}
                          onChange={(e) => {
                            const newConfig = { ...alertConfig, enableMissingFormAlerts: e.target.checked };
                            setAlertConfig(newConfig);
                          }}
                        />
                        <span>Activar alertas de formularios no llenados</span>
                      </label>
                      <p className="config-description">
                        Se enviará una alerta cuando un formulario con frecuencia diaria no haya sido llenado
                      </p>
                    </div>

                    <div className="config-item">
                      <label className="form-label">Hora de verificación diaria:</label>
                      <input
                        type="time"
                        value={alertConfig.dailyCheckTime || '18:00'}
                        onChange={(e) => {
                          const newConfig = { ...alertConfig, dailyCheckTime: e.target.value };
                          setAlertConfig(newConfig);
                        }}
                        className="form-input"
                      />
                    </div>

                    <div className="config-item">
                      <label className="form-label">Destinatarios:</label>
                      <input
                        type="text"
                        value={safeJoinEmails(alertConfig.missingFormRecipients)}
                        onChange={(e) => {
                          const emails = e.target.value.split(',').map(email => email.trim());
                          const newConfig = { ...alertConfig, missingFormRecipients: emails };
                          setAlertConfig(newConfig);
                        }}
                        placeholder="email1@ejemplo.com, email2@ejemplo.com"
                        className="form-input"
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <p className="help-text" style={{ margin: 0 }}>Separa múltiples emails con comas</p>
                        <button
                          type="button"
                          onClick={() => loadEmailsFromFirmantes('missingFormRecipients')}
                          disabled={loadingFirmantes}
                          className="btn-load-firmantes"
                          title="Carga automáticamente los emails de los usuarios asignados como firmantes en los formularios"
                        >
                          {loadingFirmantes ? '⏳ Cargando...' : '📥 Cargar emails de firmantes'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="config-group">
                    <h3>✍️ Alertas de Firmas Pendientes</h3>
                    <div className="config-item">
                      <label className="config-label">
                        <input
                          type="checkbox"
                          checked={alertConfig.enableSignatureAlerts}
                          onChange={(e) => {
                            const newConfig = { ...alertConfig, enableSignatureAlerts: e.target.checked };
                            setAlertConfig(newConfig);
                          }}
                        />
                        <span>Activar alertas de firmas pendientes</span>
                      </label>
                      <p className="config-description">
                        Se enviará una alerta cuando un formulario esté completo y pendiente de firma
                      </p>
                    </div>

                    <div className="config-item">
                      <label className="form-label">Tiempo de espera antes de alertar (horas):</label>
                      <input
                        type="number"
                        value={alertConfig.signatureAlertDelay || 24}
                        onChange={(e) => {
                          const newConfig = { ...alertConfig, signatureAlertDelay: parseInt(e.target.value) };
                          setAlertConfig(newConfig);
                        }}
                        min="1"
                        max="168"
                        className="form-input"
                      />
                    </div>

                    <div className="config-item">
                      <label className="form-label">Destinatarios:</label>
                      <input
                        type="text"
                        value={safeJoinEmails(alertConfig.signatureRecipients)}
                        onChange={(e) => {
                          const emails = e.target.value.split(',').map(email => email.trim());
                          const newConfig = { ...alertConfig, signatureRecipients: emails };
                          setAlertConfig(newConfig);
                        }}
                        placeholder="supervisor@ejemplo.com, sgi@ejemplo.com"
                        className="form-input"
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <p className="help-text" style={{ margin: 0 }}>Separa múltiples emails con comas</p>
                        <button
                          type="button"
                          onClick={() => loadEmailsFromFirmantes('signatureRecipients')}
                          disabled={loadingFirmantes}
                          className="btn-load-firmantes"
                          title="Carga automáticamente los emails de los usuarios asignados como firmantes en los formularios"
                        >
                          {loadingFirmantes ? '⏳ Cargando...' : '📥 Cargar emails de firmantes'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="config-group">
                    <h3>📧 Configuración de Email (Gmail)</h3>
                    <p className="config-description" style={{ marginBottom: '15px', color: '#e65100', fontWeight: 'bold' }}>
                      ⚠️ La contraseña de Gmail se configura en el archivo <code>appsettings.json</code> del backend.
                      Necesitas una "Contraseña de aplicación". Ve a{' '}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#1976d2' }}>
                        myaccount.google.com/apppasswords
                      </a>{' '}
                      para crearla.
                    </p>
                    <div className="config-item">
                      <label className="form-label">📧 Email del remitente:</label>
                      <input
                        type="email"
                        value={alertConfig.senderEmail || ''}
                        onChange={(e) => {
                          const newConfig = { ...alertConfig, senderEmail: e.target.value };
                          setAlertConfig(newConfig);
                        }}
                        placeholder="tu-email@gmail.com"
                        className="form-input"
                      />
                    </div>

                    <div className="config-item">
                      <label className="form-label">Nombre del remitente:</label>
                      <input
                        type="text"
                        value={alertConfig.senderName || ''}
                        onChange={(e) => {
                          const newConfig = { ...alertConfig, senderName: e.target.value };
                          setAlertConfig(newConfig);
                        }}
                        placeholder="Frigolab Alertas"
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Estado de configuración */}
                  {alertConfig.senderEmail && (
                    <div className="config-group" style={{ background: '#e8f5e9', borderColor: '#4caf50' }}>
                      <h3 style={{ color: '#2e7d32' }}>✅ Email Configurado</h3>
                      <p>Email: <strong>{alertConfig.senderEmail}</strong></p>
                      <p>Nombre: <strong>{alertConfig.senderName || 'Frigolab Alertas'}</strong></p>
                      <p style={{ color: '#666', fontSize: '13px', marginTop: '5px' }}>
                        La contraseña SMTP se configura en el archivo appsettings.json del backend.
                      </p>
                    </div>
                  )}

                  <div className="config-actions">
                    <button
                      onClick={handleSaveConfig}
                      className="btn-primary"
                      style={{ fontSize: '16px', padding: '12px 30px' }}
                    >
                      💾 Guardar Configuración
                    </button>
                    {configSaved && (
                      <span style={{ color: '#4caf50', fontWeight: 'bold', marginLeft: '15px' }}>
                        ✅ Guardado exitosamente
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!alertConfig && (
                <div className="empty-state">
                  <div className="empty-icon">⚙️</div>
                  <h3>Cargando configuración...</h3>
                  <button onClick={() => setAlertConfig(DEFAULT_CONFIG)} className="btn-primary">
                    Cargar configuración por defecto
                  </button>
                </div>
              )}

              {/* Sección de Prueba */}
              <div className="test-section">
                <h3>🧪 Enviar Alerta de Prueba</h3>
                <div className="test-form">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Ingresa un email para probar"
                    className="form-input"
                  />
                  <button
                    onClick={handleSendTestAlert}
                    className="btn-primary"
                  >
                    📧 Enviar Prueba
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            {alertHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📜</div>
                <h3>No hay historial</h3>
                <p>Aún no se han generado alertas en el sistema</p>
              </div>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Mensaje</th>
                      <th>Destinatario</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertHistory.map(alert => (
                      <tr key={alert.id}>
                        <td>
                          <span className="type-badge">
                            {getAlertTypeLabel(alert.type)}
                          </span>
                        </td>
                        <td>{alert.message}</td>
                        <td>{formatTargetEmail(alert.targetEmail)}</td>
                        <td>{new Date(alert.createdDate).toLocaleString('es-ES')}</td>
                        <td>
                          <span className={`status-badge ${alert.status}`}>
                            {alert.status === 'sent' && '✅ Enviada'}
                            {alert.status === 'read' && '👁️ Leída'}
                            {alert.status === 'pending' && '⏰ Pendiente'}
                            {alert.status === 'failed' && '❌ Fallida'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Función auxiliar para obtener etiqueta del tipo de alerta
function getAlertTypeLabel(type) {
  const labels = {
    missing_form: 'Formulario Faltante',
    pending_signature: 'Firma Pendiente',
    overdue: 'Vencido',
    system: 'Sistema',
    test: '🧪 Prueba',
  };
  return labels[type] || type;
}

/**
 * Parsea recipients del backend (puede ser JSON string, array, o string plano) a un array JS.
 */
function parseRecipientsToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(e => e && e.trim()) : [];
      } catch { return []; }
    }
    // Es un string con emails separados por comas
    return trimmed.split(',').map(e => e.trim()).filter(e => e);
  }
  return [];
}

/**
 * Convierte un valor (array o string) a texto para mostrar en un input.
 */
function safeJoinEmails(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(e => e && e.trim()).join(', ');
  if (typeof value === 'string') {
    const arr = parseRecipientsToArray(value);
    return arr.join(', ');
  }
  return '';
}

/**
 * Función auxiliar para mostrar el targetEmail correctamente.
 * El backend guarda config.MissingFormRecipients (JSON array string) en TargetEmail,
 * así que puede venir como '["email@test.com"]' o como 'email@test.com'.
 */
function formatTargetEmail(targetEmail) {
  if (!targetEmail) return 'Sin destinatario';
  
  // Si es un string que parece JSON array, parsearlo
  if (typeof targetEmail === 'string' && targetEmail.trim().startsWith('[')) {
    try {
      const emails = JSON.parse(targetEmail);
      if (Array.isArray(emails) && emails.length > 0) {
        return emails.filter(e => e && e.trim()).join(', ') || 'Sin destinatario';
      }
      return 'Sin destinatario';
    } catch {
      // No es JSON válido, mostrar como está
    }
  }
  
  // Si ya es un email normal, mostrarlo directamente
  return targetEmail || 'Sin destinatario';
}
