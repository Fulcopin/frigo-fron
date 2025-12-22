import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar si hay sesión guardada al cargar
  useEffect(() => {
    const storedUser = localStorage.getItem('fishcort_user');
    const storedToken = localStorage.getItem('fishcort_token');
    const tokenExpiration = localStorage.getItem('fishcort_token_expiration');

    if (storedUser && storedToken && tokenExpiration) {
      const expirationDate = new Date(tokenExpiration);
      if (expirationDate > new Date()) {
        setUser(JSON.parse(storedUser));
      } else {
        // Token expirado, limpiar
        localStorage.removeItem('fishcort_user');
        localStorage.removeItem('fishcort_token');
        localStorage.removeItem('fishcort_token_expiration');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // Aquí puedes conectar con tu API real
      // Por ahora, validación simple de ejemplo
      
      // Credenciales válidas
      const validCredentials = [
        { user: 'admin', pass: 'fishcort2025', rol: 'admin', nombre: 'Administrador' },
        { user: 'iflogin', pass: 'ifpwd25', rol: 'admin', nombre: 'Admin IFrigolab' },
        { user: 'operador', pass: 'fishcort2025', rol: 'operador', nombre: 'Operador' }
      ];

      const credential = validCredentials.find(
        c => c.user === username && c.pass === password
      );

      if (credential) {
        const userData = {
          id: 1,
          username: username,
          nombre: credential.nombre,
          rol: credential.rol,
          email: `${username}@fishcort.com`
        };

        const token = btoa(`${username}:${Date.now()}`); // Token simple para demo
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 8); // 8 horas de sesión

        localStorage.setItem('fishcort_user', JSON.stringify(userData));
        localStorage.setItem('fishcort_token', token);
        localStorage.setItem('fishcort_token_expiration', expirationDate.toISOString());

        setUser(userData);
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Credenciales inválidas' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error al iniciar sesión' };
    }
  };

  const logout = () => {
    localStorage.removeItem('fishcort_user');
    localStorage.removeItem('fishcort_token');
    localStorage.removeItem('fishcort_token_expiration');
    setUser(null);
  };

  const getToken = () => {
    return localStorage.getItem('fishcort_token');
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    getToken,
    isAuthenticated
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
