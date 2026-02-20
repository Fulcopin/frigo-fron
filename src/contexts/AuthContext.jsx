import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService'; // ✅ IMPORTANTE: Importar el servicio
import sessionTimeService from '../services/sessionTimeService'; // ⏱️ Servicio de tiempo

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
    if (authService.isSessionActive()) {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      // ⏱️ Solo iniciar cronómetro si NO hay uno ya activo (no sobreescribir al recargar)
      if (!sessionTimeService.getSessionStart() && currentUser) {
        sessionTimeService.startSession(currentUser);
      }
    } else {
      // Si la sesión no es válida o expiró, guardar registro y limpiar
      sessionTimeService.endSession();
      authService.logout();
      setUser(null);
    }
    setLoading(false);
  }, []);

  // ⏱️ Guardar snapshot de sesión automáticamente al cerrar la pestaña/navegador
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Guardar el tiempo transcurrido SIN borrar el cronómetro
      // → si el usuario recarga, el cronómetro continúa desde el inicio original
      // → si cierra el navegador, el historial ya tiene el registro guardado
      sessionTimeService.saveSessionSnapshot();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const login = async (username, password) => {
    try {
      // ✅ AHORA: Llamamos a la API a través del servicio
      const result = await authService.login(username, password);

      if (result.success) {
        // Si la API responde OK, actualizamos el estado global de React
        setUser(result.user);
        // ⏱️ Iniciar cronómetro de sesión
        sessionTimeService.startSession(result.user);
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
    // ⏱️ Detener cronómetro y guardar registro
    sessionTimeService.endSession();
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