/**
 * LotesEncabezado.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barra para trabajar con VARIOS lotes de proceso en un mismo formulario.
 *
 * Se muestra encima de las tablas que tienen la columna de código padre: los
 * lotes que se agregan acá son los que aparecen en el desplegable de cada fila.
 *
 * Los lotes viven en el campo de lote del ENCABEZADO, separados por coma, así
 * que no hace falta tocar la plantilla para pasar de uno a tres lotes.
 */

import { useState } from 'react';
import { lotesDelEncabezado, campoLoteEncabezado } from '../services/inventarioCeldaService';
import { validarNumeroLote, lotesConProblema } from '../utils/validacionLote';

const chip = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd',
  borderRadius: '999px', padding: '3px 6px 3px 10px',
  fontSize: '12px', fontWeight: 700,
};

/**
 * El modo "un solo lote" lo maneja el formulario (prop `unico` + `onUnicoChange`)
 * porque también decide si se dibuja la columna de código padre en las tablas.
 * Si no se pasa, se controla acá y arranca como lo dejó la plantilla.
 */
export default function LotesEncabezado({
  headerData, onChange, columnaLabel, unicoDefault = false, lotesProceso = [], campos = [],
  unico: unicoProp, onUnicoChange, columnaOculta = false,
}) {
  const [nuevo, setNuevo] = useState('');
  const [unicoLocal, setUnicoLocal] = useState(!!unicoDefault);
  const unico = unicoProp === undefined ? unicoLocal : !!unicoProp;
  const setUnico = (v) => (onUnicoChange ? onUnicoChange(v) : setUnicoLocal(v));

  // El campo marcado en la plantilla manda; si no hay ninguno se busca por nombre.
  const campo = campoLoteEncabezado(headerData, campos);
  const todos = lotesDelEncabezado(headerData, campos);

  // Solo se editan los lotes del campo principal: si la plantilla tiene además
  // "LOTE 2" como campo aparte, esos se muestran pero se cambian en su casilla.
  const propios = campo ? lotesDelEncabezado({ [campo]: headerData?.[campo] }) : [];
  const ajenos = todos.filter(l => !propios.includes(l));

  const escribir = (lista) => onChange(campo, lista.join(', '));

  // ⚠️ Un lote con un dígito de más ("2605318") no cruza con nada: no aparece en
  // los desplegables de los otros formularios ni se le puede descontar stock.
  // Se avisa antes de agregarlo y se ofrece el número corregido.
  const revisionNuevo = validarNumeroLote(nuevo);
  const problemasCargados = lotesConProblema(propios);

  const agregar = () => {
    const valor = nuevo.trim();
    if (!valor) return;
    // Se aceptan varios de un saque: "260731, 260732"
    const nuevos = valor.split(/[,;/|]+/).map(v => v.trim()).filter(Boolean);

    const malos = lotesConProblema(nuevos);
    if (malos.length > 0) {
      const detalle = malos
        .map(m => `• ${m.valor}: ${m.motivo}${m.sugerencia ? ` ¿Quisiste poner ${m.sugerencia}?` : ''}`)
        .join('\n');
      if (!window.confirm(`⚠️ Revisá el número de lote:\n\n${detalle}\n\n¿Agregarlo igual?`)) return;
    }

    const lista = [...propios];
    for (const v of nuevos) {
      if (!lista.some(x => x.toLowerCase() === v.toLowerCase())) lista.push(v);
    }
    escribir(lista);
    setNuevo('');
  };

  if (!campo) {
    return (
      <div style={{
        background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px',
        padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: '#92400e',
      }}>
        ℹ️ El encabezado de este formulario no tiene ningún campo de <strong>lote</strong>. La
        columna <strong>{columnaLabel || 'de código padre'}</strong> igual funciona: ofrece los{' '}
        <strong>lotes de proceso registrados</strong> ({lotesProceso.length}). Si además querés
        fijar los lotes del día desde el encabezado, agregá un campo &quot;Lote&quot; a la plantilla.
      </div>
    );
  }

  // Lotes de proceso ya registrados: se ofrecen como sugerencia para no
  // depender de que el operario los escriba de memoria.
  const sugerencias = (lotesProceso || []).filter(o => !todos.includes(o.value));
  const listaId = `lotes-proceso-${(campo || 'x').replace(/\W+/g, '')}`;
  const datalist = sugerencias.length > 0 ? (
    <datalist id={listaId}>
      {sugerencias.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </datalist>
  ) : null;

  // ── Modo un solo lote ──────────────────────────────────────────────────────
  const checkUnico = (
    <label
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto',
        fontSize: '11.5px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', whiteSpace: 'nowrap',
      }}
      title="Mostrar un único cuadro para escribir el lote, en vez de la lista"
    >
      <input
        type="checkbox"
        checked={unico}
        onChange={(e) => setUnico(e.target.checked)}
        style={{ accentColor: '#2563eb', cursor: 'pointer', margin: 0 }}
      />
      <span>Un solo lote</span>
    </label>
  );

  if (unico) {
    const valor = propios[0] || '';
    return (
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
        padding: '9px 12px', marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>
            🔗 Lote de este formulario:
          </span>
          <input
            type="text"
            list={sugerencias.length > 0 ? listaId : undefined}
            value={valor}
            onChange={(e) => onChange(campo, e.target.value)}
            placeholder={sugerencias.length > 0 ? 'Elija o escriba el lote…' : 'Escriba el lote…'}
            style={{
              padding: '5px 10px', border: '1px solid #93c5fd', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, width: '190px', background: 'white',
            }}
          />
          {datalist}
          {checkUnico}
        </div>
        {/* ⚠️ Aviso de lote mal escrito, con el número corregido a un clic */}
        {(() => {
          const r = validarNumeroLote(valor);
          if (r.valido || !String(valor).trim()) return null;
          return (
            <div style={{
              marginTop: '6px', padding: '6px 10px', background: '#fffbeb',
              border: '1px solid #fcd34d', borderRadius: '6px',
              fontSize: '11.5px', color: '#92400e', lineHeight: 1.6,
            }}>
              ⚠️ {r.motivo}
              {r.sugerencia && (
                <button
                  type="button"
                  onClick={() => onChange(campo, r.sugerencia)}
                  style={{
                    marginLeft: '6px', padding: '1px 8px', borderRadius: '5px',
                    border: '1px solid #f59e0b', background: 'white', color: '#92400e',
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Corregir a {r.sugerencia}
                </button>
              )}
            </div>
          );
        })()}
        <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '5px' }}>
          Se guarda en <strong>{campo}</strong>{' '}
          {columnaOculta ? (
            <>
              y se escribe solo en la columna <strong>{columnaLabel || 'de código padre'}</strong>,
              que queda escondida en la tabla (sería el mismo lote en todas las filas).
            </>
          ) : (
            <>y es la única opción de la columna <strong>{columnaLabel || 'de código padre'}</strong>.</>
          )}
          {propios.length > 1 && (
            <strong style={{ color: '#b45309' }}>
              {' '}⚠️ El encabezado tiene {propios.length} lotes; al escribir acá quedan reemplazados
              por uno solo. Destildá &quot;Un solo lote&quot; para verlos todos.
            </strong>
          )}
          {ajenos.length > 0 && ' Hay otros lotes en otro campo del encabezado.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
      padding: '9px 12px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>
          🔗 Lotes de este formulario ({todos.length}):
        </span>

        {propios.map(l => (
          <span key={l} style={chip}>
            {l}
            <button
              type="button"
              title={`Quitar ${l}`}
              onClick={() => escribir(propios.filter(x => x !== l))}
              style={{
                border: 'none', background: 'transparent', color: '#1e40af',
                cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px',
              }}
            >
              ×
            </button>
          </span>
        ))}

        {ajenos.map(l => (
          <span key={l} style={{ ...chip, background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1', paddingRight: '10px' }}>
            {l}
          </span>
        ))}

        {todos.length === 0 && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>ninguno todavía</span>
        )}

        <input
          type="text"
          list={sugerencias.length > 0 ? listaId : undefined}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          placeholder={sugerencias.length > 0 ? 'Elegir o escribir lote…' : 'Agregar lote…'}
          style={{
            padding: '4px 8px', border: '1px solid #93c5fd', borderRadius: '6px',
            fontSize: '12px', width: '175px',
          }}
        />
        {datalist}
        <button
          type="button"
          onClick={agregar}
          disabled={!nuevo.trim()}
          style={{
            padding: '4px 10px', border: 'none', borderRadius: '6px',
            background: nuevo.trim() ? '#2563eb' : '#cbd5e1', color: 'white',
            fontSize: '12px', fontWeight: 600,
            cursor: nuevo.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          + Agregar
        </button>

        {checkUnico}
      </div>

      {/* ⚠️ Lotes mal escritos: los ya cargados y el que se está por agregar */}
      {(problemasCargados.length > 0 || (!revisionNuevo.valido && nuevo.trim())) && (
        <div style={{
          marginTop: '7px', padding: '7px 10px', background: '#fffbeb',
          border: '1px solid #fcd34d', borderRadius: '6px',
          fontSize: '11.5px', color: '#92400e', lineHeight: 1.6,
        }}>
          {!revisionNuevo.valido && nuevo.trim() && (
            <div>
              ⚠️ <strong>{nuevo.trim()}</strong>: {revisionNuevo.motivo}
              {revisionNuevo.sugerencia && (
                <button
                  type="button"
                  onClick={() => setNuevo(revisionNuevo.sugerencia)}
                  style={{
                    marginLeft: '6px', padding: '1px 8px', borderRadius: '5px',
                    border: '1px solid #f59e0b', background: 'white', color: '#92400e',
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Usar {revisionNuevo.sugerencia}
                </button>
              )}
            </div>
          )}
          {problemasCargados.map(p => (
            <div key={p.valor}>
              ⚠️ El lote <strong>{p.valor}</strong> ya cargado: {p.motivo}
              {p.sugerencia && (
                <button
                  type="button"
                  onClick={() => escribir(propios.map(l => (l === p.valor ? p.sugerencia : l)))}
                  style={{
                    marginLeft: '6px', padding: '1px 8px', borderRadius: '5px',
                    border: '1px solid #f59e0b', background: 'white', color: '#92400e',
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Corregir a {p.sugerencia}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '5px' }}>
        Se guardan en <strong>{campo}</strong> separados por coma y son las opciones de la columna{' '}
        <strong>{columnaLabel || 'de código padre'}</strong>. No hay límite: podés poner tres, cuatro
        o los que necesites.
        {ajenos.length > 0 && ' Los grises vienen de otro campo del encabezado y se editan ahí.'}
      </div>
    </div>
  );
}
