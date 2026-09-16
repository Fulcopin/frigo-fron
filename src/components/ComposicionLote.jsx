// ====================================
// COMPOSICIÓN DE UN LOTE
// ====================================
// Responde las dos preguntas de una auditoría de trazabilidad:
//   · ¿De qué lotes está hecho este, y en qué porcentaje?
//   · Si uno de sus orígenes sale con problema, ¿cuánto producto retiro?
//
// Se usa dentro del Inventario de Lotes:
//   <ComposicionLote numeroLote="260720" onVerLote={setLoteActual} />

import { useState, useEffect, useCallback } from 'react';
import trazabilidadService from '../services/trazabilidadService';
import './ComposicionLote.css';

const fmt = (n) =>
  Number(n ?? 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Fila con barra proporcional. Muestra DOS porcentajes distintos:
 *  · porcentaje        — qué parte del lote de destino vino de este origen
 *  · porcentajeDelOrigen — qué parte de este lote se fue hacia allá
 * Confundirlos es fácil, así que el segundo va con su propia etiqueta.
 */
function Fila({ lote, detalle, cantidad, cantidadEnDestino, porcentaje, porcentajeDelOrigen, pesoOrigen, onVer, tono }) {
  // Se muestran las libras que HAY en el producto, no las que entraron: así la
  // columna suma el peso del lote y no el de la materia prima con su merma.
  const lbs = cantidadEnDestino > 0 ? cantidadEnDestino : cantidad;
  return (
    <li className="cl-fila">
      <button
        type="button"
        className="cl-lote"
        onClick={() => onVer && onVer(lote)}
        title={onVer ? `Ver la composición de ${lote}` : lote}
        disabled={!onVer}
      >
        {lote}
      </button>

      <div className="cl-barra-zona">
        <div className={`cl-barra cl-barra-${tono}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
        {detalle && <span className="cl-detalle" title={detalle}>{detalle}</span>}
      </div>

      <span
        className="cl-lbs"
        title={cantidadEnDestino > 0 && cantidadEnDestino !== cantidad
          ? `Entraron ${fmt(cantidad)} Lbs para producirlo; quedan ${fmt(lbs)} después de la merma`
          : undefined}
      >
        {fmt(lbs)} Lbs
      </span>
      <span className="cl-pct">{Number(porcentaje ?? 0).toFixed(2)}%</span>

      {Number(porcentajeDelOrigen) > 0 && (
        <span
          className="cl-pct-origen"
          title={`De las ${fmt(pesoOrigen)} Lbs del lote ${lote}, ${fmt(cantidad)} se usaron acá`}
        >
          usa {Number(porcentajeDelOrigen).toFixed(1)}% de {fmt(pesoOrigen)}
        </span>
      )}
    </li>
  );
}

/**
 * Nodo del mapa de trazabilidad. Se dibuja recursivo hacia arriba: cada lote
 * muestra de qué lotes viene, y esos de cuáles vienen, hasta la materia prima.
 */
function NodoMapa({ nodo, nivel = 0, onVer }) {
  const [abierto, setAbierto] = useState(nivel < 2);
  const padres = Array.isArray(nodo?.padres) ? nodo.padres : [];
  const tienePadres = padres.length > 0;

  return (
    <div className="cl-nodo" style={{ marginLeft: nivel === 0 ? 0 : 20 }}>
      <div className="cl-nodo-fila">
        <button
          type="button"
          className="cl-nodo-toggle"
          onClick={() => tienePadres && setAbierto(v => !v)}
          disabled={!tienePadres}
        >
          {tienePadres ? (abierto ? '▼' : '▶') : '◆'}
        </button>

        <button type="button" className="cl-lote" onClick={() => onVer && onVer(nodo.lote)}>
          {nodo.lote}
        </button>

        {nodo.esRaiz && <span className="cl-tag cl-tag-raiz">materia prima</span>}
        {nodo.truncado && <span className="cl-tag cl-tag-corte">nivel máximo</span>}

        {(nodo.producto || nodo.clasificacion) && (
          <span className="cl-nodo-prod">
            {[nodo.producto, nodo.clasificacion].filter(Boolean).join(' · ')}
          </span>
        )}

        {nivel > 0 && (
          <>
            <span className="cl-nodo-lbs">{fmt(nodo.cantidad)} Lbs</span>
            <span className="cl-nodo-pct" title="Aporte a su lote inmediato">
              {Number(nodo.porcentajeLocal ?? 0).toFixed(2)}%
            </span>
            {/* El acumulado solo se muestra si difiere del local: en el primer
                nivel son el mismo número y repetirlo confunde. */}
            {nivel > 1 && (
              <span className="cl-nodo-acum" title="Aporte al lote del que se pidió el mapa">
                → {Number(nodo.porcentajeTotal ?? 0).toFixed(2)}% del total
              </span>
            )}
          </>
        )}
      </div>

      {abierto && tienePadres && (
        <div className="cl-nodo-hijos">
          {padres.map((p, i) => (
            <NodoMapa key={`${p.lote}-${i}`} nodo={p} nivel={nivel + 1} onVer={onVer} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComposicionLote({ numeroLote, onVerLote }) {
  const [datos, setDatos] = useState(null);
  const [mapa, setMapa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!numeroLote) return;
    try {
      setLoading(true);
      setError('');
      // Las dos en paralelo: el mapa es lo caro y no debe demorar el resto.
      const [comp, mp] = await Promise.all([
        trazabilidadService.getComposicion(numeroLote),
        trazabilidadService.getMapa(numeroLote).catch(() => null),
      ]);
      setDatos(comp);
      setMapa(mp);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la composición del lote.');
      setDatos(null);
      setMapa(null);
    } finally {
      setLoading(false);
    }
  }, [numeroLote]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <div className="cl-loading">Cargando la composición de {numeroLote}…</div>;
  if (error) return <div className="cl-error">{error}</div>;
  if (!datos) return null;

  const lote = datos.lote || {};
  const padres = Array.isArray(datos.padresDirectos) ? datos.padresDirectos : [];
  const hijos = Array.isArray(datos.hijosDirectos) ? datos.hijosDirectos : [];
  const raices = Array.isArray(datos.origenesRaiz) ? datos.origenesRaiz : [];

  const totalHijos = hijos.reduce((s, h) => s + Number(h.cantidad || 0), 0);

  return (
    <div className="cl-panel">
      <div className="cl-cabecera">
        <h3>{lote.numeroLote}</h3>
        <div className="cl-meta">
          {lote.producto && <span>{lote.producto}</span>}
          {lote.clasificacion && <span>· {lote.clasificacion}</span>}
          {lote.proceso && <span>· {lote.proceso}</span>}
          <span className={`cl-estado cl-estado-${lote.estado}`}>{lote.estado}</span>
        </div>
        <div className="cl-pesos">
          <span><strong>{fmt(lote.pesoNeto)}</strong> Lbs neto</span>
          <span><strong>{fmt(lote.saldo)}</strong> Lbs disponibles</span>
        </div>
      </div>

      {datos.sinAristas && (
        <div className="cl-aviso">
          Este lote no tiene relaciones registradas. O es materia prima original, o el
          formulario que lo generó se guardó antes de que la plantilla estuviera configurada.
        </div>
      )}

      {padres.length > 0 && (
        <section className="cl-seccion">
          <h4>⬆️ De qué está hecho</h4>
          <p className="cl-sub">
            {padres.length} lote{padres.length === 1 ? '' : 's'} de origen · las libras suman el peso de
            este lote ({fmt(lote.pesoNeto)} Lbs), ya descontada la merma del proceso.
            El % grande es cuánto de <em>este</em> lote vino de ahí; el de la derecha, cuánto de
            <em> ese</em> lote se usó acá.
          </p>
          <ul className="cl-lista">
            {padres.map((p) => (
              <Fila
                key={p.lote}
                lote={p.lote}
                detalle={[p.producto, p.clasificacion].filter(Boolean).join(' · ')}
                cantidad={p.cantidad}
                cantidadEnDestino={p.cantidadEnDestino}
                porcentaje={p.porcentaje}
                porcentajeDelOrigen={p.porcentajeDelOrigen}
                pesoOrigen={p.pesoOrigen}
                onVer={onVerLote}
                tono="entrada"
              />
            ))}
          </ul>
        </section>
      )}

      {hijos.length > 0 && (
        <section className="cl-seccion">
          <h4>⬇️ A dónde fue</h4>
          <p className="cl-sub">
            {fmt(totalHijos)} Lbs salieron hacia {hijos.length} lote{hijos.length === 1 ? '' : 's'}.
            El porcentaje es cuánto de <em>ese</em> lote vino de acá — es lo que hay que retirar
            si este sale con problema.
          </p>
          <ul className="cl-lista">
            {hijos.map((h) => (
              <Fila
                key={h.lote}
                lote={h.lote}
                detalle={[h.producto, h.clasificacion].filter(Boolean).join(' · ')}
                cantidad={h.cantidad}
                cantidadEnDestino={h.cantidadEnDestino}
                porcentaje={h.porcentaje}
                porcentajeDelOrigen={h.porcentajeDelOrigen}
                pesoOrigen={h.pesoOrigen}
                onVer={onVerLote}
                tono="salida"
              />
            ))}
          </ul>
        </section>
      )}

      {mapa?.mapa && Array.isArray(mapa.mapa.padres) && mapa.mapa.padres.length > 0 && (
        <section className="cl-seccion">
          <h4>🗺️ Mapa de trazabilidad</h4>
          <p className="cl-sub">
            De dónde sale este lote, nivel por nivel, hasta la materia prima original
            ({mapa.niveles} nivel{mapa.niveles === 1 ? '' : 'es'}). El primer porcentaje es
            el aporte al lote de arriba; el segundo, al lote que estás viendo.
          </p>
          <div className="cl-mapa">
            <NodoMapa nodo={mapa.mapa} onVer={onVerLote} />
          </div>
        </section>
      )}

      {raices.length > 0 && (
        <section className="cl-seccion">
          <h4>🌱 Materia prima original</h4>
          <p className="cl-sub">
            Porcentajes multiplicados nivel por nivel, así que sirve aunque el producto haya
            pasado por varios procesos.
          </p>
          <ul className="cl-lista cl-lista-raiz">
            {raices.map((r) => (
              <li key={r.lote} className="cl-fila">
                <button
                  type="button"
                  className="cl-lote"
                  onClick={() => onVerLote && onVerLote(r.lote)}
                  disabled={!onVerLote}
                >
                  {r.lote}
                </button>
                <div className="cl-barra-zona">
                  <div className="cl-barra cl-barra-raiz" style={{ width: `${Math.min(r.porcentaje, 100)}%` }} />
                </div>
                <span className="cl-pct">{Number(r.porcentaje).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}