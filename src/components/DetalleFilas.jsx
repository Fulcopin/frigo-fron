// ====================================
// DETALLE EN VENTANA — varias filas dentro de una celda
// ====================================
// Reemplaza a tener columnas fijas como TAMAÑO y CANTIDAD.
//
// El problema de las columnas fijas es que solo entra UN valor por fila: si en
// un lote se usaron fundas de tres tamaños distintos, había que repetir toda la
// fila de producción o anotarlo en observaciones. Y si un formato necesitaba
// cuatro datos por insumo, había que agregar cuatro columnas a la tabla, que ya
// no entra en la pantalla.
//
// Acá la celda guarda una lista. Se abre una ventana, se cargan las filas que
// hagan falta, y en la celda queda el resumen.

import { useState, useEffect } from 'react';
import ProductoAutocomplete from './ProductoAutocomplete';
import './DetalleFilas.css';

/** Siempre hay una fila: una lista vacía no se puede empezar a llenar. */
const filaVacia = (campos) =>
  Object.fromEntries((campos || []).map(c => [c.key || c.label, '']));

const normalizar = (valor, campos) => {
  let lista = valor;
  if (typeof lista === 'string') {
    try { lista = JSON.parse(lista); } catch { lista = []; }
  }
  if (!Array.isArray(lista)) lista = [];
  return lista.length > 0 ? lista : [filaVacia(campos)];
};

/** Resumen para la celda: "3 tamaños · 240 unidades". */
export function resumenDetalle(valor, campos) {
  let lista = valor;
  if (typeof lista === 'string') {
    try { lista = JSON.parse(lista); } catch { return ''; }
  }
  if (!Array.isArray(lista)) return '';

  const llenas = lista.filter(f => Object.values(f || {}).some(v => String(v ?? '').trim()));
  if (llenas.length === 0) return '';

  // Si hay una columna numérica se muestra su total: es el dato que se busca
  // de un vistazo sin abrir la ventana.
  const numerica = (campos || []).find(c => c.type === 'number');
  if (numerica) {
    const k = numerica.key || numerica.label;
    const total = llenas.reduce((a, f) => a + (parseFloat(String(f[k]).replace(',', '.')) || 0), 0);
    if (total > 0) return `${llenas.length} ítem(s) · ${total.toLocaleString('es-EC')}`;
  }
  return `${llenas.length} ítem(s)`;
}

/** Valor de un registro del catálogo según lo que pide el campo. */
const valorDelCatalogo = (item, cual) => String(
  cual === 'codigo'
    ? (item?.codigo ?? item?.cod ?? item?.codArticulo ?? item?.detCodigo ?? item?.id ?? '')
    : (item?.nombre ?? item?.nombreEs ?? item?.descripcion ?? item?.detDescripcion ?? '')
).trim();

/**
 * Completa los demás campos de la fila a partir del que se acaba de llenar.
 *
 * El operario escribe el CÓDIGO y el nombre del insumo aparece solo; o elige el
 * insumo y el código se completa. Sin esto hay que buscar cada material en otra
 * pantalla y transcribir el código a mano, que es donde se cuelan los errores.
 *
 * Qué trae cada campo se declara en la plantilla (API + «Trae»), igual que en
 * las columnas normales. Antes se adivinaba por el nombre del campo, y eso
 * fallaba en cuanto alguien lo llamaba distinto.
 */
