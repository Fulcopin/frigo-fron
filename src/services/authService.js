// Servicio de autenticación para FishCort
const API_BASE_URL = 'http://127.0.0.1:5074/api';

class AuthService {
  constructor() {
    this.storageKeys = {
      user: 'fishcort_user',
      token: 'fishcort_token',
      tokenExpiration: 'fishcort_token_expiration'
    };
  }

  /**
   * Iniciar sesión
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async login(username, password) {
    try {
      // TODO: Conectar con tu endpoint real de autenticación
      // const response = await fetch(`${API_BASE_URL}/Auth/login`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username, password })
      // });

      // Por ahora, validación de demo
      if (username === 'admin' && password === 'fishcort2025') {
        const userData = {
          id: 1,
          username: username,
          nombre: 'Administrador FishCort',
          rol: 'admin',
          email: 'admin@fishcort.com',
          permisos: ['all']
        };

        const token = this.generateToken(username);
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 8); // 8 horas

        this.saveSession(userData, token, expirationDate);

        return { success: true, user: userData };
      } else if (username === 'operador' && password === 'fishcort2025') {
        const userData = {
          id: 2,
          username: username,
          nombre: 'Operador FishCort',
          rol: 'operador',
          email: 'operador@fishcort.com',
          permisos: ['fill-form', 'view-forms']
        };

        const token = this.generateToken(username);
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 8);

        this.saveSession(userData, token, expirationDate);

        return { success: true, user: userData };
      } else {
        return { 
          success: false, 
          error: '❌ Credenciales inválidas. Por favor verifica tu usuario y contraseña.' 
        };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { 
        success: false, 
        error: '⚠️ Error al conectar con el servidor. Intenta nuevamente.' 
      };
    }
  }

  /**
   * Generar token simple (para demo)
   * En producción, el token viene del backend
   */
  generateToken(username) {
    return btoa(`${username}:${Date.now()}:${Math.random()}`);
  }

  /**
   * Guardar sesión en localStorage
   */
  saveSession(userData, token, expirationDate) {
    localStorage.setItem(this.storageKeys.user, JSON.stringify(userData));
    localStorage.setItem(this.storageKeys.token, token);
    localStorage.setItem(this.storageKeys.tokenExpiration, expirationDate.toISOString());
  }

  /**
   * Cerrar sesión
   */
  logout() {
    localStorage.removeItem(this.storageKeys.user);
    localStorage.removeItem(this.storageKeys.token);
    localStorage.removeItem(this.storageKeys.tokenExpiration);
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser() {
    const userStr = localStorage.getItem(this.storageKeys.user);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('Error al parsear usuario:', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Obtener token actual
   */
  getToken() {
    return localStorage.getItem(this.storageKeys.token);
  }

  /**
   * Verificar si la sesión está activa
   */
  isSessionActive() {
    const user = this.getCurrentUser();
    const token = this.getToken();
    const expirationStr = localStorage.getItem(this.storageKeys.tokenExpiration);

    if (!user || !token || !expirationStr) {
      return false;
    }

    try {
      const expirationDate = new Date(expirationStr);
      const now = new Date();

      if (expirationDate <= now) {
        // Sesión expirada, limpiar
        this.logout();
        return false;
      }

      return true;
    } catch (e) {
      console.error('Error al verificar expiración:', e);
      return false;
    }
  }

  /**
   * Verificar permisos del usuario
   */
  hasPermission(permission) {
    const user = this.getCurrentUser();
    if (!user || !user.permisos) return false;

    return user.permisos.includes('all') || user.permisos.includes(permission);
  }

  /**
   * Obtener tiempo restante de sesión (en minutos)
   */
  getSessionTimeRemaining() {
    const expirationStr = localStorage.getItem(this.storageKeys.tokenExpiration);
    if (!expirationStr) return 0;

    try {
      const expirationDate = new Date(expirationStr);
      const now = new Date();
      const diffMs = expirationDate - now;
      return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    } catch (e) {
      return 0;
    }
  }

  /**
   * Renovar sesión (extender expiración)
   */
  renewSession() {
    const user = this.getCurrentUser();
    const token = this.getToken();

    if (user && token) {
      const newExpirationDate = new Date();
      newExpirationDate.setHours(newExpirationDate.getHours() + 8);
      localStorage.setItem(this.storageKeys.tokenExpiration, newExpirationDate.toISOString());
      return true;
    }
    return false;
  }
}

// Exportar instancia singleton
const authService = new AuthService();
export default authService;
