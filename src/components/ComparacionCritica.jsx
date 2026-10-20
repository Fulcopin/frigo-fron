import { useEffect, useMemo, useState } from 'react';
import {
  columnasNumericas,
  reglasPorDefecto,
  leerReglas,
  guardarReglas,
  evaluarReglas,
  OPERADORES,
  nuevoId,
  formatear as fmt,
} from '../utils/comparacionCritica';
import './ComparacionCritica.css';

const parsear = (valor, porDefecto) => {
  if (!valor) return porDefecto;
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return porDefecto;
  }
};

const CAMPOS = /FECHA|LOTE|ESPECIE|DESTINO|TURNO|CLIENTE|TIPO/i;

/**
 * Ventana de revisión que aparece antes de guardar una edición.
 *
 * Muestra los datos de encabezado y evalúa las reglas configuradas (por
 * ejemplo materia prima contra producto terminado). Si algo no cuadra,
 * muestra la advertencia pero NO impide guardar.
 *
 * Las reglas se editan dentro de la misma ventana y se recuerdan por
 * formulario (localStorage), sin tocar el backend.
 */
export default function ComparacionCritica({
  abierto,
  modo = 'guardar',
  codigo,
  nombre,
  headerData,
  bodyData,
  bodyElements,
  onCancelar,
  onGuardar,
}) {
  const columnas = useMemo(
    () => columnasNumericas(bodyData, bodyElements),
    [bodyData, bodyElements]
  );

  // Firma de las columnas: evita reiniciar la configuración cuando el
  // formulario se vuelve a dibujar (el arreglo de datos cambia de identidad).
  const firmaColumnas = columnas.map((c) => c.key).join('|');

  const [reglas, setReglas] = useState([]);
  const [configAbierta, setConfigAbierta] = useState(false);

  // Al abrir: se retoma la configuración guardada o se proponen reglas.
  useEffect(() => {
    if (!abierto) return;
    setConfigAbierta(false);
    const guardadas = leerReglas(codigo);
    setReglas(guardadas === null ? reglasPorDefecto(columnas) : guardadas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, codigo, firmaColumnas]);

  // Escape cierra sin guardar.
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, onCancelar]);

  const resultados = useMemo(() => evaluarReglas(columnas, reglas), [columnas, reglas]);
  const avisos = resultados.filter((r) => !r.cumple);

  // Columnas agrupadas por tabla, para comparar entre tablas distintas.
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const c of columnas) {
      if (!mapa.has(c.tabla)) mapa.set(c.tabla, []);
      mapa.get(c.tabla).push(c);
    }
    return [...mapa.entries()].map(([tabla, items]) => ({ tabla, items }));
  }, [columnas]);

  if (!abierto) return null;

  const opcionesColumnas = grupos.map((g) => (
    <optgroup key={g.tabla} label={g.tabla}>
      {g.items.map((c) => (
        <option key={c.key} value={c.key}>
          {c.columna} · {fmt(c.total)}
        </option>
      ))}
    </optgroup>
  ));

  const soloConsulta = modo === 'consulta';
  const encabezado = parsear(headerData, {}) || {};
  const datos = Object.entries(encabezado)
    .filter(([k, v]) => CAMPOS.test(k) && String(v ?? '').trim())
    .slice(0, 6);

  /* ── Edición de reglas (se guarda al instante) ─────────────────────────── */

  const aplicar = (siguiente) => {
    guardarReglas(codigo, siguiente);
    setReglas(siguiente);
  };

  const cambiar = (id, campo, valor) =>
    aplicar(
      reglas.map((r) => {
        if (r.id !== id) return r;
        const nueva = { ...r, [campo]: valor };

        // A y B siempre tienen que ser distintas: si se elige la columna que
        // ya estaba del otro lado, se intercambian.
        if (campo === 'aKey' && nueva.tipo !== 'valor' && valor === r.bKey) {
          nueva.bKey = r.aKey;
        }
        if (campo === 'bKey' && valor === r.aKey) {
          nueva.aKey = r.bKey;
        }

        return nueva;
      })
    );

  const agregar = () => {
    const usadas = new Set(reglas.map((r) => r.aKey));
    const aKey = columnas.find((c) => !usadas.has(c.key))?.key || columnas[0]?.key || '';
    const bKey = columnas.find((c) => c.key !== aKey)?.key || '';
    aplicar([
      ...reglas,
      { id: nuevoId(), aKey, op: 'mayor', tipo: 'columna', bKey, valor: 0, mensaje: '' },
    ]);
  };

  const quitar = (id) => aplicar(reglas.filter((r) => r.id !== id));

  return (
    <div className="cmp-overlay" role="dialog" aria-modal="true" aria-label="Revisión antes de guardar">
      <div className="cmp-panel">
        <header className="cmp-head">
          <div>
            <div className="cmp-eyebrow">
              {soloConsulta ? 'Datos críticos del formulario' : 'Revisión antes de guardar'}
            </div>
            <h2 className="cmp-title">
              {codigo ? <span className="cmp-code">{codigo}</span> : null}
              {nombre || 'Formulario'}
            </h2>
          </div>
          <button type="button" className="cmp-x" onClick={onCancelar} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {datos.length > 0 && (
          <div className="cmp-datos">
            {datos.map(([clave, valor]) => (
              <div className="cmp-dato" key={clave}>
                <span>{clave}</span>
                <b title={String(valor)}>{String(valor)}</b>
              </div>
            ))}
          </div>
        )}

        {/* Resultado de las reglas */}
        {columnas.length < 2 ? (
          <div className="cmp-sin-datos">
            Este formulario no tiene dos columnas numéricas para comparar. Se puede
            guardar igual.
          </div>
        ) : (
          <div className={`cmp-resumen ${avisos.length ? 'mal' : 'ok'}`}>
            {avisos.length > 0 ? (
              <>
                <b>
                  ⚠ {avisos.length === 1 ? 'Advertencia' : `${avisos.length} advertencias`}
                </b>
                <ul>
                  {avisos.map((a) => (
                    <li key={a.regla.id}>{a.mensaje}</li>
                  ))}
                </ul>
                <span className="cmp-resumen-pie">Se puede guardar igual.</span>
              </>
            ) : resultados.length > 0 ? (
              <b>✓ Los totales cuadran.</b>
            ) : (
              <b>Sin reglas configuradas.</b>
            )}
          </div>
        )}

        {/* Configuración */}
        {columnas.length >= 2 && (
          <details
            className="cmp-config"
            open={configAbierta}
            onToggle={(e) => setConfigAbierta(e.currentTarget.open)}
          >
            <summary>
              ⚙ Configurar reglas
              <span className="cmp-config-num">{reglas.length}</span>
            </summary>

            <div className="cmp-config-body">
              {reglas.length === 0 && (
                <p className="cmp-vacio">
                  No hay reglas. Agregá una para que aparezca la advertencia antes de
                  guardar.
                </p>
              )}

              {reglas.map((r, i) => {
                const res = resultados.find((x) => x.regla.id === r.id);

                return (
                  <div
                    className={`cmp-regla ${res ? (res.cumple ? 'ok' : 'mal') : 'incompleta'}`}
                    key={r.id}
                  >
                    <div className="cmp-regla-top">
                      <span className="cmp-regla-num">{i + 1}</span>

                      <select
                        value={r.aKey || ''}
                        onChange={(e) => cambiar(r.id, 'aKey', e.target.value)}
                        title="Columna A"
                      >
                        {opcionesColumnas}
                      </select>

                      <select
                        className="cmp-op"
                        value={r.op || 'mayor'}
                        onChange={(e) => cambiar(r.id, 'op', e.target.value)}
                        title="Condición"
                      >
                        {OPERADORES.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.signo} {o.corto}
                          </option>
                        ))}
                      </select>

                      {r.tipo === 'valor' ? (
                        <span className="cmp-b">
                          <input
                            type="number"
                            step="any"
                            value={r.valor ?? ''}
                            onChange={(e) => cambiar(r.id, 'valor', e.target.value)}
                            placeholder="0"
                            title="Valor fijo"
                          />
                          <button
                            type="button"
                            className="cmp-mini"
                            onClick={() => cambiar(r.id, 'tipo', 'columna')}
                            title="Comparar contra otra columna"
                          >
                            ≡
                          </button>
                        </span>
                      ) : (
                        <span className="cmp-b">
                          <select
                            value={r.bKey || ''}
                            onChange={(e) => cambiar(r.id, 'bKey', e.target.value)}
                            title="Columna B"
                          >
                            {opcionesColumnas}
                          </select>
                          <button
                            type="button"
                            className="cmp-mini"
                            onClick={() => cambiar(r.id, 'tipo', 'valor')}
                            title="Comparar contra un valor fijo"
                          >
                            #
                          </button>
                        </span>
                      )}

                      <button
                        type="button"
                        className="cmp-del"
                        onClick={() => quitar(r.id)}
                        title="Quitar regla"
                      >
                        ✕
                      </button>
                    </div>

                    <label className="cmp-msg-campo">
                      <span>Si no se cumple, avisar:</span>
                      <input
                        value={r.mensaje || ''}
                        onChange={(e) => cambiar(r.id, 'mensaje', e.target.value)}
                        placeholder={res?.automatico || 'Escribí la advertencia (opcional)'}
                      />
                    </label>

                    <div className="cmp-regla-res">
                      {res ? (
                        <>
                          <span className="cmp-regla-calc">
                            {fmt(res.a.total)} {res.signo} {fmt(res.b.total)}
                          </span>
                          <span className={res.cumple ? 'ok' : 'mal'}>
                            {res.cumple ? '✓ cumple' : '⚠ no cumple'}
                          </span>
                        </>
                      ) : (
                        <span className="incompleta">Elegí las dos columnas</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <button type="button" className="cmp-add" onClick={agregar}>
                ➕ Agregar regla
              </button>
            </div>
          </details>
        )}

        <footer className="cmp-pie">
          <div className="cmp-botones">
            <button type="button" className="cmp-btn" onClick={onCancelar}>
              {soloConsulta ? 'Cerrar' : '← Volver y corregir'}
            </button>
            {!soloConsulta && (
              <button
                type="button"
                className={`cmp-btn solid ${avisos.length ? 'aviso' : ''}`}
                onClick={onGuardar}
              >
                {avisos.length ? 'Guardar con advertencia' : 'Guardar formulario'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
