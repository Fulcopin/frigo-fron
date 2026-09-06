// Servicio de autenticación para FishCort
const API_BASE_URL = import.meta.env.VITE_API_EXTERNAL_URL || 'http://188.40.197.172:8094/api'; // API Externa

// ⏳ Cuánto dura la sesión DENTRO de la aplicación.
//
// El token de la API externa vence a la hora. Atar la sesión de la app a ese
// vencimiento echaba al operario en plena carga del formulario: la pantalla
// saltaba al login y, peor, el borrador que guardaba después quedaba sin dueño
// (userName vacío) y no aparecía en "Mis Borradores". Un turno de planta dura
// bastante más que una hora, así que la sesión de la app se maneja aparte y se
// renueva sola cada vez que se guarda algo.
const SESION_HORAS = 10;

class AuthService {
  constructor() {
    this.storageKeys = {
      user: 'fishcort_user',
      token: 'fishcort_token',
      tokenExpiration: 'fishcort_token_expiration',
      // Vencimiento de la sesión de la app (distinto del token de la API)
      sessionExpiration: 'fishcort_session_expiration'
    };
    
    // Mapeo de roles de API a roles internos
    this.roleMapping = {
      'ADMIN': 'admin',           // Acceso total
      'SUPERVISOR': 'supervisor',  // Acceso total
      'OPERADOR': 'trabajador',    // Solo ver y llenar formularios
      'COSTOS': 'costos'           // Control de costos: ve qué valores se modificaron
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
      console.log('🔍 Intentando login con API externa:', { username });
      
      // Conectar con endpoint real de autenticación
      const response = await fetch(`${API_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('📡 Respuesta API:', response.status);

      if (!response.ok) {
        // Si la respuesta no es OK, intentar leer el mensaje de error
        const errorData = await response.json().catch(() => null);
        console.log('❌ Error de API:', errorData);
        
        return { 
          success: false, 
          error: errorData?.message || '❌ Credenciales inválidas. Por favor verifica tu usuario y contraseña.' 
        };
      }

      // Login exitoso, procesar respuesta
      const apiResponse = await response.json();
      console.log('✅ Login exitoso, datos de API:', apiResponse);

      // Extraer datos del usuario
      const apiUser = apiResponse.user;
      const apiToken = apiResponse.token;
      const apiExpiration = apiResponse.expiration;

      // Mapear rol de API a rol interno
      const rolInterno = this.roleMapping[apiUser.rol] || 'trabajador';
      console.log(`🔄 Mapeando rol: ${apiUser.rol} → ${rolInterno}`);

      // Determinar permisos según rol interno
      let permisos = [];
      if (rolInterno === 'admin' || rolInterno === 'supervisor') {
        permisos = ['all']; // Acceso total
      } else {
        permisos = ['fill-form', 'view-forms']; // Solo llenar y ver
      }

      // Construir objeto de usuario interno
      const userData = {
        id: apiUser.id,
        username: apiUser.userName,
        nombre: apiUser.nombreCompleto,
        rol: rolInterno,
        email: apiUser.email,
        empresa: apiUser.nombreEmpresa,
        idEmpresa: apiUser.idEmpresa,
        rolOriginal: apiUser.rol, // Guardar rol original de la API
        permisos: permisos
      };

      // Guardar sesión con token y expiración de la API
      const expirationDate = new Date(apiExpiration);
      this.saveSession(userData, apiToken, expirationDate);

      console.log('✅ Sesión guardada:', { 
        usuario: userData.nombre, 
        rol: userData.rol, 
        permisos: userData.permisos,
        expira: expirationDate.toLocaleString()
      });

      return { success: true, user: userData };

    } catch (error) {
      console.error('❌ Error en login:', error);
      return { 
        success: false, 
        error: '⚠️ Error al conectar con el servidor. Verifica tu conexión e intenta nuevamente.' 
      };
    }
  }

  /**
   * Guardar sesión en localStorage
   */
  saveSession(userData, token, expirationDate) {
    localStorage.setItem(this.storageKeys.user, JSON.stringify(userData));
    localStorage.setItem(this.storageKeys.token, token);
    localStorage.setItem(this.storageKeys.tokenExpiration, expirationDate.toISOString());
    this.renewSession();   // la sesión de la app arranca con sus SESION_HORAS
  }

  /**
   * Cuándo vence la sesión de la app.
   * Las sesiones abiertas con la versión anterior no tienen la clave nueva:
   * para esas se sigue usando el vencimiento del token, como antes.
   */
  getSessionExpiration() {
    const propia = localStorage.getItem(this.storageKeys.sessionExpiration);
    const fuente = propia || localStorage.getItem(this.storageKeys.tokenExpiration);
    if (!fuente) return null;
    const fecha = new Date(fuente);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  /**
   * Cerrar sesión
   */
  logout() {
    localStorage.removeItem(this.storageKeys.user);
    localStorage.removeItem(this.storageKeys.token);
    localStorage.removeItem(this.storageKeys.tokenExpiration);
    localStorage.removeItem(this.storageKeys.sessionExpiration);
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
    // Manda el vencimiento de la SESIÓN, no el del token de la API externa:
    // ese token dura una hora y solo lo necesitan las consultas al ERP.
    const expirationDate = this.getSessionExpiration();

    if (!user || !token || !expirationDate) {
      return false;
    }

    try {
      if (expirationDate <= new Date()) {
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
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(rol) {
    const user = this.getCurrentUser();
    if (!user || !user.rol) return false;

    // Si se pasa un array de roles, verificar si el usuario tiene alguno
    if (Array.isArray(rol)) {
      return rol.includes(user.rol);
    }

    return user.rol === rol;
  }

  /**
   * Verificar si el usuario es Admin o Supervisor (acceso total)
   */
  isAdminOrSupervisor() {
    const user = this.getCurrentUser();
    if (!user || !user.rol) return false;
    return user.rol === 'admin' || user.rol === 'supervisor';
  }

  /**
   * ¿Puede ver QUÉ valores se modificaron después de guardado un formulario?
   *
   * Es información de control: sirve para detectar que alguien tocó un reporte
   * que ya estaba revisado. Solo Admin y Costos la ven; al resto la pantalla
   * VER se les muestra igual que siempre.
   */
  puedeVerCambios() {
    const user = this.getCurrentUser();
    if (!user || !user.rol) return false;
    return user.rol === 'admin' || user.rol === 'costos';
  }

  /**
   * Verificar si el usuario es trabajador
   */
  isTrabajador() {
    const user = this.getCurrentUser();
    if (!user || !user.rol) return false;
    return user.rol === 'trabajador';
  }

  /**
   * Obtener tiempo restante de sesión (en minutos)
   */
  getSessionTimeRemaining() {
    const expirationDate = this.getSessionExpiration();
    if (!expirationDate) return 0;

    try {
      const diffMs = expirationDate - new Date();
      return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    } catch (e) {
      return 0;
    }
  }

  /**
   * Renovar la sesión: vuelve a arrancar el contador de SESION_HORAS.
   *
   * Se llama cada vez que el usuario guarda (formulario o borrador, incluido el
   * respaldo automático de cada hora): mientras esté trabajando, la sesión no
   * se le cae encima.
   */
  renewSession() {
    const user = this.getCurrentUser();
    const token = this.getToken();

    if (user && token) {
      const newExpirationDate = new Date();
      newExpirationDate.setHours(newExpirationDate.getHours() + SESION_HORAS);
      localStorage.setItem(this.storageKeys.sessionExpiration, newExpirationDate.toISOString());
      return true;
    }
    return false;
  }

  /** Horas que dura la sesión de la app (para mostrarlo en pantalla) */
  get horasDeSesion() {
    return SESION_HORAS;
  }
}

// Exportar instancia singleton
const authService = new AuthService();
export default authService;
