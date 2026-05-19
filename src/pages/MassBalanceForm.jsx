import React, { useState, useEffect } from 'react';
import './MassBalanceForm.css';
import { getLotes } from '../hooks/useLoteStore';

// ── Helpers ───────────────────────────────────────────────────────────────────
const n = (v) => Number.parseFloat(v) || 0;
const pct = (num, den) => (n(den) === 0 ? '' : ((n(num) / n(den)) * 100).toFixed(2));
const timeDiff = (ini, fin) => {
  if (!ini || !fin) return '';
  const [h1, m1] = ini.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const emptyRecepcion = () => ({ fechaRecepcion: '', proveedor: '', loteLiquidacion: '', especie: '', pesoXLote: '', librasProyectadas: '', librasRecibidas: '' });
const emptyFileteo = () => ({ fechaFileteo: '', especie: '', lote: '', pBrutoFileteado: '', clasificLomos: '', pNetoFileteo: '', pesoSubprod: '' });
const emptyProductoATrazar = () => ({ loteInterno: '', producto: '', desde: '', hasta: '', tipoTrazabilidad: '' });
const emptyBalanceFila = () => ({ proceso: '', entProducto: '', entLote: '', entCant: '', salProducto: '', salLote: '', salCant: '', recortes: '', subprod: '', stkProducto: '', stkLote: '', stkCant: '', perdidas: '', comentario: '' });

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: Trazabilidad Manual (balance libre de entradas/salidas/mermas)
// ─────────────────────────────────────────────────────────────────────────────
function TrazabilidadManual() {
  const [loteBusqueda, setLoteBusqueda] = useState('');
  const [mensajeBusqueda, setMensajeBusqueda] = useState('');
  const [buscandoInfo, setBuscandoInfo] = useState(false);

  const [manualData, setManualData] = useState({
    lotePrincipal: '',
    entradas: [],
    salidas: [],
    mermas: [],
    iotData: { temperaturaPromedio: -18.5, humedad: 82, alertasSensor: false },
  });

  const [balanceData, setBalanceData] = useState({
    delta: 0, esBalanceado: true, totalIn: 0, totalOut: 0, totalWaste: 0,
  });

  // Recalcular balance en tiempo real
  useEffect(() => {
    const totalIn = manualData.entradas.reduce((s, i) => s + n(i.pesoInicial), 0);
    const totalOut = manualData.salidas.reduce((s, i) => s + n(i.pesoFinal), 0);
    const totalWaste = manualData.mermas.reduce((s, i) => s + n(i.peso), 0);
    const delta = Number((totalIn - totalOut - totalWaste).toFixed(2));
    setBalanceData({ delta, esBalanceado: Math.abs(delta) <= 0.05, totalIn, totalOut, totalWaste });
  }, [manualData.entradas, manualData.salidas, manualData.mermas]);

  const updateManualItem = (category, idx, field, value) =>
    setManualData(prev => {
      const items = [...prev[category]];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, [category]: items };
    });

  const removeManualItem = (category, idx) =>
    setManualData(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== idx) }));

  const addEntrada = () =>
    setManualData(prev => ({
      ...prev,
      entradas: [...prev.entradas, {
        idLote: `LOTE-${Date.now()}`,
        pesoInicial: 0,
        unidad: 'lbs',
        origen: 'Produccion_Actual',
        fechaOrigen: new Date().toISOString().split('T')[0],
      }],
    }));

  const addSalida = () =>
    setManualData(prev => ({
      ...prev,
      salidas: [...prev.salidas, {
        idLoteHijo: `${prev.lotePrincipal || 'LOTE'}-OUT-${prev.salidas.length + 1}`,
        pesoFinal: 0,
        clasificacion: 'Especial',
      }],
    }));

  const addMerma = () =>
    setManualData(prev => ({
      ...prev,
      mermas: [...prev.mermas, { tipo: 'Aserrin', peso: 0 }],
    }));

  const cargarLote = () => {
    if (!loteBusqueda.trim()) return;
    setBuscandoInfo(true);
    setMensajeBusqueda('Buscando lote...');
    // Simulación: sin llamada real a DB
    setTimeout(() => {
      setManualData(prev => ({
        ...prev,
        lotePrincipal: loteBusqueda,
        entradas: [{ idLote: loteBusqueda, pesoInicial: 0, unidad: 'lbs', origen: 'Produccion_Actual', fechaOrigen: new Date().toISOString().split('T')[0] }],
        salidas: [{ idLoteHijo: `${loteBusqueda}-OUT`, pesoFinal: 0, clasificacion: 'Entero' }],
        mermas: [],
      }));
      setMensajeBusqueda(`Lote ${loteBusqueda} cargado. Complete los pesos manualmente.`);
      setBuscandoInfo(false);
      setTimeout(() => setMensajeBusqueda(''), 4000);
    }, 600);
  };

  return (
    <div className="mb-container">
      {/* Encabezado */}
      <header className="mb-header">
        <div>
          <h1>⚖️ Trazabilidad Manual</h1>
          {manualData.lotePrincipal && (
            <span className="mb-id">Lote: {manualData.lotePrincipal}</span>
          )}
        </div>

        {/* Buscador */}
        <div className="mb-search-box">
          <input
            type="text"
            placeholder="Nº Lote (ej. 260511)"
            value={loteBusqueda}
            onChange={e => setLoteBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cargarLote()}
          />
          <button onClick={cargarLote} disabled={buscandoInfo || !loteBusqueda.trim()}>
            {buscandoInfo ? '⏳ Cargando...' : '🔍 Cargar Lote'}
          </button>
        </div>

        {/* Panel IoT */}
        <div className={`iot-panel ${manualData.iotData.alertasSensor ? 'alert' : 'ok'}`}>
          <div className="iot-badge">📡 IoT Activo (SENS-CAM-02)</div>
          <div className="iot-stats">
            <span>🌡️ {manualData.iotData.temperaturaPromedio}°C</span>
            <span>💧 {manualData.iotData.humedad}%</span>
          </div>
        </div>
      </header>

      {/* Mensaje búsqueda */}
      {mensajeBusqueda && <div className="mb-search-msg">{mensajeBusqueda}</div>}

      {/* Widget balance tiempo real */}
      <div className={`balance-widget ${balanceData.esBalanceado ? 'balanced' : 'unbalanced'}`}>
        <div className="balance-summary">
          <div className="bal-col">
            <span>IN (Entradas)</span>
            <strong>{balanceData.totalIn.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">−</div>
          <div className="bal-col">
            <span>OUT (Salidas)</span>
            <strong>{balanceData.totalOut.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">−</div>
          <div className="bal-col">
            <span>WASTE (Mermas)</span>
            <strong>{balanceData.totalWaste.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">=</div>
          <div className="bal-col delta">
            <span>DELTA (Target 0)</span>
            <strong>{balanceData.delta} lbs</strong>
          </div>
        </div>
        <div className="balance-status">
          {balanceData.esBalanceado
            ? '✅ Cuadre Perfecto (tolerancia ±0.05 lbs)'
            : `⚠️ Descuadre (${balanceData.delta > 0 ? 'Faltan' : 'Sobran'} ${Math.abs(balanceData.delta)} lbs)`}
        </div>
      </div>

      <div className="mb-grid">
        {/* Entradas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>📦 1. Entradas (Materia Prima)</h3>
            <button onClick={addEntrada} className="btn-add">+ Agregar Entrada</button>
          </div>
          <div className="items-list">
            {manualData.entradas.map((ent, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`ent-${idx}`} className="item-row">
                <input
                  type="text"
                  value={ent.idLote}
                  onChange={e => updateManualItem('entradas', idx, 'idLote', e.target.value)}
                  placeholder="ID Lote"
                />
                <div className="input-group">
                  <input
                    type="number"
                    value={ent.pesoInicial}
                    onChange={e => updateManualItem('entradas', idx, 'pesoInicial', e.target.value)}
                  />
                  <span>lbs</span>
                </div>
                <button className="btn-rem-inline" onClick={() => removeManualItem('entradas', idx)}>✕</button>
              </div>
            ))}
            {manualData.entradas.length === 0 && <p className="mb-empty">Sin entradas. Pulsa "+ Agregar Entrada".</p>}
          </div>
        </section>

        {/* Salidas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>🏷️ 2. Salidas (Producto Terminado)</h3>
            <button onClick={addSalida} className="btn-add">+ Agregar Salida</button>
          </div>
          <div className="items-list">
            {manualData.salidas.map((sal, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`sal-${idx}`} className="item-row">
                <input
                  type="text"
                  value={sal.idLoteHijo}
                  onChange={e => updateManualItem('salidas', idx, 'idLoteHijo', e.target.value)}
                  placeholder="ID Lote Salida"
                />
                <select
                  value={sal.clasificacion}
                  onChange={e => updateManualItem('salidas', idx, 'clasificacion', e.target.value)}
                >
                  <option value="Especial">Especial</option>
                  <option value="Entero">Entero</option>
                  <option value="Cortes 4-8oz">Cortes 4-8oz</option>
                </select>
                <div className="input-group">
                  <input
                    type="number"
                    value={sal.pesoFinal}
                    onChange={e => updateManualItem('salidas', idx, 'pesoFinal', e.target.value)}
                  />
                  <span>lbs</span>
                </div>
                <button className="btn-rem-inline" onClick={() => removeManualItem('salidas', idx)}>✕</button>
              </div>
            ))}
            {manualData.salidas.length === 0 && <p className="mb-empty">Sin salidas.</p>}
          </div>
        </section>

        {/* Mermas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>🗑️ 3. Mermas y Desperdicios</h3>
            <button onClick={addMerma} className="btn-add">+ Agregar Merma</button>
          </div>
          <div className="items-list">
            {manualData.mermas.map((mer, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`mer-${idx}`} className="item-row waste-row">
                <select
                  value={mer.tipo}
                  onChange={e => updateManualItem('mermas', idx, 'tipo', e.target.value)}
                >
                  <option value="Aserrin">Aserrín</option>
                  <option value="Visceras">Vísceras</option>
                  <option value="Merma_Frio">Merma por Frío</option>
                  <option value="Rechazo_Calidad">Rechazo Calidad</option>
                </select>
                <div className="input-group">
                  <input
                    type="number"
                    value={mer.peso}
                    onChange={e => updateManualItem('mermas', idx, 'peso', e.target.value)}
                  />
                  <span>lbs</span>
                </div>
                <button className="btn-rem-inline" onClick={() => removeManualItem('mermas', idx)}>✕</button>
              </div>
            ))}
            {manualData.mermas.length === 0 && <p className="mb-empty">Sin mermas registradas.</p>}
          </div>
        </section>
      </div>

      <div className="mb-footer">
        <p className="mb-footer-note">
          Esta vista calcula el balance en tiempo real. No guarda en base de datos.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function MassBalanceForm() {
  const [activeTab, setActiveTab] = useState('estandar');

  // ── Cabecera ──
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [solicitud, setSolicitud] = useState('');
  const [alcance, setAlcance] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [comentarioPrincipal, setComentarioPrincipal] = useState('');

  // ── Producto a Trazar ──
  const [productosATrazar, setProductosATrazar] = useState([emptyProductoATrazar()]);

  // ── Recepción de Materia Prima ──
  const [recepcion, setRecepcion] = useState([emptyRecepcion(), emptyRecepcion(), emptyRecepcion()]);

  // ── Producto en Proceso (Fileteo) ──
  const [fileteo, setFileteo] = useState([emptyFileteo(), emptyFileteo(), emptyFileteo()]);

  // ── Balance de Masa ──
  const [balanceFilas, setBalanceFilas] = useState([emptyBalanceFila(), emptyBalanceFila(), emptyBalanceFila()]);

  // 🔄 Importar lotes del inventario
  const [importandoLotes, setImportandoLotes] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [lotesParaImportar, setLotesParaImportar] = useState([]);

  const handleAbrirImport = async () => {
    setImportandoLotes(true);
    try {
      const lotes = await getLotes();
      setLotesParaImportar(lotes || []);
      setModalImport(true);
    } catch (err) {
      alert('Error cargando lotes del inventario: ' + err.message);
    } finally {
      setImportandoLotes(false);
    }
  };

  const confirmarImportLotes = () => {
    const filas = lotesParaImportar.map(l => ({
      proceso: l.proceso || '',
      entProducto: (l.estado === 'consumido' || l.estado === 'Consumido') ? (l.producto || '') : '',
      entLote: (l.estado === 'consumido' || l.estado === 'Consumido') ? (l.lote || l.numeroLote || '') : '',
      entCant: (l.estado === 'consumido' || l.estado === 'Consumido') ? String(n(l.pesoEntrada)) : '',
      salProducto: (l.estado !== 'consumido' && l.estado !== 'Consumido') ? (l.producto || '') : '',
      salLote: (l.estado !== 'consumido' && l.estado !== 'Consumido') ? (l.lote || l.numeroLote || '') : '',
      salCant: (l.estado !== 'consumido' && l.estado !== 'Consumido') ? String(n(l.pesoNeto || l.pesoEntrada)) : '',
      recortes: '', subprod: '', stkProducto: '', stkLote: '', stkCant: '',
      perdidas: '', comentario: l.notas || ''
    }));
    setBalanceFilas(filas.length > 0 ? filas : [emptyBalanceFila()]);
    setModalImport(false);
  };

  // ── Observaciones y Firmas ──
  const [observaciones, setObservaciones] = useState('');
  const [elaboradoPor, setElaboradoPor] = useState('');
  const [revision, setRevision] = useState('');

  // ── Cálculos automáticos ──
  const tiempoTotal = timeDiff(horaInicio, horaFin);
  const totalLibrasProyectadas = recepcion.reduce((s, r) => s + n(r.librasProyectadas), 0);
  const totalLibrasRecibidas = recepcion.reduce((s, r) => s + n(r.librasRecibidas), 0);
  const pctRecuperado = pct(totalLibrasRecibidas, totalLibrasProyectadas);
  const totalPBruto = fileteo.reduce((s, f) => s + n(f.pBrutoFileteado), 0);
  const totalPNeto = fileteo.reduce((s, f) => s + n(f.pNetoFileteo), 0);
  const totalPesoSubprod = fileteo.reduce((s, f) => s + n(f.pesoSubprod), 0);

  // ── Handlers genéricos ──
  const updRow = (setter, idx, field, value) =>
    setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const addRow = (setter, factory) => setter(prev => [...prev, factory()]);
  const removeRow = (setter, idx) => setter(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  // ── Print ──
  const handlePrint = () => globalThis.print();

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="mbf-page">
      {/* ── Selector de modo ── */}
      <div className="mbf-mode-tabs no-print">
        <button
          className={`mbf-mode-tab ${activeTab === 'estandar' ? 'active' : ''}`}
          onClick={() => setActiveTab('estandar')}
        >
          📄 Formulario Estándar (FOR-PD-8)
        </button>
        <button
          className={`mbf-mode-tab ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          ⚖️ Trazabilidad Manual
        </button>
      </div>

      {/* ── Trazabilidad Manual ── */}
      {activeTab === 'manual' && <TrazabilidadManual />}

      {/* ── Formulario Estándar ── */}
      {activeTab === 'estandar' && (
        <>
          {/* Barra de acciones */}
          <div className="mbf-toolbar no-print">
            <h2 className="mbf-toolbar-title">⚖️ Balance de Masas — Trazabilidad Pescado</h2>
            <button className="mbf-btn-print" onClick={handlePrint}>🖨️ Imprimir / Exportar PDF</button>
          </div>

      {/* ══════════ PRINT AREA ══════════ */}
      <div className="mbf-print-area">

        {/* ── Encabezado del documento ── */}
        <div className="mbf-doc-header">
          <div className="mbf-logo-cell">
            <div className="mbf-company">Frigolab "San Mateo"</div>
            <div className="mbf-company-sub">Exportadores de mariscos frescos y congelados</div>
          </div>
          <div className="mbf-title-cell">
            <div className="mbf-doc-title">BALANCE DE MASAS</div>
            <div className="mbf-doc-subtitle">(TRAZABILIDAD PESCADO)</div>
          </div>
          <div className="mbf-code-cell">
            <div><strong>CÓDIGO:</strong> FOR-PD-8</div>
            <div><strong>VERSIÓN:</strong> 2</div>
            <div><strong>FECHA:</strong> 2/10/2025</div>
          </div>
        </div>

        {/* ── Campos de cabecera ── */}
        <table className="mbf-header-table">
          <tbody>
            <tr>
              <td className="mbf-label-cell" style={{ width: '120px' }}>FECHA</td>
              <td colSpan={3}>
                <input className="mbf-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </td>
            </tr>
            <tr>
              <td className="mbf-label-cell">SOLICITUD DE TRAZABILIDAD</td>
              <td style={{ width: '38%' }}>
                <input className="mbf-input" value={solicitud} onChange={e => setSolicitud(e.target.value)} placeholder="Descripción de la solicitud..." />
              </td>
              <td className="mbf-label-cell" style={{ width: '100px' }}>ALCANCE</td>
              <td>
                <input className="mbf-input" value={alcance} onChange={e => setAlcance(e.target.value)} placeholder="Alcance..." />
              </td>
            </tr>
            <tr>
              <td className="mbf-label-cell">HORA INICIO</td>
              <td>
                <input className="mbf-input" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
              </td>
              <td className="mbf-label-cell">HORA FIN</td>
              <td>
                <input className="mbf-input" type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
              </td>
            </tr>
            <tr>
              <td className="mbf-label-cell">TIEMPO TOTAL</td>
              <td>
                <span className="mbf-calc-value">{tiempoTotal || '—'}</span>
              </td>
              <td className="mbf-label-cell">% RECUPERADO</td>
              <td>
                <span className="mbf-calc-value">{pctRecuperado ? `${pctRecuperado}%` : '—'}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── PRODUCTO A TRAZAR ── */}
        <div className="mbf-section-title">PRODUCTO A TRAZAR</div>
        <div className="mbf-table-wrapper">
          <table className="mbf-table">
            <thead>
              <tr>
                <th>LOTE / LIQUIDACIÓN INTERNA</th>
                <th>PRODUCTO</th>
                <th>DESDE</th>
                <th>HASTA</th>
                <th>TIPO DE TRAZABILIDAD</th>
                <th className="no-print mbf-th-action">—</th>
              </tr>
            </thead>
            <tbody>
              {productosATrazar.map((row, idx) => (
                <tr key={idx}>
                  <td><input className="mbf-input" value={row.loteInterno} onChange={e => updRow(setProductosATrazar, idx, 'loteInterno', e.target.value)} /></td>
                  <td><input className="mbf-input" value={row.producto} onChange={e => updRow(setProductosATrazar, idx, 'producto', e.target.value)} /></td>
                  <td><input className="mbf-input" type="date" value={row.desde} onChange={e => updRow(setProductosATrazar, idx, 'desde', e.target.value)} /></td>
                  <td><input className="mbf-input" type="date" value={row.hasta} onChange={e => updRow(setProductosATrazar, idx, 'hasta', e.target.value)} /></td>
                  <td><input className="mbf-input" value={row.tipoTrazabilidad} onChange={e => updRow(setProductosATrazar, idx, 'tipoTrazabilidad', e.target.value)} /></td>
                  <td className="no-print mbf-td-action">
                    <button className="mbf-btn-rem" onClick={() => removeRow(setProductosATrazar, idx)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mbf-btn-add no-print" onClick={() => addRow(setProductosATrazar, emptyProductoATrazar)}>+ Agregar fila</button>
        </div>

        {/* ── RECEPCIÓN DE MATERIA PRIMA + PRODUCTO EN PROCESO (FILETEO) ── */}
        <div className="mbf-dual-section">

          {/* Recepción */}
          <div className="mbf-dual-block">
            <div className="mbf-section-title mbf-section-title--left">RECEPCIÓN DE MATERIA PRIMA</div>
            <div className="mbf-table-wrapper">
              <table className="mbf-table mbf-table--sm">
                <thead>
                  <tr>
                    <th>FECHA<br/>RECEPC. MP</th>
                    <th>BP / PROVEEDOR</th>
                    <th>LOTE / LIQUIDACIÓN</th>
                    <th>ESPECIE</th>
                    <th>PESO X LOTE<br/>(lbs)</th>
                    <th>LIBRAS PROYECTADAS<br/>(GUÍA DE MOV)</th>
                    <th>LIBRAS RECIBIDAS<br/>(LIQUIDACIÓN)</th>
                    <th className="no-print mbf-th-action">—</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcion.map((row, idx) => (
                    <tr key={idx}>
                      <td><input className="mbf-input" type="date" value={row.fechaRecepcion} onChange={e => updRow(setRecepcion, idx, 'fechaRecepcion', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.proveedor} onChange={e => updRow(setRecepcion, idx, 'proveedor', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.loteLiquidacion} onChange={e => updRow(setRecepcion, idx, 'loteLiquidacion', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.especie} onChange={e => updRow(setRecepcion, idx, 'especie', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.pesoXLote} onChange={e => updRow(setRecepcion, idx, 'pesoXLote', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.librasProyectadas} onChange={e => updRow(setRecepcion, idx, 'librasProyectadas', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.librasRecibidas} onChange={e => updRow(setRecepcion, idx, 'librasRecibidas', e.target.value)} /></td>
                      <td className="no-print mbf-td-action">
                        <button className="mbf-btn-rem" onClick={() => removeRow(setRecepcion, idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="mbf-total-row">
                    <td colSpan={4} className="mbf-label-cell">TOTAL</td>
                    <td className="mbf-total-val">{recepcion.reduce((s,r)=>s+n(r.pesoXLote),0).toFixed(2)}</td>
                    <td className="mbf-total-val">{totalLibrasProyectadas.toFixed(2)}</td>
                    <td className="mbf-total-val">{totalLibrasRecibidas.toFixed(2)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
              <button className="mbf-btn-add no-print" onClick={() => addRow(setRecepcion, emptyRecepcion)}>+ Agregar fila</button>
            </div>
          </div>

          {/* Fileteo */}
          <div className="mbf-dual-block">
            <div className="mbf-section-title mbf-section-title--left">PRODUCTO EN PROCESO (FILETEO)</div>
            <div className="mbf-table-wrapper">
              <table className="mbf-table mbf-table--sm">
                <thead>
                  <tr>
                    <th>FECHA<br/>FILETEO</th>
                    <th>ESPECIE</th>
                    <th>LOTE</th>
                    <th>P. BRUTO<br/>FILETEADO</th>
                    <th>CLASIFIC.<br/>LOMOS</th>
                    <th>P. NETO<br/>FILETEO</th>
                    <th>PESO<br/>SUBPROD.</th>
                    <th>PROM. %<br/>RENDIM.</th>
                    <th className="no-print mbf-th-action">—</th>
                  </tr>
                </thead>
                <tbody>
                  {fileteo.map((row, idx) => (
                    <tr key={idx}>
                      <td><input className="mbf-input" type="date" value={row.fechaFileteo} onChange={e => updRow(setFileteo, idx, 'fechaFileteo', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.especie} onChange={e => updRow(setFileteo, idx, 'especie', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.lote} onChange={e => updRow(setFileteo, idx, 'lote', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.pBrutoFileteado} onChange={e => updRow(setFileteo, idx, 'pBrutoFileteado', e.target.value)} /></td>
                      <td><input className="mbf-input" value={row.clasificLomos} onChange={e => updRow(setFileteo, idx, 'clasificLomos', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.pNetoFileteo} onChange={e => updRow(setFileteo, idx, 'pNetoFileteo', e.target.value)} /></td>
                      <td><input className="mbf-input mbf-num" type="number" value={row.pesoSubprod} onChange={e => updRow(setFileteo, idx, 'pesoSubprod', e.target.value)} /></td>
                      <td className="mbf-calc-cell">{pct(row.pNetoFileteo, row.pBrutoFileteado) ? `${pct(row.pNetoFileteo, row.pBrutoFileteado)}%` : '—'}</td>
                      <td className="no-print mbf-td-action">
                        <button className="mbf-btn-rem" onClick={() => removeRow(setFileteo, idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="mbf-total-row">
                    <td colSpan={3} className="mbf-label-cell">TOTAL</td>
                    <td className="mbf-total-val">{totalPBruto.toFixed(2)}</td>
                    <td>—</td>
                    <td className="mbf-total-val">{totalPNeto.toFixed(2)}</td>
                    <td className="mbf-total-val">{totalPesoSubprod.toFixed(2)}</td>
                    <td className="mbf-total-val">{pct(totalPNeto, totalPBruto) ? `${pct(totalPNeto, totalPBruto)}%` : '—'}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
              <button className="mbf-btn-add no-print" onClick={() => addRow(setFileteo, emptyFileteo)}>+ Agregar fila</button>
            </div>
          </div>
        </div>

        {/* ── COMENTARIO ── */}
        <div className="mbf-field-row">
          <span className="mbf-label-cell" style={{ minWidth: 110 }}>COMENTARIO:</span>
          <textarea className="mbf-textarea" rows={2} value={comentarioPrincipal} onChange={e => setComentarioPrincipal(e.target.value)} placeholder="Comentario..." />
        </div>

        {/* ══════════ BALANCE DE MASA ══════════ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '28px' }}>
          <div className="mbf-section-title mbf-section-title--dark" style={{ margin: 0, flex: 1 }}>BALANCE DE MASA</div>
          <button
            className="mbf-btn-add no-print"
            onClick={handleAbrirImport}
            disabled={importandoLotes}
            style={{ background: '#064e3b', color: 'white', padding: '6px 14px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}
          >
            {importandoLotes ? '⏳ Cargando...' : '🔄 Importar del Inventario'}
          </button>
        </div>

        {/* MODAL importar lotes */}
        {modalImport && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '10px', padding: '24px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#064e3b' }}>🔄 Lotes del inventario — {lotesParaImportar.length} lotes</h3>
              {lotesParaImportar.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No hay lotes en el inventario.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#064e3b', color: 'white' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Lote</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Proceso</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Producto</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Peso entrada</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Peso neto</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesParaImportar.map((l, i) => (
                      <tr key={l.id || i} style={{ background: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{l.lote || l.numeroLote}</td>
                        <td style={{ padding: '5px 8px' }}>{l.proceso || '—'}</td>
                        <td style={{ padding: '5px 8px' }}>{l.producto || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{n(l.pesoEntrada).toFixed(1)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{n(l.pesoNeto).toFixed(1)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', background: (l.estado === 'consumido' || l.estado === 'Consumido') ? '#fef2f2' : '#f0fdf4', color: (l.estado === 'consumido' || l.estado === 'Consumido') ? '#991b1b' : '#166534', border: `1px solid ${(l.estado === 'consumido' || l.estado === 'Consumido') ? '#fca5a5' : '#86efac'}` }}>{l.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button onClick={() => setModalImport(false)} style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer', background: 'white' }}>Cancelar</button>
                <button onClick={confirmarImportLotes} disabled={lotesParaImportar.length === 0} style={{ padding: '8px 18px', borderRadius: '6px', background: '#064e3b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✅ Importar {lotesParaImportar.length} lotes</button>
              </div>
            </div>
          </div>
        )}
        <div className="mbf-table-wrapper mbf-overflow-x">
          <table className="mbf-table mbf-table--balance">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 90 }}>PROCESO</th>
                <th colSpan={3} className="mbf-group-header">ENTRADA (lbs)</th>
                <th colSpan={5} className="mbf-group-header">SALIDA (lbs)</th>
                <th colSpan={3} className="mbf-group-header">PRODUCTO EN STOCK (lbs)</th>
                <th rowSpan={2} style={{ width: 75 }}>PÉRDIDAS<br/>(lbs)</th>
                <th rowSpan={2} style={{ width: 95 }}>% RENDIMIENTO<br/>DEL PROCESO</th>
                <th rowSpan={2} style={{ width: 95 }}>% PRODUCTO<br/>RECUPERADO</th>
                <th rowSpan={2} style={{ width: 120 }}>COMENTARIO</th>
                <th rowSpan={2} className="no-print mbf-th-action">—</th>
              </tr>
              <tr>
                <th>PRODUCTO</th><th>LOTE</th><th>CANT.</th>
                <th>PRODUCTO</th><th>LOTE</th><th>CANT.</th><th>RECORTES</th><th>SUBPROD</th>
                <th>PRODUCTO</th><th>LOTE</th><th>CANT.</th>
              </tr>
            </thead>
            <tbody>
              {balanceFilas.map((row, idx) => {
                const rendProc = pct(n(row.salCant) + n(row.recortes) + n(row.subprod), row.entCant);
                const rendRec = pct(row.salCant, row.entCant);
                const perdidas = (n(row.entCant) - n(row.salCant) - n(row.recortes) - n(row.subprod) - n(row.stkCant)).toFixed(2);
                return (
                  <tr key={idx}>
                    <td><input className="mbf-input" value={row.proceso} onChange={e => updRow(setBalanceFilas, idx, 'proceso', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.entProducto} onChange={e => updRow(setBalanceFilas, idx, 'entProducto', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.entLote} onChange={e => updRow(setBalanceFilas, idx, 'entLote', e.target.value)} /></td>
                    <td><input className="mbf-input mbf-num" type="number" value={row.entCant} onChange={e => updRow(setBalanceFilas, idx, 'entCant', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.salProducto} onChange={e => updRow(setBalanceFilas, idx, 'salProducto', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.salLote} onChange={e => updRow(setBalanceFilas, idx, 'salLote', e.target.value)} /></td>
                    <td><input className="mbf-input mbf-num" type="number" value={row.salCant} onChange={e => updRow(setBalanceFilas, idx, 'salCant', e.target.value)} /></td>
                    <td><input className="mbf-input mbf-num" type="number" value={row.recortes} onChange={e => updRow(setBalanceFilas, idx, 'recortes', e.target.value)} /></td>
                    <td><input className="mbf-input mbf-num" type="number" value={row.subprod} onChange={e => updRow(setBalanceFilas, idx, 'subprod', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.stkProducto} onChange={e => updRow(setBalanceFilas, idx, 'stkProducto', e.target.value)} /></td>
                    <td><input className="mbf-input" value={row.stkLote} onChange={e => updRow(setBalanceFilas, idx, 'stkLote', e.target.value)} /></td>
                    <td><input className="mbf-input mbf-num" type="number" value={row.stkCant} onChange={e => updRow(setBalanceFilas, idx, 'stkCant', e.target.value)} /></td>
                    <td className="mbf-calc-cell mbf-yellow">{n(row.entCant) > 0 ? perdidas : '—'}</td>
                    <td className="mbf-calc-cell mbf-yellow">{rendProc ? `${rendProc}%` : '—'}</td>
                    <td className="mbf-calc-cell mbf-yellow">{rendRec ? `${rendRec}%` : '—'}</td>
                    <td><input className="mbf-input" value={row.comentario} onChange={e => updRow(setBalanceFilas, idx, 'comentario', e.target.value)} /></td>
                    <td className="no-print mbf-td-action">
                      <button className="mbf-btn-rem" onClick={() => removeRow(setBalanceFilas, idx)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="mbf-btn-add no-print" onClick={() => addRow(setBalanceFilas, emptyBalanceFila)}>+ Agregar fila</button>
        </div>

        {/* ── OBSERVACIONES ── */}
        <div className="mbf-field-row" style={{ marginTop: '16px' }}>
          <span className="mbf-label-cell" style={{ minWidth: 130 }}>OBSERVACIONES</span>
          <textarea className="mbf-textarea" rows={3} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Observaciones generales..." />
        </div>

        {/* ── FIRMAS ── */}
        <div className="mbf-signatures">
          <div className="mbf-sign-box">
            <div className="mbf-sign-title">ELABORADO POR</div>
            <div className="mbf-sign-field">
              <span className="mbf-sign-label">NOMBRE</span>
              <input className="mbf-sign-input" value={elaboradoPor} onChange={e => setElaboradoPor(e.target.value)} placeholder="Nombre completo..." />
              <div className="mbf-sign-line" />
            </div>
          </div>
          <div className="mbf-sign-box">
            <div className="mbf-sign-title">REVISIÓN</div>
            <div className="mbf-sign-field">
              <span className="mbf-sign-label">NOMBRE</span>
              <input className="mbf-sign-input" value={revision} onChange={e => setRevision(e.target.value)} placeholder="Nombre completo..." />
              <div className="mbf-sign-line" />
            </div>
          </div>
        </div>

        {/* ── HISTORIAL DE CAMBIOS ── */}
        <div className="mbf-section-title" style={{ marginTop: '24px' }}>HISTORIAL DE CAMBIOS</div>
        <table className="mbf-table mbf-table--historial">
          <thead>
            <tr>
              <th style={{ width: 120 }}>FECHA</th>
              <th style={{ width: 90 }}>VERSIÓN</th>
              <th>DESCRIPCIÓN DEL CAMBIO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3/18/2025</td><td>1</td><td>Se actualiza a la nueva codificación interna</td>
            </tr>
            <tr>
              <td>10/2/2025</td><td>2</td><td>Se añade el casillero de libras proyectadas según guia de movilización</td>
            </tr>
          </tbody>
        </table>

      </div>{/* / mbf-print-area */}
        </>
      )}
    </div>
  );
}
