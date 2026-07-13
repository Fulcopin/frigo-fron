import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { fetchUsers } from '../services/userService';
import { API_ENDPOINTS } from '../apiConfig';
import './Tickets.css';

const ESTADOS = [
  { value: 'abierto', label: '🟡 Abierto' },
  { value: 'en_progreso', label: '🔵 En progreso' },
  { value: 'cerrado', label: '🟢 Cerrado' },
];

export default function Tickets() {
  const currentUser = authService.getCurrentUser();
  const isAdminOrSupervisor = authService.isAdminOrSupervisor();

  const [tickets, setTickets] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mios');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ titulo: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  const [respuestas, setRespuestas] = useState({}); // { [ticketId]: texto }

  const [allUsers, setAllUsers] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingViewers, setSavingViewers] = useState(false);

  const canViewAll = isAdminOrSupervisor || viewers.some(
    v => (v.userEmail || '').toLowerCase() === (currentUser?.email || '').toLowerCase()
  );

  useEffect(() => {
    loadTickets();
    loadViewers();
  }, []);

  useEffect(() => {
    if (activeTab === 'acceso' && allUsers.length === 0) {
      loadUsersForAccessTab();
    }
  }, [activeTab]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.tickets);
      if (!response.ok) throw new Error('Error al cargar tickets');
      const data = await response.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error al cargar tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadViewers = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.tickets}/viewers`);
      if (!response.ok) throw new Error('Error al cargar accesos');
      const data = await response.json();
      setViewers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error al cargar accesos de tickets:', error);
      setViewers([]);
    }
  };

  const loadUsersForAccessTab = async () => {
    try {
      setLoadingUsers(true);
      const users = await fetchUsers();
      setAllUsers(Array.isArray(users) ? users : []);
      setSelectedEmails(new Set(viewers.map(v => (v.userEmail || '').toLowerCase())));
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.descripcion.trim()) return;

    try {
      setSaving(true);
      const response = await fetch(API_ENDPOINTS.tickets, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: formData.titulo.trim(),
          descripcion: formData.descripcion.trim(),
          creadoPorNombre: currentUser?.nombre || currentUser?.username || 'Desconocido',
          // El backend exige email: si el usuario no tiene, usar su username como identificador
          creadoPorEmail: currentUser?.email || currentUser?.username || 'sin-correo',
        }),
      });

      if (!response.ok) {
        // Mostrar el motivo real del rechazo (ej. validación de campos)
        const errData = await response.json().catch(() => null);
        const detalle = errData?.errors
          ? Object.values(errData.errors).filter(Array.isArray).flat().join(' ')
          : (errData?.title || errData?.message || `Error ${response.status}`);
        throw new Error(detalle);
      }

      setFormData({ titulo: '', descripcion: '' });
      setShowForm(false);
      await loadTickets();
      alert('✅ Ticket creado. El administrador fue notificado.');
    } catch (error) {
      console.error('❌ Error al crear ticket:', error);
      alert(`❌ No se pudo crear el ticket.\n${error.message || 'Intenta de nuevo.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEstado = async (ticket, estado) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.tickets}/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ticket, estado }),
      });
      if (!response.ok) throw new Error('Error al actualizar estado');
      await loadTickets();
    } catch (error) {
      console.error('❌ Error al actualizar estado:', error);
      alert('❌ No se pudo actualizar el estado.');
    }
  };

  const handleResponder = async (ticket) => {
    const texto = (respuestas[ticket.id] || '').trim();
    if (!texto) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.tickets}/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ticket,
          estado: ticket.estado === 'abierto' ? 'en_progreso' : ticket.estado,
          respuestaAdmin: texto,
          respondidoPor: currentUser?.nombre || 'Admin',
        }),
      });
      if (!response.ok) throw new Error('Error al responder');
      setRespuestas(prev => ({ ...prev, [ticket.id]: '' }));
      await loadTickets();
    } catch (error) {
      console.error('❌ Error al responder ticket:', error);
      alert('❌ No se pudo enviar la respuesta.');
    }
  };

  const toggleUserSelected = (email) => {
    const key = (email || '').toLowerCase();
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveViewers = async () => {
    try {
      setSavingViewers(true);
      const payload = allUsers
        .filter(u => selectedEmails.has((u.email || '').toLowerCase()))
        .map(u => ({ userEmail: u.email, userNombre: u.nombreCompleto || u.userName || u.email }));

      const response = await fetch(`${API_ENDPOINTS.tickets}/viewers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Error al guardar accesos');
      await loadViewers();
      alert('✅ Acceso actualizado.');
    } catch (error) {
      console.error('❌ Error al guardar accesos:', error);
      alert('❌ No se pudo guardar el acceso.');
    } finally {
      setSavingViewers(false);
    }
  };

  // Misma identidad de respaldo que al crear: email o, si no tiene, username
  const miIdentidad = (currentUser?.email || currentUser?.username || 'sin-correo').toLowerCase();
  const misTickets = tickets.filter(
    t => (t.creadoPorEmail || '').toLowerCase() === miIdentidad
  );

  const estadoLabel = (estado) => ESTADOS.find(e => e.value === estado)?.label || estado;

  if (loading) {
    return (
      <div className="tickets-page">
        <p>⏳ Cargando tickets...</p>
      </div>
    );
  }

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <div>
          <h1>🎫 Tickets / Mesa de Ayuda</h1>
          <p className="tickets-subtitle">Reporta novedades o problemas puntuales del sistema</p>
        </div>
        <Link to="/" className="btn-secondary">← Volver</Link>
      </div>

      <div className="tickets-tabs">
        <button className={activeTab === 'mios' ? 'tab active' : 'tab'} onClick={() => setActiveTab('mios')}>
          Mis Tickets ({misTickets.length})
        </button>
        {canViewAll && (
          <button className={activeTab === 'todos' ? 'tab active' : 'tab'} onClick={() => setActiveTab('todos')}>
            Todos los Tickets ({tickets.length})
          </button>
        )}
        {isAdminOrSupervisor && (
          <button className={activeTab === 'acceso' ? 'tab active' : 'tab'} onClick={() => setActiveTab('acceso')}>
            ⚙️ Configurar Acceso
          </button>
        )}
      </div>

      {activeTab === 'mios' && (
        <div className="tickets-content">
          <button className="btn-primary" onClick={() => setShowForm(prev => !prev)}>
            {showForm ? '✕ Cancelar' : '+ Nuevo Ticket'}
          </button>

          {showForm && (
            <form className="ticket-form" onSubmit={handleCreateTicket}>
              <label className="form-label">Título</label>
              <input
                type="text"
                className="form-input"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ej: Error al guardar formulario FOR-PD-04"
                required
              />
              <label className="form-label">Descripción</label>
              <textarea
                className="form-input"
                rows={4}
                value={formData.descripcion}
                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Cuenta el detalle de la novedad..."
                required
              />
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Enviando...' : 'Enviar Ticket'}
              </button>
            </form>
          )}

          <table className="tickets-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {misTickets.length === 0 ? (
                <tr><td colSpan="4" className="empty-row">Aún no has creado ningún ticket.</td></tr>
              ) : (
                misTickets.map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.titulo}</strong>
                      <p className="ticket-desc">{t.descripcion}</p>
                    </td>
                    <td>{estadoLabel(t.estado)}</td>
                    <td>{new Date(t.creadoEn).toLocaleString('es-ES')}</td>
                    <td>{t.respuestaAdmin || <span className="muted">Sin respuesta aún</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'todos' && canViewAll && (
        <div className="tickets-content">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Título / Descripción</th>
                <th>Creado por</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Responder</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan="5" className="empty-row">No hay tickets todavía.</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.titulo}</strong>
                      <p className="ticket-desc">{t.descripcion}</p>
                      {t.respuestaAdmin && (
                        <p className="ticket-respuesta">↳ {t.respuestaAdmin} <em>({t.respondidoPor})</em></p>
                      )}
                    </td>
                    <td>{t.creadoPorNombre}<br /><span className="muted">{t.creadoPorEmail}</span></td>
                    <td>{new Date(t.creadoEn).toLocaleString('es-ES')}</td>
                    <td>
                      <select value={t.estado} onChange={(e) => handleUpdateEstado(t, e.target.value)} className="form-input">
                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Escribe una respuesta..."
                        value={respuestas[t.id] || ''}
                        onChange={(e) => setRespuestas(prev => ({ ...prev, [t.id]: e.target.value }))}
                      />
                      <button className="btn-secondary" onClick={() => handleResponder(t)}>Responder</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'acceso' && isAdminOrSupervisor && (
        <div className="tickets-content">
          <p className="config-description">
            Selecciona qué usuarios, además de Admin/Supervisor, pueden ver la pestaña "Todos los Tickets".
          </p>
          {loadingUsers ? (
            <p>⏳ Cargando usuarios...</p>
          ) : (
            <>
              <div className="users-checklist">
                {allUsers.map(u => (
                  <label key={u.id || u.email} className="user-check-item">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has((u.email || '').toLowerCase())}
                      onChange={() => toggleUserSelected(u.email)}
                    />
                    <span>{u.nombreCompleto || u.userName} <span className="muted">({u.email})</span></span>
                  </label>
                ))}
              </div>
              <button className="btn-primary" onClick={handleSaveViewers} disabled={savingViewers}>
                {savingViewers ? 'Guardando...' : 'Guardar Acceso'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
