import { useState, useEffect, useMemo } from 'react';
import { getLotesDisponibles } from '../hooks/useLoteStore';
import './LoteTrazabilidadPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const n = (v) => Number.parseFloat(v) || 0;
const emptyLoteOut = (idx) => ({
  _id: `out_${Date.now()}_${idx}`,
  lote: '',
  producto: '',
  clasificacion: 'Especial',
  pesoNeto: '',
});
const emptyDesperdicio = (idx) => ({
  _id: `des_${Date.now()}_${idx}`,
  tipo: 'Aserrín',
  peso: '',
});

const TIPOS_DESPERDICIO = ['Aserrín', 'Vísceras', 'Recortes', 'Merma por frío', 'Rechazo calidad', 'Otro'];
const CLASIFICACIONES = ['Especial', 'Entero', '1-2 lbs Fletch', '2-3 lbs Fletch', '3+ lbs Fletch', '4-8 oz', 'Colas', 'Seagr'];

/**
 * LoteTrazabilidadPanel
 * Panel que aparece dentro de un formulario cuando el template tiene
 * hasTrazabilidad activo. Registra:
 *  - Lote de origen + proceso + producto + peso entrada (bruto)
 *  - Lotes generados (salida) con clasificación y peso neto
 *  - Desperdicios (tipo + peso)
 *  - Balance: ENTRADA - DESPERDICIO = PESO_NETO_DISPONIBLE
 *
 * Props:
 *  - onChange(data) — callback con toda la data como objeto serializable
 *  - initialData    — datos previos (para modo edición)
 *  - readOnly       — solo lectura (formularios ya guardados)
 */
