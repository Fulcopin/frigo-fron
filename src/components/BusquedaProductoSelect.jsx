/**
 * BusquedaProductoSelect.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Selector de "por dónde busca" una columna o campo contra el catálogo de
 * productos: por código, por nombre/material, o nada.
 *
 * Se usa en Crear y Editar plantilla, al lado del check «🌐 API Búsqueda».
 * Con esto una columna como "MATERIAL DE EMPAQUE / INSUMO" puede buscar por su
 * propio nombre y completar el código sola, que antes solo funcionaba al revés.
 */

import PropTypes from 'prop-types';
import { BUSQUEDA_PRODUCTO_OPCIONES } from '../utils/busquedaProducto';

export default function BusquedaProductoSelect({ valor, onChange }) {
  return (
    <div className="form-group" style={{ minWidth: '190px' }}>
      <label
        style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}
        title="Cómo busca esta celda en el catálogo de productos. La columna pareja (código ↔ nombre) se completa sola al elegir."
      >
        🔎 Búsqueda de producto
      </label>
      <select
        value={valor || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: '12px', width: '100%' }}
      >
        {BUSQUEDA_PRODUCTO_OPCIONES.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

BusquedaProductoSelect.propTypes = {
  valor: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
