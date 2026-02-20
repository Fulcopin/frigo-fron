/**
 * ⏱️ Servicio de registro de tiempo de sesión por usuario
 * 
 * Registra cuánto tiempo cada usuario ha estado conectado.
 * Almacena en localStorage:
 * - fishcort_session_start: timestamp de inicio de sesión actual
 * - fishcort_session_history: historial de todas las sesiones de todos los usuarios
 */

const STORAGE_KEYS = {
  sessionStart: 'fishcort_session_start',
  sessionUser: 'fishcort_session_user',
  history: 'fishcort_session_history'
};

class SessionTimeService {

  /**
   * Iniciar cronómetro al hacer login
   */
  startSession(user) {
    if (!user) return;
    
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.sessionStart, now);
    localStorage.setItem(STORAGE_KEYS.sessionUser, JSON.stringify({
      username: user.username,
      nombre: user.nombre || user.username,
      rol: user.rol,
      email: user.email
    }));

    console.log(`⏱️ Sesión iniciada para ${user.nombre || user.username} a las ${new Date().toLocaleTimeString()}`);
  }

  /**
   * Detener cronómetro y guardar registro al hacer logout
   */
  endSession() {
    const startStr = localStorage.getItem(STORAGE_KEYS.sessionStart);
    const userStr = localStorage.getItem(STORAGE_KEYS.sessionUser);

    if (!startStr || !userStr) return null;

    try {
      const user = JSON.parse(userStr);
      const start = new Date(startStr);
      const end = new Date();
      const durationMs = end - start;

      const record = {
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        email: user.email,
        inicio: start.toISOString(),
        fin: end.toISOString(),
        duracionMs: durationMs,
        duracionTexto: this.formatDuration(durationMs),
        fecha: end.toISOString().split('T')[0]
      };

      // Guardar en historial
      this._addToHistory(record);

      // Limpiar sesión actual
      localStorage.removeItem(STORAGE_KEYS.sessionStart);
      localStorage.removeItem(STORAGE_KEYS.sessionUser);

      console.log(`⏱️ Sesión finalizada para ${user.nombre}: ${record.duracionTexto}`);
      return record;
    } catch (e) {
      console.error('Error al finalizar sesión:', e);
      return null;
    }
  }

  /**
   * Guardar snapshot de la sesión actual en el historial SIN borrar el cronómetro.
   * Se usa en beforeunload para no perder el tiempo si el usuario solo recarga la página.
   * Al volver a abrir, el cronómetro continúa desde el inicio original.
   */
  saveSessionSnapshot() {
    const startStr = localStorage.getItem(STORAGE_KEYS.sessionStart);
    const userStr = localStorage.getItem(STORAGE_KEYS.sessionUser);

    if (!startStr || !userStr) return null;

    try {
      const user = JSON.parse(userStr);
      const start = new Date(startStr);
      const end = new Date();
      const durationMs = end - start;

      // Ignorar sesiones muy cortas (menos de 30 segundos) para no llenar el historial
      if (durationMs < 30000) return null;

      const record = {
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        email: user.email,
        inicio: start.toISOString(),
        fin: end.toISOString(),
        duracionMs: durationMs,
        duracionTexto: this.formatDuration(durationMs),
        fecha: end.toISOString().split('T')[0],
        tipo: 'snapshot' // Marcado como snapshot para distinguirlo de sesiones completas
      };

      this._addToHistory(record);
      console.log(`📸 Snapshot guardado para ${user.nombre}: ${record.duracionTexto}`);
      return record;
    } catch (e) {
      console.error('Error al guardar snapshot:', e);
      return null;
    }
  }

  /**
   * Obtener el timestamp de inicio de la sesión actual
   */
  getSessionStart() {
    const startStr = localStorage.getItem(STORAGE_KEYS.sessionStart);
    return startStr ? new Date(startStr) : null;
  }

  /**
   * Obtener los datos del usuario de la sesión actual
   */
  getSessionUser() {
    const userStr = localStorage.getItem(STORAGE_KEYS.sessionUser);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Calcular la duración actual de la sesión en milisegundos
   */
  getCurrentDuration() {
    const start = this.getSessionStart();
    if (!start) return 0;
    return Date.now() - start.getTime();
  }

  /**
   * Agregar registro al historial
   */
  _addToHistory(record) {
    const history = this.getHistory();
    history.push(record);

    // Mantener máximo 500 registros (los más recientes)
    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }

    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }

  /**
   * Obtener todo el historial de sesiones
   */
  getHistory() {
    const historyStr = localStorage.getItem(STORAGE_KEYS.history);
    if (!historyStr) return [];
    try {
      return JSON.parse(historyStr);
    } catch {
      return [];
    }
  }

  /**
   * Obtener historial filtrado por usuario
   */
  getHistoryByUser(username) {
    return this.getHistory().filter(r => r.username === username);
  }

  /**
   * Obtener historial filtrado por fecha (YYYY-MM-DD)
   */
  getHistoryByDate(fecha) {
    return this.getHistory().filter(r => r.fecha === fecha);
  }

  /**
   * Obtener resumen de tiempo total por usuario
   */
  getSummaryByUser() {
    const history = this.getHistory();
    const summary = {};

    for (const record of history) {
      if (!summary[record.username]) {
        summary[record.username] = {
          username: record.username,
          nombre: record.nombre,
          rol: record.rol,
          totalMs: 0,
          sesiones: 0,
          ultimaSesion: record.fin
        };
      }

      summary[record.username].totalMs += record.duracionMs;
      summary[record.username].sesiones += 1;

      if (record.fin > summary[record.username].ultimaSesion) {
        summary[record.username].ultimaSesion = record.fin;
      }
    }

    // Agregar texto de duración total
    for (const key of Object.keys(summary)) {
      summary[key].totalTexto = this.formatDuration(summary[key].totalMs);
    }

    return Object.values(summary).sort((a, b) => b.totalMs - a.totalMs);
  }

  /**
   * Obtener resumen por usuario filtrado por fecha
   */
  getSummaryByUserAndDate(fecha) {
    const dayRecords = this.getHistoryByDate(fecha);
    const summary = {};

    for (const record of dayRecords) {
      if (!summary[record.username]) {
        summary[record.username] = {
          username: record.username,
          nombre: record.nombre,
          rol: record.rol,
          totalMs: 0,
          sesiones: 0
        };
      }

      summary[record.username].totalMs += record.duracionMs;
      summary[record.username].sesiones += 1;
    }

    for (const key of Object.keys(summary)) {
      summary[key].totalTexto = this.formatDuration(summary[key].totalMs);
    }

    return Object.values(summary).sort((a, b) => b.totalMs - a.totalMs);
  }

  /**
   * Formatear milisegundos a texto legible
   */
  formatDuration(ms) {
    if (ms < 0) ms = 0;
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

  /**
   * Limpiar todo el historial
   */
  clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.history);
    console.log('🗑️ Historial de sesiones limpiado');
  }

  /**
   * Obtener la variación de personal por hora para una fecha dada
   * Devuelve un array de 24 elementos (uno por hora) con la cantidad de usuarios activos
   */
  getHourlyVariation(fecha) {
    const dayRecords = this.getHistoryByDate(fecha);
    const hours = [];

    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(`${fecha}T${h.toString().padStart(2, '0')}:00:00`);
      const hourEnd = new Date(`${fecha}T${h.toString().padStart(2, '0')}:59:59`);

      // Usuarios activos durante esta hora (su sesión se solapó con esta hora)
      const activeUsers = new Set();
      const activeByRol = {};

      for (const record of dayRecords) {
        const sessionStart = new Date(record.inicio);
        const sessionEnd = new Date(record.fin);

        // Sesión se solapa con esta hora si: inicio < finHora AND fin > inicioHora
        if (sessionStart <= hourEnd && sessionEnd >= hourStart) {
          activeUsers.add(record.username);

          const rol = record.rol || 'otro';
          if (!activeByRol[rol]) {
            activeByRol[rol] = new Set();
          }
          activeByRol[rol].add(record.username);
        }
      }

      // Convertir Sets a conteos
      const rolCounts = {};
      for (const [rol, users] of Object.entries(activeByRol)) {
        rolCounts[rol] = users.size;
      }

      hours.push({
        hora: h,
        horaTexto: `${h.toString().padStart(2, '0')}:00`,
        total: activeUsers.size,
        porRol: rolCounts
      });
    }

    return hours;
  }

  /**
   * Obtener el detalle de usuarios activos por hora para una fecha dada
   * Devuelve los nombres y roles de cada persona activa en cada hora
   */
  getHourlyDetail(fecha) {
    const dayRecords = this.getHistoryByDate(fecha);
    const hours = [];

    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(`${fecha}T${h.toString().padStart(2, '0')}:00:00`);
      const hourEnd = new Date(`${fecha}T${h.toString().padStart(2, '0')}:59:59`);

      const usersMap = {};

      for (const record of dayRecords) {
        const sessionStart = new Date(record.inicio);
        const sessionEnd = new Date(record.fin);

        if (sessionStart <= hourEnd && sessionEnd >= hourStart) {
          if (!usersMap[record.username]) {
            usersMap[record.username] = {
              username: record.username,
              nombre: record.nombre,
              rol: record.rol
            };
          }
        }
      }

      hours.push({
        hora: h,
        horaTexto: `${h.toString().padStart(2, '0')}:00`,
        usuarios: Object.values(usersMap)
      });
    }

    return hours;
  }

  // ─────────────────────────────────────────────────────────────
  // 📝 MÉTODOS DE FORMULARIOS LLENADOS
  // ─────────────────────────────────────────────────────────────

  /**
   * Obtener el historial completo de formularios llenados
   */
  getFormFillHistory() {
    const raw = localStorage.getItem('fishcort_formfill_history');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  /**
   * Agregar un registro de formulario llenado al historial
   */
  recordFormFill(record) {
    const history = this.getFormFillHistory();
    history.push({
      ...record,
      fecha: record.fecha || new Date().toISOString().split('T')[0]
    });
    if (history.length > 1000) history.splice(0, history.length - 1000);
    localStorage.setItem('fishcort_formfill_history', JSON.stringify(history));
  }

  /**
   * Obtener formularios llenados filtrados por fecha (YYYY-MM-DD)
   */
  getFormFillByDate(fecha) {
    return this.getFormFillHistory().filter(r => r.fecha === fecha);
  }

  /**
   * Obtener resumen global: total por plantilla, por usuario, etc.
   */
  getFormFillSummary() {
    const history = this.getFormFillHistory();
    const byTemplate = {};
    const byUser = {};

    for (const r of history) {
      // por plantilla
      const tKey = r.templateName || 'Sin nombre';
      if (!byTemplate[tKey]) byTemplate[tKey] = { templateName: tKey, total: 0 };
      byTemplate[tKey].total += 1;

      // por usuario
      const uKey = r.username || 'desconocido';
      if (!byUser[uKey]) byUser[uKey] = { username: uKey, nombre: r.nombre || uKey, total: 0 };
      byUser[uKey].total += 1;
    }

    return {
      total: history.length,
      byTemplate: Object.values(byTemplate).sort((a, b) => b.total - a.total),
      byUser: Object.values(byUser).sort((a, b) => b.total - a.total)
    };
  }

  /**
   * Obtener formularios llenados por usuario para una fecha dada
   */
  getFormFillByUserAndDate(fecha) {
    const dayRecords = this.getFormFillByDate(fecha);
    const summary = {};

    for (const r of dayRecords) {
      const key = r.username || 'desconocido';
      if (!summary[key]) {
        summary[key] = {
          username: key,
          nombre: r.nombre || key,
          rol: r.rol,
          total: 0,
          formularios: []
        };
      }
      summary[key].total += 1;
      summary[key].formularios.push(r.templateName || 'Sin nombre');
    }

    return Object.values(summary).sort((a, b) => b.total - a.total);
  }

  /**
   * Obtener el formulario que se está llenando actualmente (si hay uno activo)
   */
  getActiveFormFill() {
    const raw = localStorage.getItem('fishcort_formfill_active');
    if (!raw) return null;
    try {
      const active = JSON.parse(raw);
      if (!active || !active.startedAt) return null;
      // Calcular duración actual
      const ms = Date.now() - new Date(active.startedAt).getTime();
      active._duracionActual = this.formatDuration(ms);
      return active;
    } catch { return null; }
  }

  /**
   * Marcar inicio de llenado de formulario
   */
  startFormFill(user, templateName, templateId) {
    if (!user) return;
    const active = {
      username: user.username,
      nombre: user.nombre || user.username,
      rol: user.rol,
      templateName,
      templateId,
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('fishcort_formfill_active', JSON.stringify(active));
  }

  /**
   * Marcar fin de llenado de formulario y guardarlo en historial
   */
  endFormFill() {
    const raw = localStorage.getItem('fishcort_formfill_active');
    if (!raw) return;
    try {
      const active = JSON.parse(raw);
      if (!active) return;
      const end = new Date();
      const durationMs = end - new Date(active.startedAt);
      this.recordFormFill({
        ...active,
        fin: end.toISOString(),
        duracionMs: durationMs,
        duracionTexto: this.formatDuration(durationMs),
        fecha: end.toISOString().split('T')[0]
      });
    } catch { /* ignore */ }
    localStorage.removeItem('fishcort_formfill_active');
  }

  /**
   * Obtener resumen por rol para una fecha dada
   */
  getSummaryByRolAndDate(fecha) {
    const dayRecords = this.getHistoryByDate(fecha);
    const summary = {};

    for (const record of dayRecords) {
      const rol = record.rol || 'otro';
      if (!summary[rol]) {
        summary[rol] = {
          rol,
          usuarios: new Set(),
          totalMs: 0,
          sesiones: 0
        };
      }
      summary[rol].usuarios.add(record.username);
      summary[rol].totalMs += record.duracionMs;
      summary[rol].sesiones += 1;
    }

    return Object.values(summary).map(item => ({
      rol: item.rol,
      cantidadUsuarios: item.usuarios.size,
      totalMs: item.totalMs,
      totalTexto: this.formatDuration(item.totalMs),
      sesiones: item.sesiones
    }));
  }
}

const sessionTimeService = new SessionTimeService();
export default sessionTimeService;
