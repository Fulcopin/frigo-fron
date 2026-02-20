import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './UserSelector.css';

/**
 * 👤 UserSelector - Selector de usuarios con autocompletado
 * 
 * Componente que permite seleccionar usuarios de una lista filtrada.
 * Soporta búsqueda por texto y filtrado automático por rol.
 * 
 * Props:
 * @param {Array} users - Lista de usuarios disponibles
 * @param {string} value - Valor actual (nombre completo)
 * @param {function} onChange - Callback cuando cambia la selección
 * @param {string} placeholder - Texto placeholder
 * @param {boolean} disabled - Si está deshabilitado
 * @param {string} puesto - Nombre del puesto (para filtrar por rol)
 */
const UserSelector = ({ users, value, onChange, placeholder, disabled, puesto }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Filtrar usuarios por búsqueda
  useEffect(() => {
    if (!users || users.length === 0) {
      setFilteredUsers([]);
      return;
    }

    const search = searchTerm.toLowerCase().trim();
    
    if (!search) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user => {
      const nombre = user.nombreCompleto?.toLowerCase() || '';
      const email = user.email?.toLowerCase() || '';
      const userName = user.userName?.toLowerCase() || '';
      
      return nombre.includes(search) || 
             email.includes(search) || 
             userName.includes(search);
    });

    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sincronizar valor externo con búsqueda interna
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value || '');
    }
  }, [value]);

  // Manejar selección de usuario
  const handleSelectUser = (user) => {
    setSearchTerm(user.nombreCompleto);
    // Pasar nombre y email: onChange(nombreCompleto, email, userObj)
    onChange(user.nombreCompleto, user.email, user);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Manejar cambio en el input
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue); // Permitir escritura libre también
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  // Manejar teclas (navegación y selección)
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredUsers[selectedIndex]) {
          handleSelectUser(filteredUsers[selectedIndex]);
        }
        break;
      
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      
      default:
        break;
    }
  };

  // Abrir dropdown al hacer focus
  const handleFocus = () => {
    if (!disabled && users && users.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="user-selector" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="user-selector-input"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Buscar o escribir nombre...'}
        disabled={disabled}
        autoComplete="off"
      />
      
      {isOpen && filteredUsers.length > 0 && (
        <div className="user-selector-dropdown">
          <div className="user-selector-header">
            {users.length !== filteredUsers.length ? (
              <span>📋 {filteredUsers.length} de {users.length} usuarios</span>
            ) : (
              <span>📋 {users.length} usuarios disponibles</span>
            )}
            {puesto && (
              <span className="puesto-badge">{puesto}</span>
            )}
          </div>
          
          <ul className="user-selector-list">
            {filteredUsers.map((user, index) => (
              <li
                key={user.id || index}
                className={`user-selector-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelectUser(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="user-info">
                  <span className="user-name">{user.nombreCompleto}</span>
                  <span className="user-role">{user.rol}</span>
                </div>
                <div className="user-details">
                  <span className="user-email">{user.email}</span>
                  <span className="user-company">{user.nombreEmpresa}</span>
                </div>
              </li>
            ))}
          </ul>
          
          {filteredUsers.length === 0 && searchTerm && (
            <div className="user-selector-empty">
              <p>❌ No se encontraron usuarios</p>
              <small>Puedes escribir el nombre manualmente</small>
            </div>
          )}
        </div>
      )}
      
      {!users || users.length === 0 ? (
        <small className="user-selector-hint">
          ⚠️ Cargando usuarios...
        </small>
      ) : null}
    </div>
  );
};

UserSelector.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    nombreCompleto: PropTypes.string,
    email: PropTypes.string,
    rol: PropTypes.string,
    nombreEmpresa: PropTypes.string,
    userName: PropTypes.string
  })),
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  puesto: PropTypes.string
};

UserSelector.defaultProps = {
  users: [],
  value: '',
  placeholder: 'Buscar o escribir nombre...',
  disabled: false,
  puesto: null
};

export default UserSelector;
