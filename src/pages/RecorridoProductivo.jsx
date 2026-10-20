import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ETAPAS,
  COMPLEMENTARIAS,
  contarPorPlantilla,
  contarPendientesFirma,
  cargarDetalleEtapa,
  consolidar,
  etiquetaRango,
} from '../utils/recorridoProductivo';
import { ultimosDias } from '../utils/rangoFechas';
import './RecorridoProductivo.css';

const nf = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 });

const fmt = (n) => (Number.isFinite(n) ? nf.format(n) : '—');

const fechaCorta = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}` : String(iso);
};

function Kpi({ label, valor, unidad, tono = '' }) {
  return (
    <div className={`rp-kpi ${tono ? `rp-kpi-${tono}` : ''}`}>
      <span className="rp-kpi-label">{label}</span>
      <b className="rp-kpi-valor">
        {valor}
        {unidad ? <em>{unidad}</em> : null}
      </b>
    </div>
  );
}

export default function RecorridoProductivo() {
  const inicial = useMemo(() => ultimosDias(7), []);

  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [etapaSel, setEtapaSel] = useState('co');

  const [conteos, setConteos] = useState(new Map());
  const [pendientes, setPendientes] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [refresco, setRefresco] = useState(0);

  const [detalle, setDetalle] = useState({
    cargando: false,
    lecturas: [],
    parcial: false,
    error: '',
  });

  /* Conteos por plantilla + firmas pendientes */
  useEffect(() => {
    let vivo = true;

    (async () => {
      setCargando(true);
      setError('');
      try {
        const [c, p] = await Promise.all([
          contarPorPlantilla(desde, hasta),
          contarPendientesFirma(),
        ]);
        if (!vivo) return;
        setConteos(c);
        setPendientes(p);
      } catch (e) {
        if (vivo) setError(e.message || 'No se pudieron leer los formularios.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [desde, hasta, refresco]);

  /* Detalle de la etapa elegida */
  useEffect(() => {
    let vivo = true;
    const etapa = ETAPAS.find((e) => e.id === etapaSel);
    if (!etapa) return undefined;

    (async () => {
      setDetalle({ cargando: true, lecturas: [], parcial: false, error: '' });
      try {
        const r = await cargarDetalleEtapa(etapa, desde, hasta);
        if (!vivo) return;
        setDetalle({ cargando: false, lecturas: r.lecturas, parcial: r.parcial, error: '' });
      } catch (e) {
        if (vivo) {
          setDetalle({
            cargando: false,
            lecturas: [],
            parcial: false,
            error: e.message || 'No se pudo leer el detalle de la etapa.',
          });
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, [etapaSel, desde, hasta, refresco]);

  const resumenDe = (etapa) => {
    let total = 0;
    let activas = 0;
    let porFirmar = 0;
    let ultimo = null;

    for (const p of etapa.plantillas) {
      const c = conteos.get(p.id);
      total += c?.total || 0;
      if ((c?.total || 0) > 0) activas += 1;
      porFirmar += pendientes.get(p.id) || 0;
      if (c?.ultimo?.fechaRegistro && (!ultimo || c.ultimo.fechaRegistro > ultimo)) {
        ultimo = c.ultimo.fechaRegistro;
      }
    }

    return { total, activas, porFirmar, ultimo };
  };

  const totalRango = useMemo(() => {
    let t = 0;
    for (const e of ETAPAS) t += resumenDe(e).total;
    return t;
  }, [conteos, pendientes]);

  const seleccionada = ETAPAS.find((e) => e.id === etapaSel) || ETAPAS[0];
  const resumenSel = resumenDe(seleccionada);
  const consolidado = useMemo(() => consolidar(detalle.lecturas), [detalle.lecturas]);

  const productos = useMemo(
    () =>
      [...consolidado.porProducto.values()]
        .filter((p) => p.lbs > 0)
        .sort((a, b) => b.lbs - a.lbs)
        .slice(0, 12),
    [consolidado]
  );

  const dias = useMemo(
    () => [...consolidado.porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    [consolidado]
  );

  const maxDia = Math.max(...dias.map(([, n]) => n), 1);

  const registros = useMemo(
    () =>
      [...consolidado.porFormulario]
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        .slice(0, 30),
    [consolidado]
  );

  const aplicarUltimosDias = () => {
    const r = ultimosDias(7);
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  const cambiarDesde = (valor) => {
    setDesde(valor);
    if (valor && hasta && valor > hasta) setHasta(valor);
  };

  const cambiarHasta = (valor) => {
    setHasta(valor);
    if (valor && desde && valor < desde) setDesde(valor);
  };

  return (
    <div className="rp-page">
      <header className="rp-head">
        <div>
          <div className="rp-eyebrow">Producción</div>
          <h1 className="rp-h1">Recorrido productivo</h1>
        </div>

        <div className="rp-fechas">
          <input
            type="date"
            className="rp-input"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => cambiarDesde(e.target.value)}
            aria-label="Desde"
          />
          <span className="rp-flecha">→</span>
          <input
            type="date"
            className="rp-input"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => cambiarHasta(e.target.value)}
            aria-label="Hasta"
          />
          <button type="button" className="rp-btn" onClick={aplicarUltimosDias}>
            7 días
          </button>
          <button
            type="button"
            className="rp-btn"
            onClick={() => setRefresco((n) => n + 1)}
          >
            Actualizar
          </button>
        </div>
      </header>

      <div className="rp-resumen">
        <span className="rp-resumen-rango">{etiquetaRango(desde, hasta)}</span>
        <span className="rp-punto" />
        <span>
          <b>{cargando ? '…' : fmt(totalRango)}</b> registros en el recorrido
        </span>
        <span className="rp-punto" />
        <span>
          <b>{ETAPAS.length}</b> etapas
        </span>
      </div>

      {error && <div className="rp-error">{error}</div>}

      {/* Flujo de etapas */}
      <div className="rp-flow" role="list">
        {ETAPAS.map((etapa) => {
          const r = resumenDe(etapa);
          const activa = etapa.id === etapaSel;
          return (
            <button
              key={etapa.id}
              type="button"
              role="listitem"
              className={`rp-etapa ${activa ? 'on' : ''} ${r.total === 0 ? 'vacia' : ''}`}
              onClick={() => setEtapaSel(etapa.id)}
            >
              <div className="rp-etapa-top">
                <span className="rp-etapa-num">{etapa.numero}</span>
                <span className="rp-etapa-count">{cargando ? '·' : r.total}</span>
              </div>
              <div className="rp-etapa-nombre">{etapa.nombre}</div>
              <div className="rp-etapa-detalle">{etapa.detalle}</div>
              <div className="rp-etapa-codigos">
                {etapa.plantillas.map((p) => p.codigo).join(' · ')}
              </div>
              <div className="rp-etapa-pie">
                <span>
                  {r.activas}/{etapa.plantillas.length} con registros
                </span>
                {r.porFirmar > 0 && <span className="rp-pend">{r.porFirmar} por firmar</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Fuente complementaria */}
      <div className="rp-complemento">
        <span className="rp-complemento-t">
          Fuente complementaria · productividad y personal
        </span>
        <div className="rp-chips">
          {COMPLEMENTARIAS.map((p) => (
            <span key={p.id} className="rp-chip" title={p.nombre}>
              <b>{conteos.get(p.id)?.total ?? 0}</b>
              {p.codigo}
            </span>
          ))}
        </div>
      </div>

      {/* Detalle de la etapa */}
      <section className="rp-detalle">
        <header className="rp-detalle-head">
          <div>
            <div className="rp-detalle-num">{seleccionada.numero}</div>
            <h2>{seleccionada.nombre}</h2>
            <p>{seleccionada.detalle}</p>
          </div>
          <div className="rp-detalle-total">
            <b>{fmt(resumenSel.total)}</b>
            <span>registros en el rango</span>
          </div>
        </header>

        <div className="rp-plantillas">
          {seleccionada.plantillas.map((p) => {
            const c = conteos.get(p.id);
            return (
              <div key={p.id} className={`rp-plantilla ${!c?.total ? 'sin-datos' : ''}`}>
                <div className="rp-plantilla-codigo">{p.codigo}</div>
                <div className="rp-plantilla-nombre" title={p.nombre}>
                  {p.nombre}
                </div>
                <div className="rp-plantilla-pie">
                  <b>{c?.total ?? 0}</b>
                  <span>
                    {c?.ultimo?.fechaRegistro
                      ? `último ${fechaCorta(c.ultimo.fechaRegistro)}`
                      : 'sin registros'}
                  </span>
                  {(pendientes.get(p.id) || 0) > 0 && (
                    <span className="rp-pend">{pendientes.get(p.id)} por firmar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {detalle.cargando ? (
          <div className="rp-vacio">Leyendo los formularios de la etapa…</div>
        ) : detalle.error ? (
          <div className="rp-error">{detalle.error}</div>
        ) : detalle.lecturas.length === 0 ? (
          <div className="rp-vacio">No hay registros de esta etapa en el rango elegido.</div>
        ) : (
          <>
            {detalle.parcial && (
              <div className="rp-aviso">
                El rango tiene más registros de los que se pueden leer de una vez. Los
                indicadores son sobre una muestra; achicá las fechas para el total exacto.
              </div>
            )}

            <div className="rp-kpis">
              <Kpi label="Salida neta" valor={fmt(consolidado.neto)} unidad="lb" />
              <Kpi
                label="Entrada"
                valor={consolidado.bruto ? fmt(consolidado.bruto) : '—'}
                unidad={consolidado.bruto ? 'lb' : ''}
              />
              <Kpi
                label="Rendimiento"
                valor={consolidado.rendimiento === null ? '—' : fmt(consolidado.rendimiento)}
                unidad={consolidado.rendimiento === null ? '' : '%'}
              />
              <Kpi
                label="Reempaque"
                valor={consolidado.reempaque ? fmt(consolidado.reempaque) : '—'}
                unidad={consolidado.reempaque ? 'lb' : ''}
              />
              <Kpi
                label="Lb por persona"
                valor={consolidado.productividad === null ? '—' : fmt(consolidado.productividad)}
                unidad={consolidado.productividad === null ? '' : 'lb'}
              />
              <Kpi
                label="Por firmar"
                valor={fmt(resumenSel.porFirmar)}
                tono={resumenSel.porFirmar > 0 ? 'ambar' : ''}
              />
              <Kpi label="Formularios" valor={fmt(consolidado.formularios)} />
            </div>

            <div className="rp-columnas">
              <div className="rp-bloque">
                <h3>
                  Producto y clasificación <span>{productos.length}</span>
                </h3>
                {productos.length === 0 ? (
                  <p className="rp-nota">
                    Los formularios de esta etapa no traen producto con libras netas.
                  </p>
                ) : (
                  <table className="rp-tabla">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Clasificación</th>
                        <th className="num">Lb netas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={`${p.producto}-${p.clasificacion}`}>
                          <td title={p.producto}>{p.producto}</td>
                          <td>{p.clasificacion || '—'}</td>
                          <td className="num">{fmt(p.lbs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rp-bloque">
                <h3>
                  Actividad del período <span>{dias.length} días</span>
                </h3>
                {dias.length === 0 ? (
                  <p className="rp-nota">Sin fechas registradas.</p>
                ) : (
                  <div className="rp-barras">
                    {dias.map(([fecha, n]) => (
                      <div className="rp-barra" key={fecha} title={`${fecha}: ${n} formularios`}>
                        <span className="rp-barra-fecha">{fechaCorta(fecha)}</span>
                        <span className="rp-barra-pista">
                          <span
                            className="rp-barra-valor"
                            style={{ width: `${Math.round((n / maxDia) * 100)}%` }}
                          />
                        </span>
                        <span className="rp-barra-n">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rp-bloque">
              <h3>
                Registros del período <span>{consolidado.formularios}</span>
              </h3>
              <div className="rp-tabla-scroll">
                <table className="rp-tabla">
                  <thead>
                    <tr>
                      <th>Formulario</th>
                      <th>Fecha</th>
                      <th>Lote</th>
                      <th>Llenado por</th>
                      <th className="num">Lb netas</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r) => (
                      <tr key={r.formID}>
                        <td className="rp-mono">{r.codigo}</td>
                        <td>{fechaCorta(r.fecha)}</td>
                        <td className="rp-mono">{r.lote || '—'}</td>
                        <td title={r.usuario}>{r.usuario || '—'}</td>
                        <td className="num">{r.neto ? fmt(r.neto) : '—'}</td>
                        <td className="num">
                          <Link className="rp-link" to="/view-forms" state={{ viewFormId: r.formID }}>
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
