import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../apiConfig';
import { buscarCalculo, resumenCalculo } from '../utils/calculoCelda';
import CuadernoCelda from '../components/CuadernoCelda';
import './ResumenLotes.css';

/**
 * 📦 RESUMEN DE LOTES
 *
 * Cuánto pesó cada lote, sumando lo que se anotó en TODOS los formularios del
 * período. Hasta ahora eso había que armarlo a mano: abrir formulario por
 * formulario, buscar las columnas de peso y sumarlas en una calculadora — y
 * cuando un lote aparece en tres registros de días distintos, nadie lo hacía.
 *
 * Se arma en el navegador con el mismo endpoint que usa "Descargar Datos"
 * (FilledForms/erp-report), que ya está en producción: no hace falta nada nuevo
 * del lado del servidor.
 */

const TANDA = 200;          // registros por pedido
const MAX_REGISTROS = 3000; // freno para no colgar el navegador

// ── Qué columna es un peso ───────────────────────────────────────────────────
// La tara y el peso bruto no se suman: la tara es el envase y el bruto ya está
// contado dentro del neto. Sumarlos infla el total del lote.
const ES_PESO = /(PESO|LIBRA|LBS?\b|KILO|KG\b)/i;
const NO_ES_PESO = /(TARA|BRUTO|PROMEDIO|UNITARIO)/i;

const esColumnaDePeso = (clave) => ES_PESO.test(clave) && !NO_ES_PESO.test(clave);

// El peso del cartón, de las fundas y del plástico también dice "PESO", pero no
// es producto: sumarlo al lote da un total que no existe. Se separan y quedan
// fuera del total salvo que se pidan expresamente con el interruptor.
const ES_EMPAQUE = /(EMPAQUE|FUNDA|CART[OÓ]N|CARTON|MASTER|PL[AÁ]STICO|PLASTICO|VAC[IÍ]O|VACIO|ETIQUETA|CINTA|SUNCHO|INSUMO|CAJA)/i;

