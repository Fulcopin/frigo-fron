import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import {
  clasificarProducto, getLotes, getMovimientos,
  getResumenProduccion, getFormulariosProduccion,
} from '../hooks/useLoteStore';
import { resolverLoteDeProduccion, saldoDe } from '../services/inventarioCeldaService';
// El catálogo de clasificaciones es único y compartido: lo que se agregue acá
// queda disponible en cualquier formulario cuya columna use el origen
// «🏷️ Catálogo de Clasificaciones».
import {
  catalogoClasificaciones, agregarClasificacion as agregarAlCatalogo,
  quitarClasificacion as quitarDelCatalogo,
} from '../services/clasificacionesService';
import './ClasificacionProduccion.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

const nLbs = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '—');

// Fecha corta para el detalle (ej: "03/08/26")
function fechaCorta(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Fecha + hora corta para el kardex (ej: "29/07 14:32")
function fechaHora(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 16);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Consolida TODAS las filas de producción en un producto por Código.
 *
 * La clasificación es del PRODUCTO, no de la corrida: el mismo código se
 * clasifica una sola vez y vale para todos los formularios y todas las fechas.
 * Cada aparición queda en `origenes` para poder ver el detalle y el kardex.
 *
 * @param {Array} filas — filas de resumen, ya marcadas con su formulario
 * @param {Array} lotes — inventario, para resolver el lote real de cada aparición
 * @returns {Array} productos ordenados por código
 */
export function consolidarProductos(filas, lotes) {
  const mapa = new Map();

  for (const f of filas) {
    const codigo = String(f.codigoProducto || '').trim();
    const nombre = String(f.producto || '').trim();
    const clave = norm(codigo || nombre);
    if (!clave) continue;

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        codigoProducto: codigo,
        producto: nombre,
        origenes: [],
        formularios: [],
        lotes: [],
      });
    }
    const p = mapa.get(clave);
    if (!p.codigoProducto && codigo) p.codigoProducto = codigo;
    if (!p.producto && nombre) p.producto = nombre;

    const lote = resolverLoteDeProduccion(lotes, f);
    p.origenes.push({ ...f, _lote: lote });
    if (f._codigoForm && !p.formularios.includes(f._codigoForm)) p.formularios.push(f._codigoForm);
    // El mismo lote puede venir repetido (varias filas de la misma corrida):
    // el saldo se cuenta una sola vez.
    if (lote && !p.lotes.some(l => l.numeroLote === lote.numeroLote)) p.lotes.push(lote);
  }

  for (const p of mapa.values()) {
    p.saldoTotal = p.lotes.reduce((acc, l) => acc + saldoDe(l), 0);
    p.netoTotal = p.lotes.reduce(
      (acc, l) => acc + (Number(l.pesoNeto) || Number(l.pesoEntrada) || 0), 0
    );
    p.consumidoTotal = Math.max(0, p.netoTotal - p.saldoTotal);
    // Si el producto nunca llegó al inventario, al menos se ve lo producido.
    if (p.lotes.length === 0) {
      p.netoTotal = p.origenes.reduce((acc, o) => acc + (Number(o.pesoNeto) || 0), 0);
    }
    p.formularios.sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
  }

  return Array.from(mapa.values()).sort((a, b) =>
    String(a.codigoProducto || a.producto).localeCompare(
      String(b.codigoProducto || b.producto), 'es', { numeric: true },
    )
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ClasificacionProduccion() {
  const [filas, setFilas] = useState([]);
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // Filtros (opcionales: por defecto se ve TODO, de todos los formularios)
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');
  const [soloSinClasificar, setSoloSinClasificar] = useState(false);

  // Estado local de edición: { [claveProducto]: clasificacion }
  const [edit, setEdit] = useState({});
  const [guardando, setGuardando] = useState({});
  const [guardandoTodo, setGuardandoTodo] = useState(false);

  // 📦 Inventario de lotes: saldos reales + catálogo de clasificaciones guardadas
  const [lotes, setLotes] = useState([]);
  // 📜 Kardex por número de lote: { [numeroLote]: { cargando, movs, error } }
  const [kardex, setKardex] = useState({});
  const [kardexAbierto, setKardexAbierto] = useState({});
  // Productos con el detalle de apariciones desplegado
  const [detalleAbierto, setDetalleAbierto] = useState({});

  // 🏷️ Catálogo de clasificaciones (compartido con todos los formularios).
  // Se recalcula cuando llega el inventario: lo que otro ya clasificó también
  // pasa a estar disponible acá y en las plantillas.
  const [clasificaciones, setClasificaciones] = useState(() => catalogoClasificaciones([]));
  const [nuevaClasif, setNuevaClasif] = useState('');
  const [mostrarClasifManager, setMostrarClasifManager] = useState(false);

  const agregarClasificacion = () => {
    const v = nuevaClasif.trim();
    if (!v) return;
    agregarAlCatalogo(v);
    setClasificaciones(catalogoClasificaciones(lotes));
    setNuevaClasif('');
  };

  const eliminarClasificacion = (c) => {
    quitarDelCatalogo(c);
    setClasificaciones(catalogoClasificaciones(lotes));
  };

  // ── Cargar la producción de TODOS los formularios ───────────────────────────
  // No hay lista fija: se descubren los formularios con tabla de resumen (PD-01,
  // PD-04, PD-05, PD-06, PD-07, PD-11, PD-14…) y se piden todos en paralelo.
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const forms = await getFormulariosProduccion();
      setFormularios(forms || []);
      if (!forms || forms.length === 0) {
        setFilas([]);
        return;
      }
      const rango = { ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) };
      const listas = await Promise.all(
        forms.map(async (form) => {
          try {
            const data = await getResumenProduccion({ templateId: form.templateId, ...rango });
            return (data || []).map((f) => ({
              ...f,
              _templateId: form.templateId,
              _codigoForm: form.codigo || `Plantilla ${form.templateId}`,
              _nombreForm: form.nombre || '',
            }));
          } catch {
            return []; // un formulario que falla no tumba a los demás
          }
        })
      );
      setFilas(listas.flat());
    } catch (e) {
      setError(e.message || 'No se pudo cargar la producción de los formularios.');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  // El inventario se pide aparte: si falla, la página sigue funcionando y solo
  // se queda sin la columna de saldo (no se bloquea la clasificación).
  const cargarLotes = useCallback(async () => {
    try {
      setLotes(await getLotes());
    } catch {
      setLotes([]);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  // Las clasificaciones ya usadas en el inventario se suman solas al catálogo.
  useEffect(() => { setClasificaciones(catalogoClasificaciones(lotes)); }, [lotes]);

  // ── Kardex de un lote (se pide solo al desplegarlo) ─────────────────────────
  const toggleKardex = async (numeroLote) => {
    const abierto = !!kardexAbierto[numeroLote];
    setKardexAbierto((prev) => ({ ...prev, [numeroLote]: !abierto }));
    if (abierto || !numeroLote || kardex[numeroLote]?.movs) return;

    setKardex((prev) => ({ ...prev, [numeroLote]: { cargando: true, movs: null, error: null } }));
    try {
      const movs = await getMovimientos(numeroLote);
      setKardex((prev) => ({ ...prev, [numeroLote]: { cargando: false, movs, error: null } }));
    } catch (e) {
      setKardex((prev) => ({
        ...prev,
        [numeroLote]: { cargando: false, movs: null, error: e.message || 'No se pudo leer el kardex.' },
      }));
    }
  };

  /**
   * Clasificación ya guardada de un producto. Manda el catálogo del inventario
   * (el lote cuyo número ES el código de producto): es la que vale para todos
   * los formularios. Si todavía no existe, se cae a la que trajo el resumen.
   */
  const clasificacionDe = useCallback((p) => {
    const objetivo = norm(p.codigoProducto || p.producto);
    const enCatalogo = lotes.find((l) => norm(l.numeroLote) === objetivo);
    if (enCatalogo?.clasificacion) return enCatalogo.clasificacion;
    return p.origenes.find((o) => o.clasificacion)?.clasificacion || '';
  }, [lotes]);

  // ── Un producto por Código, sin importar formulario ni fecha ────────────────
  const productos = useMemo(() => {
    const lista = consolidarProductos(filas, lotes);
    return lista.map((p) => ({ ...p, clasificacion: clasificacionDe(p) }));
  }, [filas, lotes, clasificacionDe]);

  // Al llegar datos nuevos, el desplegable arranca con lo ya guardado (sin pisar
  // lo que el operario esté editando en pantalla).
  useEffect(() => {
    setEdit((prev) => {
      const next = { ...prev };
      let cambio = false;
      for (const p of productos) {
        if (next[p.clave] === undefined) { next[p.clave] = p.clasificacion || ''; cambio = true; }
      }
      return cambio ? next : prev;
    });
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return productos.filter((p) => {
      if (soloSinClasificar && p.clasificacion) return false;
      if (!q) return true;
      return (p.codigoProducto || '').toLowerCase().includes(q)
        || (p.producto || '').toLowerCase().includes(q);
    });
  }, [productos, buscar, soloSinClasificar]);

  // ── Guardar la clasificación de un producto ─────────────────────────────────
  const guardarUno = async (p, valor) => {
    const clave = (p.codigoProducto || p.producto || '').trim();
    if (!clave) throw new Error('El producto no tiene Código ni nombre.');
    await clasificarProducto({ codigoProducto: clave, producto: p.producto, clasificacion: valor });
    // Reflejar en el catálogo en memoria para no tener que recargar todo.
    setLotes((prev) => {
      const i = prev.findIndex((l) => norm(l.numeroLote) === norm(clave));
      if (i === -1) {
        return [...prev, { numeroLote: clave, lote: clave, producto: p.producto, clasificacion: valor, saldo: 0, pesoNeto: 0, estado: 'disponible' }];
      }
      const copia = [...prev];
      copia[i] = { ...copia[i], clasificacion: valor };
      return copia;
    });
  };

  const guardar = async (p) => {
    const valor = edit[p.clave];
    if (!valor) {
      setError('Selecciona una clasificación antes de guardar.');
      return;
    }
    setGuardando((g) => ({ ...g, [p.clave]: true }));
    setError(null);
    setOk(null);
    try {
      await guardarUno(p, valor);
      setOk(`"${p.producto || p.codigoProducto}" quedó como ${valor} en todos los formularios.`);
    } catch (e) {
      setError(e.message || 'No se pudo guardar la clasificación.');
    } finally {
      setGuardando((g) => ({ ...g, [p.clave]: false }));
    }
  };

  // Productos con un cambio sin guardar (para el botón de guardar todo)
  const pendientes = useMemo(
    () => filtrados.filter((p) => (edit[p.clave] || '') && (edit[p.clave] || '') !== (p.clasificacion || '')),
    [filtrados, edit]
  );

  const guardarTodo = async () => {
    if (pendientes.length === 0) return;
    setGuardandoTodo(true);
    setError(null);
    setOk(null);
    const fallidos = [];
    for (const p of pendientes) {
      try {
        await guardarUno(p, edit[p.clave]);
      } catch (e) {
        fallidos.push(`${p.codigoProducto || p.producto}: ${e.message}`);
      }
    }
    setGuardandoTodo(false);
    const guardados = pendientes.length - fallidos.length;
    if (guardados > 0) setOk(`${guardados} producto(s) clasificados.`);
    if (fallidos.length > 0) setError(`No se pudo guardar:\n• ${fallidos.join('\n• ')}`);
  };

  const totalClasificados = productos.filter((p) => p.clasificacion).length;
  const saldoTotal = useMemo(
    () => filtrados.reduce((acc, p) => acc + p.saldoTotal, 0),
    [filtrados]
  );

  return (
    <div className="clasprod">
      {/* ── Encabezado ── */}
      <div className="clasprod-header">
        <div>
          <h1 className="clasprod-title">🏷️ Clasificación General de Productos</h1>
          <p className="clasprod-subtitle">
            Un producto por <strong>Código</strong>, juntando la producción de{' '}
            <strong>todos los formularios</strong> (PD-01, PD-04, PD-05, PD-06, PD-07, PD-11,
            PD-14…) y de todas las fechas. La clasificación se asigna{' '}
            <strong>una sola vez por producto</strong> y vale en todos lados. La columna{' '}
            <strong>Saldo</strong> suma lo que queda de todos sus lotes; <strong>🔎 Detalle</strong>{' '}
            abre dónde se produjo y el <strong>📜 Kardex</strong> de cada lote.
          </p>
        </div>
        <div className="clasprod-stats">
          <div className="clasprod-stat">
            <span className="clasprod-stat-num">{productos.length}</span>
            <span className="clasprod-stat-lbl">Productos</span>
          </div>
          <div className="clasprod-stat">
            <span className="clasprod-stat-num">{totalClasificados}</span>
            <span className="clasprod-stat-lbl">Clasificados</span>
          </div>
          <div className="clasprod-stat">
            <span className="clasprod-stat-num">{formularios.length}</span>
            <span className="clasprod-stat-lbl">Formularios</span>
          </div>
          <div className="clasprod-stat">
            <span className="clasprod-stat-num">{saldoTotal.toFixed(0)}</span>
            <span className="clasprod-stat-lbl">Lbs con saldo</span>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="clasprod-filtros">
        <div className="clasprod-campo">
          <label>Buscar (código o producto)</label>
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Ej: PT-TNA o Tuna"
          />
        </div>
        <div className="clasprod-campo">
          <label>Desde (opcional)</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="clasprod-campo">
          <label>Hasta (opcional)</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button
          className="clasprod-btn-recargar"
          onClick={() => { cargar(); cargarLotes(); setKardex({}); }}
          disabled={loading}
          title="Vuelve a leer la producción de todos los formularios y los saldos del inventario"
        >
          {loading ? '⏳ Cargando...' : '🔄 Recargar'}
        </button>
        <button
          className="clasprod-btn-clasif"
          onClick={() => setMostrarClasifManager((v) => !v)}
          title="Agregar o quitar opciones de clasificación"
        >
          🏷️ Clasificaciones ({clasificaciones.length})
        </button>
        <label className="clasprod-filtro-check" title="Ver solo los productos que todavía no tienen clasificación">
          <input
            type="checkbox"
            checked={soloSinClasificar}
            onChange={(e) => setSoloSinClasificar(e.target.checked)}
          />
          Solo sin clasificar
        </label>
        {pendientes.length > 0 && (
          <button
            className="clasprod-btn-guardar-todo"
            onClick={guardarTodo}
            disabled={guardandoTodo}
            title="Guarda de una vez todos los productos con cambios"
          >
            {guardandoTodo ? '⏳ Guardando…' : `💾 Guardar ${pendientes.length} cambio${pendientes.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* ── Administrador de clasificaciones ── */}
      {mostrarClasifManager && (
        <div className="clasprod-clasif-manager">
          <div className="clasprod-clasif-nota">
            🏷️ Este es el <strong>catálogo único</strong>. Lo que agregues acá queda disponible en{' '}
            <strong>cualquier formulario</strong>: en la plantilla, poné la columna en{' '}
            <strong>Tipo = 📦 Inventario</strong> y elegí el origen{' '}
            <strong>🏷️ Catálogo de Clasificaciones</strong>. No hace falta volver a editar la
            plantilla cada vez que agregues una clasificación nueva.
          </div>
          <div className="clasprod-clasif-add">
            <input
              type="text"
              value={nuevaClasif}
              onChange={(e) => setNuevaClasif(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarClasificacion(); }}
              placeholder="Escribe una nueva clasificación (ej: 5-6oz, 12oz, 3up)…"
            />
            <button onClick={agregarClasificacion} disabled={!nuevaClasif.trim()}>
              ➕ Agregar
            </button>
          </div>
          <div className="clasprod-clasif-chips">
            {clasificaciones.map((c) => (
              <span key={c} className="clasprod-chip">
                {c}
                <button
                  className="clasprod-chip-x"
                  title={`Quitar "${c}"`}
                  onClick={() => eliminarClasificacion(c)}
                >
                  ×
                </button>
              </span>
            ))}
            {clasificaciones.length === 0 && (
              <span className="clasprod-clasif-vacio">No hay clasificaciones. Agrega al menos una.</span>
            )}
          </div>
        </div>
      )}

      {/* ── Mensajes ── */}
      {error && <div className="clasprod-msg clasprod-error">⚠️ {error}</div>}
      {ok && <div className="clasprod-msg clasprod-ok">✅ {ok}</div>}

      {/* ── Tabla única: un producto por fila ── */}
      {loading ? (
        <div className="clasprod-vacio">Cargando la producción de todos los formularios…</div>
      ) : filtrados.length === 0 ? (
        <div className="clasprod-vacio">
          {productos.length === 0
            ? 'No hay producción registrada en ningún formulario para el rango seleccionado.'
            : 'Ningún producto coincide con el filtro.'}
        </div>
      ) : (
        <div className="clasprod-tabla-wrap">
          <table className="clasprod-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Código Producto</th>
                <th>Tipo de Producto</th>
                <th>Aparece en</th>
                <th>Producido</th>
                <th>Saldo / Consumido</th>
                <th>Clasificación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const valor = edit[p.clave] ?? p.clasificacion ?? '';
                const sinCambios = valor === (p.clasificacion || '');
                const abierto = !!detalleAbierto[p.clave];
                return (
                  <Fragment key={p.clave}>
                    <tr>
                      <td className="clasprod-num">{i + 1}</td>
                      <td className="clasprod-lote">{p.codigoProducto || '—'}</td>
                      <td className="clasprod-prod">{p.producto || '—'}</td>
                      <td>
                        <div className="clasprod-forms">
                          {p.formularios.map((c) => (
                            <span key={c} className="clasprod-form-chip">{c}</span>
                          ))}
                          <button
                            type="button"
                            className="clasprod-btn-kardex"
                            onClick={() => setDetalleAbierto((prev) => ({ ...prev, [p.clave]: !abierto }))}
                            title="Ver en qué formularios, fechas y lotes se produjo"
                          >
                            {abierto ? '▲ Detalle' : `🔎 Detalle (${p.origenes.length})`}
                          </button>
                        </div>
                      </td>
                      <td className="clasprod-peso">{nLbs(p.netoTotal)} Lbs</td>
                      <td className="clasprod-peso">
                        {p.lotes.length > 0 ? (
                          <>
                            <strong className={p.saldoTotal <= 0 ? 'clasprod-saldo-cero' : 'clasprod-saldo'}>
                              {nLbs(p.saldoTotal)} Lbs
                            </strong>
                            {p.consumidoTotal > 0 && (
                              <span className="clasprod-consumido"> − {nLbs(p.consumidoTotal)} usadas</span>
                            )}
                            <span className="clasprod-lotes-num">{p.lotes.length} lote(s)</span>
                          </>
                        ) : (
                          <span
                            className="clasprod-sin-lote"
                            title="Este producto no está en el Inventario de Lotes: guardá de nuevo el formulario o sincronizá el inventario."
                          >
                            sin lote
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className="clasprod-select"
                          value={valor}
                          onChange={(e) => setEdit((prev) => ({ ...prev, [p.clave]: e.target.value }))}
                        >
                          <option value="">— Seleccionar —</option>
                          {clasificaciones.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          {/* Conserva un valor guardado aunque ya no esté en la lista */}
                          {valor && !clasificaciones.includes(valor) && (
                            <option value={valor}>{valor}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <button
                          className="clasprod-btn-guardar"
                          onClick={() => guardar(p)}
                          disabled={guardando[p.clave] || sinCambios || !valor}
                          title={sinCambios ? 'Sin cambios que guardar' : 'Guardar para todos los formularios'}
                        >
                          {guardando[p.clave] ? '⏳' : p.clasificacion && sinCambios ? '✔ Guardado' : '💾 Guardar'}
                        </button>
                      </td>
                    </tr>

                    {abierto && (
                      <tr className="clasprod-kardex-row">
                        <td colSpan={8}>
                          <table className="clasprod-kardex">
                            <thead>
                              <tr>
                                <th>Formulario</th>
                                <th>Fecha</th>
                                <th>Lote de proceso</th>
                                <th>Lote inventario</th>
                                <th>Peso neto</th>
                                <th>Saldo</th>
                                <th>Kardex</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.origenes.map((o, oi) => {
                                const lote = o._lote;
                                const kx = lote ? kardex[lote.numeroLote] : null;
                                const kAbierto = lote ? !!kardexAbierto[lote.numeroLote] : false;
                                return (
                                  <Fragment key={`${p.clave}-o${oi}`}>
                                    <tr>
                                      <td>
                                        <span className="clasprod-form-chip">{o._codigoForm}</span>
                                        {o.formId ? ` #${o.formId}` : ''}
                                      </td>
                                      <td>{fechaCorta(o.fecha)}</td>
                                      <td className="clasprod-lote">{o.loteProceso || '—'}</td>
                                      <td className="clasprod-lote">
                                        {lote ? (
                                          <>
                                            {lote.numeroLote}
                                            <span className={`clasprod-estado clasprod-estado-${(lote.estado || 'disponible').toLowerCase()}`}>
                                              {lote.estado || 'disponible'}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="clasprod-sin-lote">sin lote</span>
                                        )}
                                      </td>
                                      <td className="clasprod-peso">{o.pesoNeto || '—'}</td>
                                      <td className="clasprod-peso">{lote ? `${nLbs(saldoDe(lote))} Lbs` : '—'}</td>
                                      <td>
                                        {lote && (
                                          <button
                                            type="button"
                                            className="clasprod-btn-kardex"
                                            onClick={() => toggleKardex(lote.numeroLote)}
                                            title="Ver entradas y salidas de este lote"
                                          >
                                            {kAbierto ? '▲ Kardex' : '📜 Kardex'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                    {kAbierto && lote && (
                                      <tr>
                                        <td colSpan={7}>
                                          {kx?.cargando && <div className="clasprod-kardex-msg">⏳ Cargando kardex de {lote.numeroLote}…</div>}
                                          {kx?.error && <div className="clasprod-kardex-msg clasprod-kardex-err">⚠️ {kx.error}</div>}
                                          {kx?.movs && kx.movs.length === 0 && (
                                            <div className="clasprod-kardex-msg">
                                              Sin movimientos registrados para {lote.numeroLote}.
                                            </div>
                                          )}
                                          {kx?.movs && kx.movs.length > 0 && (
                                            <table className="clasprod-kardex">
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
                                                {kx.movs.map((m) => (
                                                  <tr key={m.id ?? `${m.creadoEn}-${m.cantidad}`}>
                                                    <td>{fechaHora(m.creadoEn)}</td>
                                                    <td>
                                                      <span className={`clasprod-mov clasprod-mov-${(m.tipo || '').toLowerCase()}`}>
                                                        {m.tipo === 'entrada' ? '⬆ entrada' : '⬇ salida'}
                                                      </span>
                                                    </td>
                                                    <td className="clasprod-peso">
                                                      {m.tipo === 'entrada' ? '+' : '−'}{nLbs(m.cantidad)} Lbs
                                                    </td>
                                                    <td className="clasprod-peso">{nLbs(m.saldoResultante)} Lbs</td>
                                                    <td>{m.proceso || '—'}</td>
                                                    <td>{m.formId ? `#${m.formId}` : '—'}</td>
                                                    <td className="clasprod-kardex-notas">{m.notas || '—'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
