import { useState, useEffect, useCallback, useRef } from 'react';
import authService from '../services/authService';
import { agentQuery, mcpListarTemplates } from '../services/aiService';
import { isTrazaEnabled, setTrazaEnabled } from '../hooks/useLoteStore';
import './TrazabilidadConfig.css';

// ─── Constantes de dominio ────────────────────────────────────────────────────
const MODULOS = ['BASE', 'FRIGOLAB', 'TRAZABILIDAD'];
const TIPOS_DOCUMENTO = [
  { value: 'DATOS_SISTEMA', label: 'Datos registrados en sistema' },
  { value: 'ADJUNTO_ESTATICO', label: 'Adjunto estático (PDF/imagen)' },
  { value: 'ADJUNTO_DINAMICO', label: 'Adjunto dinámico' },
];
const TEMPORALIDADES = [
  'DIARIO', 'CADA 30 MIN', 'CADA 1 HORA', 'SEMANAL', 'MENSUAL', 'A DEMANDA',
];
const TIPOS_RELLENO = ['DIGITAL', 'MIXTO'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'frigolab_trazabilidad_config';

// Datos iniciales pre-cargados desde la planilla de configuración de trazabilidad
const DEFAULT_DATA = {
  formatos: [
    {
      id: 1001,
      nombre: 'TRAZABILIDAD PESCADO',
      modulo: 'BASE',
      usuario: 'proceso@frigo.com',
      campoBusqueda: 'LOTE DE PRODUCTO TERMINADO',
    },
  ],
  detalles: [
    {
      id: 1,
      formatoId: 1001,
      codigoDocumento: 'FOR-PD-2',
      nombreDocumento: 'RECEPCION DE MATERIA PRIMA',
      orden: 1,
      tipo: 'DATOS_SISTEMA',
      temporalidad: 'DIARIO',
      campoClave: 'PROVEEDOR RECEPCION',
      tipoRelleno: 'DIGITAL',
      datosBase: '',
      templateId: '',
    },
    {
      id: 2,
      formatoId: 1001,
      codigoDocumento: 'FOR-PD-3',
      nombreDocumento: 'LISTA DE EMPAQUE Y CALIFICACIÓN (FRESCO)',
      orden: 2,
      tipo: 'DATOS_SISTEMA',
      temporalidad: 'DIARIO',
      campoClave: 'FECHA',
      tipoRelleno: 'DIGITAL',
      datosBase: '',
      templateId: '',
    },
    {
      id: 3,
      formatoId: 1001,
      codigoDocumento: '',
      nombreDocumento: 'FICHA DE PRODUCTO',
      orden: 3,
      tipo: 'ADJUNTO_ESTATICO',
      temporalidad: 'A DEMANDA',
      campoClave: '',
      tipoRelleno: 'DIGITAL',
      datosBase: '',
      templateId: '',
    },
    {
      id: 4,
      formatoId: 1001,
      codigoDocumento: '',
      nombreDocumento: 'CERTIFICADO DE AUTORIDAD',
      orden: 4,
      tipo: 'ADJUNTO_DINAMICO',
      temporalidad: 'A DEMANDA',
      campoClave: '',
      tipoRelleno: 'MIXTO',
      datosBase: '',
      templateId: '',
    },
    {
      id: 5,
      formatoId: 1001,
      codigoDocumento: 'FOR-CC-1',
      nombreDocumento: 'CONTROL DE BUENAS PRACTICAS DE MANUFACTURA',
      orden: 5,
      tipo: 'DATOS_SISTEMA',
      temporalidad: 'CADA 30 MIN',
      campoClave: 'FECHA',
      tipoRelleno: 'DIGITAL',
      datosBase: '',
      templateId: '',
    },
  ],
};

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If stored but empty (user deleted everything), return default
      if (parsed.formatos?.length > 0) return parsed;
    }
    return DEFAULT_DATA;
  } catch { return DEFAULT_DATA; }
};

const saveToStorage = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* skip */ }
};

const nextId = (arr) => (arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1001);

const defaultFormatoForm = () => ({
  nombre: '', modulo: 'BASE', usuario: '', campoBusqueda: '',
});

