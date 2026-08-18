import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLotes,
  deleteLote,
  consumirLote,
  liberarLote,
  addLote,
  getArbol,
  getMovimientos,
  sincronizarDesdeFormularios,
  getCambioProcesoResumen,
} from '../hooks/useLoteStore';
import { compararCodigos } from '../utils/ordenFormularios';
import { saldoDe } from '../services/inventarioCeldaService';
import { API_BASE_URL } from '../apiConfig';
import './LotesInventario.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const n = (v) => Number.parseFloat(v) || 0;

// Fecha + hora corta para el kardex (ej: "30/07 14:32")
const fechaHora = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v).slice(0, 16)
    : d.toLocaleString('es-HN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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

// ── Kardex de un lote ────────────────────────────────────────────────────────
/**
 * Entradas y salidas de un lote, agrupadas primero por proceso (la pregunta
 * habitual es "¿a qué proceso se fue?") y después en detalle cronológico.
 * Pide sus propios datos: se usa igual en el detalle del lote y en su modal.
 */
function KardexLote({ numeroLote }) {
  const [estado, setEstado] = useState({ cargando: true, lista: [], error: null });

  useEffect(() => {
    if (!numeroLote) return undefined;
    let cancel = false;
    setEstado({ cargando: true, lista: [], error: null });
    getMovimientos(numeroLote)
      .then(l => { if (!cancel) setEstado({ cargando: false, lista: l || [], error: null }); })
      .catch(e => { if (!cancel) setEstado({ cargando: false, lista: [], error: e.message || 'No se pudo leer el kardex.' }); });
    return () => { cancel = true; };
  }, [numeroLote]);

  if (estado.cargando) return <div className="li-kardex-msg">⏳ Cargando movimientos…</div>;
  if (estado.error) return <div className="li-kardex-msg li-kardex-err">⚠️ {estado.error}</div>;

  const salidas = estado.lista.filter(m => (m.tipo || '').toLowerCase() === 'salida');
  const cambiosProceso = salidas.filter(m => String(m.notas || '').includes('#cambio_proceso:'));
  const salidasNormales = salidas.filter(m => !String(m.notas || '').includes('#cambio_proceso:'));

  // Parse destino de cambio de proceso desde notas (#cambio_proceso:<dest>)
  const destDeCambio = (notas) => {
    const m = String(notas || '').match(/#cambio_proceso:([^\s#]+)/);
    return m ? m[1] : '';
  };

  const porProceso = new Map();
  salidasNormales.forEach(m => {
    const p = m.proceso || 'Sin proceso registrado';
    const acc = porProceso.get(p) || { lbs: 0, veces: 0, forms: new Set() };
    acc.lbs += n(m.cantidad);
    acc.veces += 1;
    if (m.formId) acc.forms.add(m.formId);
    porProceso.set(p, acc);
  });

  const porCambio = new Map();
  cambiosProceso.forEach(m => {
    const dest = destDeCambio(m.notas) || m.proceso || 'Otro proceso';
    const acc = porCambio.get(dest) || { lbs: 0, veces: 0, forms: new Set() };
    acc.lbs += n(m.cantidad);
    acc.veces += 1;
    if (m.formId) acc.forms.add(m.formId);
    porCambio.set(dest, acc);
  });

  return (
    <div className="li-kardex-panel">
      <h4 className="li-kardex-titulo">🏭 En qué procesos se usó este lote</h4>
      {salidas.length === 0 ? (
        <div className="li-kardex-msg">
          Todavía no se consumió en ningún proceso — sigue completo en el inventario.
        </div>
      ) : (
        <div className="li-kardex-procesos">
          {[...porProceso.entries()]
            .sort((a, b) => b[1].lbs - a[1].lbs)
            .map(([proceso, info]) => (
              <div key={proceso} className="li-kardex-proceso">
                <span className="li-kardex-proc-nombre">{proceso}</span>
                <strong className="li-kardex-proc-lbs">−{info.lbs.toFixed(2)} lbs</strong>
                <span className="li-kardex-proc-meta">
                  {info.veces} salida{info.veces !== 1 ? 's' : ''}
                  {info.forms.size > 0 && ` · formulario${info.forms.size !== 1 ? 's' : ''} ${[...info.forms].map(f => `#${f}`).join(', ')}`}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ── CAMBIOS DE PROCESO ── */}
      {porCambio.size > 0 && (
        <>
          <h4 className="li-kardex-titulo" style={{ color: '#15803d', marginTop: '14px' }}>🔄 Cambio de Proceso</h4>
          <div className="li-kardex-procesos">
            {[...porCambio.entries()]
              .sort((a, b) => b[1].lbs - a[1].lbs)
              .map(([dest, info]) => (
                <div key={dest} className="li-kardex-proceso" style={{ borderLeft: '3px solid #4ade80' }}>
                  <span className="li-kardex-proc-nombre">→ {dest}</span>
                  <strong className="li-kardex-proc-lbs" style={{ color: '#15803d' }}>{info.lbs.toFixed(2)} lbs</strong>
                  <span className="li-kardex-proc-meta">
                    {info.veces} vez{info.veces !== 1 ? 'es' : ''}
                    {info.forms.size > 0 && ` · formulario${info.forms.size !== 1 ? 's' : ''} ${[...info.forms].map(f => `#${f}`).join(', ')}`}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {estado.lista.length > 0 && (
        <>
          <h4 className="li-kardex-titulo">📜 Kardex completo</h4>
          <div className="li-kardex-wrap">
            <table className="li-kardex">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Saldo resultante</th>
                  <th>Proceso</th>
                  <th>Formulario</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {estado.lista.map(m => (
                  <tr key={m.id ?? `${m.creadoEn}-${m.cantidad}`}>
                    <td>{fechaHora(m.creadoEn)}</td>
                    <td className={`li-mov li-mov-${(m.tipo || '').toLowerCase()}`}>
                      {(m.tipo || '').toLowerCase() === 'entrada'
                        ? '⬆ entrada'
                        : String(m.notas || '').includes('#cambio_proceso:')
                          ? '🔄 cambio proceso'
                          : '⬇ salida'}
                    </td>
                    <td className="li-num">
                      {(m.tipo || '').toLowerCase() === 'entrada' ? '+' : '−'}{n(m.cantidad).toFixed(2)}
                    </td>
                    <td className="li-num">{n(m.saldoResultante).toFixed(2)}</td>
                    <td>{m.proceso || '—'}</td>
                    <td>{m.formId ? `#${m.formId}` : '—'}</td>
                    <td className="li-kardex-notas" title={m.notas || ''}>{m.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {estado.lista.length === 0 && (
        <div className="li-kardex-msg" style={{ marginTop: '8px' }}>
          Sin movimientos registrados. Los lotes creados antes de que existiera el kardex
          no tienen ni siquiera el movimiento de entrada.
        </div>
      )}
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
  // 📜 Lote cuyo kardex se está viendo (modal aparte, sin pasar por el detalle)
  const [kardexLote, setKardexLote] = useState(null);
  // Filtro por código de formulario de origen (FOR-PD-04, FOR-CC-01…)
  const [filtroForm, setFiltroForm] = useState('');
  // Plantillas: el lote guarda el templateId, el código legible vive acá
  const [plantillas, setPlantillas] = useState([]);
  // Resumen de cambios de proceso: { [numeroLote]: { totalLbs, destinos } }
  const [cpResumen, setCpResumen] = useState({});
  // Paginación
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 25;

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

  // Las plantillas dan el código legible (FOR-PD-04) del templateId del lote.
  // Si falla, el filtro cae al templateId crudo y la página sigue andando.
  useEffect(() => {
    let cancel = false;
    fetch(`${API_BASE_URL}/Templates`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data?.$values || []);
        setPlantillas(arr);
      })
      .catch(() => { /* sin plantillas → se muestra el templateId tal cual */ });
    return () => { cancel = true; };
  }, []);

  // Resumen de "Cambio de Proceso" por lote (una sola llamada, no N llamadas)
  useEffect(() => {
    let cancel = false;
    getCambioProcesoResumen().then(data => {
      if (!cancel && data && typeof data === 'object') setCpResumen(data);
    });
    return () => { cancel = true; };
  }, [lotes]); // se recarga cuando cambian los lotes (tras guardar un formulario)


  // ── Filtrado ──
  const procesos = [...new Set(lotes.map(l => l.proceso).filter(Boolean))];

  // templateId (lo que guarda el lote) → { codigo, nombre } de la plantilla
  const infoPlantilla = new Map();
  plantillas.forEach(t => {
    const id = String(t.templateID ?? t.TemplateID ?? t.id ?? '');
    if (!id) return;
    infoPlantilla.set(id, {
      codigo: t.codigo || t.Codigo || `Plantilla ${id}`,
      nombre: t.nombre || t.Nombre || '',
    });
  });

  /** Código de formulario del que nació el lote (FOR-PD-04) o '' si no se sabe. */
  const codigoFormDe = (lote) => {
    const id = String(lote?.templateId || '').trim();
    if (!id) return '';
    return infoPlantilla.get(id)?.codigo || `Plantilla ${id}`;
  };

  // Códigos presentes entre los lotes, por número de formulario:
  // FOR-CC-01 → FOR-CC-18, y FOR-PD-04 antes que FOR-PD-14.
  const codigosForm = [...new Set(lotes.map(codigoFormDe).filter(Boolean))]
    .sort(compararCodigos);

  // Resetear a página 1 cuando cambia el filtro
  const resetPagina = () => setPagina(1);

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
    const matchForm =
      !filtroForm ||
      (filtroForm === '__sin__' ? !codigoFormDe(l) : codigoFormDe(l) === filtroForm);
    return matchTab && matchBuscar && matchProc && matchForm;
  });

  // ── Estadísticas ──
  // Se calculan sobre el SALDO (lo que queda de verdad), no sobre el peso neto:
  // así el consumo parcial de un proceso posterior se ve en el acto.
  const disponibles = lotes.filter(l => saldoDe(l) > 0);
  const totalLbsDisp = disponibles.reduce((s, l) => s + saldoDe(l), 0);
  const totalLbsNeto = lotes.reduce((s, l) => s + n(l.pesoNeto), 0);
  const totalLbsSaldo = lotes.reduce((s, l) => s + saldoDe(l), 0);
  const totalConsumido = Math.max(0, totalLbsNeto - totalLbsSaldo);
  const pctConsumo = totalLbsNeto > 0
    ? ((totalConsumido / totalLbsNeto) * 100).toFixed(1)
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
            title="Compara los lotes nombrados en los formularios contra el inventario. Solo informa: no crea ni modifica lotes."
          >
            {syncing ? '⏳ Revisando…' : '🔍 Revisar diferencias'}
          </button>
          <button className="li-btn-primary" onClick={() => setShowNuevo(true)}>
            + Nuevo lote
          </button>
        </div>
      </div>

      {error && <div className="li-error">⚠️ {error}</div>}
      {loading && <div className="li-loading">Cargando lotes…</div>}

      {/* ── DIFERENCIAS FORMULARIOS vs INVENTARIO ──
           Ya no da de alta nada: solo compara. El inventario se llena al guardar
           cada formulario, según el rol que su plantilla declara. */}
      {syncResult && (
        <div className="li-sync-result">
          <span>🔍 Revisión —</span>
          <strong> {syncResult.lotesSinRegistrar ?? 0} lotes nombrados en formularios</strong> que no están en inventario
          {syncResult.lotesYaExistentes > 0 && (
            <span> · {syncResult.lotesYaExistentes} sí están</span>
          )}
          <span> · {syncResult.totalFormulariosEscaneados} formularios revisados</span>
          <span className="li-sync-note"> — no se creó ni modificó ningún lote</span>
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
          <span className="li-stat-val">{totalLbsDisp.toLocaleString(undefined, { maximumFractionDigits: 2 })} lbs</span>
          <span className="li-stat-lbl">Saldo disponible</span>
        </div>
        <div className="li-stat">
          <span className="li-stat-val">{totalConsumido.toLocaleString(undefined, { maximumFractionDigits: 2 })} lbs</span>
          <span className="li-stat-lbl">Consumido por otros procesos</span>
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
              onChange={e => { setBuscar(e.target.value); resetPagina(); }}
            />
            <select
              className="li-input"
              value={filtroProc}
              onChange={e => { setFiltroProc(e.target.value); resetPagina(); }}
            >
              <option value="">Todos los procesos</option>
              {procesos.map(p => <option key={p}>{p}</option>)}
            </select>
            <select
              className="li-input"
              value={filtroForm}
              onChange={e => { setFiltroForm(e.target.value); resetPagina(); }}
              title="Ver solo los lotes que nacieron de un formulario concreto (FOR-PD-04, FOR-CC-01…)"
            >
              <option value="">Todos los formularios</option>
              {codigosForm.map(c => {
                const nombre = [...infoPlantilla.values()].find(p => p.codigo === c)?.nombre;
                return (
                  <option key={c} value={c}>
                    {nombre ? `${c} — ${nombre}` : c}
                  </option>
                );
              })}
              <option value="__sin__">— Sin formulario (manuales) —</option>
            </select>
            {(filtroProc || filtroForm || buscar) && (
              <button
                className="li-btn-secondary"
                onClick={() => { setFiltroProc(''); setFiltroForm(''); setBuscar(''); resetPagina(); }}
                title="Quitar todos los filtros"
              >
                ✕ Limpiar filtros
              </button>
            )}
            <span className="li-count">{lotesFiltrados.length} registros</span>
            <select
              className="li-input"
              style={{ maxWidth: '140px' }}
              value={POR_PAGINA}
              onChange={() => {}}
              title="Registros por página (fijo en 25)"
              disabled
            >
              <option>25 por página</option>
            </select>
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
                    <th>Formulario</th>
                    <th>P. Entrada (lbs)</th>
                    <th>Desperdicio (lbs)</th>
                    <th>Tipo Desp.</th>
                    <th>Peso Neto (lbs)</th>
                    <th>Saldo (lbs)</th>
                    <th>% Rend.</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(l => {
                    const rendimiento = n(l.pesoEntrada) > 0
                      ? ((n(l.pesoNeto) / n(l.pesoEntrada)) * 100).toFixed(1)
                      : '—';
                    const saldo = saldoDe(l);
                    const usado = Math.max(0, n(l.pesoNeto) - saldo);
                    const codigoForm = codigoFormDe(l);
                    return (
                      <tr key={l.id}>
                        <td className="li-lote-num">{l.lote}</td>
                        <td>{l.proceso || '—'}</td>
                        <td>{l.producto || '—'}</td>
                        <td>{l.clasificacion || '—'}</td>
                        <td className="li-padre">{l.lotePadre || '—'}</td>
                        <td className="li-formid">
                          {codigoForm && <div className="li-form-codigo">{codigoForm}</div>}
                          {l.formId ? (
                            <button
                              className="li-btn-link"
                              onClick={() => navigate(`/view-forms`)}
                              title={`Ver formulario #${l.formId}`}
                            >
                              #{l.formId}
                            </button>
                          ) : (!codigoForm && '—')}
                        </td>
                        <td className="li-num">{n(l.pesoEntrada).toFixed(2)}</td>
                        <td className="li-num li-desp">{n(l.desperdicio).toFixed(2)}</td>
                        <td className="li-tipo-desp">{n(l.desperdicio) > 0 ? (l.tipoDesperdicio || '—') : '—'}</td>
                        <td className="li-num li-neto">{n(l.pesoNeto).toFixed(2)}</td>
                        <td className="li-num li-saldo" title={usado > 0 ? `${usado.toFixed(2)} lbs ya consumidas por otros procesos` : 'Sin consumo registrado'}>
                          <strong style={{ color: saldo <= 0 ? '#b91c1c' : usado > 0 ? '#b45309' : '#15803d' }}>
                            {saldo.toFixed(2)}
                          </strong>
                          {usado > 0 && <div className="li-saldo-usado">−{usado.toFixed(2)}</div>}
                          {(() => {
                            const cp = cpResumen[l.lote] || cpResumen[l.numeroLote];
                            if (!cp || !cp.totalLbs) return null;
                            const dests = cp.destinos ? Object.entries(cp.destinos).map(([d, v]) => `${d}: ${Number(v).toFixed(1)} lbs`).join(', ') : '';
                            return (
                              <div title={dests || undefined} style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', fontWeight: 600 }}>
                                🔄 {Number(cp.totalLbs).toFixed(1)} lbs
                              </div>
                            );
                          })()}
                        </td>
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
                          <button className="li-btn-sm li-btn-kardex" onClick={() => setKardexLote(l)} title="Ver kardex: entradas, salidas y en qué proceso se usó">📜</button>
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

          {/* ── PAGINACIÓN ── */}
          {lotesFiltrados.length > POR_PAGINA && (
            <div className="li-pagination">
              <button
                className="li-btn-secondary li-pag-btn"
                onClick={() => setPagina(1)}
                disabled={pagina === 1}
              >⟨⟨</button>
              <button
                className="li-btn-secondary li-pag-btn"
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
              >⟨</button>
              {(() => {
                const total = Math.ceil(lotesFiltrados.length / POR_PAGINA);
                const pages = [];
                const start = Math.max(1, pagina - 2);
                const end   = Math.min(total, pagina + 2);
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      className={`li-pag-btn ${i === pagina ? 'li-pag-active' : 'li-btn-secondary'}`}
                      onClick={() => setPagina(i)}
                    >{i}</button>
                  );
                }
                return pages;
              })()}
              <button
                className="li-btn-secondary li-pag-btn"
                onClick={() => setPagina(p => Math.min(Math.ceil(lotesFiltrados.length / POR_PAGINA), p + 1))}
                disabled={pagina >= Math.ceil(lotesFiltrados.length / POR_PAGINA)}
              >⟩</button>
              <button
                className="li-btn-secondary li-pag-btn"
                onClick={() => setPagina(Math.ceil(lotesFiltrados.length / POR_PAGINA))}
                disabled={pagina >= Math.ceil(lotesFiltrados.length / POR_PAGINA)}
              >⟩⟩</button>
              <span className="li-pag-info">
                Página {pagina} de {Math.ceil(lotesFiltrados.length / POR_PAGINA)}
                {' · '}{((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, lotesFiltrados.length)} de {lotesFiltrados.length}
              </span>
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
                  <span className="li-detalle-label">Proceso de origen (dónde nació)</span>
                  <span className="li-detalle-val">{detalleLote.proceso || '—'}</span>
                </div>
                <div className="li-detalle-group">
                  <span className="li-detalle-label">Saldo actual (lbs)</span>
                  <span className="li-detalle-val li-neto">{saldoDe(detalleLote).toFixed(2)}</span>
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
                    <span className="li-detalle-label">Formulario de origen</span>
                    <span className="li-detalle-val">
                      <strong>{codigoFormDe(detalleLote)}</strong>
                      {infoPlantilla.get(String(detalleLote.templateId))?.nombre && (
                        <span className="li-text-muted"> — {infoPlantilla.get(String(detalleLote.templateId)).nombre}</span>
                      )}
                    </span>
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
                <span className="li-bal-op">−</span>
                <div className="li-bal-box li-bal-desp">
                  <span className="li-bal-lbl">Consumido</span>
                  <strong>{Math.max(0, n(detalleLote.pesoNeto) - saldoDe(detalleLote)).toFixed(2)} lbs</strong>
                </div>
                <span className="li-bal-op">=</span>
                <div className="li-bal-box li-bal-neto">
                  <span className="li-bal-lbl">Saldo</span>
                  <strong>{saldoDe(detalleLote).toFixed(2)} lbs</strong>
                </div>
              </div>

              {/* 🏭 En qué procesos se usó + kardex completo */}
              <KardexLote numeroLote={detalleLote.lote} />
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

      {/* ── MODAL KARDEX ── */}
      {kardexLote && (
        <div className="li-modal-overlay" onClick={() => setKardexLote(null)}>
          <div className="li-modal li-modal-detalle" onClick={e => e.stopPropagation()}>
            <div className="li-modal-header">
              <div>
                <h3>📜 Kardex del lote</h3>
                <span className="li-modal-lote-num">{kardexLote.lote}</span>
              </div>
              <button className="li-modal-close" onClick={() => setKardexLote(null)}>✕</button>
            </div>
            <div className="li-modal-body">
              <div className="li-detalle-balance">
                <div className="li-bal-box">
                  <span className="li-bal-lbl">Peso Neto</span>
                  <strong>{n(kardexLote.pesoNeto).toFixed(2)} lbs</strong>
                </div>
                <span className="li-bal-op">−</span>
                <div className="li-bal-box li-bal-desp">
                  <span className="li-bal-lbl">Consumido</span>
                  <strong>{Math.max(0, n(kardexLote.pesoNeto) - saldoDe(kardexLote)).toFixed(2)} lbs</strong>
                </div>
                <span className="li-bal-op">=</span>
                <div className="li-bal-box li-bal-neto">
                  <span className="li-bal-lbl">Saldo</span>
                  <strong>{saldoDe(kardexLote).toFixed(2)} lbs</strong>
                </div>
              </div>
              <KardexLote numeroLote={kardexLote.lote} />
            </div>
            <div className="li-modal-footer">
              <button className="li-btn-secondary" onClick={() => setKardexLote(null)}>Cerrar</button>
              <button className="li-btn-primary" onClick={() => { const l = kardexLote; setKardexLote(null); setDetalleLote(l); }}>
                🔍 Ver detalle del lote
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
