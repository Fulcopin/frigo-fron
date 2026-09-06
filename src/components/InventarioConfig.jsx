/**
 * InventarioConfig.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Paneles de configuración del enlace TABLA ↔ INVENTARIO DE LOTES.
 * Se usan igual en Crear Plantilla y en Editar Plantilla.
 *
 *   <InventarioColumnaConfig>   → columna type="inventario" (lista desplegable)
 *   <InventarioAutoCompletar>   → cualquier columna: se rellena desde el lote
 *   <InventarioTablaConfig>     → tabla: restar la cantidad del saldo del lote
 *
 * La lógica de ejecución vive en services/inventarioCeldaService.js
 */

import { useEffect, useRef, useState } from 'react';
import {
  INVENTARIO_CAMPOS, INVENTARIO_AUTO_CAMPOS, INVENTARIO_ORIGENES,
  PRODUCCION_CAMPOS, PRODUCCION_AUTO_CAMPOS, esColumnaInventario, esColumnaProduccion,
  esColumnaDeLote, esOrigenProduccion, origenDe, origenesDe, cargarOrigenesProduccion,
  esOrigenClasificaciones, CLASIFICACION_CAMPOS,
  sugerirConfigDescuento, columnasAutoProduccionLegacy, sugerirConfigEntrada,
  TIPO_COL_LOTE_PADRE, LABEL_LOTE_PADRE, esColumnaLotePadre, columnaLotePadreDe,
  cargarLotesPadre, listaLotePadreDe, lotePadreSeleccionDe,
  TIPO_COL_LOTE_PADRE_TABLA, columnasDeTabla, columnaLoteSugerida, ubicarTabla,
} from '../services/inventarioCeldaService';

/**
 * Orígenes disponibles para el desplegable: el inventario de saldos más TODOS
 * los formularios que tienen tabla de resumen (PD-04, PD-05, PD-06, PD-07…).
 * La lista se descubre del backend, no está escrita a mano, así que un
 * formulario nuevo aparece solo.
 */
function useOrigenesInventario(origenesActuales = []) {
  const [formularios, setFormularios] = useState([]);

  useEffect(() => {
    let cancel = false;
    cargarOrigenesProduccion().then(l => { if (!cancel) setFormularios(l || []); });
    return () => { cancel = true; };
  }, []);

  const opciones = [...INVENTARIO_ORIGENES, ...formularios];
  // Un origen ya guardado que todavía no llegó (o cuya plantilla se borró) no
  // debe desaparecer del selector: se conserva como opción propia.
  for (const actual of (Array.isArray(origenesActuales) ? origenesActuales : [origenesActuales])) {
    if (!actual || opciones.some(o => o.value === actual)) continue;
    opciones.push({
      value: actual,
      label: esOrigenProduccion(actual)
        ? `🏭 Formulario ${actual.replace('form:', '')} (guardado)`
        : actual,
    });
  }
  return { opciones, cargando: formularios.length === 0 };
}

const caja = {
  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
  border: '2px solid #60a5fa',
  borderRadius: '10px',
  padding: '14px 16px',
  marginTop: '10px',
  width: '100%',
};
const etiqueta = { fontSize: '12px', fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: '4px' };
const control  = { padding: '7px 10px', border: '1.5px solid #93c5fd', borderRadius: '6px', fontSize: '13px', background: 'white', width: '100%', boxSizing: 'border-box' };
const check    = { width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0, margin: 0 };
// El texto suelto dentro de un <label> flex se reparte en varios flex-items y
// termina apilado/centrado: por eso va siempre envuelto en un <span>.
const filaCheck = {
  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px',
  justifyContent: 'flex-start', textAlign: 'left', width: '100%',
  fontSize: '13px', color: '#1e3a8a', cursor: 'pointer', fontWeight: 500,
};

/**
 * Configuración de una columna de tipo "inventario".
 * @param {Object}   column     — la columna de la plantilla
 * @param {Function} onChange   — (prop, valor) => void
 */
/**
 * Selector de ORÍGENES con casillas: se ve como el desplegable de siempre, pero
 * al abrirlo cada formulario tiene su casilla, así que se pueden marcar el
 * PD-04, el PD-05, el PD-06… todos en la misma columna, o «Todos» de un saque.
 *
 * El primero de la lista es el PRINCIPAL (⭐): es el que decide qué campos se
 * ofrecen en «Campo que se lista» y el que pone la etiqueta con producto y saldo.
 *
 * @param {Array}    opciones      — { value, label } de todos los orígenes
 * @param {Array}    seleccionados — orígenes elegidos, el principal primero
 * @param {Function} onChange      — (listaNueva) => void
 */
function SelectorOrigenes({ opciones, seleccionados, onChange, cargando }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  // Clic fuera → se cierra, como cualquier desplegable.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const nombreDe = (v) => opciones.find(o => o.value === v)?.label || v;
  const todosMarcados = opciones.length > 0 && opciones.every(o => seleccionados.includes(o.value));

  const alternar = (valor) => {
    if (!seleccionados.includes(valor)) return onChange([...seleccionados, valor]);
    // Nunca se queda sin ninguno: el último marcado no se puede desmarcar.
    if (seleccionados.length === 1) return;
    onChange(seleccionados.filter(v => v !== valor));
  };
  const alternarTodos = () => onChange(
    todosMarcados ? seleccionados.slice(0, 1) : [
      ...seleccionados,
      ...opciones.map(o => o.value).filter(v => !seleccionados.includes(v)),
    ]
  );
  const hacerPrincipal = (valor) => onChange([valor, ...seleccionados.filter(v => v !== valor)]);

  const resumen = seleccionados.length > 1
    ? `${nombreDe(seleccionados[0])}   +${seleccionados.length - 1} más`
    : nombreDe(seleccionados[0]);

  return (
    <div ref={contenedor} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        title={seleccionados.map(nombreDe).join('\n')}
        style={{
          ...control,
          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
          textAlign: 'left', fontWeight: seleccionados.length > 1 ? 600 : 500,
          borderColor: seleccionados.length > 1 ? '#2563eb' : '#93c5fd',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {resumen}
        </span>
        <span style={{ color: '#1d4ed8', fontSize: '11px' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1.5px solid #60a5fa', borderRadius: '8px',
          boxShadow: '0 8px 20px rgba(30, 64, 175, 0.18)', padding: '7px',
          maxHeight: '320px', overflowY: 'auto', minWidth: '320px',
        }}>
          <label
            style={{
              ...filaCheck, fontSize: '12.5px', gap: '7px', padding: '5px 7px',
              borderRadius: '6px', fontWeight: 700,
              background: todosMarcados ? '#dbeafe' : '#f8fafc', color: '#1d4ed8',
            }}
          >
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={alternarTodos}
              style={{ ...check, width: '15px', height: '15px' }}
            />
            <span>✅ Todos los orígenes — todos los lotes juntos</span>
          </label>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '6px 2px' }} />

          {cargando && (
            <div style={{ fontSize: '11.5px', color: '#1d4ed8', padding: '4px 7px' }}>
              ⏳ Buscando formularios de producción disponibles…
            </div>
          )}

          {opciones.map(o => {
            const marcado = seleccionados.includes(o.value);
            const esPrincipal = seleccionados[0] === o.value;
            return (
              <div
                key={o.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  borderRadius: '6px', padding: '1px 4px',
                  background: marcado ? '#eff6ff' : 'transparent',
                }}
              >
                <label style={{ ...filaCheck, fontSize: '12px', gap: '7px', padding: '4px 3px', flex: 1, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(o.value)}
                    style={{ ...check, width: '14px', height: '14px' }}
                  />
                  <span
                    title={o.label}
                    style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: marcado ? 600 : 500, color: marcado ? '#1d4ed8' : '#334155',
                    }}
                  >
                    {o.label}
                  </span>
                </label>
                {marcado && (
                  <button
                    type="button"
                    onClick={() => hacerPrincipal(o.value)}
                    disabled={esPrincipal}
                    title={esPrincipal ? 'Es el origen principal' : 'Convertir en el origen principal'}
                    style={{
                      border: 'none', background: 'transparent', cursor: esPrincipal ? 'default' : 'pointer',
                      color: esPrincipal ? '#f59e0b' : '#cbd5e1', fontSize: '15px', lineHeight: 1, padding: '0 3px',
                    }}
                  >
                    ★
                  </button>
                )}
              </div>
            );
          })}

          <div style={{
            marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0',
            fontSize: '11px', color: '#1e40af', lineHeight: 1.6,
          }}>
            Marcá todos los formularios que alimentan esta columna: el desplegable del formulario
            muestra los valores de <strong>todos juntos</strong>, sin repetir. La ⭐ marca el
            <strong> principal</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

