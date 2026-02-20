import React, { useState, useEffect } from 'react';
import sessionTimeService from '../services/sessionTimeService';
import authService from '../services/authService';
import ScrollButton from '../components/ScrollButton';
import './SessionHistory.css';

/**
 * 📊 SessionHistory - Página de historial de tiempos de sesión por usuario
 * Solo visible para admin y supervisor.
 */
function SessionHistory() {
  const [view, setView] = useState('hourly'); // 'hourly' | 'summary' | 'detail' | 'byDate'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState([]);
  const [history, setHistory] = useState([]);
  const [dateSummary, setDateSummary] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyDetail, setHourlyDetail] = useState([]);
  const [rolSummary, setRolSummary] = useState([]);
  const [expandedHour, setExpandedHour] = useState(null);
  const [formFillHistory, setFormFillHistory] = useState([]);
  const [formFillSummary, setFormFillSummary] = useState({});
  const [formFillByUser, setFormFillByUser] = useState([]);
  const [activeFormFill, setActiveFormFill] = useState(null);
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadData();
    // 🔄 Auto-refresh cada 30 segundos para ver sesión activa en tiempo real
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const loadData = () => {
    setSummary(sessionTimeService.getSummaryByUser());
    setHistory(sessionTimeService.getHistory().reverse());
    setDateSummary(sessionTimeService.getSummaryByUserAndDate(selectedDate));
    setHourlyData(sessionTimeService.getHourlyVariation(selectedDate));
    setHourlyDetail(sessionTimeService.getHourlyDetail(selectedDate));
    setRolSummary(sessionTimeService.getSummaryByRolAndDate(selectedDate));
    
    // 📝 Datos de formularios
    setFormFillHistory(sessionTimeService.getFormFillByDate(selectedDate).reverse());
    setFormFillSummary(sessionTimeService.getFormFillSummary());
    setFormFillByUser(sessionTimeService.getFormFillByUserAndDate(selectedDate));
    setActiveFormFill(sessionTimeService.getActiveFormFill());
  };

  const getRolBadge = (rol) => {
    const badges = {
      admin: { icon: '👑', text: 'Admin', color: '#667eea' },
      supervisor: { icon: '👔', text: 'Supervisor', color: '#ed8936' },
      trabajador: { icon: '👷', text: 'Trabajador', color: '#48bb78' }
    };
    return badges[rol] || { icon: '👤', text: rol || 'N/A', color: '#718096' };
  };

  const getRolColor = (rol) => {
    const colors = {
      admin: '#667eea',
      supervisor: '#ed8936',
      trabajador: '#48bb78'
    };
    return colors[rol] || '#94a3b8';
  };

  const handleClearHistory = () => {
    if (globalThis.confirm('¿Estás seguro de limpiar todo el historial de sesiones? Esta acción no se puede deshacer.')) {
      sessionTimeService.clearHistory();
      loadData();
    }
  };

  // Calcular estadísticas del día
  const maxPersonal = Math.max(...hourlyData.map(h => h.total), 1);
  const totalPersonalUnico = new Set(history.filter(r => r.fecha === selectedDate).map(r => r.username)).size;
  const horasConActividad = hourlyData.filter(h => h.total > 0).length;
  const horaPico = hourlyData.reduce((max, h) => h.total > max.total ? h : max, { total: 0, horaTexto: '--:--' });

  return (
    <div className="session-history-page">
      <div className="session-history-header">
        <h1>⏱️ Registro de Tiempo y Personal</h1>
        <p className="session-history-subtitle">
          Variación de personal por hora y control de tiempos por proceso
        </p>
      </div>

      {/* Tabs de vista */}
      <div className="session-tabs">
        <button 
          className={`session-tab ${view === 'hourly' ? 'active' : ''}`}
          onClick={() => setView('hourly')}
        >
          📈 Variación por Hora
        </button>
       
        <button 
          className={`session-tab ${view === 'summary' ? 'active' : ''}`}
          onClick={() => setView('summary')}
        >
          📊 Resumen Total
        </button>
        <button 
          className={`session-tab ${view === 'byDate' ? 'active' : ''}`}
          onClick={() => setView('byDate')}
        >
          📅 Por Fecha
        </button>
        <button 
          className={`session-tab ${view === 'detail' ? 'active' : ''}`}
          onClick={() => setView('detail')}
        >
          📋 Detalle
        </button>
      </div>

      {/* ========== NUEVA VISTA: Variación por Hora ========== */}
      {view === 'hourly' && (
        <div className="hourly-view">
          {/* Filtro de fecha */}
          <div className="date-filter">
            <label htmlFor="hourly-date">📅 Fecha:</label>
            <input 
              id="hourly-date"
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <span className="date-label-text">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </span>
          </div>

          {/* Tarjetas resumen del día */}
          <div className="stats-cards">
            <div className="stat-card stat-blue">
              <span className="stat-icon">👥</span>
              <div className="stat-content">
                <span className="stat-number">{totalPersonalUnico}</span>
                <span className="stat-label">Personal Único</span>
              </div>
            </div>
            <div className="stat-card stat-green">
              <span className="stat-icon">🕐</span>
              <div className="stat-content">
                <span className="stat-number">{horasConActividad}h</span>
                <span className="stat-label">Horas con Actividad</span>
              </div>
            </div>
            <div className="stat-card stat-orange">
              <span className="stat-icon">📈</span>
              <div className="stat-content">
                <span className="stat-number">{horaPico.total}</span>
                <span className="stat-label">Pico a las {horaPico.horaTexto}</span>
              </div>
            </div>
            <div className="stat-card stat-purple">
              <span className="stat-icon">📊</span>
              <div className="stat-content">
                <span className="stat-number">{rolSummary.length}</span>
                <span className="stat-label">Roles Activos</span>
              </div>
            </div>
          </div>

          {/* Resumen por Rol */}
          {rolSummary.length > 0 && (
            <div className="session-section" style={{ marginBottom: '1.5rem' }}>
              <h2>👥 Personal por Proceso / Rol</h2>
              <div className="rol-summary-grid">
                {rolSummary.map(item => {
                  const badge = getRolBadge(item.rol);
                  return (
                    <div key={item.rol} className="rol-summary-card" style={{ borderLeftColor: badge.color }}>
                      <div className="rol-card-header">
                        <span className="rol-card-icon">{badge.icon}</span>
                        <span className="rol-card-title">{badge.text}</span>
                      </div>
                      <div className="rol-card-stats">
                        <div className="rol-stat">
                          <span className="rol-stat-value">{item.cantidadUsuarios}</span>
                          <span className="rol-stat-label">personas</span>
                        </div>
                        <div className="rol-stat">
                          <span className="rol-stat-value">{item.sesiones}</span>
                          <span className="rol-stat-label">sesiones</span>
                        </div>
                        <div className="rol-stat">
                          <span className="rol-stat-value time-value">{item.totalTexto}</span>
                          <span className="rol-stat-label">tiempo total</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gráfico de barras de variación por hora */}
          <div className="session-section">
            <h2>📈 Variación de Personal por Hora</h2>
            
            {hourlyData.every(h => h.total === 0) ? (
              <div className="session-empty">
                <span className="empty-icon">📈</span>
                <p>No hay actividad registrada para esta fecha.</p>
                <p className="empty-hint">Los datos se generan cuando los usuarios inician y cierran sesión.</p>
              </div>
            ) : (
              <>
                {/* Gráfico visual de barras */}
                <div className="hourly-chart">
                  <div className="chart-y-axis">
                    {[...Array(maxPersonal + 1)].map((_, i) => {
                      const val = maxPersonal - i;
                      return (
                        <span key={val} className="y-label">{val}</span>
                      );
                    })}
                  </div>
                  <div className="chart-bars">
                    {hourlyData.map((hour) => {
                      const heightPercent = maxPersonal > 0 ? (hour.total / maxPersonal) * 100 : 0;
                      const isExpanded = expandedHour === hour.hora;
                      const roles = Object.keys(hour.porRol);
                      
                      return (
                        <div 
                          key={hour.hora} 
                          className={`chart-bar-col ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedHour(isExpanded ? null : hour.hora)}
                          title={`${hour.horaTexto} — ${hour.total} persona(s)`}
                        >
                          <div className="bar-wrapper">
                            {/* Barra apilada por roles */}
                            <div 
                              className="bar-fill"
                              style={{ height: `${heightPercent}%` }}
                            >
                              {roles.map(rol => {
                                const rolPercent = (hour.porRol[rol] / hour.total) * 100;
                                return (
                                  <div 
                                    key={rol}
                                    className="bar-segment"
                                    style={{ 
                                      height: `${rolPercent}%`, 
                                      background: getRolColor(rol) 
                                    }}
                                    title={`${getRolBadge(rol).text}: ${hour.porRol[rol]}`}
                                  />
                                );
                              })}
                            </div>
                            {hour.total > 0 && (
                              <span className="bar-count">{hour.total}</span>
                            )}
                          </div>
                          <span className="bar-label">{hour.hora.toString().padStart(2, '0')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leyenda de roles */}
                <div className="chart-legend">
                  {['admin', 'supervisor', 'trabajador'].map(rol => {
                    const badge = getRolBadge(rol);
                    return (
                      <div key={rol} className="legend-item">
                        <span className="legend-dot" style={{ background: getRolColor(rol) }} />
                        <span>{badge.icon} {badge.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Detalle expandido de la hora seleccionada */}
                {expandedHour !== null && hourlyDetail[expandedHour] && (
                  <div className="hour-detail-panel">
                    <h3>👥 Personal activo a las {expandedHour.toString().padStart(2, '0')}:00</h3>
                    {hourlyDetail[expandedHour].usuarios.length === 0 ? (
                      <p className="no-users-msg">Sin personal activo en esta hora.</p>
                    ) : (
                      <div className="hour-users-list">
                        {hourlyDetail[expandedHour].usuarios.map(user => {
                          const badge = getRolBadge(user.rol);
                          return (
                            <div key={user.username} className="hour-user-chip">
                              <span className="rol-badge" style={{ background: badge.color }}>
                                {badge.icon}
                              </span>
                              <span className="hour-user-name">{user.nombre}</span>
                              <span className="hour-user-rol">{badge.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tabla hora por hora */}
          <div className="session-section" style={{ marginTop: '1.5rem' }}>
            <h2>🕐 Detalle Hora por Hora</h2>
            <div className="session-table-wrapper">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Personal Total</th>
                    {['admin', 'supervisor', 'trabajador'].map(rol => (
                      <th key={rol}>{getRolBadge(rol).icon} {getRolBadge(rol).text}</th>
                    ))}
                    <th>Personas</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyData.filter(h => h.total > 0).map((hour) => {
                    const users = hourlyDetail[hour.hora]?.usuarios || [];
                    return (
                      <tr key={hour.hora}>
                        <td style={{ fontWeight: 700 }}>{hour.horaTexto}</td>
                        <td className="center-cell">
                          <span className="time-value" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                            {hour.total}
                          </span>
                        </td>
                        {['admin', 'supervisor', 'trabajador'].map(rol => (
                          <td key={rol} className="center-cell">
                            {hour.porRol[rol] || 0}
                          </td>
                        ))}
                        <td className="users-cell">
                          {users.map(u => u.nombre).join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {hourlyData.every(h => h.total === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        Sin actividad registrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========== VISTA: Formularios - Tiempo de llenado ========== */}
      {view === 'forms' && (
        <div className="forms-view">
          {/* Filtro de fecha */}
          <div className="date-filter">
            <label htmlFor="forms-date">📅 Fecha:</label>
            <input 
              id="forms-date"
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <span className="date-label-text">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </span>
            <button className="btn-refresh-forms" onClick={loadData}>🔄 Actualizar</button>
          </div>

          {/* Formulario en curso */}
          {activeFormFill && (
            <div className="active-form-banner">
              <span className="active-form-pulse" />
              <div className="active-form-info">
                <strong>📝 En curso:</strong> {activeFormFill.nombre} está llenando 
                <em> &quot;{activeFormFill.templateName}&quot;</em>
                <span className="active-form-time">⏱️ {activeFormFill._duracionActual}</span>
              </div>
            </div>
          )}

          {/* Tarjetas resumen de formularios del día */}
          <div className="stats-cards">
            <div className="stat-card stat-blue">
              <span className="stat-icon">📝</span>
              <div className="stat-content">
                <span className="stat-number">{formFillHistory.length}</span>
                <span className="stat-label">Formularios del Día</span>
              </div>
            </div>
            <div className="stat-card stat-green">
              <span className="stat-icon">👥</span>
              <div className="stat-content">
                <span className="stat-number">{formFillByUser.length}</span>
                <span className="stat-label">Usuarios Activos</span>
              </div>
            </div>
            <div className="stat-card stat-orange">
              <span className="stat-icon">⏱️</span>
              <div className="stat-content">
                <span className="stat-number">
                  {formFillHistory.length > 0 
                    ? sessionTimeService.formatDuration(
                        Math.round(formFillHistory.reduce((sum, r) => sum + r.duracionMs, 0) / formFillHistory.length)
                      )
                    : '--'}
                </span>
                <span className="stat-label">Promedio del Día</span>
              </div>
            </div>
            <div className="stat-card stat-purple">
              <span className="stat-icon">📋</span>
              <div className="stat-content">
                <span className="stat-number">{formFillSummary?.byTemplate?.length ?? 0}</span>
                <span className="stat-label">Tipos de Formulario</span>
              </div>
            </div>
          </div>

          {/* Resumen por tipo de formulario (historico) */}
          {(formFillSummary?.byTemplate?.length ?? 0) > 0 && (
            <div className="session-section" style={{ marginBottom: '1.5rem' }}>
              <h2>📊 Resumen por Tipo de Formulario</h2>
              <div className="session-table-wrapper">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>Formulario</th>
                      <th>Veces Llenado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formFillSummary.byTemplate.map(item => (
                      <tr key={item.templateName}>
                        <td><strong>{item.templateName}</strong></td>
                        <td className="center-cell">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Por usuario del día */}
          {formFillByUser.length > 0 && (
            <div className="session-section" style={{ marginBottom: '1.5rem' }}>
              <h2>👥 Formularios por Usuario — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}</h2>
              <div className="session-table-wrapper">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Formularios</th>
                      <th>Tiempo Total</th>
                      <th>Formularios Llenados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formFillByUser.map(user => {
                      const badge = getRolBadge(user.rol);
                      return (
                        <tr key={user.username}>
                          <td className="user-cell">
                            <strong>{user.nombre}</strong>
                            <span className="username-small">@{user.username}</span>
                          </td>
                          <td>
                            <span className="rol-badge" style={{ background: badge.color }}>
                              {badge.icon} {badge.text}
                            </span>
                          </td>
                          <td className="center-cell">{user.total}</td>
                          <td className="time-cell">
                            <span className="time-value">—</span>
                          </td>
                          <td className="users-cell">
                            {(user.formularios || []).join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detalle: Todos los formularios del día */}
          <div className="session-section">
            <h2>📋 Detalle de Formularios — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })}</h2>
            {formFillHistory.length === 0 ? (
              <div className="session-empty">
                <span className="empty-icon">📝</span>
                <p>No hay formularios registrados para esta fecha.</p>
                <p className="empty-hint">Los tiempos se registran automáticamente cuando un usuario abre y guarda un formulario.</p>
              </div>
            ) : (
              <div className="session-table-wrapper">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Formulario</th>
                      <th>Hora Inicio</th>
                      <th>Hora Fin</th>
                      <th>Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formFillHistory.map((record, idx) => {
                      const badge = getRolBadge(record.rol);
                      return (
                        <tr key={`${record.inicio}-${record.templateName}`}>
                          <td className="rank-cell">{idx + 1}</td>
                          <td className="user-cell">
                            <strong>{record.nombre}</strong>
                          </td>
                          <td>
                            <span className="rol-badge" style={{ background: badge.color }}>
                              {badge.icon} {badge.text}
                            </span>
                          </td>
                          <td><strong>{record.templateName}</strong></td>
                          <td className="date-cell">
                            {record.startedAt ? new Date(record.startedAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="date-cell">
                            {record.fin ? new Date(record.fin).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="time-cell">
                            <span className="time-value">{record.duracionTexto}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'summary' && (
        <div className="session-section">
          <h2>📊 Tiempo Total por Usuario</h2>
          {summary.length === 0 ? (
            <div className="session-empty">
              <span className="empty-icon">⏱️</span>
              <p>No hay registros de sesiones aún.</p>
              <p className="empty-hint">Los tiempos se registran automáticamente cuando los usuarios inician y cierran sesión.</p>
            </div>
          ) : (
            <div className="session-table-wrapper">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Sesiones</th>
                    <th>Tiempo Total</th>
                    <th>Última Sesión</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((user, index) => {
                    const badge = getRolBadge(user.rol);
                    return (
                      <tr key={user.username}>
                        <td className="rank-cell">{index + 1}</td>
                        <td className="user-cell">
                          <strong>{user.nombre}</strong>
                          <span className="username-small">@{user.username}</span>
                        </td>
                        <td>
                          <span className="rol-badge" style={{ background: badge.color }}>
                            {badge.icon} {badge.text}
                          </span>
                        </td>
                        <td className="center-cell">{user.sesiones}</td>
                        <td className="time-cell">
                          <span className="time-value">{user.totalTexto}</span>
                        </td>
                        <td className="date-cell">
                          {new Date(user.ultimaSesion).toLocaleString('es-EC', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vista: Por Fecha */}
      {view === 'byDate' && (
        <div className="session-section">
          <div className="date-filter">
            <label>📅 Filtrar por fecha:</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <h2>Registros del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}</h2>

          {dateSummary.length === 0 ? (
            <div className="session-empty">
              <span className="empty-icon">📅</span>
              <p>No hay registros para esta fecha.</p>
            </div>
          ) : (
            <div className="session-table-wrapper">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Sesiones</th>
                    <th>Tiempo del Día</th>
                  </tr>
                </thead>
                <tbody>
                  {dateSummary.map((user, index) => {
                    const badge = getRolBadge(user.rol);
                    return (
                      <tr key={user.username}>
                        <td className="rank-cell">{index + 1}</td>
                        <td className="user-cell">
                          <strong>{user.nombre}</strong>
                          <span className="username-small">@{user.username}</span>
                        </td>
                        <td>
                          <span className="rol-badge" style={{ background: badge.color }}>
                            {badge.icon} {badge.text}
                          </span>
                        </td>
                        <td className="center-cell">{user.sesiones}</td>
                        <td className="time-cell">
                          <span className="time-value">{user.totalTexto}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vista: Detalle de Sesiones */}
      {view === 'detail' && (
        <div className="session-section">
          <h2>📋 Todas las Sesiones ({history.length})</h2>
          
          {history.length === 0 ? (
            <div className="session-empty">
              <span className="empty-icon">📋</span>
              <p>No hay sesiones registradas.</p>
            </div>
          ) : (
            <div className="session-table-wrapper">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record, index) => {
                    const badge = getRolBadge(record.rol);
                    return (
                      <tr key={index}>
                        <td className="rank-cell">{index + 1}</td>
                        <td className="user-cell">
                          <strong>{record.nombre}</strong>
                          <span className="username-small">@{record.username}</span>
                        </td>
                        <td>
                          <span className="rol-badge" style={{ background: badge.color }}>
                            {badge.icon} {badge.text}
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(record.inicio).toLocaleString('es-EC', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="date-cell">
                          {new Date(record.fin).toLocaleString('es-EC', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="time-cell">
                          <span className="time-value">{record.duracionTexto}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Botón de limpiar historial - solo admin */}
      {currentUser?.rol === 'admin' && history.length > 0 && (
        <div className="session-actions">
          <button className="btn-clear-history" onClick={handleClearHistory}>
            🗑️ Limpiar Historial
          </button>
        </div>
      )}

      <ScrollButton />
    </div>
  );
}

export default SessionHistory;
