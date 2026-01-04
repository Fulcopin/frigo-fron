import { useState } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import Login from "./pages/Login"
import ProtectedRoute from "./components/ProtectedRoute"
import UserInfo from "./components/UserInfo"
import Home from "./pages/Home"
import CreateTemplate from "./pages/CreateTemplate"
import EditTemplate from "./pages/EditTemplate"
import FillForm from "./pages/FillForm"
import EditFilledForm from "./pages/EditFilledForm"
import ViewForms from "./pages/ViewForms"
import ManageTemplates from './pages/ManageTemplates';
import DailyForms from './pages/DailyForms';
import "./App.css"

function Navigation() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { logout, isAuthenticated } = useAuth()

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
          <Link to="/" className={isActive("/") ? "active" : ""}>
            🏠 Inicio
          </Link>
          <Link to="/create-template" className={isActive("/create-template") ? "active" : ""}>
            ➕ Crear Plantilla
          </Link>
          <Link to="/fill-form" className={isActive("/fill-form") ? "active" : ""}>
            📝 Llenar Formulario
          </Link>
          <Link to="/manage-templates" className={isActive("/manage-templates") ? "active" : ""}>
            ⚙️ Administrar Plantillas
          </Link>
          <Link to="/view-forms" className={isActive("/view-forms") ? "active" : ""}>
            👁️ Ver Formularios
          </Link>
          <Link to="/daily-forms" className={isActive("/daily-forms") ? "active" : ""}>
            📅 Formularios por Fecha
          </Link>
          
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
          <span className="collapsed-brand">� FishCort - Frigolab "San Mateo"</span>
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
              <Route path="/" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              <Route path="/create-template" element={
                <ProtectedRoute>
                  <CreateTemplate />
                </ProtectedRoute>
              } />
              <Route path="/edit-template/:id" element={
                <ProtectedRoute>
                  <EditTemplate />
                </ProtectedRoute>
              } />
              <Route path="/fill-form" element={
                <ProtectedRoute>
                  <FillForm />
                </ProtectedRoute>
              } />
              <Route path="/edit-filled-form/:id" element={
                <ProtectedRoute>
                  <EditFilledForm />
                </ProtectedRoute>
              } />
              <Route path="/view-forms" element={
                <ProtectedRoute>
                  <ViewForms />
                </ProtectedRoute>
              } />
              <Route path="/manage-templates" element={
                <ProtectedRoute>
                  <ManageTemplates />
                </ProtectedRoute>
              } />
              <Route path="/daily-forms" element={
                <ProtectedRoute>
                  <DailyForms />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