export function InventarioColumnaConfig({ column, onChange }) {
  const origenes = origenesDe(column);
  const origen = origenes[0];
  const extras = origenes.slice(1);
  const { opciones, cargando } = useOrigenesInventario(origenes);
  if (!esColumnaInventario(column)) return null;

  const esProd  = esColumnaProduccion(column);
  const esClasif = esOrigenClasificaciones(origen);
  const campos  = esClasif ? CLASIFICACION_CAMPOS : (esProd ? PRODUCCION_CAMPOS : INVENTARIO_CAMPOS);
  const campo   = column.invCampo || (esClasif ? 'clasificacion' : (esProd ? 'loteProceso' : 'numeroLote'));
  const nombreDe = (valor) => opciones.find(o => o.value === valor)?.label || valor;
  const etiquetaOrigen = nombreDe(origen);

  /**
   * Guarda la lista completa de orígenes: el principal primero. Si el principal
   * cambió de tipo (inventario ↔ producción) el campo elegido puede ya no
   * existir, así que se resetea al primero de la lista nueva.
   */
  const aplicarOrigenes = (lista) => {
    const nueva = (lista || []).filter(Boolean);
    if (nueva.length === 0) return;
    onChange('invOrigen', nueva[0]);      // compat: las plantillas viejas leen este
    onChange('invOrigenes', nueva);
    const camposNuevos = esOrigenClasificaciones(nueva[0])
      ? CLASIFICACION_CAMPOS
      : (esOrigenProduccion(nueva[0]) ? PRODUCCION_CAMPOS : INVENTARIO_CAMPOS);
    if (!camposNuevos.some(c => c.value === campo)) onChange('invCampo', camposNuevos[0].value);
  };

  return (
    <div style={caja}>
      <strong style={{ color: '#1e40af', fontSize: '14px', display: 'block', marginBottom: '10px' }}>
        📦 Lista desplegable enlazada a datos reales
      </strong>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <label style={etiqueta}>¿De dónde salen los valores? (se pueden marcar varios)</label>
          <SelectorOrigenes
            opciones={opciones}
            seleccionados={origenes}
            onChange={aplicarOrigenes}
            cargando={cargando}
          />
          {extras.length > 0 && (
            <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px', fontWeight: 600, lineHeight: 1.5 }}>
              ✅ {origenes.length} orígenes combinados: {origenes.map(nombreDe).join('  +  ')}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={etiqueta}>Campo que se lista</label>
          <select value={campo} onChange={(e) => onChange('invCampo', e.target.value)} style={control}>
            {campos.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        {!esProd && !esClasif && (
          <label style={filaCheck}>
            <input
              type="checkbox"
              checked={column.invSoloDisponibles !== false}
              onChange={(e) => onChange('invSoloDisponibles', e.target.checked)}
              style={check}
            />
            <span>Mostrar solo lotes con saldo disponible (oculta los consumidos)</span>
          </label>
        )}

        {campo === 'numeroLote' || campo === 'loteProceso' ? (
          <label style={filaCheck}>
            <input
              type="checkbox"
              checked={column.invMostrarSaldo !== false}
              onChange={(e) => onChange('invMostrarSaldo', e.target.checked)}
              style={check}
            />
            <span>Mostrar el saldo en la opción — ej: <em>260722 · 85.5 lbs disp.</em></span>
          </label>
        ) : null}

        {campo === 'numeroLote' || campo === 'loteProceso' || campo === 'codigoProducto' ? (
          <label style={filaCheck}>
            <input
              type="checkbox"
              checked={column.invMostrarProducto === true}
              onChange={(e) => onChange('invMostrarProducto', e.target.checked)}
              style={check}
            />
            <span>
              Agregar el nombre del producto — ej: <em>260722 — PT Tuna Loins SP Gquil</em>.
              {' '}Apagado la lista muestra solo el número de lote.
            </span>
          </label>
        ) : null}

        {!esClasif && (
          <label style={filaCheck}>
            <input
              type="checkbox"
              checked={column.invFiltraPorFila !== false}
              onChange={(e) => onChange('invFiltraPorFila', e.target.checked)}
              style={check}
            />
            <span>Desplegable dependiente (filtra según lo ya elegido en la misma fila)</span>
          </label>
        )}
      </div>

      <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#1e40af', background: 'white', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 10px' }}>
        {esClasif ? (
          <>
            🏷️ Los valores salen del <strong>catálogo de clasificaciones</strong>: la lista que se
            configura una sola vez en <strong>Clasificación General de Productos</strong> (botón
            🏷️ Clasificaciones) y que sirve para todos los formularios. Se suman también las
            clasificaciones ya usadas en el inventario, así que lo que carga un compañero aparece
            acá sin tocar nada. Agregar una nueva no obliga a editar ninguna plantilla.
          </>
        ) : esProd ? (
          <>
            🏭 Los valores salen del resumen de <strong>{etiquetaOrigen.replace(/^🏭\s*/, '')}</strong>:
            lote de proceso → productos de ese lote → su clasificación. Con el desplegable
            dependiente activo, elegir el lote filtra los productos y elegir el producto trae
            su clasificación automáticamente. Para <strong>restar inventario</strong> con este
            origen, activá el panel naranja de la tabla y elegí la columna de lote, la de
            producto y la de cantidad: el saldo se descuenta del lote hijo real
            (ej. <em>260725-P01</em>).
          </>
        ) : (
          <>
            💡 Al llenar el formulario esta celda será un menú desplegable con los lotes reales del
            inventario, con su saldo. Es el origen que hay que usar si esta tabla va a
            <strong> restar inventario</strong>.
          </>
        )}
        {extras.length > 0 && (
          <>
            {' '}➕ Además se agregan los valores de{' '}
            <strong>{extras.map(nombreDe).join(', ')}</strong>: todo en un solo desplegable, sin
            repetidos. Si un lote aparece en dos formularios se muestra una sola vez.
          </>
        )}
        {' '}Si no hay datos o el backend no responde, la celda vuelve a ser un campo de texto normal
        (no se bloquea al operario).
      </div>
    </div>
  );
}

/**
 * Selector "autocompletar esta columna desde el lote elegido en la fila".
 * Se muestra en cualquier columna que NO sea de inventario, siempre que la
 * tabla tenga al menos una columna de inventario con el número de lote.
 */
export function InventarioAutoCompletar({ column, columnas, onChange }) {
  if (esColumnaInventario(column)) return null;

  const hayProd = (columnas || []).some(c => esColumnaInventario(c) && esColumnaProduccion(c));
  const hayColumnaLote = (columnas || []).some(
    c => esColumnaInventario(c) && origenDe(c) === 'inventario' && (c.invCampo || 'numeroLote') === 'numeroLote'
  );
  if (!hayProd && !hayColumnaLote) return null;

  const campos = hayProd ? PRODUCCION_AUTO_CAMPOS : INVENTARIO_AUTO_CAMPOS;

  return (
    <div className="form-group" style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '6px', padding: '6px 10px' }}>
      <label style={{ ...etiqueta, marginBottom: '2px' }}>
        {hayProd ? '🏭 Autocompletar desde la producción' : '📦 Autocompletar desde el lote'}
      </label>
      <select
        value={column.invAutoDesde || ''}
        onChange={(e) => onChange('invAutoDesde', e.target.value)}
        style={{ ...control, padding: '6px 8px', fontSize: '12px', marginTop: '4px' }}
      >
        {campos.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Configuración de descuento de inventario para una tabla.
 * @param {Object}   element   — el bodyElement de tipo table
 * @param {Function} onChange  — (prop, valor) => void
 */
/**
 * Interruptor del enlace automático heredado: cualquier columna llamada
 * "LOTE DE PROCESO" / "TIPO DE PRODUCTO" se convierte sola en un desplegable con
 * la producción del PD-04, aunque la tabla nunca se haya configurado. Se muestra
 * solo en las tablas afectadas, para poder dejarlas como texto libre.
 */
function AutoProduccionLegacyConfig({ element, onChange }) {
  const afectadas = columnasAutoProduccionLegacy(element);
  if (afectadas.length === 0) return null;

  const activo = !element?.sinAutoProduccion;
  const nombres = afectadas.map(c => c.label || c.header).join(' · ');
  const soloEncabezado = !!element?.autoProduccionSoloEncabezado;

  return (
    <div style={{
      background: activo ? '#f5f3ff' : '#f9fafb',
      border: `1.5px solid ${activo ? '#c4b5fd' : '#e5e7eb'}`,
      borderRadius: '10px',
      padding: '10px 14px',
      marginBottom: '16px',
    }}>
      <label style={{ ...filaCheck, color: activo ? '#5b21b6' : '#4b5563', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onChange('sinAutoProduccion', !e.target.checked)}
          style={{ ...check, accentColor: '#7c3aed' }}
        />
        <span>🏭 Llenar {nombres} con la producción del PD-04</span>
      </label>
      <div style={{ fontSize: '11.5px', color: activo ? '#6d28d9' : '#6b7280', marginTop: '6px', lineHeight: 1.6 }}>
        {activo ? (
          <>
            Estas columnas se vuelven desplegables con los lotes y productos del PD-04 <strong>por
            su nombre</strong>, aunque esta tabla no esté configurada. <strong>Destildá</strong> la
            casilla si en este formulario deben ser campos normales, como los definió la plantilla.
          </>
        ) : (
          <>
            ✅ Enlace apagado: {nombres} se comportan como los definió la plantilla (texto libre,
            número, etc.) y no se cargan lotes del PD-04 en esta tabla.
          </>
        )}
      </div>

      {activo && (
        <label style={{ ...filaCheck, marginTop: '10px', color: '#5b21b6' }}>
          <input
            type="checkbox"
            checked={soloEncabezado}
            onChange={(e) => onChange('autoProduccionSoloEncabezado', e.target.checked)}
            style={{ ...check, accentColor: '#7c3aed' }}
          />
          <span>
            Mostrar solo los lotes escritos arriba, en el encabezado (oculta la lista completa
            de lotes de proceso del PD-04)
          </span>
        </label>
      )}
    </div>
  );
}

/**
 * Saca el rol de código padre de una tabla: la columna que se había creado se
 * borra y una columna existente vuelve al tipo que tenía antes.
 */
function quitarLotePadre(columnas) {
  return (columnas || [])
    .filter(c => !(esColumnaLotePadre(c) && c.creadaAuto))
    .map(c => (esColumnaLotePadre(c) ? { ...c, type: c.tipoPrevio || 'text', tipoPrevio: undefined } : c));
}

/**
 * Asigna qué columna de la tabla recibe los lotes del encabezado.
 * @param {Array}  columnas
 * @param {string} label — etiqueta de la columna, '__nueva__' para crear una, '' para ninguna
 */
function asignarLotePadre(columnas, label, nombreNueva = LABEL_LOTE_PADRE) {
  const base = quitarLotePadre(columnas);
  if (!label) return base;
  if (label === '__nueva__') {
    return [
      { label: nombreNueva, type: TIPO_COL_LOTE_PADRE, creadaAuto: true, required: false, includeInSum: false, options: [] },
      ...base,
    ];
  }
  return base.map(c => (
    c.label === label ? { ...c, type: TIPO_COL_LOTE_PADRE, tipoPrevio: c.type || 'text' } : c
  ));
}

/**
 * Interruptor por COLUMNA: convierte esta columna en la que recibe los lotes de
 * proceso cargados en el encabezado. Es lo mismo que elegirla desde el panel de
 * la tabla, pero acá, al lado de la columna que se está editando.
 *
 * @param {Object}   column   — la columna de la plantilla
 * @param {Function} onChange — (prop, valor) => void
 */
export function ColumnaLotePadreConfig({ column, columnas, onChange, onColumnas, element, bodyElements }) {
  const activo = esColumnaLotePadre(column);
  const desdeTabla = column?.type === TIPO_COL_LOTE_PADRE_TABLA;
  // En una columna de inventario mandan sus propios ajustes: no se ofrece acá.
  if (esColumnaInventario(column)) return null;

  // Otra columna de la misma tabla que ya tenga el rol: solo puede haber una,
  // si no el formulario muestra dos desplegables de lote y gana la primera.
  const otraPadre = (columnas || []).find(c => esColumnaLotePadre(c) && c.label !== column?.label);

  const alternar = (checked) => {
    // Con la tabla completa se reasigna el rol (y se limpia el de las demás).
    if (onColumnas && Array.isArray(columnas)) {
      onColumnas(asignarLotePadre(columnas, checked ? column?.label : ''));
      return;
    }
    if (checked) {
      onChange('tipoPrevio', column?.type || 'text');
      onChange('type', TIPO_COL_LOTE_PADRE);
    } else {
      onChange('type', column?.tipoPrevio || 'text');
      onChange('tipoPrevio', undefined);
    }
  };

  return (
    <div className="form-group" style={{
      background: activo ? '#eff6ff' : '#f8fafc',
      border: `1.5px solid ${activo ? '#93c5fd' : '#e2e8f0'}`,
      borderRadius: '6px',
      padding: '6px 10px',
    }}>
      {/* El check solo gobierna el modo "lotes del encabezado". Con el tipo
          «desde Materia Prima» ya lo dice el desplegable Tipo, y mostrarlo acá
          sería un segundo control para lo mismo: destildarlo borraría la
          columna si se había creado automáticamente. */}
      {!desdeTabla && (
        <>
          <label style={{ ...filaCheck, fontSize: '12px', color: activo ? '#1d4ed8' : '#4b5563' }}>
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => alternar(e.target.checked)}
              style={{ ...check, width: '14px', height: '14px' }}
            />
            <span>🔗 Lote de proceso — recibe los lotes del encabezado</span>
          </label>
          <div style={{ fontSize: '11px', color: activo ? '#1e40af' : '#6b7280', marginTop: '3px', lineHeight: 1.5 }}>
            {activo
              ? `Al llenar el formulario esta celda es un desplegable con los lotes cargados arriba. Si lo destildás vuelve a ser «${column?.tipoPrevio || 'text'}».`
              : 'Tildalo en la columna donde el operario elige el lote de proceso (ej: LOTE DE PROCESO).'}
            {!activo && otraPadre && (
              <div style={{ color: '#b45309', fontWeight: 600 }}>
                Hoy lo recibe «{otraPadre.label}»: al tildar acá, esa columna deja de recibirlo
                {otraPadre.creadaAuto ? ' y se elimina (fue creada automáticamente).' : '.'}
              </div>
            )}
          </div>
        </>
      )}

      {column?.type === TIPO_COL_LOTE_PADRE_TABLA && (
        <LotePadreDesdeTabla
          column={column}
          element={element}
          bodyElements={bodyElements}
          onChange={onChange}
        />
      )}

      <label style={{ ...filaCheck, fontSize: '12px', color: column?.isHidden ? '#b91c1c' : '#4b5563', marginTop: '6px' }}>
        <input
          type="checkbox"
          checked={!!column?.isHidden}
          onChange={(e) => onChange('isHidden', e.target.checked)}
          style={{ ...check, width: '14px', height: '14px' }}
        />
        <span>🚫 No imprimir esta columna (se llena, pero no sale en Ver / PDF / Excel)</span>
      </label>
    </div>
  );
}

/**
 * Relación MATERIA PRIMA → PRODUCCIÓN dentro del mismo formulario.
 *
 * Es el caso del PD-06 y del PD-07: arriba se declara qué lotes entran y con
 * cuántas libras, y abajo cada fila de producción dice de cuál de esos lotes
 * salió. Sin esto la columna de código padre ofrecía el listado global de
 * lotes de proceso, que no tiene nada que ver con lo que entró a este proceso.
 *
 * Deja configurado sobre la tabla de producción:
 *   lotePadreOrigen: 'tabla' + lotePadreTablaId + lotePadreTablaCol
 *   validarMpVsProd + mpCantidadCol + prodCantidadCol
 *
 * @param {Object}   element      — la tabla de producción que se está editando
 * @param {Array}    bodyElements — todas las tablas, para elegir la de origen
 * @param {Function} onElemento   — (prop, valor) => void sobre esta tabla
 */
function LotePadreDesdeTabla({ column, element, bodyElements, onChange }) {
  // Las demás tablas del formulario: la de origen no puede ser ella misma.
  const otras = (bodyElements || [])
    .filter(el => el?.type === 'table'
                  && String(el?.id ?? '') !== String(element?.id ?? '')
                  && (el.columns || []).some(c => c?.label));

  const origen = ubicarTabla(bodyElements, column?.lotePadreTablaId)?.element || null;
  const colsOrigen = columnasDeTabla(origen);
  const colsPropias = columnasDeTabla(element).filter(c => c.label !== column?.label);

  // Al abrir el panel sin tabla elegida se propone la primera, que en la
  // práctica siempre es la de materia prima. Igual se puede cambiar abajo.
  const sugerida = !column?.lotePadreTablaId && otras.length > 0 ? otras[0] : null;

  const elegirTabla = (id) => {
    onChange('lotePadreTablaId', id);
    const nueva = ubicarTabla(bodyElements, id)?.element;
    onChange('lotePadreTablaCol', nueva ? columnaLoteSugerida(nueva) : '');
    onChange('mpCantidadCol', '');
  };

  const sel = {
    width: '100%', padding: '4px 6px', fontSize: '11px',
    border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '2px',
  };
  const rotulo = { fontSize: '10px', color: '#475569', fontWeight: 600 };

  if (otras.length === 0) {
    return (
      <div style={{
        marginTop: '6px', padding: '6px 8px', background: '#fffbeb',
        border: '1px solid #fcd34d', borderRadius: '6px',
        fontSize: '11px', color: '#b45309', lineHeight: 1.5,
      }}>
        ⚠️ Este formulario no tiene otra tabla con columnas. Agregá primero el cuadro de
        MATERIA PRIMA y volvé a elegir este tipo.
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '6px', padding: '6px 8px',
      background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px',
    }}>
      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, marginBottom: '5px' }}>
        📥 Los lotes salen de otra tabla de este formulario
      </div>
      <div style={{ fontSize: '10px', color: '#166534', marginBottom: '6px', lineHeight: 1.5 }}>
        El operario solo va a poder elegir los lotes que se declararon arriba como materia prima,
        en vez del listado completo de lotes de proceso.
      </div>

      <div style={{ display: 'grid', gap: '6px' }}>
        <div>
          <div style={rotulo}>Tabla de materia prima</div>
          <select value={column?.lotePadreTablaId ?? ''} onChange={(e) => elegirTabla(e.target.value)} style={sel}>
            <option value="">— Elegir tabla —</option>
            {otras.map(el => (
              <option key={el.id} value={el.id}>{el.title || el.label || `Tabla ${el.id}`}</option>
            ))}
          </select>
          {sugerida && (
            <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
              Falta elegirla — se propone «{sugerida.title || sugerida.label || sugerida.id}».
            </div>
          )}
        </div>

        <div>
          <div style={rotulo}>Columna que tiene el lote</div>
          <select
            value={column?.lotePadreTablaCol ?? ''}
            onChange={(e) => onChange('lotePadreTablaCol', e.target.value)}
            style={sel}
            disabled={!origen}
          >
            <option value="">— Elegir columna —</option>
            {colsOrigen.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
        </div>

        {/* ── Control: no se puede producir más de lo que entró ── */}
        <label style={{ ...filaCheck, fontSize: '12px', color: column?.validarMpVsProd ? '#b45309' : '#4b5563' }}>
          <input
            type="checkbox"
            checked={!!column?.validarMpVsProd}
            onChange={(e) => onChange('validarMpVsProd', e.target.checked)}
            style={{ ...check, width: '14px', height: '14px' }}
          />
          <span>⚖️ Avisar si se produce más de lo que entró</span>
        </label>

        {column?.validarMpVsProd && (
          <div style={{ display: 'grid', gap: '6px', paddingLeft: '4px' }}>
            <div>
              <div style={rotulo}>Cantidad en materia prima</div>
              <select
                value={column?.mpCantidadCol ?? ''}
                onChange={(e) => onChange('mpCantidadCol', e.target.value)}
                style={sel}
                disabled={!origen}
              >
                <option value="">— Elegir columna —</option>
                {colsOrigen.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <div style={rotulo}>Cantidad en producción</div>
              <select
                value={column?.prodCantidadCol ?? ''}
                onChange={(e) => onChange('prodCantidadCol', e.target.value)}
                style={sel}
              >
                <option value="">— Elegir columna —</option>
                {colsPropias.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '10px', color: '#92400e', lineHeight: 1.5 }}>
              Al guardar se compara la suma de las dos columnas. Si la producción supera a la
              materia prima sale un aviso con los lotes excedidos.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Configuración del CAMPO DE LOTES del encabezado.
 *
 * Marca cuál de los campos del encabezado guarda los lotes de proceso del
 * formulario (sin depender de que se llame "Lote") y elige de dónde salen las
 * sugerencias, para que el operario no tenga que escribirlos de memoria.
 * Además muestra a qué tablas y columnas van a parar esos lotes.
 *
 * @param {Object}   field        — campo del encabezado
 * @param {Array}    bodyElements — elementos del cuerpo, para listar los destinos
 * @param {Function} onChange     — (prop, valor) => void
 */
export function CampoLoteEncabezadoConfig({ field, bodyElements, onChange, onColumnasTabla }) {
  const activo = !!field?.esCampoLotes;
  const tipoOk = !field?.type || ['text', 'textarea'].includes(field.type);

  // Tablas del formulario: en cada una se elige qué columna recibe los lotes.
  const tablas = (bodyElements || [])
    .map((el, indice) => ({ el, indice }))
    .filter(({ el }) => el?.type === 'table' && (el.columns || []).some(c => c.label));

  const elegir = (indice, columnas, label) => {
    if (!onColumnasTabla) return;
    onColumnasTabla(indice, asignarLotePadre(columnas, label));
  };

  const conDestino = tablas.filter(({ el }) => columnaLotePadreDe(el));

  return (
    <div style={{
      background: activo ? '#eff6ff' : '#f9fafb',
      border: `1.5px solid ${activo ? '#93c5fd' : '#e5e7eb'}`,
      borderRadius: '10px',
      padding: '10px 14px',
      marginTop: '10px',
    }}>
      <label style={{ ...filaCheck, color: activo ? '#1d4ed8' : '#4b5563', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onChange('esCampoLotes', e.target.checked)}
          style={check}
        />
        <span>🔗 Este campo guarda los lotes de proceso del formulario</span>
      </label>

      {activo && (
        <div style={{ marginTop: '10px' }}>
          <label style={etiqueta}>¿Qué se le sugiere al operario?</label>
          <select
            value={field?.origenLotes || 'inventario'}
            onChange={(e) => onChange('origenLotes', e.target.value)}
            style={{ ...control, maxWidth: '380px' }}
          >
            <option value="inventario">🏭 Los lotes de proceso ya registrados (inventario + producción)</option>
            <option value="libre">✏️ Nada — se escriben a mano</option>
          </select>

          {!tipoOk && (
            <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 600, marginTop: '6px' }}>
              ⚠️ El tipo de este campo es «{field.type}». Para poder guardar varios lotes separados
              por coma conviene dejarlo en <strong>Texto</strong>.
            </div>
          )}

          <div style={{
            marginTop: '10px', padding: '9px 11px', background: 'white',
            border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', lineHeight: 1.7,
          }}>
            <strong style={{ color: conDestino.length > 0 ? '#166534' : '#b45309' }}>
              {conDestino.length > 0
                ? '✅ ¿En qué columna se eligen estos lotes?'
                : '⚠️ Elegí en qué columna se van a poder elegir estos lotes:'}
            </strong>

            {tablas.length === 0 && (
              <div style={{ color: '#6b7280' }}>
                Este formulario todavía no tiene tablas con columnas.
              </div>
            )}

            {tablas.map(({ el, indice }) => {
              const columnas = (el.columns || []).filter(c => c.label);
              const actual = columnaLotePadreDe(el);
              const esNueva = columnas.some(c => esColumnaLotePadre(c) && c.creadaAuto);
              return (
                <div key={indice} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                  <span style={{ color: '#1e40af', minWidth: '150px' }}>
                    📋 <strong>{el.title || `Tabla ${indice + 1}`}</strong>
                  </span>
                  <select
                    value={esNueva ? '__nueva__' : actual}
                    onChange={(e) => elegir(indice, el.columns || [], e.target.value)}
                    style={{ ...control, maxWidth: '260px', padding: '5px 8px', fontSize: '12px' }}
                  >
                    <option value="">— Ninguna (esta tabla no los usa) —</option>
                    {columnas.map((c, i) => (
                      <option key={i} value={c.label}>
                        {esColumnaLotePadre(c) && !c.creadaAuto ? `✅ ${c.label}` : c.label}
                      </option>
                    ))}
                    <option value="__nueva__">➕ Agregar una columna nueva</option>
                  </select>
                  {actual && (
                    <span style={{ color: '#166534', fontWeight: 600 }}>← recibe los lotes</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '11.5px', color: '#1e40af', marginTop: '6px', lineHeight: 1.6 }}>
            Al llenar el formulario, debajo del encabezado aparece la barra para cargar varios lotes
            (con el check <em>Un solo lote</em> si ese día entra uno solo). Se guardan en este campo
            separados por coma.
          </div>
        </div>
      )}
    </div>
  );
}

/** Comparación de lotes tolerante a mayúsculas / espacios. */
const igualLote = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * Selector de LOTES PADRE contra la API de lotes.
 *
 * Trae los lotes raíz del Inventario de Lotes (los que pueden ser padre) y deja
 * marcar cuáles se van a ofrecer en la columna de código padre: algunos elegidos
 * a mano, todos de un saque, o ninguno. Un lote que ya no esté en la API no se
 * pierde: se sigue mostrando marcado para poder desmarcarlo.
 *
 * @param {Object}   element  — la tabla (usa lotePadreLista)
 * @param {Function} onChange — (prop, valor) => void
 */
function SelectorLotesPadre({ element, onChange }) {
  const [opciones, setOpciones] = useState(null); // null = todavía cargando
  const [busca, setBusca] = useState('');
  const [manual, setManual] = useState('');
  const elegidos = listaLotePadreDe(element);
  const soloDisponibles = !!element?.lotePadreSoloDisponibles;

  const traer = (refrescar = false) => {
    setOpciones(null);
    cargarLotesPadre({ refrescar }).then(l => setOpciones(l || []));
  };
  useEffect(() => { traer(); }, []);

  const guardar = (lista) => onChange('lotePadreLista', lista);
  const alternar = (valor) => {
    guardar(elegidos.some(v => igualLote(v, valor))
      ? elegidos.filter(v => !igualLote(v, valor))
      : [...elegidos, valor]);
  };

  const agregarManual = () => {
    const valor = manual.trim();
    if (!valor) return;
    // Se aceptan varios de un saque: "260731, 260732"
    const nuevos = valor.split(/[,;/|]+/).map(v => v.trim()).filter(Boolean);
    const lista = [...elegidos];
    for (const v of nuevos) if (!lista.some(x => igualLote(x, v))) lista.push(v);
    guardar(lista);
    setManual('');
  };

  const cargando = opciones === null;
  const todosLosLotes = opciones || [];

  // Lo que se ve en la lista: los lotes de la API (filtrados por el buscador y,
  // si está tildado, por saldo) más los ya elegidos que la API no devolvió.
  const deApi = todosLosLotes.filter(o => {
    if (elegidos.some(v => igualLote(v, o.value))) return true; // un elegido nunca se esconde
    if (soloDisponibles && !(o.saldo > 0)) return false;
    if (!busca.trim()) return true;
    return o.label.toLowerCase().includes(busca.trim().toLowerCase());
  });
  const sueltos = elegidos
    .filter(v => !todosLosLotes.some(o => igualLote(o.value, v)))
    .map(v => ({ value: v, label: `${v} (no está en el inventario)`, saldo: 0 }));
  const visibles = [...sueltos, ...deApi];

  const boton = (texto, onClick, activo = true) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!activo}
      style={{
        padding: '4px 10px', borderRadius: '6px', border: '1px solid #93c5fd',
        background: activo ? 'white' : '#f1f5f9', color: activo ? '#1d4ed8' : '#94a3b8',
        fontSize: '11.5px', fontWeight: 600, cursor: activo ? 'pointer' : 'not-allowed',
      }}
    >
      {texto}
    </button>
  );

  return (
    <div style={{
      marginTop: '10px', background: 'white', border: '1px solid #bfdbfe',
      borderRadius: '8px', padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '12px', color: '#1d4ed8' }}>
          📦 Lotes padre de la API ({elegidos.length} elegidos)
        </strong>
        {boton('✅ Todos', () => guardar(visibles.map(o => o.value)), visibles.length > 0)}
        {boton('✖️ Ninguno', () => guardar([]), elegidos.length > 0)}
        {boton('🔄 Actualizar', () => traer(true), !cargando)}
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar lote…"
          style={{ ...control, width: '150px', padding: '4px 8px', fontSize: '12px', marginLeft: 'auto' }}
        />
      </div>

      {cargando ? (
        <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '8px' }}>
          ⏳ Buscando los lotes padre en el inventario…
        </div>
      ) : visibles.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#b45309', marginTop: '8px', lineHeight: 1.6 }}>
          {todosLosLotes.length === 0
            ? '⚠️ El inventario no devolvió ningún lote padre (o el backend no respondió). Podés escribirlos a mano acá abajo.'
            : '🔍 Ningún lote coincide con la búsqueda.'}
        </div>
      ) : (
        <div style={{
          marginTop: '8px', maxHeight: '200px', overflowY: 'auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '2px',
        }}>
          {visibles.map(o => {
            const marcado = elegidos.some(v => igualLote(v, o.value));
            return (
              <label
                key={o.value}
                style={{
                  ...filaCheck, fontSize: '12px', gap: '6px', padding: '3px 6px',
                  borderRadius: '5px', background: marcado ? '#eff6ff' : 'transparent',
                  color: marcado ? '#1d4ed8' : '#334155', fontWeight: marcado ? 600 : 500,
                }}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(o.value)}
                  style={{ ...check, width: '14px', height: '14px' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.label}>
                  {o.label}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '9px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarManual(); } }}
          placeholder="Agregar un lote que no está en la lista…"
          style={{ ...control, width: '250px', padding: '5px 8px', fontSize: '12px' }}
        />
        {boton('+ Agregar', agregarManual, !!manual.trim())}
      </div>

      <div style={{ fontSize: '11px', color: elegidos.length > 0 ? '#166534' : '#b45309', marginTop: '7px', fontWeight: 600, lineHeight: 1.6 }}>
        {elegidos.length > 0
          ? `✅ La columna va a ofrecer únicamente estos ${elegidos.length} lote(s): ${elegidos.slice(0, 6).join(', ')}${elegidos.length > 6 ? '…' : ''}`
          : '⚠️ Sin ningún lote marcado la columna se comporta como «todos los lotes de proceso». Marcá al menos uno.'}
      </div>
    </div>
  );
}

/**
 * Columna de CÓDIGO PADRE: una columna extra donde el operario elige, por fila,
 * a cuál de los lotes del encabezado pertenece esa línea. Sirve cuando un mismo
 * formulario procesa dos o más lotes a la vez.
 *
 * No es una columna virtual: al activarla se agrega de verdad a la tabla (y al
 * desactivarla se quita), así que se guarda, se exporta y se imprime como
 * cualquier otra.
 */
function CodigoPadreConfig({ element, onChange }) {
  const columnas = element?.columns || [];
  const colPadre = columnas.find(esColumnaLotePadre);
  const activo = !!colPadre;
  const [etiquetaNueva, setEtiquetaNueva] = useState('');

  /**
   * Columna que ya existe y claramente es la del lote: si la tabla tiene
   * "LOTE DE PROCESO" no tiene sentido agregar otra al lado, se usa esa.
   */
  const columnaLoteExistente = () => {
    const conLabel = columnas.filter(c => c.label);
    return conLabel.find(c => /lote\s*de\s*proceso/i.test(c.label))
      || conLabel.find(c => /lote/i.test(c.label) && !/lbs?|peso|cantidad/i.test(c.label))
      || null;
  };

  const alternar = (checked) => {
    if (!checked) {
      onChange('columns', quitarLotePadre(columnas));
      return;
    }
    // Si la tabla ya tiene "LOTE DE PROCESO" se usa esa, no se agrega otra al lado.
    const existente = columnaLoteExistente();
    const nombre = (etiquetaNueva || LABEL_LOTE_PADRE).trim() || LABEL_LOTE_PADRE;
    onChange('columns', asignarLotePadre(columnas, existente ? existente.label : '__nueva__', nombre));
  };

  /**
   * De dónde salen las opciones del desplegable. Son tres formas excluyentes,
   * guardadas en los dos campos que ya existían para no romper las plantillas
   * viejas (lotePadreOrigen) más la lista elegida a mano (lotePadreSeleccion).
   */
  const modo = lotePadreSeleccionDe(element) === 'algunos'
    ? 'algunos'
    : ((element?.lotePadreOrigen || 'ambos') === 'encabezado' ? 'encabezado' : 'todos');

  const cambiarModo = (nuevo) => {
    onChange('lotePadreSeleccion', nuevo === 'algunos' ? 'algunos' : 'todos');
    onChange('lotePadreOrigen', nuevo === 'encabezado' ? 'encabezado' : 'ambos');
  };

  /** Elegir QUÉ columna hace de código padre. */
  const usarColumna = (label) => {
    onChange('columns', asignarLotePadre(columnas, label, colPadre?.label || LABEL_LOTE_PADRE));
  };

  const renombrar = (label) => {
    onChange('columns', columnas.map(c => (esColumnaLotePadre(c) ? { ...c, label } : c)));
  };

  return (
    <div style={{
      background: activo ? '#eff6ff' : '#f9fafb',
      border: `1.5px solid ${activo ? '#93c5fd' : '#e5e7eb'}`,
      borderRadius: '10px',
      padding: '10px 14px',
      marginBottom: '16px',
    }}>
      <label style={{ ...filaCheck, color: activo ? '#1d4ed8' : '#4b5563', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => alternar(e.target.checked)}
          style={check}
        />
        <span>🔗 Agregar columna de código padre (elegir el lote del encabezado en cada fila)</span>
      </label>

      {activo ? (
        <div style={{ marginTop: '10px' }}>
          <label style={etiqueta}>¿Qué columna de la tabla recibe el lote?</label>
          <select
            value={colPadre.creadaAuto ? '__nueva__' : (colPadre.label || '')}
            onChange={(e) => usarColumna(e.target.value)}
            style={{ ...control, maxWidth: '380px' }}
          >
            <option value="__nueva__">➕ Una columna nueva</option>
            {columnas.filter(c => c.label && !esColumnaLotePadre(c)).map((c, i) => (
              <option key={i} value={c.label}>Usar la columna «{c.label}»</option>
            ))}
            {!colPadre.creadaAuto && <option value={colPadre.label}>Usar la columna «{colPadre.label}»</option>}
          </select>
          <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '3px' }}>
            Si la tabla ya tiene <em>LOTE DE PROCESO</em>, elegila acá y esa misma columna recibe los
            lotes — no se agrega ninguna al lado.
          </div>

          <label style={{ ...etiqueta, marginTop: '10px' }}>Nombre de la columna</label>
          <input
            type="text"
            value={colPadre.label || ''}
            onChange={(e) => renombrar(e.target.value)}
            placeholder={LABEL_LOTE_PADRE}
            style={{ ...control, maxWidth: '260px' }}
          />

          <label style={{ ...etiqueta, marginTop: '12px' }}>¿Qué lotes se ofrecen en esa columna?</label>
          <select value={modo} onChange={(e) => cambiarModo(e.target.value)} style={{ ...control, maxWidth: '440px' }}>
            <option value="todos">🏭 Todos los lotes de proceso (encabezado + inventario)</option>
            <option value="encabezado">📝 Solo los lotes escritos arriba, en el encabezado</option>
            <option value="algunos">✅ Solo los lotes que yo elija de la API de lotes</option>
          </select>

          {modo === 'algunos' && <SelectorLotesPadre element={element} onChange={onChange} />}

          <label style={{ ...filaCheck, marginTop: '10px', color: '#1d4ed8' }}>
            <input
              type="checkbox"
              checked={!!element?.lotePadreSoloDisponibles}
              onChange={(e) => onChange('lotePadreSoloDisponibles', e.target.checked)}
              style={check}
            />
            <span>
              Mostrar solo lotes de proceso con saldo disponible (oculta los que están en 0 y los
              ya consumidos)
              {modo === 'algunos' && ' — acá arriba también se acortan las opciones para elegir'}
            </span>
          </label>

          <label style={{ ...filaCheck, marginTop: '6px', color: '#1d4ed8' }}>
            <input
              type="checkbox"
              checked={!!element?.lotePadreUnico}
              onChange={(e) => onChange('lotePadreUnico', e.target.checked)}
              style={check}
            />
            <span>
              Un solo lote — el formulario arranca con un único cuadro para escribir el lote,
              en vez de la lista de varios
            </span>
          </label>

          <label style={{ ...filaCheck, marginTop: '6px', color: '#1d4ed8' }}>
            <input
              type="checkbox"
              checked={element?.lotePadreOcultarSiUno !== false}
              onChange={(e) => onChange('lotePadreOcultarSiUno', e.target.checked)}
              style={check}
            />
            <span>
              Esconder la columna cuando el formulario tenga <strong>un solo lote</strong> — se
              llena sola con el del encabezado y no se dibuja (repetiría el mismo dato en cada fila)
            </span>
          </label>

          <div style={{
            marginTop: '10px', padding: '7px 10px', background: 'white',
            border: '1px solid #bfdbfe', borderRadius: '6px',
            fontSize: '12px', color: '#166534', fontWeight: 600,
          }}>
            ✅ La columna <strong>{colPadre.label || LABEL_LOTE_PADRE}</strong> recibirá{' '}
            {modo === 'algunos'
              ? `los ${listaLotePadreDe(element).length} lote(s) elegidos de la API`
              : 'los lotes cargados en el encabezado'}.
            {colPadre.tipoPrevio && (
              <span style={{ color: '#6b7280', fontWeight: 500 }}>
                {' '}(antes era «{colPadre.tipoPrevio}»; si desactivás el panel vuelve a serlo)
              </span>
            )}
          </div>

          <div style={{ fontSize: '11.5px', color: '#1e40af', marginTop: '6px', lineHeight: 1.6 }}>
            {element?.lotePadreUnico && (
              <>El operario puede destildarlo desde el formulario si ese día entran varios lotes.{' '}</>
            )}
            {modo === 'algunos' ? (
              <>
                ✅ Al llenar el formulario, <strong>{colPadre.label || LABEL_LOTE_PADRE}</strong> será un
                desplegable con <strong>los lotes elegidos arriba</strong> y nada más, aunque el
                encabezado tenga otros. Cada opción muestra el saldo real del momento. Si el lote
                elegido ya no existe en el inventario igual se ofrece, con su número solo.
              </>
            ) : (
              <>
                ✅ Al llenar el formulario, <strong>{colPadre.label || LABEL_LOTE_PADRE}</strong> será un
                desplegable con los lotes escritos en el encabezado. Sirven las dos formas: varios campos
                de encabezado (<em>LOTE 1</em>, <em>LOTE 2</em>) o uno solo con los lotes separados por
                coma (<em>260729, 260730</em>). Si el encabezado está vacío, la celda deja escribir a mano.
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '6px', lineHeight: 1.6 }}>
          Sin activar, la tabla queda igual que ahora: no se agrega ninguna columna. Activala cuando
          el formulario trabaje con más de un lote y haga falta saber de cuál sale cada fila.
        </div>
      )}
    </div>
  );
}

/**
 * Configuración de ENTRADA al inventario: la tabla registra lotes nuevos con
 * saldo disponible. Es el camino inverso al panel naranja (que resta).
 * @param {Object}   element   — el bodyElement de tipo table
 * @param {Function} onChange  — (prop, valor) => void
 */
export function InventarioEntradaConfig({ element, onChange }) {
  const columnas = (element?.columns || []).filter(c => c.label);
  const activo = !!element?.guardaInventario;
  const sugerida = sugerirConfigEntrada(element);

  const activar = (checked) => {
    onChange('guardaInventario', checked);
    if (!checked) return;
    // Dejar el panel listo: vacío es la causa habitual de que no guarde nada.
    if (!element?.guardaLoteCol && sugerida.guardaLoteCol) onChange('guardaLoteCol', sugerida.guardaLoteCol);
    if (!element?.guardaProductoCol && sugerida.guardaProductoCol) onChange('guardaProductoCol', sugerida.guardaProductoCol);
    if (!element?.guardaCantidadCol && sugerida.guardaCantidadCol) onChange('guardaCantidadCol', sugerida.guardaCantidadCol);
    if (!element?.guardaClasificacionCol && sugerida.guardaClasificacionCol) {
      onChange('guardaClasificacionCol', sugerida.guardaClasificacionCol);
    }
    if (!element?.guardaLotePadreCol && sugerida.guardaLotePadreCol) {
      onChange('guardaLotePadreCol', sugerida.guardaLotePadreCol);
    }
  };

  const selectorCol = (prop, etiquetaTxt, ayuda, opcional = false) => (
    <div style={{ flex: 1, minWidth: '190px' }}>
      <label style={{ ...etiqueta, color: '#047857' }}>{etiquetaTxt}</label>
      <select
        value={element?.[prop] || ''}
        onChange={(e) => onChange(prop, e.target.value)}
        style={{ ...control, borderColor: (opcional || element?.[prop]) ? '#6ee7b7' : '#f87171' }}
      >
        <option value="">{opcional ? '— No usar —' : '-- Seleccionar columna --'}</option>
        {columnas.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}
      </select>
      {ayuda && <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px' }}>{ayuda}</div>}
    </div>
  );

  return (
    <div style={{
      background: activo ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : '#f9fafb',
      border: `2px solid ${activo ? '#34d399' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id={`guardaInventario-${element?.id ?? 'x'}`}
          checked={activo}
          onChange={(e) => activar(e.target.checked)}
          style={{ ...check, width: '18px', height: '18px', accentColor: '#059669' }}
        />
        <label
          htmlFor={`guardaInventario-${element?.id ?? 'x'}`}
          style={{ cursor: 'pointer', fontWeight: 600, color: activo ? '#047857' : '#4a5568', fontSize: '14px', margin: 0, textAlign: 'left' }}
        >
          <span>➕ Guardar en el Inventario de Lotes (esta tabla crea saldo)</span>
        </label>
      </div>

      {activo && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#065f46' }}>
            💡 Al guardar el formulario, cada fila se registra como un lote del inventario con su
            peso disponible, listo para que otro proceso lo consuma. Si el número de lote ya existe
            no se duplica ni se pisa — para corregir un peso hay que editar el lote en el Inventario.
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {selectorCol('guardaLoteCol', '🔢 Columna con el número de lote', 'El identificador del lote nuevo (código de producto, lote, etc.).')}
            {selectorCol('guardaCantidadCol', '⚖️ Columna con el peso que entra', 'Sin esto el lote entra con 0.00 Lbs y nadie podrá descontarlo.')}
            {selectorCol('guardaProductoCol', '🐟 Columna de producto', null, true)}
            {selectorCol('guardaClasificacionCol', '⭐ Columna de clasificación', null, true)}
            {selectorCol('guardaLotePadreCol', '🔗 Columna de lote padre', 'Para colgar el lote nuevo del lote de origen (trazabilidad).', true)}
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ ...etiqueta, color: '#047857' }}>⚙️ Proceso del lote</label>
              <input
                type="text"
                value={element?.guardaProceso || ''}
                onChange={(e) => onChange('guardaProceso', e.target.value)}
                placeholder="Por defecto: proceso de la plantilla"
                style={{ ...control, borderColor: '#6ee7b7' }}
              />
            </div>
          </div>

          {!element?.guardaLoteCol && (
            <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
              ⚠️ Falta elegir la columna con el número de lote — sin eso no se guarda nada.
            </div>
          )}
          {element?.guardaLoteCol && !element?.guardaCantidadCol && (
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
              ⚠️ Sin columna de peso los lotes entran en 0.00 Lbs y no se les puede descontar nada.
            </div>
          )}
          {element?.guardaLoteCol && element?.guardaCantidadCol && (
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, lineHeight: 1.6 }}>
              ✅ Por cada fila se crea el lote de <strong>{element.guardaLoteCol}</strong> con el peso
              de <strong>{element.guardaCantidadCol}</strong>. Las filas con el mismo lote se suman.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Configuración de "Cambio de Proceso": registra que los lotes de esta tabla
 * fueron enviados a otro proceso (ej. CC-05 Registro de Liberación).
 * Genera un movimiento de salida en el kardex marcado con #cambio_proceso,
 * que el Inventario de Lotes muestra como "🔄 Cambio de Proceso".
 */
function CambioProcesosConfig({ element, onChange }) {
  const columnas = (element?.columns || []).filter(c => c.label);
  const activo = !!element?.cambioProceso;
  const columnasLote = columnas.filter(esColumnaDeLote);

  const activar = (checked) => {
    onChange('cambioProceso', checked);
    if (!checked) return;
    // Precarga columnas sugeridas si están vacías
    const sug = sugerirConfigDescuento(element);
    if (!element?.cambioProcesLoteCol && sug.descuentaLoteCol)
      onChange('cambioProcesLoteCol', sug.descuentaLoteCol);
    if (!element?.cambioProcesoCantidadCol && sug.descuentaCantidadCol)
      onChange('cambioProcesoCantidadCol', sug.descuentaCantidadCol);
  };

  const grupos = (
    <>
      {columnasLote.length > 0 && (
        <optgroup label="📦 Enlazadas al inventario / producción (recomendado)">
          {columnasLote.map((c, i) => (
            <option key={`inv-${i}`} value={c.label}>
              {esColumnaProduccion(c) ? `🏭 ${c.label}` : `📦 ${c.label}`}
            </option>
          ))}
        </optgroup>
      )}
      {columnas.filter(c => !esColumnaDeLote(c)).length > 0 && (
        <optgroup label="✏️ Otras columnas">
          {columnas.filter(c => !esColumnaDeLote(c)).map((c, i) => (
            <option key={`otra-${i}`} value={c.label}>{c.label}</option>
          ))}
        </optgroup>
      )}
    </>
  );

  return (
    <div style={{
      background: activo ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#f9fafb',
      border: `2px solid ${activo ? '#4ade80' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id={`cambioProceso-${element?.id ?? 'x'}`}
          checked={activo}
          onChange={(e) => activar(e.target.checked)}
          style={{ ...check, width: '18px', height: '18px', accentColor: '#16a34a' }}
        />
        <label
          htmlFor={`cambioProceso-${element?.id ?? 'x'}`}
          style={{ cursor: 'pointer', fontWeight: 600, color: activo ? '#15803d' : '#4a5568', fontSize: '14px', margin: 0, textAlign: 'left' }}
        >
          <span>🔄 Cambio de Proceso (esta tabla mueve lotes a otro proceso)</span>
        </label>
      </div>

      {activo && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#14532d' }}>
            💡 Al guardar el formulario, la cantidad de cada fila se resta del lote y queda
            marcada en el kardex como <strong>"🔄 Cambio de Proceso"</strong>. En el Inventario
            de Lotes se verá cuántas Lbs pasaron a este proceso. Ideal para registrar que el
            lote fue enviado a <strong>Registro de Liberación (CC-05)</strong> u otro formulario.
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '190px' }}>
              <label style={{ ...etiqueta, color: '#15803d' }}>🔢 Columna con el número de lote</label>
              <select
                value={element?.cambioProcesLoteCol || columnasLote[0]?.label || ''}
                onChange={(e) => onChange('cambioProcesLoteCol', e.target.value)}
                style={{ ...control, borderColor: '#86efac' }}
              >
                <option value="">-- Seleccionar columna --</option>
                {grupos}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '190px' }}>
              <label style={{ ...etiqueta, color: '#15803d' }}>⚖️ Columna con la cantidad a mover</label>
              <select
                value={element?.cambioProcesoCantidadCol || ''}
                onChange={(e) => onChange('cambioProcesoCantidadCol', e.target.value)}
                style={{ ...control, borderColor: element?.cambioProcesoCantidadCol ? '#86efac' : '#f87171' }}
              >
                <option value="">-- Seleccionar columna --</option>
                {columnas.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ ...etiqueta, color: '#15803d' }}>🏭 Proceso de destino (ej. CC-05)</label>
              <input
                type="text"
                value={element?.cambioProcesoDest || ''}
                onChange={(e) => onChange('cambioProcesoDest', e.target.value)}
                placeholder="Ej: CC-05, Liberación, Empaque…"
                style={{ ...control, borderColor: '#86efac' }}
              />
              <div style={{ fontSize: '11px', color: '#166534', marginTop: '3px' }}>
                Aparece como proceso en el kardex del lote.
              </div>
            </div>
          </div>

          {(element?.cambioProcesLoteCol || columnasLote[0]?.label) && element?.cambioProcesoCantidadCol && (
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, lineHeight: 1.6 }}>
              ✅ Por cada fila: saldo del lote de <strong>{element?.cambioProcesLoteCol || columnasLote[0]?.label}</strong>{' '}
              − valor de <strong>{element?.cambioProcesoCantidadCol}</strong>
              {element?.cambioProcesoDest && <> → proceso <strong>{element.cambioProcesoDest}</strong></>}.
              <div style={{ color: '#166534', fontWeight: 500, marginTop: '2px' }}>
                En Inventario de Lotes aparecerá como 🔄 Cambio de Proceso con la cantidad enviada.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InventarioTablaConfig({ element, onChange }) {
  const columnas = (element?.columns || []).filter(c => c.label);
  const activo = !!element?.descuentaInventario;
  const columnasLote = columnas.filter(esColumnaDeLote);
  const loteColActual = element?.descuentaLoteCol || columnasLote[0]?.label || '';
  const sugerida = sugerirConfigDescuento(element);

  // Las columnas que NO están enlazadas al inventario también sirven (se compara
  // el texto de la celda con el número de lote), pero hay que distinguirlas: una
  // columna suelta con el lote mal escrito es la causa de "el lote no existe".
  const columnasSueltas = columnas.filter(c => !esColumnaDeLote(c));
  const colLoteElegida = columnas.find(c => c.label === loteColActual) || null;
  const loteElegidaEnlazada = !!colLoteElegida && esColumnaDeLote(colLoteElegida);

  const grupos = (
    <>
      {columnasLote.length > 0 && (
        <optgroup label="📦 Enlazadas al inventario / producción (recomendado)">
          {columnasLote.map((c, i) => (
            <option key={`inv-${i}`} value={c.label}>
              {esColumnaProduccion(c) ? `🏭 ${c.label}` : `📦 ${c.label}`}
            </option>
          ))}
        </optgroup>
      )}
      {columnasSueltas.length > 0 && (
        <optgroup label="✏️ Otras columnas (se compara el texto escrito)">
          {columnasSueltas.map((c, i) => (
            <option key={`otra-${i}`} value={c.label}>{c.label}</option>
          ))}
        </optgroup>
      )}
    </>
  );

  /**
   * Al activar el descuento se rellenan las tres columnas con la mejor
   * suposición. Dejarlas vacías es la causa habitual de que "no reste nada":
   * el operario guarda el formulario y el servicio se salta la tabla.
   */
  const activarDescuento = (checked) => {
    onChange('descuentaInventario', checked);
    if (!checked) return;
    if (!element?.descuentaLoteCol && sugerida.descuentaLoteCol) {
      onChange('descuentaLoteCol', sugerida.descuentaLoteCol);
    }
    if (!element?.descuentaProductoCol && sugerida.descuentaProductoCol) {
      onChange('descuentaProductoCol', sugerida.descuentaProductoCol);
    }
    if (!element?.descuentaCantidadCol && sugerida.descuentaCantidadCol) {
      onChange('descuentaCantidadCol', sugerida.descuentaCantidadCol);
    }
  };

  return (
    <>
    <AutoProduccionLegacyConfig element={element} onChange={onChange} />
    <CodigoPadreConfig element={element} onChange={onChange} />
    <InventarioEntradaConfig element={element} onChange={onChange} />

    <div style={{
      background: activo ? 'linear-gradient(135deg, #fff7ed, #ffedd5)' : '#f9fafb',
      border: `2px solid ${activo ? '#fb923c' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id={`descuentaInventario-${element?.id ?? 'x'}`}
          checked={activo}
          onChange={(e) => activarDescuento(e.target.checked)}
          style={{ ...check, width: '18px', height: '18px', accentColor: '#ea580c' }}
        />
        <label
          htmlFor={`descuentaInventario-${element?.id ?? 'x'}`}
          style={{ cursor: 'pointer', fontWeight: 600, color: activo ? '#c2410c' : '#4a5568', fontSize: '14px', margin: 0, textAlign: 'left' }}
        >
          <span>➖ Restar del Inventario de Lotes (esta tabla consume saldo)</span>
        </label>
      </div>

      {/* Modo "solo dejar constancia": mismo mecanismo, pero sin tocar el saldo. */}
      <div style={{
        marginTop: '10px', padding: '8px 10px',
        background: element?.registraSinDescontar ? '#eff6ff' : '#f8fafc',
        border: `1.5px solid ${element?.registraSinDescontar ? '#93c5fd' : '#e2e8f0'}`,
        borderRadius: '8px',
      }}>
        <label style={{ ...filaCheck, fontSize: '13px', fontWeight: 600, color: element?.registraSinDescontar ? '#1d4ed8' : '#4a5568' }}>
          <input
            type="checkbox"
            checked={!!element?.registraSinDescontar}
            onChange={(e) => onChange('registraSinDescontar', e.target.checked)}
            style={{ ...check, width: '18px', height: '18px', accentColor: '#2563eb' }}
          />
          <span>🔄 Solo registrar el movimiento — SIN restar del saldo</span>
        </label>
        <div style={{ fontSize: '11px', color: element?.registraSinDescontar ? '#1e40af' : '#6b7280', marginTop: '4px', lineHeight: 1.6 }}>
          {element?.registraSinDescontar
            ? 'Al guardar queda anotado en el kardex «pasaron X Lbs a este proceso», pero el lote sigue disponible con el mismo saldo. Sirve para ver el flujo sin que el producto salga del inventario.'
            : 'Tildalo cuando el formulario solo declara que la mercadería pasó a otro proceso y todavía no debe salir del inventario.'}
          {element?.registraSinDescontar && activo && (
            <div style={{ color: '#b45309', fontWeight: 600, marginTop: '4px' }}>
              ⚠️ Está activo también «Restar del Inventario»: manda el descuento y este registro no se aplica.
              Destildá uno de los dos.
            </div>
          )}
        </div>

        {element?.registraSinDescontar && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>Columna con el número de lote</div>
              <select
                value={element?.traspasoLoteCol || ''}
                onChange={(e) => onChange('traspasoLoteCol', e.target.value)}
                style={{ ...control, borderColor: element?.traspasoLoteCol ? '#86efac' : '#f87171' }}
              >
                <option value="">— Elegir columna —</option>
                {(element?.columns || []).filter(c => c?.label).map(c => (
                  <option key={c.label} value={c.label}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>Columna con la cantidad que pasa</div>
              <select
                value={element?.traspasoCantidadCol || ''}
                onChange={(e) => onChange('traspasoCantidadCol', e.target.value)}
                style={{ ...control, borderColor: element?.traspasoCantidadCol ? '#86efac' : '#f87171' }}
              >
                <option value="">— Elegir columna —</option>
                {(element?.columns || []).filter(c => c?.label).map(c => (
                  <option key={c.label} value={c.label}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>Proceso al que pasa</div>
              <input
                type="text"
                value={element?.traspasoDest || ''}
                onChange={(e) => onChange('traspasoDest', e.target.value)}
                placeholder="Ej: Congelación"
                style={{ ...control, borderColor: element?.traspasoDest ? '#86efac' : '#f87171' }}
              />
            </div>
            {(!element?.traspasoLoteCol || !element?.traspasoCantidadCol) && (
              <div style={{ fontSize: '10.5px', color: '#b45309', fontWeight: 600, lineHeight: 1.5 }}>
                ⚠️ Faltan las dos columnas: sin ellas no se registra nada al guardar.
              </div>
            )}
            {element?.traspasoLoteCol && element?.traspasoCantidadCol && (
              <div style={{ fontSize: '10.5px', color: '#1e40af', lineHeight: 1.5 }}>
                Al guardar: por cada fila se anota <strong>{element.traspasoCantidadCol}</strong> del lote
                de <strong>{element.traspasoLoteCol}</strong>
                {element?.traspasoDest && <> → <strong>{element.traspasoDest}</strong></>}, sin restar saldo.
              </div>
            )}
          </div>
        )}
      </div>

      {activo && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#9a3412' }}>
            💡 Al guardar el formulario, la cantidad de cada fila se resta del saldo del lote elegido
            y queda registrada en el kardex. Si se vuelve a guardar el mismo formulario solo se
            aplica la diferencia — nunca se descuenta dos veces.
          </div>

          {columnasLote.length === 0 && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px',
              padding: '10px 12px', fontSize: '12px', color: '#92400e', lineHeight: 1.6,
            }}>
              🧩 <strong>Esta tabla todavía no tiene una columna de lote enlazada.</strong> Para que
              el operario <em>elija</em> el lote (y no lo escriba a mano) creá o editá la columna así:
              <div style={{ marginTop: '6px', paddingLeft: '4px' }}>
                1. En la columna, <strong>Tipo = 📦 Inventario</strong>.<br />
                2. <strong>¿De dónde salen los valores?</strong> → <strong>🏭 el formulario de
                producción</strong> (ej. PD-04 Fileteo) si el lote viene de producción, o
                <strong> 📦 Inventario de Lotes (saldos)</strong> si se elige un lote ya existente.<br />
                3. <strong>Campo que se lista</strong> → <strong>Lote de Proceso</strong> (producción)
                o <strong>Número de Lote</strong> (inventario).<br />
                4. Volvé acá y elegila en <strong>Columna con el número de lote</strong>.
              </div>
              Mientras no exista, podés elegir cualquier columna de texto: se compara lo escrito
              contra el número de lote, y si no coincide exacto no se descuenta.
            </div>
          )}

          {colLoteElegida && !loteElegidaEnlazada && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px',
              padding: '9px 12px', fontSize: '12px', color: '#92400e',
            }}>
              ✏️ <strong>{loteColActual}</strong> no está enlazada al inventario: el descuento
              compara el texto escrito contra el número de lote. Un espacio o una letra de
              diferencia y la fila no descuenta. Poné la columna en Tipo = 📦 Inventario para
              que sea un desplegable.
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '190px' }}>
              <label style={{ ...etiqueta, color: '#c2410c' }}>🔢 Columna con el número de lote</label>
              <select
                value={loteColActual}
                onChange={(e) => onChange('descuentaLoteCol', e.target.value)}
                style={{ ...control, borderColor: loteColActual ? '#fdba74' : '#f87171' }}
              >
                <option value="">-- Seleccionar columna --</option>
                {grupos}
              </select>
              <div style={{ fontSize: '11px', color: '#9a3412', marginTop: '3px' }}>
                Es la celda donde el operario elige el lote: de ahí sale el saldo que se resta.
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '190px' }}>
              <label style={{ ...etiqueta, color: '#c2410c' }}>🐟 Columna de producto (opcional)</label>
              <select
                value={element?.descuentaProductoCol || ''}
                onChange={(e) => onChange('descuentaProductoCol', e.target.value)}
                style={{ ...control, borderColor: '#fdba74' }}
              >
                <option value="">— No usar —</option>
                {columnas.map((c, i) => (
                  <option key={i} value={c.label}>
                    {esColumnaInventario(c) ? `📦 ${c.label}` : c.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '11px', color: '#9a3412', marginTop: '3px' }}>
                Si el lote de proceso tiene un lote hijo por producto (260725-P01), esto elige el hijo correcto.
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '190px' }}>
              <label style={{ ...etiqueta, color: '#c2410c' }}>⚖️ Columna con la cantidad a restar</label>
              <select
                value={element?.descuentaCantidadCol || ''}
                onChange={(e) => onChange('descuentaCantidadCol', e.target.value)}
                style={{ ...control, borderColor: element?.descuentaCantidadCol ? '#fdba74' : '#f87171' }}
              >
                <option value="">-- Seleccionar columna --</option>
                {columnas.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}
              </select>
              <div style={{ fontSize: '11px', color: '#9a3412', marginTop: '3px' }}>
                Las Lbs que salen del lote en esa fila (peso neto / cantidad usada).
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ ...etiqueta, color: '#c2410c' }}>⚙️ Proceso del movimiento</label>
              <input
                type="text"
                value={element?.descuentaProceso || ''}
                onChange={(e) => onChange('descuentaProceso', e.target.value)}
                placeholder="Por defecto: proceso de la plantilla"
                style={{ ...control, borderColor: '#fdba74' }}
              />
            </div>
          </div>

          {(!loteColActual || !element?.descuentaCantidadCol) && (
            <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
              ⚠️ Falta elegir {[
                !loteColActual ? 'la columna con el número de lote' : null,
                !element?.descuentaCantidadCol ? 'la columna con la cantidad a restar' : null,
              ].filter(Boolean).join(' y ')} — sin eso esta tabla no descuenta nada.
            </div>
          )}
          {loteColActual && element?.descuentaCantidadCol && (
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, lineHeight: 1.6 }}>
              ✅ Por cada fila: saldo del lote de <strong>{loteColActual}</strong>
              {element?.descuentaProductoCol && <> (lote hijo según <strong>{element.descuentaProductoCol}</strong>)</>}
              {' '}− valor de <strong>{element.descuentaCantidadCol}</strong>.
              <div style={{ color: '#166534', fontWeight: 500, marginTop: '2px' }}>
                El movimiento queda en el kardex del lote (visible en Clasificación de Producción,
                columna Saldo → 📜 Kardex).
              </div>
              {!element?.descuentaProductoCol && columnasLote.some(esColumnaProduccion) && (
                <div style={{ color: '#b45309', fontWeight: 600, marginTop: '4px' }}>
                  ⚠️ La columna de lote viene de un resumen de producción (lote de proceso).
                  Sin columna de producto se descuenta del lote padre, no del lote del producto.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── CAMBIO DE PROCESO ─────────────────────────────────────────────── */}
    <CambioProcesosConfig element={element} onChange={onChange} />
    </>
  );
}

export default {
  InventarioColumnaConfig, InventarioAutoCompletar,
  InventarioTablaConfig, InventarioEntradaConfig,
};
