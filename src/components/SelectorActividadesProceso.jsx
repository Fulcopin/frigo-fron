import React, { useMemo, useState } from 'react';
import {
  ACTIVIDADES_TODAS, ACTIVIDADES_PESCADO, ACTIVIDADES_CAMARON,
  origenActividad, normActividad, parseActividades, serializarActividades,
} from '../utils/actividadesProceso';
import './SelectorActividadesProceso.css';

/**
 * Campo «Proceso - Productivo» de la plantilla: multi-selección sobre el
 * catálogo completo de actividades (pescado + camarón).
 *
 * Se comunica con el resto del sistema por STRING separado por comas, que es
 * como `supervisa` ya venía guardándose y como lo imprimen ViewForms, el PDF,
 * el Excel y la pantalla de firmas. Por eso no hace falta tocar nada de eso.
 *
 * Lo que ya está guardado se respeta: cualquier valor que no esté en el
 * catálogo (un "Jefe de Producción" viejo, por ejemplo) entra igual como chip
 * marcado «personalizada» y se conserva al guardar.
 *
 * @param {string} value      Valor actual de template.supervisa.
 * @param {(s:string)=>void} onChange  Recibe el string ya serializado.
 */
export default function SelectorActividadesProceso({ value, onChange, disabled = false }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [nueva, setNueva] = useState('');

  const seleccionadas = useMemo(() => parseActividades(value), [value]);
  const setSel = useMemo(() => new Set(seleccionadas.map(normActividad)), [seleccionadas]);

  const emitir = (lista) => onChange(serializarActividades(lista));

  const alternar = (act) => {
    const n = normActividad(act);
    emitir(setSel.has(n)
      ? seleccionadas.filter(a => normActividad(a) !== n)
      : [...seleccionadas, act]);
  };

  const agregarVarias = (lista) => {
    const nuevas = lista.filter(a => !setSel.has(normActividad(a)));
    if (nuevas.length) emitir([...seleccionadas, ...nuevas]);
  };

  const agregarNueva = () => {
    const limpio = nueva.trim().replace(/\s+/g, ' ');
    if (!limpio) return;
    if (!setSel.has(normActividad(limpio))) emitir([...seleccionadas, limpio]);
    setNueva('');
  };

  // Las personalizadas (no están en el catálogo) se listan primero para que se
  // vea de una que la plantilla trae algo fuera de lista.
  const personalizadas = seleccionadas.filter(a => !origenActividad(a));

  const visibles = useMemo(() => {
    const q = normActividad(busqueda);
    return q ? ACTIVIDADES_TODAS.filter(a => normActividad(a).includes(q)) : ACTIVIDADES_TODAS;
  }, [busqueda]);

  const icono = (act) => ({ pescado: '🐟', camaron: '🦐', ambas: '🐟🦐' }[origenActividad(act)] || '✏️');

  return (
    <div className={`sap-wrap ${disabled ? 'sap-disabled' : ''}`}>
      <div className="sap-chips" onClick={() => !disabled && setAbierto(true)}>
        {seleccionadas.length === 0 && (
          <span className="sap-placeholder">Sin actividades — clic para elegir del catálogo</span>
        )}
        {seleccionadas.map(act => (
          <span key={act} className={`sap-chip ${origenActividad(act) ? `sap-${origenActividad(act)}` : 'sap-custom'}`}>
            <span className="sap-chip-ico">{icono(act)}</span>
            {act}
            {!disabled && (
              <button
                type="button"
                className="sap-chip-x"
                title={`Quitar ${act}`}
                onClick={(e) => { e.stopPropagation(); alternar(act); }}
              >×</button>
            )}
          </span>
        ))}
      </div>

      <div className="sap-barra">
        <button type="button" className="sap-btn sap-btn-main" disabled={disabled}
                onClick={() => setAbierto(v => !v)}>
          {abierto ? '▲ Cerrar catálogo' : `▼ Elegir actividades (${ACTIVIDADES_TODAS.length})`}
        </button>
        <span className="sap-conteo">
          {seleccionadas.length} seleccionada{seleccionadas.length === 1 ? '' : 's'}
          {personalizadas.length > 0 && ` · ${personalizadas.length} personalizada${personalizadas.length === 1 ? '' : 's'}`}
        </span>
        {seleccionadas.length > 0 && !disabled && (
          <button type="button" className="sap-btn sap-btn-link" onClick={() => emitir([])}>
            Limpiar
          </button>
        )}
      </div>

      {abierto && !disabled && (
        <div className="sap-panel">
          <div className="sap-panel-top">
            <input
              type="text"
              className="sap-buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar actividad…"
            />
            <button type="button" className="sap-btn sap-btn-mini sap-pescado"
                    onClick={() => agregarVarias(ACTIVIDADES_PESCADO)}>
              🐟 Todas pescado ({ACTIVIDADES_PESCADO.length})
            </button>
            <button type="button" className="sap-btn sap-btn-mini sap-camaron"
                    onClick={() => agregarVarias(ACTIVIDADES_CAMARON)}>
              🦐 Todas camarón ({ACTIVIDADES_CAMARON.length})
            </button>
          </div>

          <div className="sap-lista">
            {visibles.length === 0 && <div className="sap-vacio">Sin resultados para «{busqueda}»</div>}
            {visibles.map(act => {
              const marcada = setSel.has(normActividad(act));
              return (
                <label key={act} className={`sap-item ${marcada ? 'sap-item-on' : ''}`}>
                  <input type="checkbox" checked={marcada} onChange={() => alternar(act)} />
                  <span className="sap-item-ico">{icono(act)}</span>
                  <span className="sap-item-txt">{act}</span>
                </label>
              );
            })}
          </div>

          <div className="sap-panel-bot">
            <input
              type="text"
              className="sap-nueva"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarNueva(); } }}
              placeholder="¿Falta una? Escribila y agregala…"
            />
            <button type="button" className="sap-btn sap-btn-mini" onClick={agregarNueva}>
              + Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
