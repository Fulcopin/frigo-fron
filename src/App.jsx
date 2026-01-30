import { useState } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import Login from "./pages/Login"
import ProtectedRoute from "./components/ProtectedRoute"
import RoleBasedRoute from "./components/RoleBasedRoute"
import UserInfo from "./components/UserInfo"
import authService from "./services/authService"
import Home from "./pages/Home"
import CreateTemplate from "./pages/CreateTemplate"
import EditTemplate from "./pages/EditTemplate"
import FillForm from "./pages/FillForm"
import EditFilledForm from "./pages/EditFilledForm"
import ViewForms from "./pages/ViewForms"
import ManageTemplates from './pages/ManageTemplates';
import DailyForms from './pages/DailyForms';
import ERPDashboard from "./pages/ERPDashboard";
import "./App.css"

function Navigation() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { logout, isAuthenticated } = useAuth()
  
  // Obtener usuario actual y su rol
  const currentUser = authService.getCurrentUser()
  const userRole = currentUser?.rol || ''

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    if (globalThis.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout()
    }
  }

  // Si no está autenticado, no mostrar el menú
  if (!isAuthenticated()) {
    return null
  }

  // Determinar qué links mostrar según el rol
  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor'

  return (
    <nav className={`navbar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Botón para colapsar/expandir el menú */}
      <button 
        className="navbar-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
      >
        <span className="toggle-icon">{isCollapsed ? '▼' : '▲'}</span>
        <span className="toggle-text">{isCollapsed ? 'Mostrar Menú' : 'Ocultar Menú'}</span>
      </button>

      <div className="nav-container">
        <div className="nav-brand">
          <div className="brand-title">
            <span className="brand-logo">🐟</span>
            <div className="brand-text">
              <h1 className="brand-main">Frigolab Docs</h1>
              <p className="brand-sub">Frigolab "San Mateo"</p>
            </div>
          </div>
        </div>
        <div className="nav-links">
          {/* Inicio - visible para todos */}
          <Link to="/" className={isActive("/") ? "active" : ""}>
            🏠 Inicio
          </Link>
          
          {/* Crear Plantilla - solo Admin y Supervisor */}
          {isAdminOrSupervisor && (
            <Link to="/create-template" className={isActive("/create-template") ? "active" : ""}>
              ➕ Crear Plantilla
            </Link>
          )}
          
          {/* Llenar Formulario - visible para todos */}
          <Link to="/fill-form" className={isActive("/fill-form") ? "active" : ""}>
            📝 Llenar Formulario
          </Link>
          
          {/* Administrar Plantillas - solo Admin y Supervisor */}
          {isAdminOrSupervisor && (
            <Link to="/manage-templates" className={isActive("/manage-templates") ? "active" : ""}>
              ⚙️ Administrar Plantillas
            </Link>
          )}
          
          {/* Ver Formularios - visible para todos */}
          <Link to="/view-forms" className={isActive("/view-forms") ? "active" : ""}>
            👁️ Ver Formularios
          </Link>
          
          {/* Formularios por Fecha - solo Admin y Supervisor */}
          {isAdminOrSupervisor && (
            <Link to="/daily-forms" className={isActive("/daily-forms") ? "active" : ""}>
              📅 Formularios por Fecha
            </Link>
          )}
          {isAdminOrSupervisor && (
          <Link to="/dashboard-erp" className={isActive("/dashboard-erp") ? "active" : ""}>
            📊 Dashboard ERP
          </Link>
        )}
          
          <UserInfo />
          
          <button 
            onClick={handleLogout} 
            className="logout-button"
            title="Cerrar sesión"
          >
            🚪 Salir
          </button>
        </div>
      </div>

      {/* Barra compacta cuando está colapsado */}
      {isCollapsed && (
        <div className="navbar-collapsed-info">
          <span className="collapsed-brand">🐟 FishCort - Frigolab "San Mateo"</span>
          <span className="collapsed-page">{getPageName(location.pathname)}</span>
        </div>
      )}
    </nav>
  )
}

// Función auxiliar para obtener el nombre de la página actual
function getPageName(pathname) {
  const routes = {
    '/': 'Inicio',
    '/create-template': 'Crear Plantilla',
    '/fill-form': 'Llenar Formulario',
    '/manage-templates': 'Administrar Plantillas',
    '/view-forms': 'Ver Formularios',
    '/daily-forms': 'Formularios por Fecha',
  }
  
  // Para rutas dinámicas como /edit-template/:id
  if (pathname.includes('/edit-template')) return 'Editar Plantilla'
  if (pathname.includes('/edit-filled-form')) return 'Editar Formulario'
  
  return routes[pathname] || 'Sistema de Formularios'
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navigation />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              
              {/* Rutas protegidas */}
              {/* Inicio - Acceso para todos los roles autenticados */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              
              {/* Crear Plantilla - Solo Admin y Supervisor */}
              <Route path="/create-template" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <CreateTemplate />
                </RoleBasedRoute>
              } />
              
              {/* Editar Plantilla - Solo Admin y Supervisor */}
              <Route path="/edit-template/:id" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <EditTemplate />
                </RoleBasedRoute>
              } />
              
              {/* Llenar Formulario - Acceso para todos los roles */}
              <Route path="/fill-form" element={
                <ProtectedRoute>
                  <FillForm />
                </ProtectedRoute>
              } />
              
              {/* Editar Formulario Lleno - Acceso para todos los roles */}
              <Route path="/edit-filled-form/:id" element={
                <ProtectedRoute>
                  <EditFilledForm />
                </ProtectedRoute>
              } />
              
              {/* Ver Formularios - Acceso para todos los roles */}
              <Route path="/view-forms" element={
                <ProtectedRoute>
                  <ViewForms />
                </ProtectedRoute>
              } />
              
              {/* Administrar Plantillas - Solo Admin y Supervisor */}
              <Route path="/manage-templates" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <ManageTemplates />
                </RoleBasedRoute>
              } />
              
              {/* Formularios por Fecha - Solo Admin y Supervisor */}
              <Route path="/daily-forms" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <DailyForms />
                </RoleBasedRoute>
              } />
              <Route path="/dashboard-erp" element={
          <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
            <ERPDashboard />
          </RoleBasedRoute>
        } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
