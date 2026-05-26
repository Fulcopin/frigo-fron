import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLotes,
  deleteLote,
  consumirLote,
  liberarLote,
  addLote,
  getArbol,
  sincronizarDesdeFormularios,
} from '../hooks/useLoteStore';
import './LotesInventario.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const n = (v) => Number.parseFloat(v) || 0;

const CLASIFICACIONES = ['Especial', 'Entero', '1-2 lbs Fletch', '2-3 lbs Fletch', '3+ lbs Fletch', '4-8 oz', 'Colas', 'Seagr'];
const TIPOS_DESP = ['Aserrín', 'Vísceras', 'Recortes', 'Merma por frío', 'Rechazo calidad', 'Otro'];

const EMPTY_NUEVO = {
  lote: '', proceso: '', producto: '', clasificacion: 'Especial',
  pesoEntrada: '', desperdicio: '', tipoDesperdicio: 'Aserrín',
  lotePadre: '', notas: '', formId: '', templateId: ''
};

// ── Componente Árbol de Trazabilidad ─────────────────────────────────────────
function ArbolNodo({ nodo, nivel = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = nodo.hijos?.length > 0;
  return (
    <div className="li-arbol-nodo" style={{ paddingLeft: nivel * 22 }}>
      <div className="li-arbol-item" onClick={() => hasChildren && setExpanded(e => !e)}>
        {hasChildren && <span className="li-arbol-toggle">{expanded ? '▼' : '▶'}</span>}
        {!hasChildren && <span className="li-arbol-leaf">◆</span>}
        <span className="li-arbol-lote">{nodo.lote}</span>
        <span className="li-arbol-proc">{nodo.proceso}</span>
        <span className="li-arbol-prod">{nodo.producto}</span>
        <span className={`li-arbol-estado li-estado-${nodo.estado}`}>{nodo.estado}</span>
        <span className="li-arbol-peso">{n(nodo.pesoNeto).toFixed(2)} lbs neto</span>
      </div>
      {expanded && hasChildren && nodo.hijos.map(h => (
        <ArbolNodo key={h.id} nodo={h} nivel={nivel + 1} />
      ))}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function LotesInventario() {
  const navigate = useNavigate();
  const [tab, setTab]          = useState('disponibles');
  const [lotes, setLotes]      = useState([]);
  const [buscar, setBuscar]    = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevo, setNuevo]      = useState({ ...EMPTY_NUEVO });
  const [arbolLote, setArbolLote] = useState(null);
  const [arbolData, setArbolData] = useState(null);
  const [filtroProc, setFiltroProc] = useState('');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState(null);
  const [syncing, setSyncing]  = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  // Modal de detalle
  const [detalleLote, setDetalleLote] = useState(null);

  const cargarLotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLotes();
      // Guarantee lotes is always an array — a non-array response would crash .filter/.map
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error cargando lotes: ' + err.message);
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarLotes();
  }, [cargarLotes]);

  // ── Filtrado ──
  const procesos = [...new Set(lotes.map(l => l.proceso).filter(Boolean))];

  const lotesFiltrados = lotes.filter(l => {
    const matchTab =
      tab === 'todos' ? true :
      tab === 'disponibles' ? l.estado === 'disponible' || l.estado === 'parcial' :
      l.estado === 'consumido';
    const matchBuscar = !buscar ||
      l.lote?.toLowerCase().includes(buscar.toLowerCase()) ||
      l.producto?.toLowerCase().includes(buscar.toLowerCase()) ||
      l.proceso?.toLowerCase().includes(buscar.toLowerCase());
    const matchProc = !filtroProc || l.proceso === filtroProc;
    return matchTab && matchBuscar && matchProc;
  });

  // ── Estadísticas ──
  const disponibles = lotes.filter(l => l.estado === 'disponible' || l.estado === 'parcial');
  const totalLbsDisp = disponibles.reduce((s, l) => s + n(l.pesoNeto), 0);
  const totalLbsTodas = lotes.reduce((s, l) => s + n(l.pesoEntrada), 0);
  const pctConsumo = totalLbsTodas > 0
    ? ((lotes.filter(l => l.estado === 'consumido').reduce((s, l) => s + n(l.pesoEntrada), 0) / totalLbsTodas) * 100).toFixed(1)
    : '0';

  // ── Acciones ──
  const handleConsumir = async (lote) => {
    if (!globalThis.confirm(`¿Marcar lote ${lote.lote} como consumido?`)) return;
    try {
      await consumirLote(lote.lote);
      await cargarLotes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  const handleLiberar = async (lote) => {
    try {
      await liberarLote(lote.id);
      await cargarLotes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  const handleEliminar = async (lote) => {
    if (!globalThis.confirm(`¿Eliminar permanentemente el lote ${lote.lote}?`)) return;
    try {
      await deleteLote(lote.id);
      await cargarLotes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  const handleVerArbol = async (loteNum) => {
    setArbolLote(loteNum);
    try {
      const arbol = await getArbol(loteNum);
      setArbolData(arbol);
    } catch {
      setArbolData(null);
    }
  };

  // ── Sincronizar desde formularios ──
  const handleSincronizar = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await sincronizarDesdeFormularios();
      setSyncResult(res);
      await cargarLotes();
    } catch (err) {
      alert('Error al sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Guardar nuevo lote ──
  const handleGuardarNuevo = async () => {
    if (!nuevo.lote || !nuevo.proceso || !n(nuevo.pesoEntrada)) {
      alert('Completa Lote, Proceso y Peso de Entrada');
      return;
    }
    try {
      await addLote({
        ...nuevo,
        pesoEntrada: n(nuevo.pesoEntrada),
        desperdicio: n(nuevo.desperdicio),
        fecha: new Date().toISOString().split('T')[0],
        formId: nuevo.formId ? Number(nuevo.formId) : null,
        templateId: nuevo.templateId || null,
      });
      setNuevo({ ...EMPTY_NUEVO });
      setShowNuevo(false);
      await cargarLotes();
    } catch (err) {
      alert('Error guardando lote: ' + err.message);
    }
  };

  return (
    <div className="li-page">

      {/* ── TÍTULO ── */}
      <div className="li-page-header">
        <div className="li-page-title">
          <span>📦</span>
          <h1>Inventario de Lotes</h1>
          <span className="li-page-sub">Trazabilidad de proceso</span>
        </div>
        <div className="li-header-actions">
          <button
            className="li-btn-secondary"
            onClick={handleSincronizar}
            disabled={syncing}
            title="Escanea todos los formularios guardados y registra los lotes detectados en el inventario"
          >
            {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar desde formularios'}
          </button>
          <button className="li-btn-primary" onClick={() => setShowNuevo(true)}>
            + Nuevo lote
          </button>
        </div>
      </div>

      {error && <div className="li-error">⚠️ {error}</div>}
      {loading && <div className="li-loading">Cargando lotes…</div>}

      {/* ── RESULTADO SINCRONIZACIÓN ── */}
      {syncResult && (
        <div className="li-sync-result">
          <span>✅ Sincronización completada —</span>
          <strong> {syncResult.lotesNuevosRegistrados} lotes nuevos</strong> registrados
          {syncResult.lotesYaExistentes > 0 && (
            <span> · {syncResult.lotesYaExistentes} ya existían</span>
          )}
          <span> · {syncResult.totalFormulariosEscaneados} formularios escaneados</span>
          <button className="li-sync-close" onClick={() => setSyncResult(null)}>✕</button>
        </div>
      )}

      {/* ── STATS ── */}
      <div className="li-stats">
        <div className="li-stat">
          <span className="li-stat-val">{disponibles.length}</span>
          <span className="li-stat-lbl">Lotes disponibles</span>
        </div>
        <div className="li-stat">
          <span className="li-stat-val">{totalLbsDisp.toLocaleString()} lbs</span>
          <span className="li-stat-lbl">Peso neto disponible</span>
        </div>
        <div className="li-stat">
          <span className="li-stat-val">{lotes.length}</span>
          <span className="li-stat-lbl">Total de lotes</span>
        </div>
        <div className="li-stat">
          <span className="li-stat-val">{pctConsumo}%</span>
          <span className="li-stat-lbl">% consumido</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="li-tabs">
        {[
          { key: 'disponibles', label: `Disponibles (${disponibles.length})` },
          { key: 'consumidos',  label: `Consumidos (${lotes.filter(l => l.estado === 'consumido').length})` },
          { key: 'todos',       label: `Todos (${lotes.length})` },
          { key: 'arbol',       label: '🌳 Árbol de trazabilidad' },
        ].map(t => (
          <button
            key={t.key}
            className={`li-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ÁRBOL ── */}
      {tab === 'arbol' && (
        <div className="li-arbol-panel">
          <div className="li-arbol-search">
            <label>Buscar árbol por lote:</label>
            <input
              className="li-input"
              value={arbolLote || ''}
              onChange={e => setArbolLote(e.target.value)}
              placeholder="Número de lote raíz"
            />
            <button className="li-btn-primary" onClick={async () => { const a = await getArbol(arbolLote); setArbolData(a); }}>
              Ver árbol
            </button>
          </div>
          {arbolData ? (
            <div className="li-arbol-tree">
              <ArbolNodo nodo={arbolData} />
            </div>
          ) : (
            <div className="li-empty">Ingresa un número de lote y presiona &quot;Ver árbol&quot;</div>
          )}
        </div>
      )}

      {/* ── LISTADO ── */}
      {tab !== 'arbol' && (
        <>
          {/* Filtros */}
          <div className="li-filtros">
            <input
              className="li-input li-search"
              placeholder="🔍 Buscar lote, producto, proceso…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
            />
            <select
              className="li-input"
              value={filtroProc}
              onChange={e => setFiltroProc(e.target.value)}
            >
              <option value="">Todos los procesos</option>
              {procesos.map(p => <option key={p}>{p}</option>)}
            </select>
            <span className="li-count">{lotesFiltrados.length} registros</span>
          </div>

          {/* Tabla */}
          {lotesFiltrados.length === 0 ? (
            <div className="li-empty">No hay lotes para mostrar</div>
          ) : (
            <div className="li-table-wrap">
              <table className="li-table">
                <thead>
                  <tr>
                    <th>Lote #</th>
                    <th>Proceso</th>
                    <th>Producto</th>
                    <th>Clasificación</th>
                    <th>Lote padre</th>
                    <th>Form ID</th>
                    <th>P. Entrada (lbs)</th>
                    <th>Desperdicio (lbs)</th>
                    <th>Tipo Desp.</th>
                    <th>Peso Neto (lbs)</th>
                    <th>% Rend.</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesFiltrados.map(l => {
                    const rendimiento = n(l.pesoEntrada) > 0
                      ? ((n(l.pesoNeto) / n(l.pesoEntrada)) * 100).toFixed(1)
                      : '—';
                    return (
                      <tr key={l.id}>
                        <td className="li-lote-num">{l.lote}</td>
                        <td>{l.proceso || '—'}</td>
                        <td>{l.producto || '—'}</td>
                        <td>{l.clasificacion || '—'}</td>
                        <td className="li-padre">{l.lotePadre || '—'}</td>
                        <td className="li-formid">
                          {l.formId ? (
                            <button
                              className="li-btn-link"
                              onClick={() => navigate(`/view-forms`)}
                              title={`Ver formulario #${l.formId}`}
                            >
                              #{l.formId}
                            </button>
                          ) : '—'}
                        </td>
                        <td className="li-num">{n(l.pesoEntrada).toFixed(2)}</td>
                        <td className="li-num li-desp">{n(l.desperdicio).toFixed(2)}</td>
                        <td className="li-tipo-desp">{n(l.desperdicio) > 0 ? (l.tipoDesperdicio || '—') : '—'}</td>
                        <td className="li-num li-neto">{n(l.pesoNeto).toFixed(2)}</td>
                        <td className="li-num">{rendimiento}{rendimiento !== '—' ? '%' : ''}</td>
                        <td>
                          <span className={`li-estado li-estado-${l.estado}`}>{l.estado}</span>
                        </td>
                        <td>{l.fecha ? new Date(l.fecha).toLocaleDateString('es-HN') : '—'}</td>
                        <td className="li-notas" title={l.notas || ''}>
                          {l.notas ? l.notas.slice(0, 30) + (l.notas.length > 30 ? '…' : '') : '—'}
                        </td>
                        <td className="li-acciones">
                          <button className="li-btn-sm li-btn-det" onClick={() => setDetalleLote(l)} title="Ver detalle">🔍</button>
                          {l.estado !== 'consumido' && (
                            <button className="li-btn-sm li-btn-cons" onClick={() => handleConsumir(l)} title="Marcar consumido">✓</button>
                          )}
                          {l.estado === 'consumido' && (
                            <button className="li-btn-sm li-btn-lib" onClick={() => handleLiberar(l)} title="Liberar">↩</button>
                          )}
                          <button className="li-btn-sm li-btn-arbol" onClick={() => { setTab('arbol'); handleVerArbol(l.lote); }} title="Ver árbol">🌳</button>
                          <button className="li-btn-sm li-btn-del" onClick={() => handleEliminar(l)} title="Eliminar">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── MODAL DETALLE LOTE ── */}
      {detalleLote && (
        <div className="li-modal-overlay" onClick={() => setDetalleLote(null)}>
          <div className="li-modal li-modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="li-modal-header">
              <div>
                <h3>📦 Detalle del Lote</h3>
                <span className="li-modal-lote-num">{detalleLote.lote}</span>
              </div>
              <button className="li-modal-close" onClick={() => setDetalleLote(null)}>✕</button>
            </div>
            <div className="li-modal-body">
              <div className="li-detalle-grid">
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Número de Lote</span>
                  <span className="li-detalle-val li-lote-num">{detalleLote.lote}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Proceso</span>
                  <span className="li-detalle-val">{detalleLote.proceso || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Producto</span>
                  <span className="li-detalle-val">{detalleLote.producto || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Clasificación</span>
                  <span className="li-detalle-val">{detalleLote.clasificacion || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Lote Padre (Origen)</span>
                  <span className="li-detalle-val li-padre">{detalleLote.lotePadre || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Estado</span>
                  <span className={`li-estado li-estado-${detalleLote.estado}`}>{detalleLote.estado}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Peso Entrada (lbs)</span>
                  <span className="li-detalle-val">{n(detalleLote.pesoEntrada).toFixed(4)}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Desperdicio (lbs)</span>
                  <span className="li-detalle-val li-desp">{n(detalleLote.desperdicio).toFixed(4)}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Tipo de Desperdicio</span>
                  <span className="li-detalle-val">{detalleLote.tipoDesperdicio || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Peso Neto (lbs)</span>
                  <span className="li-detalle-val li-neto">{n(detalleLote.pesoNeto).toFixed(4)}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">% Rendimiento</span>
                  <span className="li-detalle-val">
                    {n(detalleLote.pesoEntrada) > 0
                      ? ((n(detalleLote.pesoNeto) / n(detalleLote.pesoEntrada)) * 100).toFixed(2) + '%'
                      : '—'}
                  </span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Fecha</span>
                  <span className="li-detalle-val">
                    {detalleLote.fecha ? new Date(detalleLote.fecha).toLocaleDateString('es-HN') : '—'}
                  </span>
                </div>
                <div className="li-detalle-group li-detalle-full">
                  <span className="li-detalle-label">Formulario Origen (Form ID)</span>
                  <span className="li-detalle-val">
                    {detalleLote.formId ? (
                      <button
                        className="li-btn-link"
                        onClick={() => { setDetalleLote(null); navigate('/view-forms'); }}
                      >
                        Ver Formulario #{detalleLote.formId}
                      </button>
                    ) : <em className="li-text-muted">Lote creado manualmente (sin formulario)</em>}
                  </span>
                </div>
                {detalleLote.templateId && (
                  <div className="li-detalle-group">
                    <span className="li-detalle-label">Template ID</span>
                    <span className="li-detalle-val li-padre">{detalleLote.templateId}</span>
                  </div>
                )}
                {detalleLote.notas && (
                  <div className="li-detalle-group li-detalle-full">
                    <span className="li-detalle-label">Notas</span>
                    <span className="li-detalle-val">{detalleLote.notas}</span>
                  </div>
                )}
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Creado en</span>
                  <span className="li-detalle-val li-text-muted">
                    {detalleLote.creadoEn ? new Date(detalleLote.creadoEn).toLocaleString('es-HN') : '—'}
                  </span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Actualizado en</span>
                  <span className="li-detalle-val li-text-muted">
                    {detalleLote.actualizadoEn ? new Date(detalleLote.actualizadoEn).toLocaleString('es-HN') : '—'}
                  </span>
                </div>
              </div>

              {/* Balance visual */}
              <div className="li-detalle-balance">
                <div className="li-bal-box">
                  <span className="li-bal-lbl">Entrada</span>
                  <strong>{n(detalleLote.pesoEntrada).toFixed(2)} lbs</strong>
                </div>
                <span className="li-bal-op">−</span>
                <div className="li-bal-box li-bal-desp">
                  <span className="li-bal-lbl">Desperdicio</span>
                  <strong>{n(detalleLote.desperdicio).toFixed(2)} lbs</strong>
                </div>
                <span className="li-bal-op">=</span>
                <div className="li-bal-box li-bal-neto">
                  <span className="li-bal-lbl">Peso Neto</span>
                  <strong>{n(detalleLote.pesoNeto).toFixed(2)} lbs</strong>
                </div>
              </div>
            </div>
            <div className="li-modal-footer">
              <button className="li-btn-secondary" onClick={() => setDetalleLote(null)}>Cerrar</button>
              <button className="li-btn-primary" onClick={() => { setDetalleLote(null); setTab('arbol'); handleVerArbol(detalleLote.lote); }}>
                🌳 Ver árbol de trazabilidad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO LOTE ── */}
      {showNuevo && (
        <div className="li-modal-overlay" onClick={() => setShowNuevo(false)}>
          <div className="li-modal" onClick={e => e.stopPropagation()}>
            <div className="li-modal-header">
              <h3>Nuevo lote manual</h3>
              <button className="li-modal-close" onClick={() => setShowNuevo(false)}>✕</button>
            </div>
            <div className="li-modal-body">
              <div className="li-form-grid">
                <div className="li-field">
                  <label>Número de lote *</label>
                  <input className="li-input" value={nuevo.lote}
                    onChange={e => setNuevo(p => ({ ...p, lote: e.target.value }))}
                    placeholder="Ej: 260511" />
                </div>
                <div className="li-field">
                  <label>Proceso *</label>
                  <input className="li-input" value={nuevo.proceso}
                    onChange={e => setNuevo(p => ({ ...p, proceso: e.target.value }))}
                    placeholder="Ej: Fileteo, Corte…" />
                </div>
                <div className="li-field">
                  <label>Producto</label>
                  <input className="li-input" value={nuevo.producto}
                    onChange={e => setNuevo(p => ({ ...p, producto: e.target.value }))}
                    placeholder="Ej: Mahi Mahi" />
                </div>
                <div className="li-field">
                  <label>Clasificación</label>
                  <select className="li-input" value={nuevo.clasificacion}
                    onChange={e => setNuevo(p => ({ ...p, clasificacion: e.target.value }))}>
                    {CLASIFICACIONES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="li-field">
                  <label>Lote padre (origen)</label>
                  <input className="li-input" value={nuevo.lotePadre}
                    onChange={e => setNuevo(p => ({ ...p, lotePadre: e.target.value }))}
                    placeholder="Opcional" />
                </div>
                <div className="li-field">
                  <label>Peso entrada (lbs) *</label>
                  <input className="li-input" type="number" value={nuevo.pesoEntrada}
                    onChange={e => setNuevo(p => ({ ...p, pesoEntrada: e.target.value }))} />
                </div>
                <div className="li-field">
                  <label>Desperdicio (lbs)</label>
                  <input className="li-input" type="number" value={nuevo.desperdicio}
                    onChange={e => setNuevo(p => ({ ...p, desperdicio: e.target.value }))} />
                </div>
                <div className="li-field">
                  <label>Tipo desperdicio</label>
                  <select className="li-input" value={nuevo.tipoDesperdicio}
                    onChange={e => setNuevo(p => ({ ...p, tipoDesperdicio: e.target.value }))}>
                    {TIPOS_DESP.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="li-field li-field-full">
                  <label>Notas</label>
                  <input className="li-input" value={nuevo.notas}
                    onChange={e => setNuevo(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Observaciones opcionales" />
                </div>
                <div className="li-field">
                  <label>Form ID (si aplica)</label>
                  <input className="li-input" type="number" value={nuevo.formId}
                    onChange={e => setNuevo(p => ({ ...p, formId: e.target.value }))}
                    placeholder="ID del formulario" />
                </div>
                <div className="li-field">
                  <label>Template ID (si aplica)</label>
                  <input className="li-input" value={nuevo.templateId}
                    onChange={e => setNuevo(p => ({ ...p, templateId: e.target.value }))}
                    placeholder="ID del template" />
                </div>
              </div>
              {n(nuevo.pesoEntrada) > 0 && (
                <div className="li-modal-balance">
                  <span>Peso neto calculado:</span>
                  <strong>{Math.max(0, n(nuevo.pesoEntrada) - n(nuevo.desperdicio)).toFixed(2)} lbs</strong>
                  <span className="li-bal-rule">( {n(nuevo.pesoEntrada)} − {n(nuevo.desperdicio)} = PESO NETO )</span>
                </div>
              )}
            </div>
            <div className="li-modal-footer">
              <button className="li-btn-secondary" onClick={() => setShowNuevo(false)}>Cancelar</button>
              <button className="li-btn-primary" onClick={handleGuardarNuevo}>Guardar lote</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
