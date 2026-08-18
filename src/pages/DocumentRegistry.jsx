import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { API_BASE_URL } from '../apiConfig';
import { exportarListaMaestraExcel } from '../services/excelExportService';
import {
  AREAS_SUGERIDAS, OPCIONES_COPIA_CONTROLADA, listarDocumentosManuales,
  crearDocumentoManual, actualizarDocumentoManual, eliminarDocumentoManual,
  agruparPorArea, esSi,
} from '../services/documentosManualesService';
import { ordenarFormularios } from '../utils/ordenFormularios';
import './DocumentRegistry.css';

/** Pestaña de los formularios que ya viven en el sistema. */
const TAB_SISTEMA = '__sistema__';

/** Documento manual vacío, para el formulario de alta. */
const NUEVO_DOC = {
  nombre: '', codigo: '', version: '1', fecha: '',
  copiaControlada: 'No', ubicacion: '', observaciones: '', obsoleto: false,
};

export default function DocumentRegistry() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProceso, setFilterProceso] = useState('');
  const [hiddenIds, setHiddenIds] = useState(() => {
    try {
      const saved = localStorage.getItem('frigolab_hidden_documents');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [documentLocations, setDocumentLocations] = useState(() => {
    try {
      const saved = localStorage.getItem('frigolab_document_locations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // 📄 Copia controlada de los formularios del sistema (los manuales la guardan
  // en su propia tabla). Por defecto "No", como en la lista maestra en papel.
  const [copiaControlada, setCopiaControlada] = useState(() => {
    try {
      const saved = localStorage.getItem('frigolab_document_copia_controlada');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [showHidden, setShowHidden] = useState(false);
  const [showObsolete, setShowObsolete] = useState(false);

  // 🗂️ Documentos cargados a mano por SGI, agrupados en pestañas por área
  const [manuales, setManuales] = useState([]);
  const [tab, setTab] = useState(TAB_SISTEMA);
  const [nuevoDoc, setNuevoDoc] = useState(NUEVO_DOC);
  const [editando, setEditando] = useState(null);   // { id, ...campos }
  const [guardando, setGuardando] = useState(false);
  const [avisoManual, setAvisoManual] = useState(null);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor';

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/all`);
      if (!response.ok) throw new Error('Error al cargar plantillas');
      const data = await response.json();
      const templatesArray = Array.isArray(data) ? data : data.$values || [];
      setTemplates(ordenarFormularios(templatesArray));
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarManuales = useCallback(async () => {
    setManuales(await listarDocumentosManuales());
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { cargarManuales(); }, [cargarManuales]);

  // Persistir lo que se edita en pantalla
  useEffect(() => {
    localStorage.setItem('frigolab_hidden_documents', JSON.stringify(hiddenIds));
  }, [hiddenIds]);
  useEffect(() => {
    localStorage.setItem('frigolab_document_locations', JSON.stringify(documentLocations));
  }, [documentLocations]);
  useEffect(() => {
    localStorage.setItem('frigolab_document_copia_controlada', JSON.stringify(copiaControlada));
  }, [copiaControlada]);

  const toggleVisibility = (templateId) => {
    setHiddenIds(prev =>
      prev.includes(templateId) ? prev.filter(id => id !== templateId) : [...prev, templateId]
    );
  };

  const toggleAll = (hide) => {
    if (hide) {
      const allIds = filteredTemplates.map(t => t.templateID);
      setHiddenIds(prev => [...new Set([...prev, ...allIds])]);
    } else {
      const visibleIds = new Set(filteredTemplates.map(t => t.templateID));
      setHiddenIds(prev => prev.filter(id => !visibleIds.has(id)));
    }
  };

  const uniqueProcesos = [...new Set(templates.map(t => t.proceso).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const handleLocationChange = (templateId, value) => {
    setDocumentLocations(prev => ({ ...prev, [templateId]: value }));
  };
  const handleCopiaChange = (templateId, value) => {
    setCopiaControlada(prev => ({ ...prev, [templateId]: value }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try { return new Date(dateStr).toLocaleDateString('es-ES'); } catch { return '-'; }
  };

  // ── Filtrado de los formularios del sistema ────────────────────────────────
  const filteredTemplates = templates.filter(t => {
    if (t.isObsolete && !showObsolete) return false;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (t.nombre || '').toLowerCase().includes(q) || (t.codigo || '').toLowerCase().includes(q);
    const matchesProceso = !filterProceso || t.proceso === filterProceso;
    return matchesSearch && matchesProceso;
  });

  const visibleTemplates = filteredTemplates.filter(t => !hiddenIds.includes(t.templateID));
  const hiddenTemplates = filteredTemplates.filter(t => hiddenIds.includes(t.templateID));
  const displayedTemplates = showHidden ? filteredTemplates : visibleTemplates;

  // ── Documentos manuales ────────────────────────────────────────────────────
  const areas = useMemo(() => agruparPorArea(manuales), [manuales]);
  const areaActiva = tab === TAB_SISTEMA ? null : tab;

  const manualesDeArea = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return manuales
      .filter(d => d.area === areaActiva)
      .filter(d => (showObsolete ? true : !d.obsoleto))
      .filter(d => !q
        || (d.nombre || '').toLowerCase().includes(q)
        || (d.codigo || '').toLowerCase().includes(q));
  }, [manuales, areaActiva, searchTerm, showObsolete]);

  const agregarArea = () => {
    const nombre = window.prompt(
      `Nombre del área (pestaña).\n\nSugeridas: ${AREAS_SUGERIDAS.join(', ')}`
    );
    const area = String(nombre || '').trim().toUpperCase();
    if (!area) return;
    setTab(area);
    setNuevoDoc(NUEVO_DOC);
    // La pestaña existe en cuanto se carga el primer documento; hasta entonces
    // se muestra vacía con el formulario listo.
  };

  const guardarNuevo = async (e) => {
    e.preventDefault();
    if (!areaActiva || !nuevoDoc.nombre.trim()) return;
    setGuardando(true);
    setAvisoManual(null);
    try {
      await crearDocumentoManual({ ...nuevoDoc, area: areaActiva });
      setNuevoDoc(NUEVO_DOC);
      await cargarManuales();
      setAvisoManual({ tipo: 'ok', texto: '✅ Documento agregado a la lista maestra.' });
    } catch (err) {
      setAvisoManual({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo guardar.'}` });
    } finally {
      setGuardando(false);
    }
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setAvisoManual(null);
    try {
      await actualizarDocumentoManual(editando.id, editando);
      setEditando(null);
      await cargarManuales();
      setAvisoManual({ tipo: 'ok', texto: '✅ Documento actualizado.' });
    } catch (err) {
      setAvisoManual({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo actualizar.'}` });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre}" de la lista maestra?`)) return;
    try {
      await eliminarDocumentoManual(doc.id);
      await cargarManuales();
    } catch (err) {
      setAvisoManual({ tipo: 'error', texto: `❌ ${err.message || 'No se pudo eliminar.'}` });
    }
  };

  // ── Exportar la LISTA MAESTRA completa ─────────────────────────────────────
  // Sale todo junto —formularios del sistema y documentos manuales— porque eso
  // es la lista maestra: un solo documento con todo lo que existe.
  const filasParaExcel = useMemo(() => {
    const delSistema = displayedTemplates.map(t => ({
      nombre: t.nombre || '-',
      codigo: t.codigo || '-',
      version: t.version || '-',
      fecha: formatDate(t.fechaVersion),
      copiaControlada: copiaControlada[t.templateID] || 'No',
      ubicacion: documentLocations[t.templateID] || '',
      estado: t.isObsolete ? 'Obsoleto' : 'Activo',
    }));
    const deAreas = manuales
      .filter(d => showObsolete || !d.obsoleto)
      .map(d => ({
        nombre: d.nombre || '-',
        codigo: d.codigo || '-',
        version: d.version || '-',
        fecha: formatDate(d.fecha),
        copiaControlada: esSi(d.copiaControlada) ? 'Si' : 'No',
        ubicacion: d.ubicacion || '',
        estado: d.obsoleto ? 'Obsoleto' : 'Activo',
      }));
    return [...delSistema, ...deAreas];
  }, [displayedTemplates, manuales, copiaControlada, documentLocations, showObsolete]);

  const handleExportExcel = async () => {
    try {
      await exportarListaMaestraExcel({
        filas: filasParaExcel,
        codigo: 'FOR-SGC-3',
        nombre: 'Lista Maestra Documental',
        version: '1',
        fecha: new Date(),
      });
    } catch (err) {
      alert(`❌ No se pudo generar el Excel.\n${err.message || ''}`);
    }
  };

  if (loading) {
    return (
      <div className="doc-registry">
        <div className="doc-registry-loading">
          <div className="loading-spinner" />
          <p>Cargando documentos registrados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-registry">
      {/* Header */}
      <div className="doc-registry-header">
        <div className="doc-registry-header-left">
          <h1>📄 Documentos Registrados</h1>
          <p className="doc-registry-subtitle">
            Lista Maestra Documental — formularios del sistema y documentos cargados por SGI
          </p>
        </div>
        <div className="doc-registry-header-right">
          <Link to="/" className="btn-secondary-doc">← Volver al Inicio</Link>
        </div>
      </div>

      {/* Pestañas: sistema + un área por cada grupo de documentos manuales */}
      <div className="doc-tabs">
        <button
          className={`doc-tab ${tab === TAB_SISTEMA ? 'doc-tab--active' : ''}`}
          onClick={() => setTab(TAB_SISTEMA)}
        >
          🖥️ Del sistema <span className="doc-tab__count">{filteredTemplates.length}</span>
        </button>
        {areas.map(({ area, documentos }) => (
          <button
            key={area}
            className={`doc-tab ${tab === area ? 'doc-tab--active' : ''}`}
            onClick={() => { setTab(area); setEditando(null); setAvisoManual(null); }}
          >
            🗂️ {area} <span className="doc-tab__count">{documentos.length}</span>
          </button>
        ))}
        {/* Pestaña recién creada que todavía no tiene documentos */}
        {areaActiva && !areas.some(a => a.area === areaActiva) && (
          <button className="doc-tab doc-tab--active">🗂️ {areaActiva} <span className="doc-tab__count">0</span></button>
        )}
        {isAdmin && (
          <button className="doc-tab doc-tab--nueva" onClick={agregarArea} title="Crear una pestaña para un área nueva">
            ➕ Nueva área
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="doc-registry-stats">
        <div className="doc-stat">
          <span className="doc-stat-number">{filteredTemplates.length}</span>
          <span className="doc-stat-label">Del sistema</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-number">{manuales.length}</span>
          <span className="doc-stat-label">Cargados por SGI</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-number">{areas.length}</span>
          <span className="doc-stat-label">Áreas</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-number">{filteredTemplates.length + manuales.length}</span>
          <span className="doc-stat-label">Total lista maestra</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="doc-registry-filters">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="doc-search-input"
        />
        {tab === TAB_SISTEMA && (
          <select
            value={filterProceso}
            onChange={(e) => setFilterProceso(e.target.value)}
            className="doc-filter-select"
          >
            <option value="">Todos los procesos</option>
            {uniqueProcesos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        <button
          onClick={handleExportExcel}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          title="Descarga la lista maestra COMPLETA (sistema + áreas) con el encabezado del formato"
        >
          📊 Exportar Lista Maestra ({filasParaExcel.length})
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setShowObsolete(!showObsolete)}
              className={`btn-toggle-hidden ${showObsolete ? 'active' : ''}`}
              style={{ backgroundColor: showObsolete ? '#ef4444' : '#f3f4f6', color: showObsolete ? 'white' : '#374151' }}
            >
              {showObsolete ? '🚫 Ocultar obsoletos' : '👀 Mostrar obsoletos'}
            </button>
            {tab === TAB_SISTEMA && (
              <>
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className={`btn-toggle-hidden ${showHidden ? 'active' : ''}`}
                >
                  {showHidden ? '👁️ Mostrando todos' : `🙈 ${hiddenTemplates.length} ocultos`}
                </button>
                <button onClick={() => toggleAll(true)} className="btn-hide-all" title="Ocultar todos los filtrados">
                  🙈 Ocultar todos
                </button>
                <button onClick={() => toggleAll(false)} className="btn-show-all" title="Mostrar todos los filtrados">
                  👁️ Mostrar todos
                </button>
              </>
            )}
          </>
        )}
      </div>

      {avisoManual && (
        <div className={`doc-aviso doc-aviso--${avisoManual.tipo}`}>{avisoManual.texto}</div>
      )}

      {/* ─────────────── PESTAÑA: FORMULARIOS DEL SISTEMA ─────────────── */}
      {tab === TAB_SISTEMA && (
        <div className="doc-registry-table-wrapper">
          <table className="doc-registry-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-name">Nombre de Documento</th>
                <th className="col-code">Código</th>
                <th className="col-version">Versión</th>
                <th className="col-date">Fecha</th>
                <th className="col-copia">Copia Controlada</th>
                <th className="col-location">Ubicación donde está</th>
                {isAdmin && <th className="col-actions">Visibilidad</th>}
              </tr>
            </thead>
            <tbody>
              {displayedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="doc-empty-row">No se encontraron documentos</td>
                </tr>
              ) : (
                displayedTemplates.map((template, index) => {
                  const isHidden = hiddenIds.includes(template.templateID);
                  return (
                    <tr key={template.templateID} className={isHidden ? 'row-hidden' : ''}>
                      <td className="col-num">{index + 1}</td>
                      <td className="col-name">
                        {template.nombre || '-'}
                        {template.isObsolete && <span className="doc-badge-obsoleto">OBSOLETO</span>}
                      </td>
                      <td className="col-code">{template.codigo || '-'}</td>
                      <td className="col-version">{template.version || '-'}</td>
                      <td className="col-date">{formatDate(template.fechaVersion)}</td>
                      <td className="col-copia">
                        {isAdmin ? (
                          <select
                            value={copiaControlada[template.templateID] || 'No'}
                            onChange={(e) => handleCopiaChange(template.templateID, e.target.value)}
                            className="doc-select-copia"
                          >
                            {OPCIONES_COPIA_CONTROLADA.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          copiaControlada[template.templateID] || 'No'
                        )}
                      </td>
                      <td className="col-location">
                        {isAdmin ? (
                          <input
                            type="text"
                            value={documentLocations[template.templateID] || ''}
                            onChange={(e) => handleLocationChange(template.templateID, e.target.value)}
                            placeholder="Ej: Gerencia"
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                          />
                        ) : (
                          documentLocations[template.templateID] || '-'
                        )}
                      </td>
                      {isAdmin && (
                        <td className="col-actions">
                          <button
                            onClick={() => toggleVisibility(template.templateID)}
                            className={`btn-visibility ${isHidden ? 'hidden-state' : 'visible-state'}`}
                            title={isHidden ? 'Hacer visible' : 'Ocultar documento'}
                          >
                            {isHidden ? '👁️ Mostrar' : '🙈 Ocultar'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─────────────── PESTAÑA: ÁREA (documentos manuales de SGI) ─────────────── */}
      {areaActiva && (
        <>
          <div className="doc-registry-table-wrapper">
            <table className="doc-registry-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th className="col-name">Nombre de Documento</th>
                  <th className="col-code">Código</th>
                  <th className="col-version">Versión</th>
                  <th className="col-date">Fecha</th>
                  <th className="col-copia">Copia Controlada</th>
                  <th className="col-location">Ubicación donde está</th>
                  {isAdmin && <th className="col-actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {manualesDeArea.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="doc-empty-row">
                      Todavía no hay documentos cargados en {areaActiva}.
                      {isAdmin && ' Agregalos con el formulario de abajo.'}
                    </td>
                  </tr>
                ) : (
                  manualesDeArea.map((doc, index) => {
                    const enEdicion = editando?.id === doc.id;
                    const campo = (k) => (enEdicion ? editando[k] : doc[k]) ?? '';
                    const setCampo = (k, v) => setEditando(prev => ({ ...prev, [k]: v }));
                    return (
                      <tr key={doc.id} className={doc.obsoleto ? 'row-hidden' : ''}>
                        <td className="col-num">{index + 1}</td>
                        <td className="col-name">
                          {enEdicion ? (
                            <input value={campo('nombre')} onChange={(e) => setCampo('nombre', e.target.value)} className="doc-input" />
                          ) : (
                            <>
                              {doc.nombre || '-'}
                              {doc.obsoleto && <span className="doc-badge-obsoleto">OBSOLETO</span>}
                            </>
                          )}
                        </td>
                        <td className="col-code">
                          {enEdicion
                            ? <input value={campo('codigo')} onChange={(e) => setCampo('codigo', e.target.value)} className="doc-input" />
                            : (doc.codigo || '-')}
                        </td>
                        <td className="col-version">
                          {enEdicion
                            ? <input value={campo('version')} onChange={(e) => setCampo('version', e.target.value)} className="doc-input" />
                            : (doc.version || '-')}
                        </td>
                        <td className="col-date">
                          {enEdicion
                            ? <input type="date" value={String(campo('fecha')).slice(0, 10)} onChange={(e) => setCampo('fecha', e.target.value)} className="doc-input" />
                            : formatDate(doc.fecha)}
                        </td>
                        <td className="col-copia">
                          {enEdicion ? (
                            <select value={esSi(campo('copiaControlada')) ? 'Si' : 'No'} onChange={(e) => setCampo('copiaControlada', e.target.value)} className="doc-select-copia">
                              {OPCIONES_COPIA_CONTROLADA.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            esSi(doc.copiaControlada) ? 'Si' : 'No'
                          )}
                        </td>
                        <td className="col-location">
                          {enEdicion
                            ? <input value={campo('ubicacion')} onChange={(e) => setCampo('ubicacion', e.target.value)} placeholder="Ej: Gerencia" className="doc-input" />
                            : (doc.ubicacion || '-')}
                        </td>
                        {isAdmin && (
                          <td className="col-actions">
                            {enEdicion ? (
                              <div className="doc-acciones">
                                <button onClick={guardarEdicion} disabled={guardando} className="btn-visibility visible-state">💾 Guardar</button>
                                <button onClick={() => setEditando(null)} className="btn-visibility">✖️</button>
                              </div>
                            ) : (
                              <div className="doc-acciones">
                                <button onClick={() => setEditando({ ...doc })} className="btn-visibility visible-state">✏️ Editar</button>
                                <button onClick={() => borrar(doc)} className="btn-visibility hidden-state">🗑️</button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Alta de documentos: es lo que permite digitalizar la lista en papel */}
          {isAdmin && (
            <form className="doc-alta" onSubmit={guardarNuevo}>
              <strong className="doc-alta__titulo">➕ Agregar documento a {areaActiva}</strong>
              <div className="doc-alta__campos">
                <input
                  value={nuevoDoc.nombre}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre del documento *"
                  className="doc-input doc-alta__nombre"
                  required
                />
                <input
                  value={nuevoDoc.codigo}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, codigo: e.target.value }))}
                  placeholder="Código (PR-TH-1)"
                  className="doc-input"
                />
                <input
                  value={nuevoDoc.version}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, version: e.target.value }))}
                  placeholder="Versión"
                  className="doc-input doc-alta__corto"
                />
                <input
                  type="date"
                  value={nuevoDoc.fecha}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, fecha: e.target.value }))}
                  className="doc-input"
                />
                <select
                  value={nuevoDoc.copiaControlada}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, copiaControlada: e.target.value }))}
                  className="doc-select-copia"
                  title="Copia Controlada"
                >
                  {OPCIONES_COPIA_CONTROLADA.map(o => <option key={o} value={o}>Copia: {o}</option>)}
                </select>
                <input
                  value={nuevoDoc.ubicacion}
                  onChange={(e) => setNuevoDoc(p => ({ ...p, ubicacion: e.target.value }))}
                  placeholder="Ubicación"
                  className="doc-input"
                />
                <button type="submit" className="btn-primary" disabled={guardando || !nuevoDoc.nombre.trim()}>
                  {guardando ? '⏳' : '➕ Agregar'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Leyenda admin */}
      {isAdmin && tab === TAB_SISTEMA && hiddenTemplates.length > 0 && !showHidden && (
        <div className="doc-registry-info">
          ℹ️ Hay <strong>{hiddenTemplates.length}</strong> documento(s) oculto(s).
          Los usuarios normales no ven estos registros.
          Haz clic en &quot;Mostrando ocultos&quot; para verlos y editarlos.
        </div>
      )}
    </div>
  );
}
