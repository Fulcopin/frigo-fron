/**
 * Kardex.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * KARDEX VALORIZADO DE PRODUCTOS.
 *
 * Cuatro vistas sobre los mismos datos:
 *   📋 Resumen  — todos los productos: entradas, salidas, saldo y valor
 *   📜 Kardex   — un producto en detalle, movimiento a movimiento
 *   🏭 Flujo    — cuánto entró y salió en cada proceso
 *   💲 Costos   — carga del costo unitario (es lo que valoriza todo lo demás)
 *
 * El movimiento físico sale del Inventario de Lotes; el costo lo carga el área
 * de Costos en la última pestaña. Sin costo cargado, un producto se muestra
 * igual pero con el valor en blanco y marcado como pendiente.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import authService from '../services/authService';
import {
  getMovimientosGlobal, getLotes, getCostos, guardarCosto, borrarCosto,
  armarKardex, armarFlujoProcesos, claveProducto, money, lbs, num,
} from '../services/kardexService';
import './Kardex.css';

const hoy = () => new Date().toISOString().split('T')[0];
const haceDias = (d) => {
  const f = new Date();
  f.setDate(f.getDate() - d);
  return f.toISOString().split('T')[0];
};

const fechaHora = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString('es-EC')} ${d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function Kardex() {
  const [tab, setTab] = useState('resumen');

  const [filtros, setFiltros] = useState({ desde: haceDias(30), hasta: hoy(), lote: '' });
  const [movimientos, setMovimientos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [costos, setCostos] = useState(new Map());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [productoSel, setProductoSel] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Alta de costo
  const [formCosto, setFormCosto] = useState({ producto: '', costoUnitario: '', unidad: 'Lb', notas: '' });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const usuario = authService.getCurrentUser?.();
  const puedeEditarCostos = usuario?.rol === 'admin' || usuario?.rol === 'costos';

  // ── Carga ───────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [movs, lts, cst] = await Promise.all([
        getMovimientosGlobal({ desde: filtros.desde, hasta: filtros.hasta, lote: filtros.lote }),
        getLotes(),
        getCostos(),
      ]);
      setMovimientos(movs);
      setLotes(lts);
      setCostos(cst);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los datos.');
      setMovimientos([]);
    } finally {
      setCargando(false);
    }
  }, [filtros.desde, filtros.hasta, filtros.lote]);

  useEffect(() => { cargar(); }, []);   // primera carga; luego, botón Cargar

  // ── Cálculos ────────────────────────────────────────────────────────────
  const kardex = useMemo(() => armarKardex(movimientos, costos), [movimientos, costos]);
  const flujo  = useMemo(() => armarFlujoProcesos(movimientos, costos), [movimientos, costos]);

  /**
   * Resumen por producto. El saldo del período (entradas − salidas) no es el
   * saldo actual del inventario: se muestran los dos, porque el kardex mira una
   * ventana de fechas y el inventario, el estado de hoy.
   */
  const resumen = useMemo(() => {
    const saldoInventario = new Map();
    lotes.forEach(l => {
      const clave = claveProducto(l.producto || '(sin producto)');
      saldoInventario.set(clave, (saldoInventario.get(clave) || 0) + num(l.saldo));
    });

    const filas = [...kardex.entries()].map(([clave, p]) => ({
      clave,
      producto: p.producto,
      costoUnitario: p.costoUnitario,
      tieneCosto: !!p.costo,
      moneda: p.moneda,
      entradas: p.entradas,
      salidas: p.salidas,
      saldoPeriodo: p.saldo,
      valorEntradas: p.valorEntradas,
      valorSalidas: p.valorSalidas,
      saldoActual: saldoInventario.get(clave) ?? 0,
      valorInventario: (saldoInventario.get(clave) ?? 0) * p.costoUnitario,
      movimientos: p.movimientos.length,
    }));

    // Productos que están en el inventario pero no se movieron en el período:
    // igual tienen saldo y valor, así que no pueden faltar en el resumen.
    saldoInventario.forEach((saldo, clave) => {
      if (kardex.has(clave)) return;
      const lote = lotes.find(l => claveProducto(l.producto || '(sin producto)') === clave);
      const costo = costos.get(clave);
      filas.push({
        clave,
        producto: lote?.producto || '(sin producto)',
        costoUnitario: costo ? costo.costoUnitario : 0,
        tieneCosto: !!costo,
        moneda: costo ? costo.moneda : 'USD',
        entradas: 0, salidas: 0, saldoPeriodo: 0,
        valorEntradas: 0, valorSalidas: 0,
        saldoActual: saldo,
        valorInventario: saldo * (costo ? costo.costoUnitario : 0),
        movimientos: 0,
      });
    });

    const q = claveProducto(busqueda);
    return filas
      .filter(f => !q || claveProducto(f.producto).includes(q))
      .sort((a, b) => b.valorInventario - a.valorInventario || b.saldoActual - a.saldoActual);
  }, [kardex, lotes, costos, busqueda]);

  const totales = useMemo(() => resumen.reduce((acc, f) => ({
    entradas: acc.entradas + f.entradas,
    salidas: acc.salidas + f.salidas,
    saldoActual: acc.saldoActual + f.saldoActual,
    valorInventario: acc.valorInventario + f.valorInventario,
    sinCosto: acc.sinCosto + (f.tieneCosto ? 0 : 1),
  }), { entradas: 0, salidas: 0, saldoActual: 0, valorInventario: 0, sinCosto: 0 }), [resumen]);

  const productos = useMemo(
    () => [...new Set(resumen.map(f => f.producto))].sort((a, b) => a.localeCompare(b, 'es')),
    [resumen]
  );

  const detalle = productoSel ? kardex.get(claveProducto(productoSel)) : null;

  // ── Costos ──────────────────────────────────────────────────────────────
  const onGuardarCosto = async (e) => {
    e?.preventDefault();
    const producto = formCosto.producto.trim();
    const costo = num(formCosto.costoUnitario);

    if (!producto)  { setAviso('⚠️ Elige un producto.'); return; }
    if (costo <= 0) { setAviso('⚠️ El costo debe ser mayor que cero.'); return; }

    setGuardando(true);
    setAviso('');
    try {
      await guardarCosto({
        producto,
        costoUnitario: costo,
        unidad: formCosto.unidad,
        notas: formCosto.notas,
        actualizadoPor: usuario?.username || usuario?.nombre || '',
      });
      setCostos(await getCostos());
      setFormCosto({ producto: '', costoUnitario: '', unidad: 'Lb', notas: '' });
      setAviso(`✅ Costo de "${producto}" guardado.`);
    } catch (err) {
      setAviso(`❌ ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const onBorrarCosto = async (registro) => {
    if (!window.confirm(`¿Quitar el costo de "${registro.producto}"?\n\nEl kardex de ese producto queda sin valorizar.`)) return;
    try {
      await borrarCosto(registro.id);
      setCostos(await getCostos());
      setAviso(`🗑️ Costo de "${registro.producto}" eliminado.`);
    } catch (err) {
      setAviso(`❌ ${err.message}`);
    }
  };

  // ── Excel ───────────────────────────────────────────────────────────────
  const exportar = () => {
    const wb = XLSX.utils.book_new();
    const hoja = (nombre, datos) => {
      if (!datos.length) return;
      const ws = XLSX.utils.json_to_sheet(datos);
      ws['!autofilter'] = { ref: ws['!ref'] };
      ws['!cols'] = Object.keys(datos[0]).map(k => ({ wch: Math.min(Math.max(k.length + 4, 12), 40) }));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    };

    hoja('Resumen', resumen.map(f => ({
      PRODUCTO: f.producto,
      'COSTO UNITARIO': f.tieneCosto ? f.costoUnitario : '',
      'ENTRADAS (Lb)': f.entradas,
      'SALIDAS (Lb)': f.salidas,
      'SALDO PERÍODO (Lb)': f.saldoPeriodo,
      'SALDO ACTUAL (Lb)': f.saldoActual,
      'VALOR ENTRADAS': f.tieneCosto ? f.valorEntradas : '',
      'VALOR SALIDAS': f.tieneCosto ? f.valorSalidas : '',
      'VALOR INVENTARIO': f.tieneCosto ? f.valorInventario : '',
      'COSTO CARGADO': f.tieneCosto ? 'Sí' : 'No',
    })));

    // Kardex completo de todos los productos, un renglón por movimiento
    const movs = [];
    kardex.forEach(p => p.movimientos.forEach(m => movs.push({
      PRODUCTO: p.producto,
      FECHA: fechaHora(m.fecha),
      TIPO: m.tipo,
      LOTE: m.lote,
      'CANTIDAD (Lb)': m.tipo === 'entrada' ? m.cantidad : -m.cantidad,
      'COSTO UNITARIO': p.costo ? p.costoUnitario : '',
      VALOR: p.costo ? (m.tipo === 'entrada' ? m.valor : -m.valor) : '',
      'SALDO ACUM. (Lb)': m.saldoAcum,
      'VALOR ACUM.': p.costo ? m.valorAcum : '',
      PROCESO: m.proceso,
      FORMULARIO: m.formId ? `#${m.formId}` : '',
      NOTAS: m.notas,
    })));
    hoja('Kardex', movs);

    hoja('Flujo por proceso', flujo.map(p => ({
      PROCESO: p.proceso,
      'ENTRADAS (Lb)': p.entradas,
      'SALIDAS (Lb)': p.salidas,
      'NETO (Lb)': p.entradas - p.salidas,
      'VALOR ENTRADAS': p.valorEntradas,
      'VALOR SALIDAS': p.valorSalidas,
      PRODUCTOS: p.productos.size,
      LOTES: p.lotes.size,
      FORMULARIOS: p.formularios.size,
    })));

    XLSX.writeFile(wb, `Kardex_${filtros.desde}_${filtros.hasta}.xlsx`);
  };

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="kardex-page">

      {/* ── CABECERA ── */}
      <div className="kx-header">
        <div className="kx-title">
          <h1>📒 Kardex de Productos</h1>
          <p>Entradas, salidas y valor del inventario</p>
        </div>

        <div className="kx-controls">
          <div className="kx-group">
            <label>Desde</label>
            <input type="date" value={filtros.desde}
              onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div className="kx-group">
            <label>Hasta</label>
            <input type="date" value={filtros.hasta}
              onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
          <div className="kx-group">
            <label>Lote</label>
            <input type="text" placeholder="Ej. 260511" value={filtros.lote}
              onChange={e => setFiltros({ ...filtros, lote: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && cargar()} />
          </div>

          <button className="kx-btn kx-btn-load" onClick={cargar} disabled={cargando}>
            {cargando ? '⏳' : '🔄'} Cargar
          </button>
          <button className="kx-btn kx-btn-excel" onClick={exportar} disabled={resumen.length === 0}>
            📥 Excel
          </button>
        </div>
      </div>

      {/* ── PESTAÑAS ── */}
      <div className="kx-tabs">
        {[
          ['resumen', '📋 Resumen'],
          ['kardex',  '📜 Kardex por producto'],
          ['flujo',   '🏭 Flujo entre procesos'],
          ['costos',  '💲 Costos'],
        ].map(([id, texto]) => (
          <button key={id}
            className={`kx-tab${tab === id ? ' on' : ''}`}
            onClick={() => setTab(id)}>
            {texto}
          </button>
        ))}
      </div>

      {error && <div className="kx-error">⚠️ {error}</div>}

      {totales.sinCosto > 0 && tab !== 'costos' && (
        <div className="kx-warn">
          💲 Hay <strong>{totales.sinCosto}</strong> producto(s) sin costo cargado: su valor aparece
          en blanco y no suma al total.{' '}
          <button className="kx-link" onClick={() => setTab('costos')}>Cargar costos →</button>
        </div>
      )}

      {/* ── STATS ── */}
      {resumen.length > 0 && (
        <div className="kx-stats">
          <div className="kx-stat">
            <span className="kx-stat-val">{lbs(totales.entradas)}</span>
            <span className="kx-stat-lbl">Lb entradas</span>
          </div>
          <div className="kx-stat">
            <span className="kx-stat-val">{lbs(totales.salidas)}</span>
            <span className="kx-stat-lbl">Lb salidas</span>
          </div>
          <div className="kx-stat">
            <span className="kx-stat-val">{lbs(totales.saldoActual)}</span>
            <span className="kx-stat-lbl">Lb en inventario</span>
          </div>
          <div className="kx-stat kx-stat-money">
            <span className="kx-stat-val">{money(totales.valorInventario)}</span>
            <span className="kx-stat-lbl">Valor del inventario</span>
          </div>
          <div className="kx-stat">
            <span className="kx-stat-val">{resumen.length}</span>
            <span className="kx-stat-lbl">Productos</span>
          </div>
        </div>
      )}

      <div className="kx-body">
        {cargando ? (
          <div className="kx-loading"><div className="kx-spinner" /><p>Cargando kardex…</p></div>
        ) : (
          <>
            {/* ═══ RESUMEN ═══ */}
            {tab === 'resumen' && (
              <>
                <input className="kx-search" type="text" placeholder="🔎 Buscar producto…"
                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />

                {resumen.length === 0 ? (
                  <p className="kx-empty">📭 No hay movimientos ni saldos en el rango elegido.</p>
                ) : (
                  <div className="kx-table-wrap">
                    <table className="kx-table">
                      <thead>
                        <tr>
                          <th>PRODUCTO</th>
                          <th className="kx-r">COSTO UNIT.</th>
                          <th className="kx-r">ENTRADAS Lb</th>
                          <th className="kx-r">SALIDAS Lb</th>
                          <th className="kx-r">SALDO ACTUAL Lb</th>
                          <th className="kx-r">VALOR ENTRADAS</th>
                          <th className="kx-r">VALOR SALIDAS</th>
                          <th className="kx-r">VALOR INVENTARIO</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.map(f => (
                          <tr key={f.clave} className={f.tieneCosto ? '' : 'kx-sin-costo'}>
                            <td className="kx-prod">{f.producto}</td>
                            <td className="kx-r">
                              {f.tieneCosto
                                ? money(f.costoUnitario, f.moneda)
                                : <span className="kx-pend" title="Falta cargar el costo">pendiente</span>}
                            </td>
                            <td className="kx-r kx-in">{f.entradas ? `+${lbs(f.entradas)}` : '—'}</td>
                            <td className="kx-r kx-out">{f.salidas ? `−${lbs(f.salidas)}` : '—'}</td>
                            <td className="kx-r"><strong>{lbs(f.saldoActual)}</strong></td>
                            <td className="kx-r">{f.tieneCosto ? money(f.valorEntradas, f.moneda) : '—'}</td>
                            <td className="kx-r">{f.tieneCosto ? money(f.valorSalidas, f.moneda) : '—'}</td>
                            <td className="kx-r kx-total-cell">
                              {f.tieneCosto ? money(f.valorInventario, f.moneda) : '—'}
                            </td>
                            <td>
                              <button className="kx-mini"
                                onClick={() => { setProductoSel(f.producto); setTab('kardex'); }}
                                disabled={f.movimientos === 0}
                                title={f.movimientos === 0 ? 'Sin movimientos en el período' : 'Ver kardex'}>
                                📜 Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="kx-foot">
                          <td>TOTAL ({resumen.length} productos)</td>
                          <td />
                          <td className="kx-r">+{lbs(totales.entradas)}</td>
                          <td className="kx-r">−{lbs(totales.salidas)}</td>
                          <td className="kx-r">{lbs(totales.saldoActual)}</td>
                          <td /><td />
                          <td className="kx-r">{money(totales.valorInventario)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══ KARDEX POR PRODUCTO ═══ */}
            {tab === 'kardex' && (
              <>
                <div className="kx-sel">
                  <label>Producto</label>
                  <select value={productoSel} onChange={e => setProductoSel(e.target.value)}>
                    <option value="">— Elige un producto —</option>
                    {productos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {detalle && (
                    <span className="kx-sel-info">
                      {detalle.costo
                        ? `Costo ${money(detalle.costoUnitario, detalle.moneda)} / ${detalle.costo.unidad}`
                        : '⚠️ Sin costo cargado — el kardex va solo en libras'}
                    </span>
                  )}
                </div>

                {!productoSel ? (
                  <p className="kx-empty">👆 Elige un producto para ver su kardex.</p>
                ) : !detalle || detalle.movimientos.length === 0 ? (
                  <p className="kx-empty">📭 Ese producto no tuvo movimientos en el rango elegido.</p>
                ) : (
                  <div className="kx-table-wrap">
                    <table className="kx-table">
                      <thead>
                        <tr>
                          <th>FECHA</th>
                          <th>TIPO</th>
                          <th>LOTE</th>
                          <th className="kx-r">ENTRADA Lb</th>
                          <th className="kx-r">SALIDA Lb</th>
                          <th className="kx-r">SALDO Lb</th>
                          <th className="kx-r">VALOR MOV.</th>
                          <th className="kx-r">VALOR SALDO</th>
                          <th>PROCESO</th>
                          <th>FORM.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.movimientos.map((m, i) => (
                          <tr key={m.id ?? `${m.fecha}-${i}`}>
                            <td>{fechaHora(m.fecha)}</td>
                            <td>
                              <span className={`kx-tag kx-tag-${m.tipo}`}>
                                {m.tipo === 'entrada' ? '⬆ entrada' : '⬇ salida'}
                              </span>
                            </td>
                            <td className="kx-lote">{m.lote || '—'}</td>
                            <td className="kx-r kx-in">{m.tipo === 'entrada' ? `+${lbs(m.cantidad)}` : ''}</td>
                            <td className="kx-r kx-out">{m.tipo === 'salida' ? `−${lbs(m.cantidad)}` : ''}</td>
                            <td className="kx-r"><strong>{lbs(m.saldoAcum)}</strong></td>
                            <td className="kx-r">{detalle.costo ? money(m.valor, detalle.moneda) : '—'}</td>
                            <td className="kx-r kx-total-cell">
                              {detalle.costo ? money(m.valorAcum, detalle.moneda) : '—'}
                            </td>
                            <td>{m.proceso || '—'}</td>
                            <td>{m.formId ? `#${m.formId}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="kx-foot">
                          <td colSpan={3}>TOTAL DEL PERÍODO</td>
                          <td className="kx-r">+{lbs(detalle.entradas)}</td>
                          <td className="kx-r">−{lbs(detalle.salidas)}</td>
                          <td className="kx-r">{lbs(detalle.saldo)}</td>
                          <td />
                          <td className="kx-r">{detalle.costo ? money(detalle.valorSaldo, detalle.moneda) : '—'}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══ FLUJO ENTRE PROCESOS ═══ */}
            {tab === 'flujo' && (
              flujo.length === 0 ? (
                <p className="kx-empty">📭 No hay movimientos en el rango elegido.</p>
              ) : (
                <div className="kx-flujo">
                  {flujo.map(p => {
                    const neto = p.entradas - p.salidas;
                    return (
                      <div key={p.proceso} className="kx-flujo-card">
                        <div className="kx-flujo-head">
                          <strong>{p.proceso}</strong>
                          <span className="kx-flujo-meta">
                            {p.productos.size} producto(s) · {p.lotes.size} lote(s)
                            {p.formularios.size > 0 && ` · ${p.formularios.size} formulario(s)`}
                          </span>
                        </div>
                        <div className="kx-flujo-barras">
                          <div className="kx-flujo-fila">
                            <span className="kx-flujo-et">⬆ Entró</span>
                            <span className="kx-in">{lbs(p.entradas)} Lb</span>
                            <span className="kx-flujo-val">{money(p.valorEntradas)}</span>
                          </div>
                          <div className="kx-flujo-fila">
                            <span className="kx-flujo-et">⬇ Salió</span>
                            <span className="kx-out">{lbs(p.salidas)} Lb</span>
                            <span className="kx-flujo-val">{money(p.valorSalidas)}</span>
                          </div>
                          <div className="kx-flujo-fila kx-flujo-neto">
                            <span className="kx-flujo-et">= Neto</span>
                            <span className={neto >= 0 ? 'kx-in' : 'kx-out'}>
                              {neto >= 0 ? '+' : '−'}{lbs(Math.abs(neto))} Lb
                            </span>
                            <span className="kx-flujo-val">
                              {money(p.valorEntradas - p.valorSalidas)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ═══ COSTOS ═══ */}
            {tab === 'costos' && (
              <div className="kx-costos">
                {!puedeEditarCostos ? (
                  <p className="kx-empty">
                    🔒 Solo los roles <strong>Admin</strong> y <strong>Costos</strong> pueden
                    cargar o modificar costos. Podés ver el kardex en las otras pestañas.
                  </p>
                ) : (
                  <form className="kx-costo-form" onSubmit={onGuardarCosto}>
                    <div className="kx-group kx-group-wide">
                      <label>Producto</label>
                      <input list="kx-productos" placeholder="Escribe o elige un producto…"
                        value={formCosto.producto}
                        onChange={e => setFormCosto({ ...formCosto, producto: e.target.value })} />
                      <datalist id="kx-productos">
                        {productos.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div className="kx-group">
                      <label>Costo unitario</label>
                      <input type="number" step="0.0001" min="0" placeholder="0.0000"
                        value={formCosto.costoUnitario}
                        onChange={e => setFormCosto({ ...formCosto, costoUnitario: e.target.value })} />
                    </div>
                    <div className="kx-group">
                      <label>Por</label>
                      <select value={formCosto.unidad}
                        onChange={e => setFormCosto({ ...formCosto, unidad: e.target.value })}>
                        <option value="Lb">Libra</option>
                        <option value="Kg">Kilo</option>
                        <option value="Unidad">Unidad</option>
                      </select>
                    </div>
                    <div className="kx-group kx-group-wide">
                      <label>Notas</label>
                      <input type="text" placeholder="Opcional: de dónde sale este costo"
                        value={formCosto.notas}
                        onChange={e => setFormCosto({ ...formCosto, notas: e.target.value })} />
                    </div>
                    <button className="kx-btn kx-btn-save" type="submit" disabled={guardando}>
                      {guardando ? '⏳ Guardando…' : '💾 Guardar costo'}
                    </button>
                  </form>
                )}

                {aviso && <div className="kx-aviso">{aviso}</div>}

                <div className="kx-table-wrap">
                  <table className="kx-table">
                    <thead>
                      <tr>
                        <th>PRODUCTO</th>
                        <th className="kx-r">COSTO UNITARIO</th>
                        <th>UNIDAD</th>
                        <th className="kx-r">SALDO Lb</th>
                        <th className="kx-r">VALOR INVENTARIO</th>
                        <th>ACTUALIZADO</th>
                        <th>NOTAS</th>
                        {puedeEditarCostos && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.map(f => {
                        const registro = costos.get(f.clave);
                        return (
                          <tr key={f.clave} className={registro ? '' : 'kx-sin-costo'}>
                            <td className="kx-prod">{f.producto}</td>
                            <td className="kx-r">
                              {registro
                                ? money(registro.costoUnitario, registro.moneda)
                                : <span className="kx-pend">sin cargar</span>}
                            </td>
                            <td>{registro?.unidad || '—'}</td>
                            <td className="kx-r">{lbs(f.saldoActual)}</td>
                            <td className="kx-r kx-total-cell">
                              {registro ? money(f.valorInventario, registro.moneda) : '—'}
                            </td>
                            <td className="kx-mini-txt">
                              {registro?.actualizadoEn
                                ? `${fechaHora(registro.actualizadoEn)}${registro.actualizadoPor ? ` · ${registro.actualizadoPor}` : ''}`
                                : '—'}
                            </td>
                            <td className="kx-mini-txt">{registro?.notas || '—'}</td>
                            {puedeEditarCostos && (
                              <td className="kx-acciones">
                                <button className="kx-mini"
                                  onClick={() => setFormCosto({
                                    producto: f.producto,
                                    costoUnitario: registro ? String(registro.costoUnitario) : '',
                                    unidad: registro?.unidad || 'Lb',
                                    notas: registro?.notas || '',
                                  })}>
                                  ✏️ {registro ? 'Editar' : 'Cargar'}
                                </button>
                                {registro && (
                                  <button className="kx-mini kx-mini-del"
                                    onClick={() => onBorrarCosto(registro)}>
                                    🗑️
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