function completarDesdeCatalogo(catalogos, campo, valor, campos) {
  const api = campo?.apiEndpoint;
  if (!api) return null;

  const catalogo = catalogos?.[api];
  if (!Array.isArray(catalogo) || catalogo.length === 0) return null;

  const v = String(valor ?? '').trim();
  if (v.length < 2) return null;   // con una letra hay demasiadas coincidencias

  const norm = (x) => String(x ?? '').trim().toLowerCase();
  const cual = campo.apiCampo || 'nombre';

  // Exacta primero; si no, la única que empiece igual. Con varias parciales no
  // se completa nada: elegir por el operario sería adivinar.
  let item = catalogo.find(it => norm(valorDelCatalogo(it, cual)) === norm(v));
  if (!item) {
    const parciales = catalogo.filter(it => norm(valorDelCatalogo(it, cual)).startsWith(norm(v)));
    if (parciales.length !== 1) return null;
    item = parciales[0];
  }

  // Los demás campos que usan la MISMA api pero traen otra parte del registro.
  const cambios = [];
  for (const otro of campos || []) {
    if (otro === campo) continue;
    if (otro.apiEndpoint !== api) continue;
    const cualOtro = otro.apiCampo || 'nombre';
    if (cualOtro === cual) continue;

    const valorOtro = valorDelCatalogo(item, cualOtro);
    if (valorOtro) cambios.push({ clave: otro.key || otro.label, valor: valorOtro });
  }

  return cambios.length > 0 ? cambios : null;
}

/**
 * @param {object} [catalogos] { INSUMOS: [...], PRODUCTOS: [...] } — los
 *        catálogos que el formulario ya tiene cargados, por endpoint.
 */
/**
 * @param {Function} [getToken] token de la API externa. Con él los campos que
 *        declaran búsqueda usan el MISMO buscador que las columnas de la tabla,
 *        que consulta la API en vivo — no una lista precargada.
 */
