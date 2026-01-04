import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Si ya está autenticado, redirigir
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Por favor ingresa usuario y contraseña');
      setLoading(false);
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="fish-animation">
          <div className="fish">🐟</div>
          <div className="fish">🐠</div>
          <div className="fish">🐡</div>
        </div>
      </div>

      <div className="login-card">
        {/* 🆕 Título principal grande */}
        <div className="main-title">
          <h1 className="frigolab-title">Frigolab Docs</h1>
          <div className="title-underline"></div>
        </div>

        <div className="login-header">
          <div className="logo-container">
            {/* Logo de Frigolab Docs */}
            <img 
              src="/logo-frigolab-docs.png" 
              alt="Frigolab Docs Logo" 
              className="logo-image"
              onError={(e) => {
                // Fallback si no se encuentra la imagen
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
            />
            <div className="logo-fallback" style={{ display: 'none' }}>
              <div className="logo-icon">🐟</div>
            </div>
          </div>
          <p className="login-subtitle">Sistema de Formularios Dinámicos</p>
          <p className="login-description">Frigolab "San Mateo"</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              <span className="label-icon">👤</span>
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Contraseña
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Iniciando sesión...
              </>
            ) : (
              <>
                <span>🚀</span>
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="demo-credentials">
            <strong>Credenciales de acceso:</strong><br/>
            👑 admin / fishcort2025<br/>
            🔑 iflogin / ifpwd25<br/>
            👷 operador / fishcort2025
          </p>
          <p className="company-info">
            Frigolab "San Mateo" © 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
