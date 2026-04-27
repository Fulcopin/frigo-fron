import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { API_EXTERNAL_BASE_URL } from '../apiConfig';

/**
 * 🐟📦 EspecieProductoSelector
 *
 * Selector en cascada: Especie → Productos filtrados por especie.
 * Dos modos:
 *   - inline (rangeMode=false): para celdas de tabla, elige un producto y llama onChange
 *   - rangeMode=true:           panel flotante desde el encabezado de columna,
 *                               permite elegir especie + producto + rango de filas
 *
 * Usa los endpoints:
 *   GET api/ProductosUnion/Especies
 *   GET api/ProductosUnion/ProductosPorEspecie?especie=...
 */
const EspecieProductoSelector = ({
  value = '',
  onChange,
  especiesData = [],       // lista precargada [{nombreEs, ...}] desde FillForm
  productosData = [],      // lista de todos los productos como fallback
  getToken,                // async () => string  — función para obtener el Bearer token
  rangeMode = false,
  totalRows = 0,
  onRangeApply,            // (product, fromRowIdx, toRowIdx) => void  (0-based)
  onClose,
}) => {
  const [searchEspecie, setSearchEspecie] = useState('');
  const [selectedEspecie, setSelectedEspecie] = useState('');
  const [productos, setProductos] = useState([]);
  const [searchProducto, setSearchProducto] = useState(value || '');
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [showEspecieDrop, setShowEspecieDrop] = useState(false);
  const [showProductoDrop, setShowProductoDrop] = useState(false);
  const [fromRow, setFromRow] = useState(1);
  const [toRow, setToRow] = useState(totalRows || 1);

  const especieRef = useRef(null);
  const productoRef = useRef(null);

  // Actualizar toRow cuando cambia totalRows
  useEffect(() => {
    if (totalRows > 0) setToRow(totalRows);
  }, [totalRows]);

  // Sincronizar searchProducto con value externo (modo inline)
  useEffect(() => {
    if (!rangeMode) setSearchProducto(value || '');
  }, [value, rangeMode]);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handle = (e) => {
      if (especieRef.current && !especieRef.current.contains(e.target)) setShowEspecieDrop(false);
      if (productoRef.current && !productoRef.current.contains(e.target)) setShowProductoDrop(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Lista de especies normalizada — acepta objetos {nombreEs}, {nombre} o strings directos
  const especiesList = [...new Set(
    (especiesData || [])
      .map(e => {
        if (typeof e === 'string') return e;
        return e.nombreEs || e.nombre || e.descripcion || null;
      })
      .filter(Boolean)
  )].sort();

  const filteredEspecies = searchEspecie.trim()
    ? especiesList.filter(e => e.toLowerCase().includes(searchEspecie.toLowerCase()))
    : especiesList;

  const filteredProductos = productos.filter(p =>
    p.toLowerCase().includes(searchProducto.toLowerCase())
  );

  // Normaliza texto quitando acentos y convirtiendo a minúsculas para comparar
  const normalize = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Filtra productosData (catálogo completo) buscando los que pertenecen a la especie
  const filterProductosByEspecieLocal = (especie) => {
    const norm = normalize(especie);
    return productosData
      .map(p => p.nombreEs || p.nombre || String(p))
      .filter(Boolean)
      .filter(p => normalize(p).includes(norm));
  };

  const parseProductosList = (data) => {
    // La API devuelve { especie: "...", productos: ["prod1", "prod2", ...] }
    const raw = data.productos || data.$values || (Array.isArray(data) ? data : []);
    return raw
      .map(p => (typeof p === 'string' ? p : p.nombreEs || p.nombre || String(p)))
      .filter(p => typeof p === 'string' && p.trim().length > 0 && p !== '[object Object]');
  };

  const loadProductosByEspecie = async (especie) => {
    if (!especie) { setProductos([]); return; }
    setLoadingProductos(true);

    const url = `${API_EXTERNAL_BASE_URL}/ProductosUnion/ProductosPorEspecie?especie=${encodeURIComponent(especie)}`;

    try {
      // Obtener token siempre (el endpoint requiere autenticación)
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      if (typeof getToken === 'function') {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });

      if (res.ok) {
        const data = await res.json();
        const list = parseProductosList(data);
        if (list.length > 0) {
          setProductos(list);
          setLoadingProductos(false);
          return;
        }
        console.warn('EspecieProductoSelector: respuesta OK pero lista vacía para', especie);
      } else {
        console.warn('EspecieProductoSelector: ProductosPorEspecie respondió', res.status, 'para', especie);
      }
    } catch (err) {
      console.warn('EspecieProductoSelector: error al cargar productos', err.message);
    }

    // Fallback: filtrar del catálogo local ya cargado
    const fallback = filterProductosByEspecieLocal(especie);
    if (fallback.length > 0) {
      setProductos(fallback);
    } else {
      const all = productosData
        .map(p => p.nombreEs || p.nombre || String(p))
        .filter(p => typeof p === 'string' && p.trim().length > 0 && p !== '[object Object]');
      setProductos(all);
    }
    setLoadingProductos(false);
  };

  const selectEspecie = (especie) => {
    setSelectedEspecie(especie);
    setSearchEspecie(especie);
    setShowEspecieDrop(false);
    setSearchProducto('');
    setProductos([]);
    loadProductosByEspecie(especie);
    setTimeout(() => setShowProductoDrop(true), 100);
  };

  const selectProducto = (producto) => {
    setSearchProducto(producto);
    setShowProductoDrop(false);
    if (!rangeMode) onChange(producto);
  };

  /* ─── MODO INLINE (celda individual) ─────────────────────────────────── */
  if (!rangeMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '130px' }}>
        {/* Especie */}
        <div ref={especieRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={especiesList.length > 0 ? `🐟 Especie (${especiesList.length})...` : '⏳ Cargando especies...'}
            value={searchEspecie}
            onChange={(e) => { setSearchEspecie(e.target.value); setShowEspecieDrop(true); }}
            onFocus={() => setShowEspecieDrop(true)}
            style={styles.inputCompact}
          />
          {showEspecieDrop && (
            <div style={styles.dropdownCompact}>
              {filteredEspecies.length === 0 ? (
                <div style={{ ...styles.dropdownItem, color: '#9ca3af', fontStyle: 'italic' }}>
                  {especiesList.length === 0
                    ? '⏳ Cargando especies...'
                    : `Sin resultados para "${searchEspecie}"`}
                </div>
              ) : (
                filteredEspecies.map((e, i) => (
                  <div
                    key={i}
                    onMouseDown={() => selectEspecie(e)}
                    style={styles.dropdownItem}
                    onMouseOver={ev => ev.currentTarget.style.background = '#e0f2fe'}
                    onMouseOut={ev => ev.currentTarget.style.background = 'white'}
                  >
                    {e}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Producto */}
        <div ref={productoRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={
              loadingProductos ? '⏳ Cargando...'
              : selectedEspecie ? '📦 Producto...'
              : '↑ Elige especie'
            }
            value={searchProducto}
            disabled={!selectedEspecie && productos.length === 0}
            onChange={(e) => {
              setSearchProducto(e.target.value);
              setShowProductoDrop(true);
              onChange(e.target.value);
            }}
            onFocus={() => { if (filteredProductos.length > 0) setShowProductoDrop(true); }}
            style={{
              ...styles.inputCompact,
              background: !selectedEspecie && productos.length === 0 ? '#f9fafb' : 'white',
            }}
          />
          {showProductoDrop && filteredProductos.length > 0 && (
            <div style={{ ...styles.dropdownCompact, zIndex: 998 }}>
              {filteredProductos.map((p, i) => (
                <div
                  key={i}
                  onMouseDown={() => selectProducto(p)}
                  style={styles.dropdownItem}
                  onMouseOver={ev => ev.currentTarget.style.background = '#e0f2fe'}
                  onMouseOut={ev => ev.currentTarget.style.background = 'white'}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── MODO RANGO (panel flotante desde encabezado de columna) ─────────── */
  return (
    <div style={styles.panel}>
      {/* Encabezado */}
      <div style={styles.panelHeader}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>
          🐟📦 Completar rango — Especie → Producto
        </span>
        <button type="button" onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      {/* Paso 1: Especie */}
      <div style={styles.step}>
        <label style={styles.stepLabel}>
          1. Selecciona especie
          {especiesList.length > 0 && (
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 4 }}>
              ({especiesList.length} disponibles)
            </span>
          )}
        </label>
        <div ref={especieRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={especiesList.length > 0 ? '🐟 Escribe o busca especie...' : '⏳ Cargando especies...'}
            value={searchEspecie}
            onChange={(e) => { setSearchEspecie(e.target.value); setShowEspecieDrop(true); }}
            onFocus={() => setShowEspecieDrop(true)}
            style={styles.inputFull}
          />
          {showEspecieDrop && (
            <div style={styles.dropdownFull}>
              {filteredEspecies.length === 0 ? (
                <div style={{ ...styles.dropdownItemFull, color: '#9ca3af', fontStyle: 'italic' }}>
                  {especiesList.length === 0
                    ? '⏳ Sin datos de especies todavía...'
                    : `Sin resultados para "${searchEspecie}"`}
                </div>
              ) : (
                filteredEspecies.map((e, i) => (
                  <div
                    key={i}
                    onMouseDown={() => selectEspecie(e)}
                    style={styles.dropdownItemFull}
                    onMouseOver={ev => ev.currentTarget.style.background = '#e0f2fe'}
                    onMouseOut={ev => ev.currentTarget.style.background = 'white'}
                  >
                    {e}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Paso 2: Producto */}
      <div style={styles.step}>
        <label style={styles.stepLabel}>2. Selecciona producto</label>
        <div ref={productoRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={
              loadingProductos ? '⏳ Cargando productos...'
              : selectedEspecie ? '📦 Busca o escribe producto...'
              : 'Selecciona especie primero ↑'
            }
            value={searchProducto}
            disabled={!selectedEspecie}
            onChange={(e) => { setSearchProducto(e.target.value); setShowProductoDrop(true); }}
            onFocus={() => { if (filteredProductos.length > 0) setShowProductoDrop(true); }}
            style={{ ...styles.inputFull, background: !selectedEspecie ? '#f9fafb' : 'white' }}
          />
          {showProductoDrop && filteredProductos.length > 0 && (
            <div style={{ ...styles.dropdownFull, zIndex: 9998 }}>
              {filteredProductos.map((p, i) => (
                <div
                  key={i}
                  onMouseDown={() => selectProducto(p)}
                  style={styles.dropdownItemFull}
                  onMouseOver={ev => ev.currentTarget.style.background = '#e0f2fe'}
                  onMouseOut={ev => ev.currentTarget.style.background = 'white'}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Paso 3: Rango de filas */}
      <div style={styles.step}>
        <label style={styles.stepLabel}>3. Rango de filas a completar</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <span style={styles.miniLabel}>Desde fila</span>
            <input
              type="number"
              min={1}
              max={totalRows || 9999}
              value={fromRow}
              onChange={(e) => setFromRow(Math.max(1, Number(e.target.value)))}
              style={styles.rangeInput}
            />
          </div>
          <span style={{ fontSize: 18, color: '#9ca3af', paddingBottom: 6 }}>→</span>
          <div style={{ flex: 1 }}>
            <span style={styles.miniLabel}>Hasta fila</span>
            <input
              type="number"
              min={1}
              max={totalRows || 9999}
              value={toRow}
              onChange={(e) => setToRow(Math.max(1, Number(e.target.value)))}
              style={styles.rangeInput}
            />
          </div>
        </div>
        {totalRows > 0 && (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>
            {totalRows} {totalRows === 1 ? 'fila disponible' : 'filas disponibles'}
          </span>
        )}
      </div>

      {/* Botón Aplicar */}
      <button
        type="button"
        disabled={!searchProducto}
        onClick={() => {
          if (searchProducto) {
            onRangeApply(searchProducto, fromRow - 1, toRow - 1);
            onClose();
          }
        }}
        style={{
          width: '100%',
          padding: '10px',
          background: searchProducto
            ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
            : '#e5e7eb',
          color: searchProducto ? 'white' : '#9ca3af',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 13,
          cursor: searchProducto ? 'pointer' : 'not-allowed',
          marginTop: 4,
          transition: 'all 0.2s',
        }}
      >
        {searchProducto
          ? `✅ Aplicar "${searchProducto}" a filas ${fromRow}–${toRow}`
          : '⬆ Selecciona especie y producto primero'}
      </button>
    </div>
  );
};

/* ─── Estilos compartidos ───────────────────────────────────────────────── */
const styles = {
  inputCompact: {
    width: '100%',
    padding: '3px 6px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: '0.78rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  dropdownCompact: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 999,
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    maxHeight: 320,
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  dropdownItem: {
    padding: '5px 8px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    color: '#111827',
    background: 'white',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  panel: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 18,
    width: 340,
    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid #e5e7eb',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#6b7280',
    lineHeight: 1,
    padding: '0 2px',
  },
  step: {
    marginBottom: 12,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#374151',
    display: 'block',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  inputFull: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    boxSizing: 'border-box',
    outline: 'none',
  },
  dropdownFull: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    maxHeight: 350,
    overflowY: 'auto',
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
  },
  dropdownItemFull: {
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 13,
    color: '#111827',
    background: 'white',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  miniLabel: {
    fontSize: 10,
    color: '#6b7280',
    display: 'block',
    marginBottom: 3,
  },
  rangeInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    boxSizing: 'border-box',
    textAlign: 'center',
  },
};

EspecieProductoSelector.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  especiesData: PropTypes.array,
  productosData: PropTypes.array,
  getToken: PropTypes.func,
  rangeMode: PropTypes.bool,
  totalRows: PropTypes.number,
  onRangeApply: PropTypes.func,
  onClose: PropTypes.func,
};

export default EspecieProductoSelector;