export default function DetalleFilas({ valor, campos, titulo, onGuardar, onCerrar, soloLectura, catalogos, getToken }) {
  const [filas, setFilas] = useState(() => normalizar(valor, campos));

  useEffect(() => {
    const escape = (e) => { if (e.key === 'Escape') onCerrar?.(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onCerrar]);

  const cambiar = (i, k, v) => setFilas(prev => prev.map((f, idx) => {
    if (idx !== i) return f;
    const fila = { ...f, [k]: v };

    // Si el campo editado es código o material, se completa el otro.
    const campo = (campos || []).find(c => (c.key || c.label) === k);
    if (campo) {
      const cambios = completarDesdeCatalogo(catalogos, campo, v, campos || []);
      // No se pisa lo que el operario ya escribió a mano: solo se completa lo
      // que está vacío.
      for (const c of cambios || []) {
        if (!String(fila[c.clave] ?? '').trim()) fila[c.clave] = c.valor;
      }
    }
    return fila;
  }));

  const agregar = () => setFilas(prev => [...prev, filaVacia(campos)]);

  // Nunca se borra la última: dejar la lista en cero obliga a cerrar y volver a
  // abrir para poder cargar algo.
  const quitar = (i) =>
    setFilas(prev => prev.length <= 1 ? [filaVacia(campos)] : prev.filter((_, idx) => idx !== i));

  const guardar = () => {
    // Las filas totalmente vacías no se guardan: ensucian el reporte con
    // renglones en blanco que después hay que filtrar.
    const limpias = filas.filter(f => Object.values(f || {}).some(v => String(v ?? '').trim()));
    onGuardar?.(limpias);
    onCerrar?.();
  };

  const cols = campos || [];

  return (
    <div className="df-fondo" onClick={onCerrar}>
      <div className="df-panel" onClick={(e) => e.stopPropagation()}>
        <div className="df-cab">
          <span className="df-titulo">{titulo || 'Detalle'}</span>
          <button type="button" className="df-cerrar" onClick={onCerrar} title="Cerrar (Escape)">✕</button>
        </div>

        <div className="df-cuerpo">
          <table className="df-tabla">
            <thead>
              <tr>
                <th style={{ width: 38 }}>#</th>
                {cols.map(c => <th key={c.key || c.label}>{c.label}</th>)}
                {!soloLectura && <th style={{ width: 44 }} />}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  <td className="df-num">{i + 1}</td>
                  {cols.map(c => {
                    const k = c.key || c.label;
                    const opcionesBase = Array.isArray(c.options) ? c.options : [];
                    // Un valor guardado que ya no está en la lista se sigue mostrando: si no,
                    // el selector queda en "— Elegir —" y parece que el dato se perdió.
                    const valorGuardado = fila[k];
                    const estaEnLista = opcionesBase.some(o =>
                      String(o && typeof o === 'object' ? (o.value ?? o.label) : o) === String(valorGuardado));
                    const opciones = (valorGuardado != null && String(valorGuardado).trim() !== '' && !estaEnLista)
                      ? [...opcionesBase, String(valorGuardado)]
                      : opcionesBase;
                    return (
                      <td key={k}>
                        {/* Búsqueda en vivo contra la API, igual que en las
                            columnas de la tabla. Al elegir un artículo se
                            completan el código Y el nombre de una sola vez, sin
                            depender de que el catálogo esté precargado. */}
                        {c.busqueda && c.type !== 'select' ? (
                          <ProductoAutocomplete
                            value={fila[k] ?? ''}
                            onChange={(v) => cambiar(i, k, typeof v === 'string' ? v : (v?.selectedValue ?? ''))}
                            searchType={c.busqueda}
                            getToken={getToken}
                            placeholder={c.busqueda === 'codigoErp'
                              ? 'Buscar por código…'
                              : `Buscar ${(c.label || 'artículo').toLowerCase()}…`}
                            onSelect={(art) => {
                              // Se llenan TODOS los campos de la fila que
                              // declaren búsqueda: el que se tocó y su par.
                              setFilas(prev => prev.map((f, idx) => {
                                if (idx !== i) return f;
                                const nueva = { ...f };
                                for (const campo of cols) {
                                  const ck = campo.key || campo.label;
                                  if (campo.busqueda === 'codigoErp') nueva[ck] = art.codigoErp ?? '';
                                  else if (campo.busqueda) nueva[ck] = art.nombreProducto ?? '';
                                }
                                return nueva;
                              }));
                            }}
                          />
                        ) : c.type === 'select' && opciones.length > 0 ? (
                          <select value={fila[k] ?? ''} disabled={soloLectura}
                                  onChange={(e) => cambiar(i, k, e.target.value)}>
                            <option value="">— Elegir —</option>
                            {opciones.map(o => {
                              const v = typeof o === 'object' ? (o.value ?? o.label) : o;
                              return <option key={v} value={v}>{typeof o === 'object' ? (o.label ?? v) : o}</option>;
                            })}
                          </select>
                        ) : (
                          <input
                            type={c.type === 'number' ? 'number' : 'text'}
                            inputMode={c.type === 'number' ? 'decimal' : undefined}
                            value={fila[k] ?? ''}
                            disabled={soloLectura}
                            onChange={(e) => cambiar(i, k, e.target.value)}
                            placeholder={c.placeholder
                              || (c.apiEndpoint ? 'Elegí de la lista…' : '')}
                            list={c.apiEndpoint ? `df-cat-${k}` : undefined}
                          />
                        )}
                      </td>
                    );
                  })}
                  {!soloLectura && (
                    <td className="df-num">
                      <button type="button" className="df-quitar" onClick={() => quitar(i)}
                              title="Quitar esta fila">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sugerencias del catálogo: el operario ve las opciones mientras
              escribe, en vez de tener que saberlas de memoria.
              Se corta en 500 porque un datalist con miles de opciones traba el
              navegador en tablet. */}
          {cols.map(c => {
            const k = c.key || c.label;
            const lista = c.apiEndpoint ? catalogos?.[c.apiEndpoint] : null;
            if (!Array.isArray(lista) || lista.length === 0) return null;
            return (
              <datalist key={k} id={`df-cat-${k}`}>
                {lista.slice(0, 500).map((it, n) => {
                  const v = valorDelCatalogo(it, c.apiCampo || 'nombre');
                  return v ? <option key={n} value={v} /> : null;
                })}
              </datalist>
            );
          })}

          {!soloLectura && (
            <button type="button" className="df-agregar" onClick={agregar}>
              ➕ Agregar fila
            </button>
          )}
        </div>

        <div className="df-pie">
          <button type="button" className="df-btn df-btn-sec" onClick={onCerrar}>Cancelar</button>
          {!soloLectura && (
            <button type="button" className="df-btn df-btn-ok" onClick={guardar}>
              ✅ Guardar {filas.filter(f => Object.values(f || {}).some(v => String(v ?? '').trim())).length} fila(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}