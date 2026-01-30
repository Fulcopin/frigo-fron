import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

/**
 * Componente para proteger rutas basadas en roles
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componente hijo a renderizar
 * @param {string|string[]} props.allowedRoles - Rol(es) permitido(s) para acceder a la ruta
 */
const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '2rem'
      }}>
        <div>
          <div className="spinner" style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ marginTop: '1rem', color: '#667eea' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  // Verificar si está autenticado
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar si el usuario tiene el rol permitido
  const user = authService.getCurrentUser();
  
  if (!user || !user.rol) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Convertir allowedRoles a array si es un string
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // Verificar si el usuario tiene alguno de los roles permitidos
  const hasAccess = rolesArray.includes(user.rol);

  if (!hasAccess) {
    // Si no tiene acceso, mostrar página de acceso denegado
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '5rem',
          marginBottom: '1rem'
        }}>
          🚫
        </div>
        <h1 style={{
          fontSize: '2rem',
          color: '#e53e3e',
          marginBottom: '1rem'
        }}>
          Acceso Denegado
        </h1>
        <p style={{
          fontSize: '1.2rem',
          color: '#4a5568',
          marginBottom: '2rem',
          maxWidth: '600px'
        }}>
          No tienes permisos para acceder a esta página. 
          Tu rol actual es <strong>{user.rol}</strong>.
        </p>
        <p style={{
          fontSize: '1rem',
          color: '#718096',
          marginBottom: '2rem'
        }}>
          Esta página requiere uno de los siguientes roles: 
          <strong> {rolesArray.join(', ')}</strong>
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#5568d3'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#667eea'}
        >
          ← Volver atrás
        </button>
      </div>
    );
  }

  // Si tiene acceso, renderizar el componente hijo
  return children;
};

export default RoleBasedRoute;
