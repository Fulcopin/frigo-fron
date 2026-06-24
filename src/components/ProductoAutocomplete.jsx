import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { API_EXTERNAL_BASE_URL } from '../apiConfig';

/**
 * ProductoAutocomplete
 * 
 * Componente de autocompletado para buscar productos por código o por nombre.
 * Utiliza los endpoints:
 * - /api/ProductosUnion/ProductosPorCodigoErp?codigoErp=...
 * - /api/ProductosUnion/ProductosPorNombre?nombreProducto=...
 */
const ProductoAutocomplete = ({
  value = '',
  onChange,
  onSelect,
  searchType = 'nombreProducto', // 'codigoErp' o 'nombreProducto'
  getToken,
  placeholder = 'Buscar producto...',
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  // Sincronizar el valor externo SOLO si no estamos escribiendo
  useEffect(() => {
    if (value !== searchTerm && !showDropdown) {
      setSearchTerm(value || '');
    }
  }, [value]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchProducts = async (term) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      if (typeof getToken === 'function') {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const endpoint = searchType === 'codigoErp' 
        ? `ProductosPorCodigoErp?codigoErp=${encodeURIComponent(term)}`
        : `ProductosPorNombre?nombreProducto=${encodeURIComponent(term)}`;

      const url = `${API_EXTERNAL_BASE_URL}/ProductosUnion/${endpoint}`;
      
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const list = data.$values || (Array.isArray(data) ? data : []);
        setResults(list);
      } else {
        setResults([]);
        console.warn('Error al buscar productos', res.status);
      }
    } catch (err) {
      console.error('Error de red al buscar productos', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para la búsqueda
  useEffect(() => {
    
    const timer = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        searchProducts(searchTerm);
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, searchType]);

  const handleChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setShowDropdown(true);
    if (onChange) onChange(val);
  };

  const handleSelect = (product) => {
    const selectedValue = searchType === 'codigoErp' ? product.codigoErp : product.nombreProducto;
    setSearchTerm(selectedValue);
    setShowDropdown(false);
    if (onSelect) {
      onSelect(product);
    } else if (onChange) {
      onChange(selectedValue);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '130px' }}>
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0) setShowDropdown(true);
        }}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '4px 6px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          fontSize: '0.78rem',
          boxSizing: 'border-box',
          outline: 'none',
          backgroundColor: disabled ? '#f3f4f6' : 'white'
        }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 8, top: 6, fontSize: '10px', color: '#6b7280' }}>
          ⏳
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          maxHeight: '250px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          marginTop: '2px'
        }}>
          {results.map((p, i) => (
            <div
              key={p.id || i}
              onMouseDown={() => handleSelect(p)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: '#111827',
                borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ fontWeight: searchType === 'codigoErp' ? 'bold' : 'normal' }}>
                {p.codigoErp}
              </div>
              <div style={{ fontSize: '0.7rem', color: searchType === 'nombreProducto' ? '#111827' : '#4b5563', fontWeight: searchType === 'nombreProducto' ? 'bold' : 'normal' }}>
                {p.nombreProducto}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

ProductoAutocomplete.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onSelect: PropTypes.func,
  searchType: PropTypes.oneOf(['codigoErp', 'nombreProducto']),
  getToken: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool
};

export default ProductoAutocomplete;