const defaultDetalleForm = () => ({
  codigoDocumento: '', nombreDocumento: '', orden: 1,
  tipo: 'DATOS_SISTEMA', templateId: '',
  temporalidad: 'DIARIO', campoClave: '',
  tipoRelleno: 'DIGITAL', datosBase: '',
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function TrazabilidadConfig() {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor';

  // Data state
  const [formatos, setFormatos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // UI state
  const [selectedFormato, setSelectedFormato] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePanel, setActivePanel] = useState('list'); // 'list' | 'detail'
  const [mainTab, setMainTab] = useState('formatos'); // 'formatos' | 'lotes'
  const [lotesEnabled, setLotesEnabled] = useState({});

  // Format form modal
  const [showFormatoModal, setShowFormatoModal] = useState(false);
  const [editingFormato, setEditingFormato] = useState(null);
  const [formatoForm, setFormatoForm] = useState(defaultFormatoForm());

  // Detail form modal
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [editingDetalle, setEditingDetalle] = useState(null);
  const [detalleForm, setDetalleForm] = useState(defaultDetalleForm());
  const [detalleErrors, setDetalleErrors] = useState({});

  // JSON editor for datosBase
  const [datosBaseError, setDatosBaseError] = useState('');

  // Drag-and-drop reorder state
  const [draggedDetId, setDraggedDetId] = useState(null);
  const [dragOverDetId, setDragOverDetId] = useState(null);

  // Import templates modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importSelection, setImportSelection] = useState(new Set());

  // ── AI assistant state ───────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu asistente de trazabilidad. Puedo ayudarte a:\n• Armar el orden de un reporte de trazabilidad\n• Calcular campos clave entre documentos\n• Consultar qué formularios existen para un proceso\n• Buscar trazabilidad de un lote específico\n\n¿Cómo quieres estructurar tu formato?',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);
  const aiInputRef = useRef(null);

  // Auto-scroll AI chat
  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // Build context string from current formato
  const buildContext = useCallback(() => {
    if (!selectedFormato) return '';
    const docs = detalles
      .filter(d => d.formatoId === selectedFormato.id)
      .sort((a, b) => a.orden - b.orden)
      .map(d => `  ${d.orden}. [${d.codigoDocumento || '—'}] ${d.nombreDocumento} (${d.tipo}, campo clave: ${d.campoClave || 'sin definir'})`)
      .join('\n');
    return `\n\n[Contexto actual - Formato seleccionado: "${selectedFormato.nombre}" (ID ${selectedFormato.id}), módulo ${selectedFormato.modulo}, campo búsqueda: ${selectedFormato.campoBusqueda || 'sin definir'}]\n[Documentos configurados hasta ahora:]\n${docs || '  (ninguno aún)'}\n[Formularios disponibles en el sistema: ${templates.slice(0,10).map(t => `${t.codigo || t.templateID}: ${t.nombre}`).join(', ')}${templates.length > 10 ? ` y ${templates.length - 10} más` : ''}]`;
  }, [selectedFormato, detalles, templates]);

  const sendAiMessage = useCallback(async (text) => {
    const query = (text || aiInput).trim();
    if (!query || aiLoading) return;
    setAiInput('');
    const userMsg = { role: 'user', text: query };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    try {
      const history = aiMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map(m => ({ role: m.role, text: m.text }));
      const contextualQuery = query + buildContext();
      const result = await agentQuery(contextualQuery, history);
      setAiMessages(prev => [
        ...prev,
        { role: 'assistant', text: result.response, toolsUsed: result.tools_used || [] },
      ]);
    } catch {
      setAiMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Error al conectar con el asistente AI. Verifica que el servidor esté activo.', error: true },
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages, buildContext]);

  const AI_SUGGESTIONS = [
    'Busca trazabilidad del lote más reciente de pescado',
    'Qué formulario corresponde a FOR-PD-2 o FOR-PD-3?',
    'Cuál es el campo clave entre recepción y lista de empaque?',
    'Qué documentos faltan para completar la trazabilidad?',
  ];

  // ── Load from localStorage on mount ─────────────────────────────────────────
  useEffect(() => {
    const stored = loadFromStorage();
    setFormatos(stored.formatos || []);
    setDetalles(stored.detalles || []);
  }, []);

  // ── Load templates via MCP listar_templates ─────────────────────────────────
  useEffect(() => {
    mcpListarTemplates()
      .then(arr => {
        setTemplates(arr);
        // Initialize lotesEnabled state from useLoteStore
        const enabled = {};
        arr.forEach(t => {
          enabled[String(t.templateID)] = isTrazaEnabled(String(t.templateID));
        });
        setLotesEnabled(enabled);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // ── Persist on change ────────────────────────────────────────────────────────
  const persist = useCallback((fmts, dets) => {
    saveToStorage({ formatos: fmts, detalles: dets });
  }, []);

  // ── Filtered formats ─────────────────────────────────────────────────────────
  const filteredFormatos = formatos.filter(f => {
    const q = searchTerm.toLowerCase();
    return (
      f.nombre.toLowerCase().includes(q) ||
      String(f.id).includes(q) ||
      (f.modulo || '').toLowerCase().includes(q)
    );
  });

  // ── Selected format details ───────────────────────────────────────────────────
  const formatoDetalles = selectedFormato
    ? detalles
        .filter(d => d.formatoId === selectedFormato.id)
        .sort((a, b) => a.orden - b.orden)
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMAT CRUD
  // ─────────────────────────────────────────────────────────────────────────────
  const openFormatoModal = (fmt = null) => {
    setEditingFormato(fmt);
    if (fmt) {
      setFormatoForm({ nombre: fmt.nombre, modulo: fmt.modulo, usuario: fmt.usuario, campoBusqueda: fmt.campoBusqueda });
    } else {
      setFormatoForm({ ...defaultFormatoForm(), usuario: currentUser?.correo || currentUser?.nombre || '' });
    }
    setShowFormatoModal(true);
  };

  const saveFormato = () => {
    if (!formatoForm.nombre.trim()) return;
    let updated;
    if (editingFormato) {
      updated = formatos.map(f =>
        f.id === editingFormato.id ? { ...f, ...formatoForm } : f
      );
      if (selectedFormato?.id === editingFormato.id) {
        setSelectedFormato(prev => ({ ...prev, ...formatoForm }));
      }
    } else {
      const newFmt = { id: nextId(formatos), ...formatoForm };
      updated = [...formatos, newFmt];
    }
    setFormatos(updated);
    persist(updated, detalles);
    setShowFormatoModal(false);
  };

  const deleteFormato = (id) => {
    if (!globalThis.confirm('¿Eliminar este formato de trazabilidad y todos sus detalles?')) return;
    const updatedFmts = formatos.filter(f => f.id !== id);
    const updatedDets = detalles.filter(d => d.formatoId !== id);
    setFormatos(updatedFmts);
    setDetalles(updatedDets);
    persist(updatedFmts, updatedDets);
    if (selectedFormato?.id === id) {
      setSelectedFormato(null);
      setActivePanel('list');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DETAIL CRUD
  // ─────────────────────────────────────────────────────────────────────────────
  const openDetalleModal = (det = null) => {
    setEditingDetalle(det);
    setDetalleErrors({});
    setDatosBaseError('');
    if (det) {
      setDetalleForm({
        codigoDocumento: det.codigoDocumento || '',
        nombreDocumento: det.nombreDocumento || '',
        orden: det.orden,
        tipo: det.tipo || 'DATOS_SISTEMA',
        templateId: det.templateId || '',
        temporalidad: det.temporalidad || 'DIARIO',
        campoClave: det.campoClave || '',
        tipoRelleno: det.tipoRelleno || 'DIGITAL',
        datosBase: det.datosBase || '',
      });
    } else {
      const nextOrden = formatoDetalles.length > 0
        ? Math.max(...formatoDetalles.map(d => d.orden)) + 1
        : 1;
      setDetalleForm({ ...defaultDetalleForm(), orden: nextOrden });
    }
    setShowDetalleModal(true);
  };

  const validateDetalle = () => {
    const errors = {};
    if (!detalleForm.nombreDocumento.trim()) errors.nombreDocumento = 'Requerido';
    if (!detalleForm.orden || detalleForm.orden < 1) errors.orden = 'Debe ser ≥ 1';
    if (detalleForm.tipo === 'DATOS_SISTEMA' && !detalleForm.templateId)
      errors.templateId = 'Selecciona un formulario';
    if (detalleForm.datosBase.trim()) {
      try { JSON.parse(detalleForm.datosBase); }
      catch { errors.datosBase = 'JSON inválido'; }
    }
    setDetalleErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveDetalle = () => {
    if (!validateDetalle()) return;

    // If tipo is DATOS_SISTEMA, auto-fill codigoDocumento from template
    let finalForm = { ...detalleForm };
    if (finalForm.tipo === 'DATOS_SISTEMA' && finalForm.templateId) {
      const tpl = templates.find(t => String(t.templateID) === String(finalForm.templateId));
      if (tpl) {
        finalForm.codigoDocumento = tpl.codigo || '';
        if (!finalForm.nombreDocumento.trim()) finalForm.nombreDocumento = tpl.nombre || '';
      }
    }

    let updatedDets;
    if (editingDetalle) {
      updatedDets = detalles.map(d =>
        d.id === editingDetalle.id ? { ...d, ...finalForm } : d
      );
    } else {
      const newDet = {
        id: nextId(detalles.length > 0 ? detalles : [{ id: 0 }]),
        formatoId: selectedFormato.id,
        ...finalForm,
      };
      updatedDets = [...detalles, newDet];
    }
    setDetalles(updatedDets);
    persist(formatos, updatedDets);
    setShowDetalleModal(false);
  };

  const deleteDetalle = (id) => {
    if (!globalThis.confirm('¿Eliminar este documento del formato?')) return;
    const updated = detalles.filter(d => d.id !== id);
    setDetalles(updated);
    persist(formatos, updated);
  };

  const moveDetalle = (id, direction) => {
    const list = [...formatoDetalles];
    const idx = list.findIndex(d => d.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    const aOrden = list[idx].orden;
    const bOrden = list[swapIdx].orden;

    const updatedDets = detalles.map(d => {
      if (d.id === list[idx].id) return { ...d, orden: bOrden };
      if (d.id === list[swapIdx].id) return { ...d, orden: aOrden };
      return d;
    });
    setDetalles(updatedDets);
    persist(formatos, updatedDets);
  };

  const handleDragStart = (e, id) => {
    setDraggedDetId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggedDetId) setDragOverDetId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedDetId || draggedDetId === targetId) {
      setDraggedDetId(null);
      setDragOverDetId(null);
      return;
    }
    const orderedList = [...formatoDetalles];
    const fromIdx = orderedList.findIndex(d => d.id === draggedDetId);
    const toIdx = orderedList.findIndex(d => d.id === targetId);
    const [moved] = orderedList.splice(fromIdx, 1);
    orderedList.splice(toIdx, 0, moved);
    const reordered = orderedList.map((d, i) => ({ ...d, orden: i + 1 }));
    const updatedDets = detalles.map(d => reordered.find(r => r.id === d.id) || d);
    setDetalles(updatedDets);
    persist(formatos, updatedDets);
    setDraggedDetId(null);
    setDragOverDetId(null);
  };

  const handleDragEnd = () => {
    setDraggedDetId(null);
    setDragOverDetId(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // IMPORT SYSTEM TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────────
  const openImportModal = () => {
    // Pre-select all templates not already added
    const alreadyAdded = new Set(formatoDetalles.map(d => String(d.templateId)).filter(Boolean));
    const preSelected = new Set(
      templates
        .filter(t => !alreadyAdded.has(String(t.templateID)))
        .map(t => String(t.templateID))
    );
    setImportSelection(preSelected);
    setImportSearch('');
    setShowImportModal(true);
  };

  const toggleImportItem = (id) => {
    setImportSelection(prev => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  const importSelectedTemplates = () => {
    if (!selectedFormato || importSelection.size === 0) return;
    const alreadyAdded = new Set(formatoDetalles.map(d => String(d.templateId)).filter(Boolean));
    let nextOrden = formatoDetalles.length > 0
      ? Math.max(...formatoDetalles.map(d => d.orden)) + 1
      : 1;
    let nextDetId = nextId(detalles.length > 0 ? detalles : [{ id: 0 }]);
    const newDetalles = [];
    for (const tplId of importSelection) {
      if (alreadyAdded.has(String(tplId))) continue;
      const tpl = templates.find(t => String(t.templateID) === String(tplId));
      if (!tpl) continue;
      newDetalles.push({
        id: nextDetId++,
        formatoId: selectedFormato.id,
        codigoDocumento: tpl.codigo || '',
        nombreDocumento: tpl.nombre || '',
        orden: nextOrden++,
        tipo: 'DATOS_SISTEMA',
        templateId: String(tpl.templateID),
        temporalidad: tpl.frecuencia || 'DIARIO',
        campoClave: '',
        tipoRelleno: 'DIGITAL',
        datosBase: '',
      });
    }
    const updatedDets = [...detalles, ...newDetalles];
    setDetalles(updatedDets);
    persist(formatos, updatedDets);
    setShowImportModal(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Template selector auto-fill
  // ─────────────────────────────────────────────────────────────────────────────
  const handleTemplateSelect = (templateId) => {
    const tpl = templates.find(t => String(t.templateID) === String(templateId));
    setDetalleForm(prev => ({
      ...prev,
      templateId,
      codigoDocumento: tpl?.codigo || prev.codigoDocumento,
      nombreDocumento: tpl?.nombre || prev.nombreDocumento,
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  const tipoLabel = (value) => TIPOS_DOCUMENTO.find(t => t.value === value)?.label || value;
  const tipoBadgeClass = (tipo) => {
    if (tipo === 'DATOS_SISTEMA') return 'badge-sistema';
    if (tipo === 'ADJUNTO_ESTATICO') return 'badge-estatico';
    return 'badge-dinamico';
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="traz-root">
      {/* ── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div className="traz-header">
        <div className="traz-header-left">
          <h1 className="traz-title">🔗 Configuración de Trazabilidad</h1>
          <p className="traz-subtitle">
            Define los formatos y el orden de los reportes para auditorías y autoridades
          </p>
        </div>
        {isAdmin && mainTab === 'formatos' && (
          <button className="traz-btn-primary" onClick={() => openFormatoModal()}>
            + Nuevo formato
          </button>
        )}
      </div>

      {/* ── MAIN TAB BAR ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '16px' }}>
        {[
          { key: 'formatos', label: '🔗 Formatos de Trazabilidad' },
          { key: 'lotes', label: '📦 Lotes por Template' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            style={{
              background: 'none', border: 'none',
              borderBottom: mainTab === t.key ? '2px solid #1d4ed8' : '2px solid transparent',
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              color: mainTab === t.key ? '#1d4ed8' : '#64748b',
              cursor: 'pointer', marginBottom: '-2px'
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── LOTES CONFIG TAB ───────────────────────────────────────────────── */}
      {mainTab === 'lotes' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Habilitar seguimiento de lotes por template</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
              Al activar un template, el panel &quot;Trazabilidad de Lotes&quot; aparecerá en ese formulario y los lotes generados se guardarán en el inventario automáticamente.
            </p>
          </div>
          {loadingTemplates ? (
            <p style={{ color: '#94a3b8' }}>Cargando templates…</p>
          ) : templates.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No hay templates disponibles.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ID</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Template</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Proceso</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Seguimiento de lotes</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => {
                  const tid = String(t.templateID);
                  const enabled = !!lotesEnabled[tid];
                  return (
                    <tr key={tid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#94a3b8' }}>{t.templateID}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{t.nombre}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.proceso || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            const next = !enabled;
                            setTrazaEnabled(tid, next);
                            setLotesEnabled(prev => ({ ...prev, [tid]: next }));
                          }}
                          style={{
                            padding: '4px 16px', borderRadius: '20px', fontSize: '12px',
                            fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: enabled ? '#dcfce7' : '#f1f5f9',
                            color: enabled ? '#15803d' : '#64748b',
                            transition: 'all 0.15s'
                          }}
                        >
                          {enabled ? '✅ Activado' : '○ Desactivado'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TWO-PANEL LAYOUT ─────────────────────────────────────────────────── */}
      <div className="traz-panels" style={{ display: mainTab !== 'formatos' ? 'none' : undefined }}>

        {/* ══ LEFT PANEL: FORMATS LIST ════════════════════════════════════════ */}
        <div className={`traz-panel-left ${activePanel === 'detail' && selectedFormato ? 'panel-hidden-mobile' : ''}`}>
          <div className="traz-panel-header">
            <h2 className="traz-panel-title">Formatos de Trazabilidad</h2>
            <span className="traz-panel-count">{formatos.length} formatos</span>
          </div>

          {/* Search */}
          <div className="traz-search-wrapper">
            <span className="traz-search-icon">🔍</span>
            <input
              type="text"
              className="traz-search"
              placeholder="Buscar por nombre, código, módulo…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="traz-search-clear" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          {/* Format cards */}
          {filteredFormatos.length === 0 ? (
            <div className="traz-empty">
              <span className="traz-empty-icon">📋</span>
              <p>{searchTerm ? 'Sin resultados' : 'No hay formatos. Crea el primero.'}</p>
            </div>
          ) : (
            <div className="traz-format-list">
              {filteredFormatos.map(fmt => (
                <div
                  key={fmt.id}
                  className={`traz-format-card ${selectedFormato?.id === fmt.id ? 'traz-format-card-active' : ''}`}
                  onClick={() => { setSelectedFormato(fmt); setActivePanel('detail'); }}
                >
                  <div className="traz-format-card-top">
                    <span className="traz-format-code">{fmt.id}</span>
                    <span className={`traz-modulo-badge modulo-${(fmt.modulo || 'BASE').toLowerCase()}`}>
                      {fmt.modulo || 'BASE'}
                    </span>
                  </div>
                  <h3 className="traz-format-name">{fmt.nombre}</h3>
                  <div className="traz-format-meta">
                    <span title="Usuario">👤 {fmt.usuario || '—'}</span>
                    <span title="Campo búsqueda">🔑 {fmt.campoBusqueda || '—'}</span>
                  </div>
                  <div className="traz-format-docs-count">
                    {detalles.filter(d => d.formatoId === fmt.id).length} documento(s) configurado(s)
                  </div>
                  {isAdmin && (
                    <div className="traz-format-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="traz-btn-icon"
                        title="Editar"
                        onClick={() => openFormatoModal(fmt)}
                      >✏️</button>
                      <button
                        className="traz-btn-icon traz-btn-danger"
                        title="Eliminar"
                        onClick={() => deleteFormato(fmt.id)}
                      >🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ RIGHT PANEL: FORMAT DETAILS ═════════════════════════════════════ */}
        <div className={`traz-panel-right ${!selectedFormato ? 'panel-placeholder' : ''} ${activePanel === 'list' && selectedFormato ? 'panel-hidden-mobile' : ''}`}>
          {!selectedFormato ? (
            <div className="traz-placeholder">
              <div className="traz-placeholder-icon">👈</div>
              <h3>Selecciona un formato</h3>
              <p>Haz clic en un formato de la lista para ver y configurar sus documentos</p>
            </div>
          ) : (
            <>
              {/* Back button mobile */}
              <button className="traz-back-btn" onClick={() => setActivePanel('list')}>
                ← Volver a formatos
              </button>

              {/* Detail header */}
              <div className="traz-detail-header">
                <div className="traz-detail-header-left">
                  <div className="traz-detail-code-row">
                    <span className="traz-format-code">{selectedFormato.id}</span>
                    <span className={`traz-modulo-badge modulo-${(selectedFormato.modulo || 'BASE').toLowerCase()}`}>
                      {selectedFormato.modulo}
                    </span>
                  </div>
                  <h2 className="traz-detail-name">{selectedFormato.nombre}</h2>
                  <div className="traz-detail-meta">
                    <span>👤 {selectedFormato.usuario || '—'}</span>
                    <span>🔑 Campo clave: <strong>{selectedFormato.campoBusqueda || '—'}</strong></span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="traz-detail-header-actions">
                    <button
                      className="traz-btn-secondary"
                      onClick={openImportModal}
                      disabled={loadingTemplates || templates.length === 0}
                      title="Agrega de una vez todos los formularios registrados en el sistema"
                    >
                      📥 Importar del sistema {templates.length > 0 ? `(${templates.length})` : ''}
                    </button>
                    <button
                      className="traz-btn-primary"
                      onClick={() => openDetalleModal()}
                    >
                      + Agregar documento
                    </button>
                  </div>
                )}
              </div>

              {/* Documents table */}
              {formatoDetalles.length === 0 ? (
                <div className="traz-empty traz-empty-detail">
                  <span className="traz-empty-icon">📄</span>
                  <p>Aún no hay documentos configurados para este formato.</p>
                  {isAdmin && (
                    <div className="traz-empty-actions">
                      <button className="traz-btn-primary" onClick={openImportModal} disabled={loadingTemplates || templates.length === 0}>
                        📥 Importar formularios del sistema
                      </button>
                      <button className="traz-btn-secondary" onClick={() => openDetalleModal()}>
                        + Agregar manualmente
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="traz-docs-table-wrapper">
                  <table className="traz-docs-table">
                    <thead>
                      <tr>
                        {isAdmin && <th className="col-drag" title="Arrastra para reordenar">⠿</th>}
                        <th className="col-orden">Orden</th>
                        <th className="col-codigo">Código</th>
                        <th className="col-nombre">Nombre Documento</th>
                        <th className="col-tipo">Tipo</th>
                        <th className="col-temp">Temporalidad</th>
                        <th className="col-clave">Campo Clave</th>
                        <th className="col-relleno">Relleno</th>
                        <th className="col-base">Datos Base</th>
                        {isAdmin && <th className="col-actions">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {formatoDetalles.map((det, idx) => (
                        <tr
                          key={det.id}
                          className={`traz-doc-row${draggedDetId === det.id ? ' row-dragging' : ''}${dragOverDetId === det.id ? ' row-drag-over' : ''}`}
                          draggable={isAdmin}
                          onDragStart={isAdmin ? (e) => handleDragStart(e, det.id) : undefined}
                          onDragOver={isAdmin ? (e) => handleDragOver(e, det.id) : undefined}
                          onDrop={isAdmin ? (e) => handleDrop(e, det.id) : undefined}
                          onDragEnd={isAdmin ? handleDragEnd : undefined}
                        >
                          {isAdmin && (
                            <td className="col-drag">
                              <span className="traz-drag-handle" title="Arrastra para reordenar">⠿</span>
                            </td>
                          )}
                          <td className="col-orden">
                            <div className="traz-orden-cell">
                              <span className="traz-orden-num">{det.orden}</span>
                              {isAdmin && (
                                <div className="traz-orden-btns">
                                  <button
                                    className="traz-move-btn"
                                    disabled={idx === 0}
                                    onClick={() => moveDetalle(det.id, 'up')}
                                    title="Subir"
                                  >▲</button>
                                  <button
                                    className="traz-move-btn"
                                    disabled={idx === formatoDetalles.length - 1}
                                    onClick={() => moveDetalle(det.id, 'down')}
                                    title="Bajar"
                                  >▼</button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="col-codigo">
                            <code className="traz-doc-code">{det.codigoDocumento || '—'}</code>
                          </td>
                          <td className="col-nombre">
                            <span className="traz-doc-name">{det.nombreDocumento}</span>
                          </td>
                          <td className="col-tipo">
                            <span className={`traz-badge ${tipoBadgeClass(det.tipo)}`}>
                              {tipoLabel(det.tipo)}
                            </span>
                          </td>
                          <td className="col-temp">
                            <span className="traz-temp">{det.temporalidad || '—'}</span>
                          </td>
                          <td className="col-clave">
                            <span className="traz-clave">{det.campoClave || '—'}</span>
                          </td>
                          <td className="col-relleno">
                            <span className={`traz-relleno-badge relleno-${(det.tipoRelleno || 'DIGITAL').toLowerCase()}`}>
                              {det.tipoRelleno || 'DIGITAL'}
                            </span>
                          </td>
                          <td className="col-base">
                            {det.datosBase ? (
                              <span className="traz-has-json" title={det.datosBase}>
                                📊 JSON configurado
                              </span>
                            ) : (
                              <span className="traz-no-json">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="col-actions">
                              <div className="traz-row-actions">
                                <button
                                  className="traz-btn-icon"
                                  title="Editar"
                                  onClick={() => openDetalleModal(det)}
                                >✏️</button>
                                <button
                                  className="traz-btn-icon traz-btn-danger"
                                  title="Eliminar"
                                  onClick={() => deleteDetalle(det.id)}
                                >🗑️</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: FORMATO FORM                                                     */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showFormatoModal && (
        <div className="traz-overlay" onClick={() => setShowFormatoModal(false)}>
          <div className="traz-modal" onClick={e => e.stopPropagation()}>
            <div className="traz-modal-header">
              <h3>{editingFormato ? 'Editar formato' : 'Nuevo formato de trazabilidad'}</h3>
              <button className="traz-modal-close" onClick={() => setShowFormatoModal(false)}>✕</button>
            </div>
            <div className="traz-modal-body">
              <div className="traz-form-row">
                <label className="traz-label">Nombre del formato <span className="traz-req">*</span></label>
                <input
                  className="traz-input"
                  placeholder="Ej. Trazabilidad Pescado"
                  value={formatoForm.nombre}
                  onChange={e => setFormatoForm(p => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div className="traz-form-row">
                <label className="traz-label">Módulo</label>
                <select
                  className="traz-input"
                  value={formatoForm.modulo}
                  onChange={e => setFormatoForm(p => ({ ...p, modulo: e.target.value }))}
                >
                  {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="traz-form-row">
                <label className="traz-label">Usuario responsable</label>
                <input
                  className="traz-input"
                  placeholder="correo@frigolab.com"
                  value={formatoForm.usuario}
                  onChange={e => setFormatoForm(p => ({ ...p, usuario: e.target.value }))}
                />
              </div>
              <div className="traz-form-row">
                <label className="traz-label">Campo de búsqueda principal</label>
                <input
                  className="traz-input"
                  placeholder="Ej. Lote de Producto Terminado"
                  value={formatoForm.campoBusqueda}
                  onChange={e => setFormatoForm(p => ({ ...p, campoBusqueda: e.target.value }))}
                />
                <p className="traz-hint">Campo que identifica toda la trazabilidad (lote, fecha, etc.)</p>
              </div>
            </div>
            <div className="traz-modal-footer">
              <button className="traz-btn-secondary" onClick={() => setShowFormatoModal(false)}>Cancelar</button>
              <button
                className="traz-btn-primary"
                disabled={!formatoForm.nombre.trim()}
                onClick={saveFormato}
              >
                {editingFormato ? 'Guardar cambios' : 'Crear formato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DETAIL (DOCUMENT) FORM                                           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showDetalleModal && (
        <div className="traz-overlay" onClick={() => setShowDetalleModal(false)}>
          <div className="traz-modal traz-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="traz-modal-header">
              <h3>{editingDetalle ? 'Editar documento' : 'Agregar documento al formato'}</h3>
              <button className="traz-modal-close" onClick={() => setShowDetalleModal(false)}>✕</button>
            </div>

            <div className="traz-modal-body traz-modal-grid">
              {/* ── Tipo de documento ── */}
              <div className="traz-form-row traz-full">
                <label className="traz-label">Tipo de documento <span className="traz-req">*</span></label>
                <div className="traz-type-selector">
                  {TIPOS_DOCUMENTO.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`traz-type-btn ${detalleForm.tipo === t.value ? 'traz-type-btn-active' : ''}`}
                      onClick={() => setDetalleForm(p => ({ ...p, tipo: t.value }))}
                    >
                      {t.value === 'DATOS_SISTEMA' && '📋 '}
                      {t.value === 'ADJUNTO_ESTATICO' && '📎 '}
                      {t.value === 'ADJUNTO_DINAMICO' && '🔄 '}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Si es tipo sistema, seleccionar formulario ── */}
              {detalleForm.tipo === 'DATOS_SISTEMA' && (
                <div className="traz-form-row traz-full">
                  <label className="traz-label">
                    Formulario del sistema <span className="traz-req">*</span>
                  </label>
                  {loadingTemplates ? (
                    <p className="traz-hint">Cargando formularios…</p>
                  ) : (
                    <select
                      className={`traz-input ${detalleErrors.templateId ? 'traz-input-error' : ''}`}
                      value={detalleForm.templateId}
                      onChange={e => handleTemplateSelect(e.target.value)}
                    >
                      <option value="">— Selecciona un formulario —</option>
                      {templates.map(t => (
                        <option key={t.templateID} value={t.templateID}>
                          {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                  {detalleErrors.templateId && (
                    <span className="traz-error">{detalleErrors.templateId}</span>
                  )}
                </div>
              )}

              {/* ── Código documento (editable / auto-filled) ── */}
              <div className="traz-form-row">
                <label className="traz-label">Código documento</label>
                <input
                  className="traz-input"
                  placeholder="Ej. FOR-PD-2"
                  value={detalleForm.codigoDocumento}
                  onChange={e => setDetalleForm(p => ({ ...p, codigoDocumento: e.target.value }))}
                />
              </div>

              {/* ── Nombre documento ── */}
              <div className="traz-form-row">
                <label className="traz-label">Nombre documento <span className="traz-req">*</span></label>
                <input
                  className={`traz-input ${detalleErrors.nombreDocumento ? 'traz-input-error' : ''}`}
                  placeholder="Ej. Recepción de Materia Prima"
                  value={detalleForm.nombreDocumento}
                  onChange={e => setDetalleForm(p => ({ ...p, nombreDocumento: e.target.value }))}
                />
                {detalleErrors.nombreDocumento && (
                  <span className="traz-error">{detalleErrors.nombreDocumento}</span>
                )}
              </div>

              {/* ── Orden ── */}
              <div className="traz-form-row">
                <label className="traz-label">Orden en el reporte <span className="traz-req">*</span></label>
                <input
                  type="number"
                  min="1"
                  className={`traz-input traz-input-sm ${detalleErrors.orden ? 'traz-input-error' : ''}`}
                  value={detalleForm.orden}
                  onChange={e => setDetalleForm(p => ({ ...p, orden: Number(e.target.value) }))}
                />
                {detalleErrors.orden && <span className="traz-error">{detalleErrors.orden}</span>}
              </div>

              {/* ── Temporalidad ── */}
              <div className="traz-form-row">
                <label className="traz-label">Temporalidad</label>
                <select
                  className="traz-input"
                  value={detalleForm.temporalidad}
                  onChange={e => setDetalleForm(p => ({ ...p, temporalidad: e.target.value }))}
                >
                  {TEMPORALIDADES.map(t => <option key={t}>{t}</option>)}
                </select>
                <p className="traz-hint">Cada cuánto se registra este documento</p>
              </div>

              {/* ── Campo clave ── */}
              <div className="traz-form-row">
                <label className="traz-label">Campo clave de vínculo</label>
                <input
                  className="traz-input"
                  placeholder="Ej. Fecha, Lote, Proveedor…"
                  value={detalleForm.campoClave}
                  onChange={e => setDetalleForm(p => ({ ...p, campoClave: e.target.value }))}
                />
                <p className="traz-hint">Campo que enlaza este documento con el siguiente</p>
              </div>

              {/* ── Tipo relleno ── */}
              <div className="traz-form-row">
                <label className="traz-label">Tipo de relleno</label>
                <div className="traz-radio-group">
                  {TIPOS_RELLENO.map(tr => (
                    <label key={tr} className="traz-radio-label">
                      <input
                        type="radio"
                        name="tipoRelleno"
                        value={tr}
                        checked={detalleForm.tipoRelleno === tr}
                        onChange={() => setDetalleForm(p => ({ ...p, tipoRelleno: tr }))}
                      />
                      <span className={`traz-relleno-badge relleno-${tr.toLowerCase()}`}>{tr}</span>
                    </label>
                  ))}
                </div>
                <p className="traz-hint">
                  <strong>DIGITAL</strong>: lleno automáticamente por el sistema. 
                  <strong> MIXTO</strong>: puede generarse o llenarse manualmente.
                </p>
              </div>

              {/* ── Datos Base (JSON) ── */}
              <div className="traz-form-row traz-full">
                <label className="traz-label">Datos base (JSON)</label>
                <textarea
                  className={`traz-textarea traz-json-editor ${detalleErrors.datosBase ? 'traz-input-error' : ''}`}
                  placeholder={'{\n  "sal": 3,\n  "temperatura": 0,\n  "observaciones": ""\n}'}
                  rows={6}
                  value={detalleForm.datosBase}
                  onChange={e => {
                    setDetalleForm(p => ({ ...p, datosBase: e.target.value }));
                    setDatosBaseError('');
                  }}
                  onBlur={() => {
                    if (detalleForm.datosBase.trim()) {
                      try { JSON.parse(detalleForm.datosBase); setDatosBaseError(''); }
                      catch { setDatosBaseError('JSON inválido — verifica la sintaxis'); }
                    }
                  }}
                />
                {(detalleErrors.datosBase || datosBaseError) && (
                  <span className="traz-error">{detalleErrors.datosBase || datosBaseError}</span>
                )}
                <p className="traz-hint">
                  Valores ideales/esperados para auditoría. Si un campo del formulario difiere, 
                  se podrá comparar o reemplazar al generar el reporte oficial.
                </p>
              </div>
            </div>

            <div className="traz-modal-footer">
              <button className="traz-btn-secondary" onClick={() => setShowDetalleModal(false)}>Cancelar</button>
              <button className="traz-btn-primary" onClick={saveDetalle}>
                {editingDetalle ? 'Guardar cambios' : 'Agregar documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: IMPORT SYSTEM TEMPLATES                                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="traz-overlay" onClick={() => setShowImportModal(false)}>
          <div className="traz-modal traz-modal-import" onClick={e => e.stopPropagation()}>
            <div className="traz-modal-header">
              <h3>📥 Importar formularios del sistema</h3>
              <button className="traz-modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>

            <div className="traz-import-subheader">
              <p className="traz-import-desc">
                Seleccioná los formularios registrados en la base de datos para agregarlos al formato
                <strong> {selectedFormato?.nombre}</strong>.
                Los que ya están configurados aparecen marcados.
              </p>
              <div className="traz-import-toolbar">
                <input
                  className="traz-input traz-import-search"
                  placeholder="Buscar formulario…"
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                />
                <div className="traz-import-bulk-actions">
                  <button
                    className="traz-btn-link"
                    onClick={() => setImportSelection(new Set(templates.map(t => String(t.templateID))))}
                  >Seleccionar todos</button>
                  <span>|</span>
                  <button
                    className="traz-btn-link"
                    onClick={() => setImportSelection(new Set())}
                  >Limpiar</button>
                </div>
              </div>
            </div>

            <div className="traz-import-list">
              {(() => {
                const alreadyAdded = new Set(formatoDetalles.map(d => String(d.templateId)).filter(Boolean));
                const filtered = templates.filter(t => {
                  const q = importSearch.toLowerCase();
                  return (
                    (t.nombre || '').toLowerCase().includes(q) ||
                    (t.codigo || '').toLowerCase().includes(q) ||
                    (t.proceso || '').toLowerCase().includes(q)
                  );
                });
                if (filtered.length === 0) {
                  return <div className="traz-import-empty">No hay formularios que coincidan con la búsqueda.</div>;
                }
                return filtered.map(tpl => {
                  const idStr = String(tpl.templateID);
                  const isAdded = alreadyAdded.has(idStr);
                  const isSelected = importSelection.has(idStr);
                  return (
                    <label
                      key={tpl.templateID}
                      className={`traz-import-item ${isAdded ? 'import-item-added' : ''} ${isSelected ? 'import-item-checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleImportItem(tpl.templateID)}
                      />
                      <div className="traz-import-item-info">
                        <div className="traz-import-item-name">
                          {tpl.codigo && <code className="traz-doc-code">{tpl.codigo}</code>}
                          <span>{tpl.nombre}</span>
                          {isAdded && <span className="import-badge-added">✓ Ya agregado</span>}
                        </div>
                        {(tpl.proceso || tpl.frecuencia || tpl.quienLoLlena) && (
                          <div className="traz-import-item-meta">
                            {tpl.proceso && <span>📂 {tpl.proceso}</span>}
                            {tpl.frecuencia && <span>🕐 {tpl.frecuencia}</span>}
                            {tpl.quienLoLlena && <span>👤 {tpl.quienLoLlena}</span>}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                });
              })()}
            </div>

            <div className="traz-modal-footer">
              <span className="traz-import-count">
                {importSelection.size} formulario(s) seleccionado(s)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="traz-btn-secondary" onClick={() => setShowImportModal(false)}>Cancelar</button>
                <button
                  className="traz-btn-primary"
                  disabled={importSelection.size === 0}
                  onClick={importSelectedTemplates}
                >
                  📥 Importar seleccionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* AI ASSISTANT FLOATING PANEL                                             */}
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {/* Floating button */}
      <button
        className={`traz-ai-fab ${aiOpen ? 'traz-ai-fab--open' : ''}`}
        onClick={() => setAiOpen(o => !o)}
        title="Asistente AI de Trazabilidad"
      >
        {aiOpen ? '✕' : '🤖'}
        {!aiOpen && <span className="traz-ai-fab-label">IA Trazabilidad</span>}
      </button>

      {/* AI Panel */}
      {aiOpen && (        <div className="traz-ai-panel">
          {/* Header */}
          <div className="traz-ai-header">
            <div className="traz-ai-header-left">
              <span className="traz-ai-icon">🤖</span>
              <div>
                <strong>Asistente AI</strong>
                <small>
                  {selectedFormato
                    ? `Contexto: ${selectedFormato.nombre}`
                    : 'Trazabilidad · FrigoVoice Agent'}
                </small>
              </div>
            </div>
            <button className="traz-ai-close" onClick={() => setAiOpen(false)}>✕</button>
          </div>

          {/* Context indicator */}
          {selectedFormato && (
            <div className="traz-ai-context-bar">
              <span>📋 Formato activo:</span>
              <strong>{selectedFormato.nombre}</strong>
              <span className={`traz-modulo-badge modulo-${(selectedFormato.modulo || 'BASE').toLowerCase()}`}>
                {selectedFormato.modulo}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="traz-ai-messages">
            {aiMessages.map((msg, i) => (
              <div
                key={i}
                className={`traz-ai-msg traz-ai-msg--${msg.role} ${msg.error ? 'traz-ai-msg--error' : ''}`}
              >
                <div className="traz-ai-msg-text">
                  {msg.text.split('\n').map((line, li) => (
                    <span key={li}>{line}{li < msg.text.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="traz-ai-msg-tools">
                    {msg.toolsUsed.map((t, j) => (
                      <span key={j} className="traz-ai-tool-tag">⚙️ {t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {aiLoading && (
              <div className="traz-ai-msg traz-ai-msg--assistant">
                <div className="traz-ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* Quick suggestions */}
          {aiMessages.length <= 2 && (
            <div className="traz-ai-suggestions">
              {AI_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="traz-ai-suggestion"
                  onClick={() => sendAiMessage(s)}
                  disabled={aiLoading}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="traz-ai-input-row">
            <textarea
              ref={aiInputRef}
              className="traz-ai-input"
              placeholder="Pregunta sobre trazabilidad, lotes, formularios…"
              rows={2}
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendAiMessage();
                }
              }}
              disabled={aiLoading}
            />
            <button
              className="traz-ai-send"
              onClick={() => sendAiMessage()}
              disabled={aiLoading || !aiInput.trim()}
              title="Enviar (Enter)"
            >
              {aiLoading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