export default function LoteTrazabilidadPanel({ onChange, initialData, readOnly = false }) {
  // ── Estado: Origen ──
  const [procesoOrigen, setProcesoOrigen] = useState(initialData?.procesoOrigen || '');
  const [loteOrigen, setLoteOrigen]       = useState(initialData?.loteOrigen || '');
  const [productoOrigen, setProductoOrigen] = useState(initialData?.productoOrigen || '');
  const [pesoEntrada, setPesoEntrada]     = useState(initialData?.pesoEntrada || '');

  // ── Estado: Lotes generados (salida) ──
  const [lotesOut, setLotesOut] = useState(
    initialData?.lotesGenerados?.length ? initialData.lotesGenerados : [emptyLoteOut(0)]
  );

  // ── Estado: Desperdicios ──
  const [desperdicios, setDesperdicios] = useState(
    initialData?.desperdicios?.length ? initialData.desperdicios : [emptyDesperdicio(0)]
  );

  // ── Lotes disponibles en inventario (para dropdown) ──
  const [lotesDisp, setLotesDisp] = useState([]);
  useEffect(() => {
    getLotesDisponibles()
      .then(data => setLotesDisp(data || []))
      .catch(() => setLotesDisp([]));
  }, []);

  // ── Cálculos de balance ──
  const totalDesperdicio = useMemo(() =>
    desperdicios.reduce((s, d) => s + n(d.peso), 0), [desperdicios]);

  const pesoNetoDisponible = useMemo(() =>
    Math.max(0, n(pesoEntrada) - totalDesperdicio), [pesoEntrada, totalDesperdicio]);

  const totalPesoOut = useMemo(() =>
    lotesOut.reduce((s, l) => s + n(l.pesoNeto), 0), [lotesOut]);

  const diferencia = useMemo(() =>
    n(pesoNetoDisponible) - totalPesoOut, [pesoNetoDisponible, totalPesoOut]);

  const isBalanced = Math.abs(diferencia) <= 0.1 && n(pesoEntrada) > 0;

  // ── Propagar cambios al padre ──
  useEffect(() => {
    if (onChange) {
      onChange({
        procesoOrigen,
        loteOrigen,
        productoOrigen,
        pesoEntrada: n(pesoEntrada),
        lotesGenerados: lotesOut,
        desperdicios,
        totalDesperdicio,
        pesoNetoDisponible,
        totalPesoOut,
        isBalanced,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoOrigen, loteOrigen, productoOrigen, pesoEntrada, lotesOut, desperdicios]);

  // ── Handlers ──
  const updOut = (idx, field, val) =>
    setLotesOut(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const updDes = (idx, field, val) =>
    setDesperdicios(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const addOut = () => setLotesOut(prev => [...prev, emptyLoteOut(prev.length)]);
  const removeOut = (idx) => setLotesOut(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const addDes = () => setDesperdicios(prev => [...prev, emptyDesperdicio(prev.length)]);
  const removeDes = (idx) => setDesperdicios(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  // ── Al seleccionar un lote del inventario ──
  const onSelectLoteDisp = (loteNum) => {
    setLoteOrigen(loteNum);
    const loteData = lotesDisp.find(l => l.lote === loteNum);
    if (loteData) {
      setProductoOrigen(loteData.producto || '');
      setPesoEntrada(loteData.pesoNeto || loteData.pesoEntrada || '');
      setProcesoOrigen(loteData.proceso || '');
    }
  };

  return (
    <div className="ltp-panel">
      <div className="ltp-header">
        <span className="ltp-icon">🔗</span>
        <h3 className="ltp-title">Trazabilidad de Lotes</h3>
        <span className={`ltp-badge ${isBalanced && n(pesoEntrada) > 0 ? 'ok' : n(pesoEntrada) > 0 ? 'warn' : 'idle'}`}>
          {n(pesoEntrada) > 0
            ? isBalanced ? '✅ Balance OK' : `⚠️ Diff: ${diferencia.toFixed(1)} lbs`
            : 'Ingresa peso de entrada'}
        </span>
      </div>

      {/* ── SECCIÓN ORIGEN ── */}
      <div className="ltp-section">
        <div className="ltp-section-title">📥 Origen del proceso</div>
        <div className="ltp-grid-4">
          {/* Lote origen: dropdown de lotes disponibles O texto libre */}
          <div className="ltp-field">
            <label>Lote de origen</label>
            {lotesDisp.length > 0 ? (
              <div className="ltp-combo">
                <select
                  value={loteOrigen}
                  onChange={e => onSelectLoteDisp(e.target.value)}
                  disabled={readOnly}
                  className="ltp-select"
                >
                  <option value="">— Seleccionar lote inventario —</option>
                  {lotesDisp.map(l => (
                    <option key={l.id} value={l.lote}>
                      {l.lote} — {l.producto} ({l.pesoNeto} lbs disp.)
                    </option>
                  ))}
                </select>
                <span className="ltp-combo-or">ó</span>
                <input
                  className="ltp-input"
                  placeholder="Ingresa manualmente"
                  value={loteOrigen}
                  onChange={e => setLoteOrigen(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            ) : (
              <input
                className="ltp-input"
                placeholder="Ej: 260511"
                value={loteOrigen}
                onChange={e => setLoteOrigen(e.target.value)}
                disabled={readOnly}
              />
            )}
          </div>

          <div className="ltp-field">
            <label>Proceso de origen</label>
            <input
              className="ltp-input"
              placeholder="Ej: Fileteo, Corte, Congelación…"
              value={procesoOrigen}
              onChange={e => setProcesoOrigen(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="ltp-field">
            <label>Producto</label>
            <input
              className="ltp-input"
              placeholder="Ej: Mahi Mahi, Tilapia…"
              value={productoOrigen}
              onChange={e => setProductoOrigen(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="ltp-field">
            <label>Peso de entrada (lbs)</label>
            <input
              className="ltp-input ltp-num"
              type="number"
              placeholder="0.00"
              value={pesoEntrada}
              onChange={e => setPesoEntrada(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* ── SECCIÓN DESPERDICIOS ── */}
      <div className="ltp-section">
        <div className="ltp-section-title-row">
          <span className="ltp-section-title">🗑️ Desperdicios / Mermas</span>
          {!readOnly && <button className="ltp-btn-add" onClick={addDes}>+ Agregar</button>}
        </div>
        <table className="ltp-table">
          <thead>
            <tr>
              <th>Tipo de desperdicio</th>
              <th>Peso (lbs)</th>
              {!readOnly && <th style={{ width: 32 }}>—</th>}
            </tr>
          </thead>
          <tbody>
            {desperdicios.map((d, idx) => (
              <tr key={d._id}>
                <td>
                  <select
                    className="ltp-input"
                    value={d.tipo}
                    onChange={e => updDes(idx, 'tipo', e.target.value)}
                    disabled={readOnly}
                  >
                    {TIPOS_DESPERDICIO.map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="ltp-input ltp-num"
                    type="number"
                    value={d.peso}
                    onChange={e => updDes(idx, 'peso', e.target.value)}
                    disabled={readOnly}
                  />
                </td>
                {!readOnly && (
                  <td>
                    <button className="ltp-btn-rem" onClick={() => removeDes(idx)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── BALANCE ── */}
      {n(pesoEntrada) > 0 && (
        <div className={`ltp-balance ${isBalanced ? 'ok' : 'warn'}`}>
          <div className="ltp-bal-item">
            <span>ENTRADA</span>
            <strong>{n(pesoEntrada).toFixed(2)} lbs</strong>
          </div>
          <div className="ltp-bal-op">−</div>
          <div className="ltp-bal-item">
            <span>DESPERDICIO</span>
            <strong>{totalDesperdicio.toFixed(2)} lbs</strong>
          </div>
          <div className="ltp-bal-op">=</div>
          <div className="ltp-bal-item highlight">
            <span>PESO NETO DISPONIBLE</span>
            <strong>{pesoNetoDisponible.toFixed(2)} lbs</strong>
          </div>
        </div>
      )}

      {/* ── SECCIÓN LOTES GENERADOS (SALIDA) ── */}
      <div className="ltp-section">
        <div className="ltp-section-title-row">
          <span className="ltp-section-title">📤 Lotes generados (salida)</span>
          {!readOnly && <button className="ltp-btn-add" onClick={addOut}>+ Agregar lote</button>}
        </div>
        <table className="ltp-table ltp-table--out">
          <thead>
            <tr>
              <th>Número de lote</th>
              <th>Producto</th>
              <th>Clasificación</th>
              <th>Peso neto (lbs)</th>
              {!readOnly && <th style={{ width: 32 }}>—</th>}
            </tr>
          </thead>
          <tbody>
            {lotesOut.map((lo, idx) => (
              <tr key={lo._id}>
                <td>
                  <input
                    className="ltp-input"
                    placeholder="Ej: 260512"
                    value={lo.lote}
                    onChange={e => updOut(idx, 'lote', e.target.value)}
                    disabled={readOnly}
                  />
                </td>
                <td>
                  <input
                    className="ltp-input"
                    placeholder="Producto"
                    value={lo.producto}
                    onChange={e => updOut(idx, 'producto', e.target.value)}
                    disabled={readOnly}
                  />
                </td>
                <td>
                  <select
                    className="ltp-input"
                    value={lo.clasificacion}
                    onChange={e => updOut(idx, 'clasificacion', e.target.value)}
                    disabled={readOnly}
                  >
                    {CLASIFICACIONES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="ltp-input ltp-num"
                    type="number"
                    placeholder="0.00"
                    value={lo.pesoNeto}
                    onChange={e => updOut(idx, 'pesoNeto', e.target.value)}
                    disabled={readOnly}
                  />
                </td>
                {!readOnly && (
                  <td>
                    <button className="ltp-btn-rem" onClick={() => removeOut(idx)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="ltp-total-row">
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total salida:</td>
              <td className={`ltp-total-val ${totalPesoOut > pesoNetoDisponible && n(pesoEntrada) > 0 ? 'over' : ''}`}>
                {totalPesoOut.toFixed(2)} lbs
                {totalPesoOut > pesoNetoDisponible && n(pesoEntrada) > 0 &&
                  <span className="ltp-over-warn"> ⚠️ supera disponible</span>}
              </td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>

        {n(pesoEntrada) > 0 && (
          <div className="ltp-diff-bar">
            <span>Restante sin asignar:</span>
            <strong className={diferencia < 0 ? 'ltp-neg' : ''}>
              {diferencia.toFixed(2)} lbs
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
