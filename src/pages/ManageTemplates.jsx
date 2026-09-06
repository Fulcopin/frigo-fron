"use client"

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./ManageTemplates.css";
import { API_BASE_URL } from "../apiConfig";
import authService from "../services/authService";
import { exportFormToExcel } from "../services/excelExportService";
import alertService from "../services/alertService";
import { fetchUsers } from "../services/userService";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;

function ManageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 📝 Historial manual
  const [showManualHistory, setShowManualHistory] = useState(false);
  const [manualHistoryTemplate, setManualHistoryTemplate] = useState(null);
  const [manualHistoryEntries, setManualHistoryEntries] = useState([]);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAutoHistory, setShowAutoHistory] = useState(false);
  const [newHistoryFecha, setNewHistoryFecha] = useState('');
  const [newHistoryCambio, setNewHistoryCambio] = useState('');
  const [newHistoryVersion, setNewHistoryVersion] = useState('');
  // 📢 Notificación masiva del cambio a todos los usuarios (correo)
  // La preferencia se recuerda en el navegador: si lo marcas queda marcado, si lo quitas queda quitado
  const [notifyAllUsers, setNotifyAllUsers] = useState(() => localStorage.getItem('mh_notifyAllUsers') === '1');
  const [savingHistoryEntry, setSavingHistoryEntry] = useState(false);

  const handleToggleNotifyAll = (checked) => {
    setNotifyAllUsers(checked);
    localStorage.setItem('mh_notifyAllUsers', checked ? '1' : '0');
  };


  // �👁️ Pre-visualización
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // 📋 Duplicar plantilla
  const [duplicarOrigen, setDuplicarOrigen] = useState(null);
  const [duplicarCodigo, setDuplicarCodigo] = useState('');
  const [duplicarNombre, setDuplicarNombre] = useState('');
  const [duplicando, setDuplicando] = useState(false);
  const [duplicarError, setDuplicarError] = useState('');

  const currentUser = authService.getCurrentUser();
  
  // 🔒 Solo admin puede eliminar (SGI y tu persona)
  const canDelete = currentUser?.rol === 'admin';

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        // Usa /all para que el admin vea también las obsoletas
        const response = await fetch(`${API_URL_TEMPLATES}/all`);
        if (!response.ok) {
          throw new Error("No se pudieron cargar las plantillas.");
        }
        const data = await response.json();
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        setTemplates(templatesArray);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // 🔍 Filtrar plantillas por búsqueda
  const filteredTemplates = templates
    .filter(t => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (t.nombre || '').toLowerCase().includes(term) ||
        (t.codigo || '').toLowerCase().includes(term) ||
        (t.proceso || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) =>
      (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true, sensitivity: 'base' })
    );

  // ── 📋 DUPLICAR PLANTILLA ──────────────────────────────────────────────
  //
  // Crea una plantilla nueva con TODO el contenido de otra: encabezado, tablas,
  // firmas y configuración. Lo único que cambia es la identidad —código y
  // nombre, que se piden en el modal— y que la copia nace activa aunque el
  // original esté obsoleto: si la estás duplicando es para usarla.
  //
  // El código no tiene índice único en la base, así que un duplicado no falla
  // en el servidor. Se avisa acá y se deja decidir.

  /** Sugiere «PD-04-COPIA», y si ya existe, «PD-04-COPIA 2», «3»… */
  const sugerirCodigoCopia = (codigo) => {
    const base = `${(codigo || 'PLANTILLA').trim()}-COPIA`;
    const usados = new Set(templates.map(t => String(t.codigo || '').trim().toUpperCase()));
    if (!usados.has(base.toUpperCase())) return base;
    for (let i = 2; i < 100; i++) {
      if (!usados.has(`${base} ${i}`.toUpperCase())) return `${base} ${i}`;
    }
    return base;
  };

  const handleOpenDuplicar = (template) => {
    setDuplicarError('');
    setDuplicarOrigen(template);
    setDuplicarCodigo(sugerirCodigoCopia(template.codigo));
    setDuplicarNombre(`${template.nombre || 'Plantilla'} (copia)`);
  };

  const handleConfirmDuplicar = async () => {
    if (!duplicarOrigen) return;
    const codigo = duplicarCodigo.trim();
    const nombre = duplicarNombre.trim();
    if (!codigo || !nombre) { setDuplicarError('El código y el nombre son obligatorios.'); return; }

    setDuplicando(true);
    setDuplicarError('');
    try {
      // Se relee del servidor en vez de copiar el objeto del listado: así la
      // copia sale del estado guardado real y no de lo que la lista tenga
      // cargado en memoria.
      const resGet = await fetch(`${API_URL_TEMPLATES}/${duplicarOrigen.templateID}`);
      if (!resGet.ok) throw new Error(`No se pudo leer la plantilla original (${resGet.status})`);
      const original = await resGet.json();

      // Se copia TODO y solo se saca la identidad, para que cualquier campo que
      // se agregue a la plantilla en el futuro se duplique solo.
      const copia = { ...original };
      for (const k of ['templateID', 'TemplateID', 'createdAt', 'CreatedAt',
                       'updatedAt', 'UpdatedAt', '$id', '$values']) {
        delete copia[k];
      }
      copia.codigo = codigo;
      copia.nombre = nombre;
      copia.isObsolete = false;
      copia.isDraft = false;

      const resPost = await fetch(API_URL_TEMPLATES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copia),
      });
      if (!resPost.ok) {
        const detalle = await resPost.text();
        throw new Error(`El servidor rechazó la copia (${resPost.status}): ${detalle.slice(0, 200)}`);
      }
      const creada = await resPost.json();

      // El listado viene ordenado por fecha de creación descendente.
      setTemplates(prev => [creada, ...prev]);
      setDuplicarOrigen(null);
    } catch (err) {
      console.error('Error al duplicar la plantilla:', err);
      setDuplicarError(err.message || 'No se pudo duplicar la plantilla.');
    } finally {
      setDuplicando(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!canDelete) {
      alert("⚠️ Solo el personal de Sistema de Gestión Integrado puede eliminar plantillas.");
      return;
    }
    if (!globalThis.confirm("¿Estás seguro de que quieres eliminar esta PLANTILLA? Esta acción es permanente y no se puede deshacer.")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la plantilla desde el servidor.");
      }

      setTemplates(prevTemplates => prevTemplates.filter(t => t.templateID !== templateId));
      alert("Plantilla eliminada exitosamente.");

    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    }
  };

  // ========== 🚫 TOGGLE OBSOLETO ==========
  const handleToggleObsolete = async (template) => {
    const newValue = !template.isObsolete;
    const action = newValue ? 'marcar como OBSOLETA' : 'reactivar';
    if (!globalThis.confirm(`¿Estás seguro de ${action} la plantilla "${template.nombre}"?${newValue ? '\n\nNo aparecerá en el listado para llenar formularios, pero los registros pasados se mantienen.' : ''}`)) {
      return;
    }
    try {
      // Traer la plantilla completa para hacer PUT
      const getResp = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!getResp.ok) throw new Error('Error al obtener plantilla');
      const fullTemplate = await getResp.json();
      
      const payload = { ...fullTemplate, isObsolete: newValue };
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Error al actualizar');
      
      setTemplates(prev => prev.map(t => 
        t.templateID === template.templateID ? { ...t, isObsolete: newValue } : t
      ));
      alert(newValue ? '✅ Plantilla marcada como obsoleta.' : '✅ Plantilla reactivada.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // ========== 📝 HISTORIAL MANUAL (API) ==========

  const loadManualHistory = async (templateId) => {
    setHistoryLoadError(false);
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${templateId}/changelog`);
      if (!response.ok) {
        setHistoryLoadError(true);
        setHistoryLoading(false);
        return null; // null = error, no borrar entradas existentes
      }
      const data = await response.json();
      const arr = Array.isArray(data) ? data : data.$values || [];
      const entries = arr.map(e => ({
        id: e.id || e.Id,
        fecha: (e.fecha || e.Fecha) ? (e.fecha || e.Fecha).split('T')[0] : '',
        cambioRealizado: e.cambioRealizado || e.CambioRealizado || '',
        version: e.version || e.Version || ''
      }));
      setHistoryLoading(false);
      return entries;
    } catch {
      setHistoryLoadError(true);
      setHistoryLoading(false);
      return null; // null = error, no borrar entradas existentes
    }
  };

  const handleOpenManualHistory = async (template) => {
    setManualHistoryTemplate(template);
    setManualHistoryEntries([]);
    setShowAutoHistory(false);
    setShowManualHistory(true);
    setNewHistoryFecha('');
    setNewHistoryCambio('');
    setNewHistoryVersion(template.version || '');
    const entries = await loadManualHistory(template.templateID);
    if (entries !== null) setManualHistoryEntries(entries);
  };

  // 📢 Enviar el cambio registrado como notificación (correo) a TODOS los usuarios
  const enviarNotificacionMasiva = async (entry) => {
    const users = await fetchUsers(authService.getToken());
    const emails = [...new Set(
      (Array.isArray(users) ? users : [])
        .map(u => (u.email || '').trim().toLowerCase())
        .filter(e => e.includes('@'))
    )];
    if (emails.length === 0) {
      alert('⚠️ El registro se guardó, pero no se encontraron usuarios con correo para notificar.');
      return;
    }

    const fechaFmt = entry.fecha ? (() => { const [y, m, d] = entry.fecha.split('-'); return `${d}/${m}/${y}`; })() : '';
    const titulo = `📢 Actualización de documento: ${manualHistoryTemplate.codigo} (Versión ${entry.version})`;
    const mensaje = `El documento ${manualHistoryTemplate.codigo} — ${manualHistoryTemplate.nombre} fue actualizado a la versión ${entry.version}.` +
      `\n\nCambio realizado${fechaFmt ? ` (${fechaFmt})` : ''}:\n${entry.cambioRealizado}`;

    const resultados = await Promise.allSettled(emails.map(email =>
      alertService.createManualAlert({
        type: 'template_update',
        priority: 'medium',
        title: titulo,
        message: mensaje,
        targetEmail: email,
        formCode: manualHistoryTemplate.codigo
      })
    ));
    const ok = resultados.filter(r => r.status === 'fulfilled').length;
    if (ok === emails.length) {
      alert(`📧 Notificación del cambio enviada a los ${ok} usuarios.`);
    } else {
      alert(`📧 Notificación enviada a ${ok} de ${emails.length} usuarios (algunos envíos fallaron).`);
    }
  };

  const handleAddManualEntry = async () => {
    if (!newHistoryFecha.trim() || !newHistoryCambio.trim()) {
      alert('Por favor completa la fecha y el cambio realizado.');
      return;
    }
    const optimisticEntry = {
      id: Date.now(), // temporal hasta recargar
      fecha: newHistoryFecha.trim(),
      version: newHistoryVersion.trim() || manualHistoryTemplate.version || 'N/A',
      cambioRealizado: newHistoryCambio.trim()
    };
    try {
      setSavingHistoryEntry(true);
      const response = await fetch(`${API_URL_TEMPLATES}/${manualHistoryTemplate.templateID}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: newHistoryFecha.trim(),
          version: optimisticEntry.version,
          cambioRealizado: newHistoryCambio.trim()
        })
      });
      if (!response.ok) throw new Error(`Error ${response.status} al guardar`);
      setNewHistoryFecha('');
      setNewHistoryCambio('');
      setNewHistoryVersion(manualHistoryTemplate.version || '');
      // Recargar desde servidor; si falla, mantener entrada optimista
      const updatedEntries = await loadManualHistory(manualHistoryTemplate.templateID);
      if (updatedEntries !== null) {
        setManualHistoryEntries(updatedEntries);
      } else {
        setManualHistoryEntries(prev => [optimisticEntry, ...prev]);
      }
      // 📢 Solo si el check está marcado: notificar a todos los usuarios por correo
      if (notifyAllUsers) {
        try {
          await enviarNotificacionMasiva(optimisticEntry);
        } catch (notifyErr) {
          alert('⚠️ El registro se guardó, pero falló el envío de la notificación masiva: ' + notifyErr.message);
        }
      }
    } catch (err) {
      alert('Error guardando el registro: ' + err.message);
    } finally {
      setSavingHistoryEntry(false);
    }
  };

  const handleDeleteManualEntry = async (entryId) => {
    if (!globalThis.confirm('¿Eliminar este registro del historial?')) return;
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/changelog/${entryId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar');
      setManualHistoryEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      alert('Error eliminando el registro: ' + err.message);
    }
  };

  // ========== 👁️ PRE-VISUALIZACIÓN ==========
  const handlePreview = async (template) => {
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!response.ok) throw new Error('Error al cargar plantilla');
      const data = await response.json();
      
      const parsed = {
        ...data,
        headerFields: data.headerFields ? JSON.parse(data.headerFields) : [],
        bodyElements: data.bodyElements ? JSON.parse(data.bodyElements) : [],
        firmas: data.firmas ? JSON.parse(data.firmas) : [],
      };
      setPreviewTemplate(parsed);
      setShowPreview(true);
    } catch (err) {
      alert('Error al cargar la vista previa: ' + err.message);
    }
  };

  // ========== 📄 DESCARGAR PLANTILLA VACÍA ==========
  const handleDownloadEmpty = async (template) => {
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!response.ok) throw new Error('Error al cargar plantilla');
      const data = await response.json();
      
      const parsed = {
        ...data,
        headerFields: data.headerFields ? JSON.parse(data.headerFields) : [],
        bodyElements: data.bodyElements ? JSON.parse(data.bodyElements) : [],
        firmas: data.firmas ? JSON.parse(data.firmas) : [],
      };

      // 📊 Crear formulario vacío con estructura de datos vacía
      // Construir firmasData con puesto como clave y nombre del catálogo como valor
      const firmasDataVacio = {};
      (parsed.firmas || []).forEach(firma => {
        firmasDataVacio[firma.puesto] = {
          nombre: firma.nombreCompleto || '',
          fecha: ''
        };
      });

      const emptyForm = {
        templateID: template.templateID,
        templateCodigo: parsed.codigo,
        templateNombre: parsed.nombre,
        version: parsed.version || 1,
        createdAt: new Date().toISOString(),
        headerData: {},
        bodyData: [],
        firmasData: firmasDataVacio
      };

      // Llenar headerData con campos vacíos
      parsed.headerFields.forEach(field => {
        emptyForm.headerData[field.name || field.label] = '';
      });

      // Llenar bodyData con arrays vacíos para tablas
      emptyForm.bodyData = parsed.bodyElements.map((element, index) => {
        if (element.type === 'table') {
          return {
            elementIndex: index,
            elementId: element.id || `element_${index}`,
            title: element.title || 'Tabla',
            type: 'table',
            data: [] // Array vacío - Excel mostrará las columnas sin datos
          };
        } else if (element.type === 'section') {
          const sectionData = {};
          (element.fields || []).forEach(field => {
            sectionData[field.name || field.label] = '';
          });
          return {
            elementIndex: index,
            elementId: element.id || `element_${index}`,
            title: element.title || 'Sección',
            type: 'section',
            data: sectionData
          };
        }
        return null;
      }).filter(Boolean);

      // 📊 Exportar a Excel
      console.log('📊 Exportando formulario vacío a Excel...', { emptyForm, template: parsed });
      await exportFormToExcel(emptyForm, parsed);

    } catch (err) {
      console.error('❌ Error al generar Excel:', err);
      alert('Error al generar el Excel: ' + err.message);
    }
  };

  if (loading) return <div className="manage-templates"><h1>Cargando plantillas...</h1></div>;
  if (error) return <div className="manage-templates"><h1 className="error-message">Error: {error}</h1></div>;

  return (
    <div className="manage-templates">
      <div className="page-header">
        <h1>Administrar Plantillas de Formularios</h1>
        <Link to="/create-template" className="btn-primary">
          + Crear Nueva Plantilla
        </Link>
      </div>

      {/* 🔍 BUSCADOR */}
      <div className="search-bar-manage">
        <span className="search-icon-manage">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, código o proceso..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input-manage"
        />
        {searchTerm && (
          <button className="search-clear-manage" onClick={() => setSearchTerm('')}>✕</button>
        )}
        <span className="search-count-manage">{filteredTemplates.length} de {templates.length}</span>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="empty-state-card">
          <p>{searchTerm ? `No se encontraron plantillas con "${searchTerm}"` : 'No hay plantillas disponibles. ¡Crea la primera!'}</p>
        </div>
      ) : (
        <div className="templates-list">
          {filteredTemplates.map((template) => (
            <div key={template.templateID} className={`template-card-manage ${template.isObsolete ? 'template-obsolete' : ''}`}>
              <div className="template-card-info">
                <span className="template-code">{template.codigo}</span>
                {template.isObsolete && (
                  <span style={{
                    display: 'inline-block', marginLeft: '8px', padding: '2px 10px',
                    background: '#ef4444', color: 'white', borderRadius: '12px',
                    fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px'
                  }}>🚫 OBSOLETA</span>
                )}
                <h3 style={template.isObsolete ? { color: '#6b7280', textDecoration: 'line-through' } : undefined}>{template.nombre}</h3>
                <span className="template-version">Versión: {template.version}</span>
                {template.proceso && <span className="template-proceso">📁 {template.proceso}</span>}
              </div>
              <div className="template-card-actions">
                {/*  Historial manual */}
                <button 
                  onClick={() => handleOpenManualHistory(template)} 
                  className="btn-manual-history"
                  title="Registro manual de cambios"
                >
                  📝 Registro Cambios
                </button>

                <button
                  onClick={() => handlePreview(template)}
                  className="btn-secondary"
                  style={{ background: '#0ea5e9', color: 'white', border: 'none' }}
                  title="Vista previa del formulario"
                >
                  👁️ Vista Previa
                </button>

                <button
                  onClick={() => handleDownloadEmpty(template)}
                  className="btn-secondary"
                  style={{ background: '#16a34a', color: 'white', border: 'none' }}
                  title="Imprimir formulario en blanco"
                >
                  🖨️ Imprimir Vacío
                </button>

                <button
                  onClick={() => handleToggleObsolete(template)}
                  className="btn-secondary"
                  style={{
                    background: template.isObsolete ? '#22c55e' : '#ef4444',
                    color: 'white', border: 'none',
                    fontSize: '13px'
                  }}
                  title={template.isObsolete ? 'Reactivar plantilla' : 'Marcar como obsoleta (no aparece para llenar)'}
                >
                  {template.isObsolete ? '✅ Reactivar' : '🚫 Obsoleto'}
                </button>

                <button
                  onClick={() => handleOpenDuplicar(template)}
                  className="btn-secondary"
                  style={{ background: '#8b5cf6', color: 'white', border: 'none' }}
                  title="Crear una plantilla nueva con el mismo contenido"
                >
                  📋 Duplicar
                </button>

                <Link 
                  to={`/edit-template/${template.templateID}`} 
                  className="btn-secondary"
                >
                  ✏️ Editar
                </Link>
                
                {/* 🔒 Solo admin puede eliminar */}
                {canDelete && (
                  <button 
                    onClick={() => handleDeleteTemplate(template.templateID)} 
                    className="btn-danger"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== MODAL: REGISTRO DE CAMBIOS ========== */}
      {showManualHistory && manualHistoryTemplate && (
        <div className="modal-overlay" onClick={() => setShowManualHistory(false)}>
          <div className="modal-manual-history" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-mh">
              <div>
                <h2>📝 Registro de Cambios</h2>
                <p className="modal-subtitle-mh">{manualHistoryTemplate.codigo} — {manualHistoryTemplate.nombre}</p>
              </div>
              <button className="modal-close-mh" onClick={() => setShowManualHistory(false)}>✕</button>
            </div>

            {/* Formulario para agregar nuevo registro */}
            <div className="mh-form">
              <h3>➕ Agregar Nuevo Registro</h3>
              <div className="mh-form-grid">
                <div className="mh-field">
                  <label>Fecha del cambio *</label>
                  <input 
                    type="date" 
                    value={newHistoryFecha} 
                    onChange={(e) => setNewHistoryFecha(e.target.value)}
                  />
                </div>
                <div className="mh-field">
                  <label>Cambio realizado / Modificación *</label>
                  <textarea 
                    value={newHistoryCambio} 
                    onChange={(e) => setNewHistoryCambio(e.target.value)}
                    placeholder="Describe qué se modificó..."
                    rows={3}
                  />
                </div>
                <div className="mh-field">
                  <label>Versión</label>
                  <input 
                    type="text" 
                    value={newHistoryVersion !== undefined ? newHistoryVersion : (manualHistoryTemplate?.version || '')} 
                    onChange={(e) => setNewHistoryVersion(e.target.value)}
                    placeholder="Ej: 1, 2, 1.1"
                  />
                </div>
              </div>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '10px 0',
                padding: '10px 12px', background: notifyAllUsers ? '#eff6ff' : '#f9fafb',
                border: `1px solid ${notifyAllUsers ? '#93c5fd' : '#e5e7eb'}`, borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px', color: '#374151'
              }}>
                <input
                  type="checkbox"
                  checked={notifyAllUsers}
                  onChange={(e) => handleToggleNotifyAll(e.target.checked)}
                  style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>
                  📢 <strong>Enviar notificación masiva a todos los usuarios</strong>
                  <br />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Se enviará a todos los correos la descripción de este cambio y la versión actual. Si no lo marcas, no se envía nada.
                  </span>
                </span>
              </label>
              <button className="btn-add-mh" onClick={handleAddManualEntry} disabled={savingHistoryEntry}>
                {savingHistoryEntry ? '⏳ Guardando...' : '💾 Agregar Registro'}
              </button>
            </div>

            {/* Tabla de registros */}
            <div className="mh-entries">
              <h3 style={{marginTop:0}}>📋 HISTORIAL DE CAMBIOS Y/O MODIFICACIONES</h3>
              {historyLoading ? (
                <p className="mh-empty">⏳ Cargando historial...</p>
              ) : historyLoadError ? (
                <p className="mh-empty" style={{color:'#ef4444'}}>
                  ⚠️ No se pudo cargar el historial. Verifica que el servidor esté activo.
                  <button onClick={() => loadManualHistory(manualHistoryTemplate?.templateID).then(e => { if(e!==null) setManualHistoryEntries(e); })}
                    style={{marginLeft:'10px', fontSize:'12px', background:'#ef4444', color:'white', border:'none', borderRadius:'4px', padding:'2px 8px', cursor:'pointer'}}>
                    🔄 Reintentar
                  </button>
                </p>
              ) : (() => {
                const manualEntries = manualHistoryEntries.filter(e => !e.cambioRealizado.startsWith('[Auto]'));
                const autoEntries = manualHistoryEntries.filter(e => e.cambioRealizado.startsWith('[Auto]'));
                const renderTable = (entries, isDeletable) => (
                  <div className="mh-table-wrapper">
                    <table className="mh-table">
                      <thead>
                        <tr>
                          <th>FECHA</th>
                          <th>VERSIÓN</th>
                          <th>MODIFICACIÓN</th>
                          {isDeletable && <th style={{ width: '42px' }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="mh-td-fecha">
                              {entry.fecha && entry.fecha.includes('T')
                                ? new Date(entry.fecha).toLocaleDateString('es-EC', {
                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                  })
                                : entry.fecha
                                  ? (() => { const [y, m, d] = entry.fecha.split('-'); return `${d}/${m}/${y}`; })()
                                  : 'N/A'
                              }
                            </td>
                            <td className="mh-td-version">{entry.version}</td>
                            <td className="mh-td-modificacion">
                              {isDeletable ? entry.cambioRealizado : entry.cambioRealizado.replace('[Auto] ', '')}
                            </td>
                            {isDeletable && (
                              <td>
                                <button
                                  className="mh-entry-delete"
                                  onClick={() => handleDeleteManualEntry(entry.id)}
                                  title="Eliminar registro"
                                >
                                  🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
                return (
                  <>
                    {manualEntries.length === 0 ? (
                      <p className="mh-empty">No hay registros manuales aún. Agrega el primero usando el formulario de arriba.</p>
                    ) : renderTable(manualEntries, true)}
                    {autoEntries.length > 0 && (
                      <div style={{marginTop:'16px'}}>
                        <button
                          onClick={() => setShowAutoHistory(v => !v)}
                          style={{fontSize:'12px', background:'none', border:'1px solid #d1d5db', borderRadius:'6px', padding:'4px 12px', cursor:'pointer', color:'#6b7280'}}
                        >
                          {showAutoHistory ? '▲ Ocultar' : '▼ Ver'} cambios del sistema ({autoEntries.length})
                        </button>
                        {showAutoHistory && (
                          <div style={{marginTop:'8px', opacity:0.7}}>
                            {renderTable(autoEntries, false)}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: PRE-VISUALIZACIÓN ========== */}
      {/* 📋 MODAL: duplicar plantilla */}
      {duplicarOrigen && (
        <div className="modal-overlay" onClick={() => !duplicando && setDuplicarOrigen(null)}>
          <div className="modal-manual-history" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header-mh">
              <div>
                <h2 className="modal-title-mh">📋 Duplicar plantilla</h2>
                <p className="modal-subtitle-mh">
                  Copia de <strong>{duplicarOrigen.codigo}</strong> — {duplicarOrigen.nombre}
                </p>
              </div>
              <button className="modal-close-mh" onClick={() => setDuplicarOrigen(null)} disabled={duplicando}>✕</button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
                Se crea una plantilla nueva con el mismo encabezado, las mismas tablas,
                las mismas firmas y la misma configuración. El original no se toca.
              </p>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                Código nuevo *
              </label>
              <input
                type="text"
                value={duplicarCodigo}
                onChange={(e) => setDuplicarCodigo(e.target.value)}
                disabled={duplicando}
                style={{ width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', marginBottom: '14px' }}
              />

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                Nombre nuevo *
              </label>
              <input
                type="text"
                value={duplicarNombre}
                onChange={(e) => setDuplicarNombre(e.target.value)}
                disabled={duplicando}
                onKeyDown={(e) => { if (e.key === 'Enter' && !duplicando) handleConfirmDuplicar(); }}
                style={{ width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
              />

              {duplicarError && (
                <div style={{ marginTop: '14px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {duplicarError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={() => setDuplicarOrigen(null)}
                  disabled={duplicando}
                  style={{ padding: '9px 16px', border: '1px solid #cbd5e1', background: '#fff', color: '#374151', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDuplicar}
                  disabled={duplicando}
                  style={{ padding: '9px 16px', border: 'none', background: duplicando ? '#a78bfa' : '#8b5cf6', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: duplicando ? 'default' : 'pointer' }}
                >
                  {duplicando ? '⏳ Duplicando…' : `📋 Crear copia`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewTemplate && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-preview">
              <div>
                <h2>👁️ Vista Previa del Formulario</h2>
                <p className="modal-subtitle-mh">{previewTemplate.codigo} — {previewTemplate.nombre} (v{previewTemplate.version})</p>
              </div>
              <button className="modal-close-mh" onClick={() => setShowPreview(false)}>✕</button>
            </div>

            <div className="preview-content">
              {/* Info general */}
              {previewTemplate.objetivo && (
                <div className="preview-info-box">
                  <strong>Objetivo:</strong> {previewTemplate.objetivo}
                </div>
              )}

              {/* Campos de encabezado */}
              {previewTemplate.headerFields.length > 0 && (
                <div className="preview-section">
                  <h3>📝 Encabezado</h3>
                  <table className="preview-table">
                    <tbody>
                      {previewTemplate.headerFields.map((f, i) => (
                        <tr key={i}>
                          <td className="preview-label">{f.label || 'Campo'}</td>
                          <td className="preview-value">
                            {f.type === 'select' ? (
                              <select disabled><option>— Seleccionar —</option>{(f.options || []).map((o, j) => <option key={j}>{o}</option>)}</select>
                            ) : f.type === 'date' ? (
                              <input type="date" disabled />
                            ) : f.type === 'time' ? (
                              <input type="time" disabled />
                            ) : f.type === 'textarea' ? (
                              <textarea disabled placeholder={f.label} rows={2} />
                            ) : (
                              <input type={f.type || 'text'} disabled placeholder={f.label} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Body elements */}
              {previewTemplate.bodyElements.map((el, idx) => (
                <div key={idx} className="preview-section">
                  <h3>{el.type === 'table' ? '📊' : '📝'} {el.title || 'Sección'}</h3>
                  
                  {el.type === 'table' && (
                    <div className="preview-table-wrapper">
                      <table className="preview-table preview-table-body">
                        <thead>
                          <tr>
                            {(el.columns || []).map((c, ci) => (
                              <th key={ci}>{c.label || `Col ${ci + 1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[0, 1, 2].map(rowIdx => (
                            <tr key={rowIdx}>
                              {(el.columns || []).map((c, ci) => (
                                <td key={ci}>
                                  {c.type === 'select' ? (
                                    <select disabled style={{ width: '100%' }}>
                                      <option>—</option>
                                      {(c.options || []).map((o, j) => <option key={j}>{o}</option>)}
                                    </select>
                                  ) : (
                                    <input type={c.type || 'text'} disabled placeholder="..." style={{ width: '100%' }} />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {el.type === 'section' && (
                    <table className="preview-table">
                      <tbody>
                        {(el.fields || []).map((f, fi) => (
                          <tr key={fi}>
                            <td className="preview-label">{f.label || 'Campo'}</td>
                            <td className="preview-value">
                              <input type={f.type || 'text'} disabled placeholder={f.label} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {/* Firmas */}
              {previewTemplate.firmas.length > 0 && (
                <div className="preview-section">
                  <h3>✍️ Firmas</h3>
                  <div className="preview-firmas">
                    {previewTemplate.firmas.map((f, i) => (
                      <div key={i} className="preview-firma-box">
                        <div className="preview-firma-area">Firma</div>
                        <div className="preview-firma-puesto">{f.puesto || 'Cargo'}</div>
                        <div className="preview-firma-fields">
                          <span>Nombre: ____________</span>
                          <span>Fecha: __/__/____</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>  
  );      
}           

export default ManageTemplates; 