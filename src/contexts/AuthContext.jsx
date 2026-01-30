import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService'; // ✅ IMPORTANTE: Importar el servicio

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

  // Verificar si hay sesión guardada al cargar la página
  useEffect(() => {
    // Usamos el servicio para verificar la sesión, no lo hacemos manual aquí
    if (authService.isSessionActive()) {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
    } else {
      // Si la sesión no es válida o expiró, limpiamos
      authService.logout();
      setUser(null);
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // ✅ AHORA: Llamamos a la API a través del servicio
      const result = await authService.login(username, password);

      if (result.success) {
        // Si la API responde OK, actualizamos el estado global de React
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error en AuthContext:', error);
      return { success: false, error: 'Error inesperado al iniciar sesión' };
    }
  };

  const logout = () => {
    authService.logout(); // Limpia localStorage
    setUser(null); // Limpia estado de React
  };

  const getToken = () => {
    return authService.getToken();
  };

  const isAuthenticated = () => {
    return user !== null && authService.isSessionActive();
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