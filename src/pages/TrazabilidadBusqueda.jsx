import { useState, useCallback, useEffect, useRef } from 'react';
import { mcpObtenerFormulario, agentQuery } from '../services/aiService';
import TraceabilityService from '../services/traceabilityService';
import './TrazabilidadBusqueda.css';

// â”€â”€â”€ Config storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STORAGE_KEY = 'frigolab_trazabilidad_config';
function loadConfig() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatDate(dt) {
  if (!dt) return 'â€”';
  try {
    return new Date(dt).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(dt); }
}

function buildAiContext(pasos, formDataCache, selectedCols, lote) {
  let ctx = `[DATOS DE TRAZABILIDAD â€” LOTE ${lote}]\n\n`;
  pasos.forEach((paso, i) => {
    ctx += `FORMULARIO ${i + 1}: ${paso.template_codigo || ''} â€” ${paso.template_nombre}\n`;
    ctx += `  Fecha: ${formatDate(paso.created_at)} | Responsable: ${paso.filled_by}\n`;
    if (paso.header && Object.keys(paso.header).length > 0) {
      const hEntries = Object.entries(paso.header).map(([k, v]) => `${k}="${v}"`).join(', ');
      ctx += `  Encabezado: ${hEntries}\n`;
    }
    const fd = formDataCache[paso.form_id];
    if (fd?.tablas?.length > 0) {
      fd.tablas.forEach((tabla, ti) => {
        const key = `${paso.form_id}_${ti}`;
        const cols = selectedCols[key] || [];
        if (cols.length > 0) {
          ctx += `  Tabla ${ti + 1} â€” Columnas seleccionadas: ${cols.join(', ')}\n`;
          tabla.filas.slice(0, 50).forEach(row => {
            const vals = cols.map(c => `${c}=${row[c] ?? ''}`).join(', ');
            if (vals.replace(/[=,\s]/g, '')) ctx += `    â†’ ${vals}\n`;
          });
        } else if (paso.body_rows?.length > 0) {
          ctx += `  Filas del lote:\n`;
          paso.body_rows.slice(0, 15).forEach(row => {
            ctx += `    â†’ ${Object.entries(row).map(([k, v]) => `${k}="${v}"`).join(', ')}\n`;
          });
        }
      });
    } else if (paso.body_rows?.length > 0) {
      ctx += `  Filas del lote:\n`;
      paso.body_rows.slice(0, 15).forEach(row => {
        ctx += `    â†’ ${Object.entries(row).map(([k, v]) => `${k}="${v}"`).join(', ')}\n`;
      });
    }
    if (paso.observaciones) ctx += `  Observaciones: ${paso.observaciones}\n`;
    ctx += '\n';
  });
  ctx += 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n';
  return ctx;
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function TrazabilidadBusqueda() {
  const config = loadConfig();
  const [formatos] = useState(config.formatos || []);
  const [allDetalles] = useState(config.detalles || []);
  const [selectedFormatoId, setSelectedFormatoId] = useState(
    config.formatos?.[0]?.id ? String(config.formatos[0].id) : ''
  );

  // Search state
  const [lote, setLote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expandedPaso, setExpandedPaso] = useState(null);
  
  // All lotes state
  const [allLotes, setAllLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);

  // Full form data per paso
  const [formDataCache, setFormDataCache] = useState({}); // { formId: data | { error } | undefined }
  const [loadingFormId, setLoadingFormId] = useState(null);
  const [autoLoadingForAi, setAutoLoadingForAi] = useState(false);

  // Selected columns: { "formId_tablaIdx": string[] }
  const [selectedCols, setSelectedCols] = useState({});
  const AI_INITIAL_MESSAGE = 'Usa "Usar todos los documentos con IA" para cargar los formularios del lote y analizarlos automaticamente. Tambien puedes abrir un formulario y seleccionar columnas manualmente.';

  // AI chat panel
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([{
    role: 'assistant',
    text: AI_INITIAL_MESSAGE,
  }]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);
  const aiInputRef = useRef(null);

  const selectedFormato = formatos.find(f => String(f.id) === selectedFormatoId) || null;
  const detalles = selectedFormato
    ? allDetalles.filter(d => d.formatoId === selectedFormato.id).sort((a, b) => a.orden - b.orden)
    : [];

  const totalSelectedCols = Object.values(selectedCols).reduce((acc, arr) => acc + arr.length, 0);

  // Auto-scroll AI
  useEffect(() => {
    if (aiOpen) aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiOpen]);

  // Load all lotes on mount
  useEffect(() => {
    const fetchLotes = async () => {
      setLoadingLotes(true);
      try {
        const data = await TraceabilityService.getLotes();
        if (data && data.lotes) {
          setAllLotes(data.lotes);
        }
      } catch (err) {
        console.error("No se pudieron cargar los lotes", err);
      } finally {
        setLoadingLotes(false);
      }
    };
    fetchLotes();
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const buscar = useCallback(async (loteParam = null) => {
    const v = loteParam || lote.trim();
    if (!v) return;
    if (loteParam && loteParam !== lote) setLote(loteParam);
    
    setLoading(true);
    setError('');
    setResult(null);
    setExpandedPaso(null);
    setFormDataCache({});
    setSelectedCols({});
    setAutoLoadingForAi(false);
    setAiOpen(false);
    setAiMessages([{
      role: 'assistant',
      text: AI_INITIAL_MESSAGE,
    }]);
    try {
      const data = await TraceabilityService.getLoteTraceability(v);
      setResult(data);
    } catch {
      setError('No se pudo conectar con el backend de Trazabilidad.');
    } finally {
      setLoading(false);
    }
  }, [lote]);

  const handleKey = (e) => { if (e.key === 'Enter') buscar(); };

  // ── Load full form data ─────────────────────────────────────────────────────
  const loadFormData = useCallback(async (formId) => {
    if (formDataCache[formId] !== undefined || loadingFormId) return;
    setLoadingFormId(formId);
    try {
      const data = await mcpObtenerFormulario(formId);
      setFormDataCache(prev => ({ ...prev, [formId]: data || { error: 'El agente no devolviÃ³ datos estructurados.' } }));
    } catch {
      setFormDataCache(prev => ({ ...prev, [formId]: { error: 'Error al cargar datos completos del formulario.' } }));
    } finally {
      setLoadingFormId(null);
    }
  }, [formDataCache, loadingFormId]);

  // ── Column selection ───────────────────────────────────────────────────────
  const toggleCol = useCallback((formId, tablaIdx, col) => {
    const key = `${formId}_${tablaIdx}`;
    setSelectedCols(prev => {
      const cur = [...(prev[key] || [])];
      const i = cur.indexOf(col);
      if (i >= 0) cur.splice(i, 1); else cur.push(col);
      return { ...prev, [key]: cur };
    });
  }, []);

  const toggleAllCols = useCallback((formId, tablaIdx, cols) => {
    const key = `${formId}_${tablaIdx}`;
    setSelectedCols(prev => {
      const cur = prev[key] || [];
      const allSel = cols.every(c => cur.includes(c));
      return { ...prev, [key]: allSel ? [] : [...cols] };
    });
  }, []);

  const analyzeAllDocumentsWithAi = useCallback(async () => {
    if (!result?.pasos?.length || aiLoading || autoLoadingForAi) return;

    const prompt = `Usa todos los documentos cargados del lote ${result.numeroLote} para reconstruir la trazabilidad completa, explicar el flujo paso a paso, detectar faltantes e identificar inconsistencias.`;
    const mergedCache = { ...formDataCache };
    const mergedSelected = { ...selectedCols };

    setAiOpen(true);
    setAiInput('');
    setAutoLoadingForAi(true);

    try {
      for (const paso of result.pasos) {
        if (!paso.form_id) continue;

        let data = mergedCache[paso.form_id];
        if (data === undefined) {
          try {
            data = await mcpObtenerFormulario(paso.form_id);
            mergedCache[paso.form_id] = data || { error: 'El agente no devolvio datos estructurados.' };
          } catch {
            mergedCache[paso.form_id] = { error: 'Error al cargar datos completos del formulario.' };
            continue;
          }
        }

        if (mergedCache[paso.form_id]?.tablas?.length > 0) {
          mergedCache[paso.form_id].tablas.forEach((tabla, tablaIdx) => {
            mergedSelected[`${paso.form_id}_${tablaIdx}`] = [...(tabla.columnas || [])];
          });
        }
      }

      setFormDataCache(prev => ({ ...prev, ...mergedCache }));
      setSelectedCols(prev => ({ ...prev, ...mergedSelected }));

      const userMessage = { role: 'user', text: prompt };
      setAiMessages(prev => [...prev, userMessage]);
      setAiLoading(true);

      const traceCtx = buildAiContext(result.pasos, mergedCache, mergedSelected, result.numeroLote);
      const history = [
        ...aiMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-5)
          .map(m => ({ role: m.role, text: m.text })),
        userMessage,
      ].slice(-6);

      const res = await agentQuery(`${traceCtx}\nPregunta del usuario: ${prompt}`, history);
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        text: res.response,
        toolsUsed: res.tools_used || [],
      }]);
    } catch {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Error al conectar con el agente IA. Verifica que frigo-ai este activo.',
        error: true,
      }]);
    } finally {
      setAiLoading(false);
      setAutoLoadingForAi(false);
    }
  }, [aiLoading, aiMessages, autoLoadingForAi, formDataCache, result, selectedCols]);

  // ── AI Chat ────────────────────────────────────────────────────────────────
  const sendAiMessage = useCallback(async (text) => {
    const query = (text || aiInput).trim();
    if (!query || aiLoading) return;
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: query }]);
    setAiLoading(true);
    try {
      const traceCtx = result
        ? buildAiContext(result.pasos, formDataCache, selectedCols, result.numeroLote)
        : '';
      const fullQuery = traceCtx ? `${traceCtx}\nPregunta del usuario: ${query}` : query;
      const history = aiMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map(m => ({ role: m.role, text: m.text }));
      const res = await agentQuery(fullQuery, history);
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        text: res.response,
        toolsUsed: res.tools_used || [],
      }]);
    } catch {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Error al conectar con el agente IA. Verifica que frigo-ai estÃ© activo.',
        error: true,
      }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages, result, formDataCache, selectedCols]);

  // ── Compliance ──────────────────────────────────────────────────────────────
  const compliance = detalles
    .filter(d => d.tipo === 'DATOS_SISTEMA' && d.codigoDocumento)
    .map(det => {
      const found = result?.pasos?.filter(
        p => p.template_codigo?.toUpperCase() === det.codigoDocumento.toUpperCase()
      ) || [];
      return { det, found, ok: found.length > 0 };
    });
  const totalOk = compliance.filter(c => c.ok).length;
  const pct = compliance.length > 0 ? Math.round((totalOk / compliance.length) * 100) : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="tb-container">
      {/* Header */}
      <div className="tb-header">
        <h1 className="tb-title">🔍 Trazabilidad de Lotes</h1>
        <p className="tb-subtitle">
          Rastrea formularios llenados, selecciona columnas y analiza los datos con IA
        </p>
      </div>

      {/* Search bar */}
      <div className="tb-search-bar">
        {formatos.length > 0 && (
          <div className="tb-format-wrap">
            <label className="tb-label">Formato:</label>
            <select className="tb-select" value={selectedFormatoId} onChange={e => setSelectedFormatoId(e.target.value)}>
              <option value="">— Sin seleccionar —</option>
              {formatos.map(f => <option key={f.id} value={String(f.id)}>{f.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="tb-input-wrap">
          <span className="tb-search-icon">🔍</span>
          <input
            className="tb-input"
            type="text"
            placeholder={selectedFormato?.campoBusqueda ? `${selectedFormato.campoBusqueda} (ej. 260302)` : 'Número de lote (ej. 260302)'}
            value={lote}
            onChange={e => setLote(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
        </div>
        <button className="tb-btn-search" onClick={() => buscar()} disabled={loading || !lote.trim()}>
          {loading ? '⏳ Buscando…' : '🔗 Rastrear'}
        </button>
      </div>

      {error && <div className="tb-error">⚠️ {error}</div>}
      {loading && <div className="tb-loading"><div className="tb-spinner" /><span>Consultando trazabilidad en el backend…</span></div>}

      {/* ══════════ RESULTS ══════════ */}
      {result && !loading && (
        <div className="tb-results">

          {/* Summary */}
          <div className="tb-summary">
            <div className="tb-summary-left">
              <span className="tb-summary-lote">Lote: <strong>{result.numeroLote}</strong></span>
              <span className={`tb-summary-badge ${result.pasos.length > 0 ? 'badge-found' : 'badge-none'}`}>
                {result.pasos.length > 0
                  ? `${result.pasos.length} formulario${result.pasos.length !== 1 ? 's' : ''} encontrado${result.pasos.length !== 1 ? 's' : ''}`
                  : 'Sin resultados'}
              </span>
              {result.soloBorradores && <span className="tb-summary-badge badge-draft">Solo borradores</span>}
              {result.pasos.length > 0 && (
                <button
                  className="tb-btn-ai-all"
                  onClick={analyzeAllDocumentsWithAi}
                  disabled={autoLoadingForAi || aiLoading}
                >
                  {autoLoadingForAi ? 'Preparando documentos para IA...' : 'Usar todos los documentos con IA'}
                </button>
              )}
              {totalSelectedCols > 0 && (
                <button className="tb-summary-badge badge-sel" onClick={() => setAiOpen(true)}>
                  📊 {totalSelectedCols} columna{totalSelectedCols !== 1 ? 's' : ''} — Analizar con IA →
                </button>
              )}
            </div>
          </div>

          {/* Compliance */}
          {compliance.length > 0 && result.pasos.length > 0 && (
            <div className="tb-compliance">
              <div className="tb-compliance-top">
                <h3 className="tb-compliance-title">
                  Completitud — <em>{selectedFormato?.nombre}</em>
                </h3>
                <div className={`tb-pct-pill ${pct === 100 ? 'pct-full' : pct >= 50 ? 'pct-half' : 'pct-low'}`}>
                  {pct}% <span className="tb-pct-sub">({totalOk}/{compliance.length})</span>
                </div>
              </div>
              <div className="tb-compliance-grid">
                {compliance.map(({ det, found, ok }) => (
                  <div key={det.id} className={`tb-comp-item ${ok ? 'comp-ok' : 'comp-miss'}`}>
                    <span className="tb-comp-icon">{ok ? '✅' : '❌'}</span>
                    <div className="tb-comp-text">
                      <span className="tb-comp-code">{det.codigoDocumento}</span>
                      <span className="tb-comp-name">{det.nombreDocumento}</span>
                      {ok && <span className="tb-comp-count">{found.length} hallazgo{found.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <span className="tb-comp-order">#{det.orden}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {result.pasos.length > 0 && (
            <div className="tb-timeline">
              <h3 className="tb-timeline-title">
                Formularios encontrados
                <span className="tb-timeline-count">{result.pasos.length} registros</span>
              </h3>
              <p className="tb-timeline-hint">
                💡 Usa <b>Usar todos los documentos con IA</b> para analizar el lote completo de una vez, o carga formularios individuales si quieres revisar columnas especificas.
              </p>
              <div className="tb-timeline-list">
                {result.pasos.map((paso, i) => {
                  const isExpanded = expandedPaso === i;
                  const fd = formDataCache[paso.form_id];
                  const isLoadingFull = loadingFormId === paso.form_id;
                  const hasFd = fd && !fd.error;
                  const hasQuickDetail =
                    (paso.header && Object.keys(paso.header).length > 0) ||
                    paso.body_rows?.length > 0 || paso.observaciones;

                  return (
                    <div key={paso.form_id || i} className="tb-paso-wrapper">
                      <div className="tb-paso-line">
                        <div className="tb-paso-dot-col">
                          <div className="tb-paso-dot" />
                          {i < result.pasos.length - 1 && <div className="tb-paso-connector" />}
                        </div>
                        <div className="tb-paso-card">

                          {/* ── Card title row ── */}
                          <div className="tb-paso-top">
                            <div className="tb-paso-id-col">
                              <span className="tb-paso-num">{i + 1}</span>
                            </div>
                            <div className="tb-paso-main-col">
                              <div className="tb-paso-title-row">
                                {paso.template_codigo && (
                                  <span className="tb-paso-codigo">{paso.template_codigo}</span>
                                )}
                                <span className="tb-paso-nombre">{paso.template_nombre}</span>
                              </div>
                              <div className="tb-paso-meta-row">
                                <span>📅 {formatDate(paso.created_at)}</span>
                                <span>👤 {paso.filled_by || 'N/A'}</span>
                                {paso.filled_by_role && (
                                  <span className="tb-paso-role">{paso.filled_by_role}</span>
                                )}
                                {paso.tipo_producto && (
                                  <span className="tb-paso-tipo">{paso.tipo_producto}</span>
                                )}
                              </div>
                            </div>
                            <div className="tb-paso-actions">
                              {hasQuickDetail && (
                                <button
                                  className="tb-paso-toggle"
                                  onClick={() => setExpandedPaso(isExpanded ? null : i)}
                                >
                                  {isExpanded ? '▲ Ocultar' : '▼ Resumen'}
                                </button>
                              )}
                              {paso.form_id && !hasFd && !isLoadingFull && (
                                <button
                                  className="tb-btn-loadfull"
                                  onClick={() => loadFormData(paso.form_id)}
                                  title="Cargar todas las filas y columnas del formulario"
                                >
                                  📊 Datos completos
                                </button>
                              )}
                              {isLoadingFull && (
                                <span className="tb-loadfull-spin">⏳ Cargando…</span>
                              )}
                              {hasFd && (
                                <span className="tb-loadfull-ok">
                                  ✓ {fd.tablas?.length || 0} tabla{fd.tablas?.length !== 1 ? 's' : ''}, {fd.tablas?.reduce((a, t) => a + t.total_filas, 0) || 0} filas
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ── Quick view (resumen) ── */}
                          {isExpanded && (
                            <div className="tb-paso-details">
                              {paso.header && Object.keys(paso.header).length > 0 && (
                                <div className="tb-quick-section">
                                  <span className="tb-quick-label">Encabezado</span>
                                  <div className="tb-paso-fields">
                                    {Object.entries(paso.header).map(([k, v]) => (
                                      <span key={k} className="tb-paso-field">
                                        <b>{k}:</b> {String(v ?? '')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {paso.body_rows?.length > 0 && (() => {
                                const cols = [...new Set(paso.body_rows.flatMap(r => Object.keys(r)))].slice(0, 8);
                                return (
                                  <div className="tb-quick-section">
                                    <span className="tb-quick-label">Filas que contienen el lote</span>
                                    <div className="tb-body-table-wrap">
                                      <table className="tb-body-table">
                                        <thead><tr>{cols.map(k => <th key={k}>{k}</th>)}</tr></thead>
                                        <tbody>
                                          {paso.body_rows.slice(0, 10).map((row, ri) => (
                                            <tr key={ri}>{cols.map(k => <td key={k}>{String(row[k] ?? '')}</td>)}</tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {paso.body_rows.length > 10 && (
                                        <p className="tb-body-more">… {paso.body_rows.length - 10} filas mÃ¡s</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              {paso.observaciones && (
                                <p className="tb-paso-obs"><b>Observaciones:</b> {paso.observaciones}</p>
                              )}
                            </div>
                          )}

                          {/* ── Full data panel ── */}
                          {hasFd && (
                            <div className="tb-fulldata">
                              <div className="tb-fulldata-topbar">
                                <span className="tb-fulldata-title">📊 Datos completos del formulario</span>
                                <span className="tb-fulldata-hint">Selecciona columnas para enviar al agente IA</span>
                              </div>

                              {fd.header && Object.keys(fd.header).length > 0 && (
                                <div className="tb-fulldata-header-fields">
                                  <span className="tb-quick-label">Encabezado</span>
                                  <div className="tb-paso-fields">
                                    {Object.entries(fd.header).map(([k, v]) => (
                                      <span key={k} className="tb-paso-field">
                                        <b>{k}:</b> {String(v ?? '')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {fd.tablas?.length > 0 ? fd.tablas.map((tabla, ti) => {
                                const key = `${paso.form_id}_${ti}`;
                                const selCols = selectedCols[key] || [];
                                const allSel = tabla.columnas.length > 0 && tabla.columnas.every(c => selCols.includes(c));
                                return (
                                  <div key={ti} className="tb-fulldata-tabla">
                                    <div className="tb-tabla-topbar">
                                      <span className="tb-tabla-label">
                                        Tabla {ti + 1}
                                        <span className="tb-tabla-stats"> · {tabla.total_filas} filas · {tabla.columnas.length} columnas</span>
                                      </span>
                                      <button
                                        className={`tb-col-toggle-all ${allSel ? 'toggle-all-on' : ''}`}
                                        onClick={() => toggleAllCols(paso.form_id, ti, tabla.columnas)}
                                      >
                                        {allSel ? '✓ Quitar todo' : '☑ Seleccionar todo'}
                                      </button>
                                    </div>
                                    <div className="tb-fulldata-table-wrap">
                                      <table className="tb-fulldata-table">
                                        <thead>
                                          <tr>
                                            {tabla.columnas.map(col => {
                                              const isSel = selCols.includes(col);
                                              return (
                                                <th
                                                  key={col}
                                                  className={`tb-col-th ${isSel ? 'col-th-selected' : ''}`}
                                                  onClick={() => toggleCol(paso.form_id, ti, col)}
                                                  title={`Clic para ${isSel ? 'deseleccionar' : 'seleccionar'} columna`}
                                                >
                                                  <label className="tb-col-check" onClick={e => e.stopPropagation()}>
                                                    <input
                                                      type="checkbox"
                                                      checked={isSel}
                                                      onChange={() => toggleCol(paso.form_id, ti, col)}
                                                    />
                                                    {col}
                                                  </label>
                                                </th>
                                              );
                                            })}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {tabla.filas.slice(0, 25).map((row, ri) => (
                                            <tr key={ri}>
                                              {tabla.columnas.map(col => (
                                                <td key={col} className={selCols.includes(col) ? 'cell-selected' : ''}>
                                                  {String(row[col] ?? '')}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {tabla.total_filas > 25 && (
                                        <p className="tb-body-more">Mostrando 25 de {tabla.total_filas} filas</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              }) : (
                                <p className="tb-no-detail">
                                  Este formulario no tiene tablas de datos en el cuerpo.
                                </p>
                              )}
                            </div>
                          )}

                          {fd?.error && (
                            <div className="tb-fulldata-error">âš ï¸ {fd.error}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.pasos.length === 0 && (
            <div className="tb-empty">
              <div className="tb-empty-icon">ðŸ“­</div>
              <h3>No se encontraron formularios llenados</h3>
              <p>No hay registros que mencionen el lote <strong>{result.numeroLote}</strong>.</p>
              {result.mensaje && <p className="tb-empty-msg">{result.mensaje}</p>}
              <p className="tb-empty-hint">Verifica el nÃºmero exacto del lote.</p>
            </div>
          )}
        </div>
      )}

      {/* Initial guide & Lotes List */}
      {!result && !loading && !error && (
        <div className="tb-guide-and-lotes">
          <div className="tb-guide">
            <div className="tb-guide-icon">🔗</div>
            <h3>Trazabilidad con datos reales</h3>
            <ol className="tb-guide-steps">
              <li>Ingresa el número de lote y haz clic en <b>Rastrear</b></li>
              <li>En cada formulario, haz clic en <b>📊 Datos completos</b></li>
              <li><b>Selecciona las columnas</b> que quieres analizar (Kg, Temperatura, Especie…)</li>
              <li>Usa el <b>🤖 Panel IA</b> para calcular mermas, comparar valores o generar reportes</li>
            </ol>
            <p className="tb-guide-tip">💡 La IA recibe el contenido real de los formularios como contexto</p>
          </div>

          <div className="tb-lotes-list-container" style={{ marginTop: '30px', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ borderBottom: '2px solid #0056b3', paddingBottom: '10px', color: '#0056b3' }}>
              📦 Lotes Recientes Registrados
            </h3>
            {loadingLotes ? (
              <p>⏳ Cargando lotes...</p>
            ) : allLotes.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '15px' }}>
                {allLotes.map(l => (
                  <div 
                    key={l.lote} 
                    style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => buscar(l.lote)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#0056b3'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#ddd'}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '8px', color: '#333' }}>
                      Lote: {l.lote}
                    </div>
                    {l.productos && l.productos.length > 0 && (
                      <div style={{ fontSize: '0.85em', color: '#0056b3', marginBottom: '4px' }}>
                        <b>Producto:</b> {l.productos.join(', ')}
                      </div>
                    )}
                    {l.subproductos && l.subproductos.length > 0 && (
                      <div style={{ fontSize: '0.85em', color: '#e67e22', marginBottom: '8px' }}>
                        <b>Subproducto:</b> {l.subproductos.join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px', marginTop: '8px' }}>
                      <span style={{ display: 'inline-block', backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85em', marginRight: '5px' }}>
                        {l.count} formularios
                      </span>
                      <span>Último: {l.last_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#777' }}>No hay lotes registrados recientemente.</p>
            )}
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• AI PANEL (sticky bottom) â•â•â•â•â•â•â•â•â•â• */}
      {result && result.pasos.length > 0 && (
        <div className={`tb-ai-panel ${aiOpen ? 'tb-ai-panel-open' : ''}`}>
          <button
            className={`tb-ai-toggle-btn ${totalSelectedCols > 0 ? 'ai-btn-active' : ''}`}
            onClick={() => setAiOpen(v => !v)}
          >
            <span className="tb-ai-btn-icon">ðŸ¤–</span>
            <span className="tb-ai-btn-label">Analizar con IA</span>
            {totalSelectedCols > 0 && (
              <span className="tb-ai-toggle-badge">
                {totalSelectedCols} col{totalSelectedCols !== 1 ? 's' : ''} seleccionada{totalSelectedCols !== 1 ? 's' : ''}
              </span>
            )}
            {!totalSelectedCols && result.pasos.length > 0 && (
              <span className="tb-ai-toggle-hint">Pregunta sobre el lote {result.numeroLote}</span>
            )}
            <span className="tb-ai-toggle-arrow">{aiOpen ? 'â–¼' : 'â–²'}</span>
          </button>

          {aiOpen && (
            <div className="tb-ai-chat">
              <div className="tb-ai-msgs">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`tb-ai-msg tb-ai-msg-${m.role} ${m.error ? 'tb-ai-msg-error' : ''}`}>
                    <div className="tb-ai-msg-role">{m.role === 'assistant' ? 'ðŸ¤– IA' : 'ðŸ‘¤ TÃº'}</div>
                    <div className="tb-ai-msg-text">{m.text}</div>
                    {m.toolsUsed?.length > 0 && (
                      <div className="tb-ai-tools">
                        {m.toolsUsed.map(t => <span key={t} className="tb-ai-tool">{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="tb-ai-msg tb-ai-msg-assistant">
                    <div className="tb-ai-msg-role">ðŸ¤– IA</div>
                    <div className="tb-ai-typing"><span /><span /><span /></div>
                  </div>
                )}
                <div ref={aiBottomRef} />
              </div>

              <div className="tb-ai-suggestions">
                {(totalSelectedCols > 0
                  ? ['Calcula mermas o diferencias de peso', '¿Cuál es el promedio de temperatura?', 'Resume los datos seleccionados', 'Identifica alguna irregularidad']
                  : ['¿Cuántos formularios encontraste?', `Resume la trazabilidad del lote ${result.numeroLote}`, '¿Hay datos inconsistentes?', '¿Qué formularios faltan?']
                ).map(s => (
                  <button key={s} className="tb-ai-sug" onClick={() => sendAiMessage(s)}>{s}</button>
                ))}
              </div>

              <div className="tb-ai-input-row">
                <textarea
                  ref={aiInputRef}
                  className="tb-ai-input"
                  rows={2}
                  placeholder="Pregunta sobre los formularios del loteâ€¦"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
                  }}
                />
                <button
                  className="tb-ai-send"
                  onClick={() => sendAiMessage()}
                  disabled={aiLoading || !aiInput.trim()}
                >
                  {aiLoading ? 'â³' : 'âž¤'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