const parseNum = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n) => (Number.isFinite(n)
  ? n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—');

const safeParse = (txt, fallback) => {
  if (!txt) return fallback;
  try { return typeof txt === 'string' ? JSON.parse(txt) : txt; } catch { return fallback; }
};

const hoy = () => new Date().toISOString().split('T')[0];
const haceDias = (d) => new Date(Date.now() - d * 86400000).toISOString().split('T')[0];

/** El lote del encabezado: "Lote", "Lote de proceso"… y nunca el padre/hijo. */
const loteDelEncabezado = (hdr) => {
  const datos = hdr && typeof hdr === 'object' ? hdr : {};
  const clave = Object.keys(datos)
    .find(k => /LOTE/i.test(k) && !/PADRE|HIJO|ORIGEN/i.test(k) && String(datos[k] ?? '').trim());
  return clave ? String(datos[clave]).trim() : '';
};

const valorDelEncabezado = (hdr, regex) => {
  const datos = hdr && typeof hdr === 'object' ? hdr : {};
  const clave = Object.keys(datos).find(k => regex.test(k) && String(datos[k] ?? '').trim());
  return clave ? String(datos[clave]).trim() : '';
};

const ResumenLotes = () => {
  const [templates, setTemplates] = useState([]);
  const [registros, setRegistros] = useState([]);   // una entrada por peso anotado
  const [loading, setLoading]     = useState(false);
  const [progreso, setProgreso]   = useState(null);
  const [error, setError]         = useState('');
  const [abiertos, setAbiertos]   = useState({});   // lotes con el detalle desplegado
  const [incluirEmpaque, setIncluirEmpaque] = useState(false);
  const [cuaderno, setCuaderno]   = useState(null);

  const [filtros, setFiltros] = useState({
    inicio: haceDias(7),
    fin: hoy(),
    templateId: '',
    lote: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/Templates`);
        const data = await res.json();
        setTemplates(data.$values ?? data ?? []);
      } catch (e) {
        console.error('No se pudieron cargar las plantillas:', e);
      }
    })();
  }, []);

  // ── Traer los formularios del período y extraer cada peso ─────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    setRegistros([]);
    setProgreso(null);

    const base = `?inicio=${filtros.inicio}&fin=${filtros.fin}` +
      (filtros.templateId ? `&templateId=${filtros.templateId}` : '') +
      (filtros.lote.trim() ? `&lote=${encodeURIComponent(filtros.lote.trim())}` : '');

    try {
      const acumulado = [];
      let pagina = 1;

      while (true) {
        const url = `${API_BASE_URL}/FilledForms/erp-report${base}&pagina=${pagina}&tamano=${TANDA}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        const tanda = data.datos?.$values ?? data.datos ?? data.$values ?? data;
        if (!Array.isArray(tanda) || tanda.length === 0) break;

        acumulado.push(...tanda);
        setProgreso({ traidos: acumulado.length, total: data.total ?? acumulado.length });

        if (!data.hayMas || acumulado.length >= MAX_REGISTROS) break;
        pagina++;
      }

      setRegistros(extraerPesos(acumulado));
    } catch (e) {
      console.error('Error cargando el resumen de lotes:', e);
      setError(e.message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
      setProgreso(null);
    }
  }, [filtros]);

  // Proceso de cada plantilla: es lo que responde "¿en qué etapa se pesó esto?"
  const procesoDe = useCallback((templateId, nombre) => {
    const t = templates.find(x => String(x.templateID) === String(templateId));
    return t?.proceso || nombre || '';
  }, [templates]);

  /**
   * Una entrada por cada peso anotado en el período.
   * El lote sale de la fila si la tabla tiene columna de lote; si no, del
   * encabezado del formulario, que es como se llenan la mayoría.
   */
  const extraerPesos = (forms) => {
    const salida = [];

    forms.forEach(form => {
      const hdr = safeParse(form.headerData, {});
      const header = Array.isArray(hdr) ? (hdr[0] ?? {}) : hdr;
      const loteHdr = loteDelEncabezado(header);
      const especie = valorDelEncabezado(header, /ESPECIE/i);
      const fecha = (form.createdAt || '').split('T')[0];

      const body = safeParse(form.bodyData, []);
      const elementos = Array.isArray(body)
        ? body
        : Object.values(body || {}).filter(v => v && typeof v === 'object');

      elementos.forEach((el, elIdx) => {
        const filas = el?.data ?? el?.rows;
        if (!Array.isArray(filas)) return;
        const tabla = el.title || el.name || `Tabla ${elIdx + 1}`;

        filas.forEach((fila, fi) => {
          if (!fila || typeof fila !== 'object' || fila._deleted) return;

          // Lote propio de la fila (tablas que lo traen columna por columna)
          const claveLoteFila = Object.keys(fila)
            .find(k => !k.startsWith('_') && /LOTE/i.test(k) && !/PADRE|HIJO/i.test(k) && String(fila[k] ?? '').trim());
          const lote = claveLoteFila ? String(fila[claveLoteFila]).trim() : loteHdr;
          if (!lote) return;   // sin lote no hay a qué sumarlo

          Object.entries(fila).forEach(([clave, valor]) => {
            if (clave.startsWith('_')) return;          // datos internos de la fila
            if (!esColumnaDePeso(clave)) return;
            const peso = parseNum(valor);
            if (peso === null || peso === 0) return;

            salida.push({
              lote,
              especie,
              proceso: procesoDe(form.templateID, form.templateName),
              formID: form.formID,
              formCode: form.formCode || '',
              formNombre: form.templateName || '',
              fecha,
              tabla,
              columna: clave,
              fila: fi + 1,
              peso,
              esEmpaque: ES_EMPAQUE.test(clave),
              // 📓 Si ese peso se calculó con la calculadora, viaja el desglose
              cuaderno: buscarCalculo(fila, [clave]),
            });
          });
        });
      });
    });

    return salida;
  };

  // Los pesos que entran al total. El empaque queda fuera por defecto: es peso
  // de material, no de producto.
  const registrosVisibles = useMemo(
    () => (incluirEmpaque ? registros : registros.filter(r => !r.esEmpaque)),
    [registros, incluirEmpaque]
  );

  const pesosDeEmpaque = useMemo(
    () => registros.filter(r => r.esEmpaque).length,
    [registros]
  );

  // ── Agrupado por lote ─────────────────────────────────────────────────────
  const porLote = useMemo(() => {
    const mapa = new Map();

    registrosVisibles.forEach(r => {
      if (!mapa.has(r.lote)) {
        mapa.set(r.lote, {
          lote: r.lote,
          total: 0,
          registros: [],
          procesos: new Set(),
          formularios: new Set(),
          especies: new Set(),
          fechas: new Set(),
          // Cuánto puso cada formulario en el total del lote, con su proceso:
          // el total suelto no dice de dónde salió, y un lote suele pasar por
          // dos o tres registros de etapas distintas.
          porFormulario: new Map(),
        });
      }
      const g = mapa.get(r.lote);
      g.total += r.peso;
      g.registros.push(r);
      if (r.proceso) g.procesos.add(r.proceso);
      if (r.especie) g.especies.add(r.especie);
      g.formularios.add(r.formID);
      if (r.fecha) g.fechas.add(r.fecha);

      if (!g.porFormulario.has(r.formID)) {
        g.porFormulario.set(r.formID, {
          formID: r.formID,
          codigo: r.formCode,
          nombre: r.formNombre,
          proceso: r.proceso,
          fecha: r.fecha,
          total: 0,
          pesos: [],
        });
      }
      const pf = g.porFormulario.get(r.formID);
      pf.total += r.peso;
      pf.pesos.push(r);
    });

    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [registrosVisibles]);

  const totalGeneral = useMemo(
    () => porLote.reduce((acc, g) => acc + g.total, 0),
    [porLote]
  );

  const toggle = (lote) => setAbiertos(prev => ({ ...prev, [lote]: !prev[lote] }));

  /**
   * El mismo cuadrito de la calculadora, pero para un TOTAL: cada peso que lo
   * compone es un renglón. Así el total del lote se puede revisar sin abrir
   * formulario por formulario.
   */
  const verSumaDelTotal = (titulo, pesos, total) => setCuaderno({
    encabezado: '➕ Cómo se suma este total',
    titulo,
    detalle: { op: '+', valores: pesos.map(p => fmt(p.peso)) },
    resultado: fmt(total),
    nota: 'pesos que forman el total',
    etiquetaValores: '⚖️ Pesos sumados',
  });

  // ── Excel: una pestaña con el resumen y otra con el detalle ───────────────
  const descargarExcel = () => {
    const wb = XLSX.utils.book_new();

    const resumen = porLote.map(g => ({
      LOTE: g.lote,
      ESPECIE: [...g.especies].join(' / '),
      PROCESO: [...g.procesos].join(' / '),
      FECHAS: [...g.fechas].sort().join(' · '),
      FORMULARIOS: g.formularios.size,
      REGISTROS: g.registros.length,
      'TOTAL LB': Number(g.total.toFixed(2)),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumen, {
        header: ['LOTE', 'ESPECIE', 'PROCESO', 'FECHAS', 'FORMULARIOS', 'REGISTROS', 'TOTAL LB'],
      }),
      'Resumen'
    );

    const detalle = registrosVisibles.map(r => ({
      LOTE: r.lote,
      ESPECIE: r.especie,
      PROCESO: r.proceso,
      FECHA: r.fecha,
      FORMULARIO: r.formCode ? `${r.formCode} · ${r.formNombre}` : r.formNombre,
      'N° REGISTRO': r.formID,
      TABLA: r.tabla,
      COLUMNA: r.columna,
      FILA: r.fila,
      PESO: Number(r.peso.toFixed(2)),
      'CÓMO SE CALCULÓ': r.cuaderno ? resumenCalculo(r.cuaderno) : '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detalle, {
        header: ['LOTE', 'ESPECIE', 'PROCESO', 'FECHA', 'FORMULARIO', 'N° REGISTRO',
                 'TABLA', 'COLUMNA', 'FILA', 'PESO', 'CÓMO SE CALCULÓ'],
      }),
      'Detalle'
    );

    XLSX.writeFile(wb, `Resumen_Lotes_${filtros.inicio}_${filtros.fin}.xlsx`);
  };

  return (
    <div className="resumen-lotes">
      <div className="rl-header">
        <div>
          <h1>📦 Resumen de Lotes</h1>
          <p className="rl-sub">
            Todos los pesos anotados en los formularios del período, sumados por lote.
          </p>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="rl-filtros">
        <div className="rl-campo">
          <label>Desde</label>
          <input
            type="date" value={filtros.inicio}
            onChange={e => setFiltros(f => ({ ...f, inicio: e.target.value }))}
          />
        </div>
        <div className="rl-campo">
          <label>Hasta</label>
          <input
            type="date" value={filtros.fin}
            onChange={e => setFiltros(f => ({ ...f, fin: e.target.value }))}
          />
        </div>
        <div className="rl-campo rl-campo-ancho">
          <label>Formulario</label>
          <select
            value={filtros.templateId}
            onChange={e => setFiltros(f => ({ ...f, templateId: e.target.value }))}
          >
            <option value="">Todos los formularios</option>
            {templates.map(t => (
              <option key={t.templateID} value={t.templateID}>
                {t.codigo ? `${t.codigo} · ` : ''}{t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="rl-campo">
          <label>Lote</label>
          <input
            type="text" placeholder="Todos…" value={filtros.lote}
            onChange={e => setFiltros(f => ({ ...f, lote: e.target.value }))}
          />
        </div>

        <label className="rl-switch" title="El peso de fundas, cartón y plástico no es producto: sumarlo da un total que no existe">
          <input
            type="checkbox"
            checked={incluirEmpaque}
            onChange={e => setIncluirEmpaque(e.target.checked)}
          />
          <span>
            📦 Incluir pesos de empaque
            {pesosDeEmpaque > 0 && !incluirEmpaque && (
              <em className="rl-switch-nota"> ({pesosDeEmpaque} fuera)</em>
            )}
          </span>
        </label>

        <button className="rl-btn-cargar" onClick={cargar} disabled={loading}>
          {loading ? '⏳ Cargando…' : '🔄 Cargar'}
        </button>
        <button
          className="rl-btn-excel"
          onClick={descargarExcel}
          disabled={registros.length === 0}
          title="Baja el resumen por lote y el detalle de cada peso"
        >
          📥 Excel
        </button>
      </div>

      {progreso && (
        <div className="rl-progreso">
          Trayendo registros… {progreso.traidos} de {progreso.total}
        </div>
      )}

      {error && <div className="rl-error">❌ {error}</div>}

      {/* ── TOTALES ── */}
      {registros.length > 0 && (
        <div className="rl-stats">
          <div className="rl-stat">
            <span className="rl-stat-val">{porLote.length}</span>
            <span className="rl-stat-lbl">Lotes</span>
          </div>
          <div className="rl-stat">
            <span className="rl-stat-val">{registrosVisibles.length}</span>
            <span className="rl-stat-lbl">Pesos anotados</span>
          </div>
          <div className="rl-stat rl-stat-total">
            <span className="rl-stat-val">{fmt(totalGeneral)}</span>
            <span className="rl-stat-lbl">Total lb</span>
          </div>
        </div>
      )}

      {/* Qué significa cada número: sin esto, "total" se lee como quiera cada uno */}
      {registros.length > 0 && (
        <div className="rl-leyenda">
          <span><strong>Lotes:</strong> lotes distintos encontrados en el período.</span>
          <span><strong>Pesos anotados:</strong> cada celda de peso cargada en un formulario (una fila puede tener varias).</span>
          <span><strong>Total lb:</strong> suma de esos pesos. No entra la tara, ni el peso bruto (ya está dentro del neto), ni el empaque salvo que lo pidas arriba.</span>
          <span><strong>📓</strong> = ese peso se calculó con la calculadora; el cuadrito muestra los números que se sumaron.</span>
        </div>
      )}

      {/* ── TABLA ── */}
      {registros.length === 0 && !loading ? (
        <p className="rl-vacio">
          📭 Elegí el rango de fechas y presiona <strong>Cargar</strong>.
          Si ya cargaste y no salió nada, en ese período no hay formularios con
          lote y columnas de peso.
        </p>
      ) : (
        <div className="rl-tabla-wrap">
          <table className="rl-tabla">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Lote</th>
                <th>Especie</th>
                <th>Proceso</th>
                <th>Fechas</th>
                <th>Formularios</th>
                <th className="rl-num">Pesos</th>
                <th className="rl-num">Total lb</th>
              </tr>
            </thead>
            <tbody>
              {porLote.map(g => (
                <React.Fragment key={g.lote}>
                  <tr className="rl-fila-lote" onClick={() => toggle(g.lote)}>
                    <td className="rl-toggle">{abiertos[g.lote] ? '▾' : '▸'}</td>
                    <td className="rl-lote">{g.lote}</td>
                    <td>{[...g.especies].join(' / ') || '—'}</td>
                    <td>{[...g.procesos].join(' / ') || '—'}</td>
                    <td className="rl-fechas">{[...g.fechas].sort().join(' · ')}</td>
                    <td className="rl-forms">
                      {[...g.porFormulario.values()].slice(0, 2).map(pf => (
                        <span key={pf.formID} className="rl-chip" title={`${pf.nombre} · ${pf.proceso} · ${fmt(pf.total)} lb`}>
                          {pf.codigo || pf.nombre} <em>#{pf.formID}</em>
                        </span>
                      ))}
                      {g.porFormulario.size > 2 && (
                        <span className="rl-chip rl-chip-mas">+{g.porFormulario.size - 2}</span>
                      )}
                    </td>
                    <td className="rl-num">{g.registros.length}</td>
                    <td className="rl-num rl-total">
                      {fmt(g.total)}
                      {/* El cuadrito con los pesos que forman este total */}
                      <button
                        className="rl-cuaderno rl-cuaderno-total"
                        onClick={(e) => {
                          e.stopPropagation();
                          verSumaDelTotal(`Lote ${g.lote} · total del período`, g.registros, g.total);
                        }}
                        title="Ver los pesos que suman este total"
                      >📓</button>
                    </td>
                  </tr>

                  {/* Detalle: de dónde sale cada libra del total */}
                  {abiertos[g.lote] && (
                    <tr className="rl-fila-detalle">
                      <td></td>
                      <td colSpan={7}>
                        {/* De qué formulario y proceso sale cada parte del total */}
                        <div className="rl-porform">
                          <div className="rl-porform-tit">Por formulario</div>
                          {[...g.porFormulario.values()]
                            .sort((a, b) => b.total - a.total)
                            .map(pf => (
                              <div key={pf.formID} className="rl-porform-fila">
                                <span className="rl-porform-form">
                                  {pf.codigo ? `${pf.codigo} · ` : ''}{pf.nombre} <em>#{pf.formID}</em>
                                </span>
                                <span className="rl-porform-proc">{pf.proceso || '—'}</span>
                                <span className="rl-porform-fecha">{pf.fecha}</span>
                                <span className="rl-porform-num">{pf.pesos.length} peso(s)</span>
                                <span className="rl-porform-total">{fmt(pf.total)} lb</span>
                                <button
                                  className="rl-cuaderno"
                                  onClick={() => verSumaDelTotal(
                                    `${pf.codigo || pf.nombre} #${pf.formID} · lote ${g.lote}`,
                                    pf.pesos, pf.total
                                  )}
                                  title="Ver los pesos que suman este total"
                                >📓 ver la suma</button>
                              </div>
                            ))}
                        </div>

                        <table className="rl-detalle">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Formulario</th>
                              <th>Tabla</th>
                              <th>Columna</th>
                              <th className="rl-num">Fila</th>
                              <th className="rl-num">Peso</th>
                              <th>Cómo se calculó</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.registros.map((r, i) => (
                              <tr key={`${r.formID}-${r.tabla}-${r.fila}-${r.columna}-${i}`}>
                                <td>{r.fecha}</td>
                                <td title={r.formNombre}>
                                  {r.formCode || r.formNombre} <span className="rl-id">#{r.formID}</span>
                                </td>
                                <td>{r.tabla}</td>
                                <td>{r.columna}</td>
                                <td className="rl-num">{r.fila}</td>
                                <td className="rl-num">{fmt(r.peso)}</td>
                                <td>
                                  {r.cuaderno ? (
                                    <button
                                      className="rl-cuaderno"
                                      onClick={() => setCuaderno({
                                        titulo: `Lote ${r.lote} · ${r.columna} · fila ${r.fila} · #${r.formID}`,
                                        detalle: r.cuaderno,
                                        resultado: String(r.peso),
                                      })}
                                      title="Ver de qué números salió este peso"
                                    >
                                      📓 {resumenCalculo(r.cuaderno)}
                                    </button>
                                  ) : (
                                    <span className="rl-manual">escrito a mano</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr className="rl-detalle-total">
                              <td colSpan={5}>TOTAL DEL LOTE</td>
                              <td className="rl-num">{fmt(g.total)}</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              <tr className="rl-fila-total">
                <td></td>
                <td colSpan={6}>TOTAL GENERAL · {porLote.length} lote(s)</td>
                <td className="rl-num rl-total">{fmt(totalGeneral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <CuadernoCelda
        abierta={!!cuaderno}
        titulo={cuaderno?.titulo || ''}
        detalle={cuaderno?.detalle || null}
        resultado={cuaderno?.resultado || ''}
        encabezado={cuaderno?.encabezado}
        etiquetaValores={cuaderno?.etiquetaValores}
        nota={cuaderno?.nota}
        onCerrar={() => setCuaderno(null)}
      />
    </div>
  );
};

export default ResumenLotes;
