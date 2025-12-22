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
import MasterForms from './pages/MasterForms';
import MasterFormsData from './pages/MasterFormsData';
import Registro15Tinas from './pages/Registro15Tinas';
import Registro15TinasDinamico from './pages/Registro15TinasDinamico';
import "./App.css"

function Navigation() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { logout, isAuthenticated } = useAuth()

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
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
          <h1>🐟 Frigolab "San Mateo"</h1>
          <p>Sistema FishCort - Formularios Dinámicos</p>
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
          <Link to="/registro-15-tinas" className={isActive("/registro-15-tinas") ? "active" : ""}>
            ⚖️ Registro 15 Tinas
          </Link>
          <Link to="/registro-15-tinas-dinamico" className={isActive("/registro-15-tinas-dinamico") ? "active" : ""}>
            🔄 Registro Tinas (Dinámico)
          </Link>
          <Link to="/master-forms" className={isActive("/master-forms") ? "active" : ""}>
            📊 Formularios Maestros
          </Link>
          <Link to="/manage-templates" className={isActive("/manage-templates") ? "active" : ""}>
            ⚙️ Administrar Plantillas
          </Link>
          <Link to="/view-forms" className={isActive("/view-forms") ? "active" : ""}>
            👁️ Ver Formularios
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
    '/registro-15-tinas': 'Registro 15 Tinas',
    '/registro-15-tinas-dinamico': 'Registro Tinas Dinámico',
    '/master-forms': 'Formularios Maestros',
    '/manage-templates': 'Administrar Plantillas',
    '/view-forms': 'Ver Formularios',
  }
  
  // Para rutas dinámicas como /edit-template/:id
  if (pathname.includes('/edit-template')) return 'Editar Plantilla'
  if (pathname.includes('/edit-filled-form')) return 'Editar Formulario'
  if (pathname.includes('/master-forms/') && pathname.includes('/data')) return 'Datos de Formulario Maestro'
  
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
              <Route path="/registro-15-tinas" element={
                <ProtectedRoute>
                  <Registro15Tinas />
                </ProtectedRoute>
              } />
              <Route path="/registro-15-tinas-dinamico" element={
                <ProtectedRoute>
                  <Registro15TinasDinamico />
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
              <Route path="/master-forms" element={
                <ProtectedRoute>
                  <MasterForms />
                </ProtectedRoute>
              } />
              <Route path="/master-forms/:id/data" element={
                <ProtectedRoute>
                  <MasterFormsData />
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
