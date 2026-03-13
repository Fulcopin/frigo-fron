import { useState } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import Login from "./pages/Login"
import ProtectedRoute from "./components/ProtectedRoute"
import RoleBasedRoute from "./components/RoleBasedRoute"
import UserInfo from "./components/UserInfo"
import SessionTimer from "./components/SessionTimer"
import ErrorBoundary from "./components/ErrorBoundary"
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
import SignatureManagement from "./pages/SignatureManagement";
import MySignature from "./pages/MySignature";
import AlertManagement from "./pages/AlertManagement";
import ConsumptionDashboard from "./pages/ConsumptionDashboard";
import CatalogoFirmas from "./pages/CatalogoFirmas";
import SessionHistory from "./pages/SessionHistory";
import MyDrafts from "./pages/MyDrafts";
import DocumentRegistry from "./pages/DocumentRegistry";
import "./App.css"

function Navigation() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { logout, isAuthenticated } = useAuth()
  
  const currentUser = authService.getCurrentUser()
  const userRole = currentUser?.rol || ''

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    if (globalThis.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout()
    }
  }

  const handleNavClick = () => {
    setSidebarOpen(false)
  }

  if (!isAuthenticated()) {
    return null
  }

  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor'

  const navLinks = [
    { to: "/", icon: "🏠", label: "Inicio", show: true },
    { to: "/fill-form", icon: "📝", label: "Llenar Formulario", show: true },
    { to: "/my-drafts", icon: "📋", label: "Mis Borradores", show: true },
    { to: "/view-forms", icon: "👁️", label: "Ver Formularios", show: true },
    { divider: true, label: "Plantillas", show: isAdminOrSupervisor },
    { to: "/create-template", icon: "➕", label: "Crear Plantilla", show: isAdminOrSupervisor },
    { to: "/manage-templates", icon: "⚙️", label: "Administrar Plantillas", show: isAdminOrSupervisor },
    { divider: true, label: "Firmas", show: true },
    { to: "/signatures", icon: "✍️", label: "Firmas Pendientes", show: true },
    { to: "/signatures?tab=timing", icon: "⏱️", label: "Tiempos y Rechazos", show: true },
    { to: "/my-signature", icon: "🖊️", label: "Mi Firma", show: true },
    { to: "/catalogo-firmas", icon: "📋", label: "Catálogo Firmas", show: isAdminOrSupervisor },
    { divider: true, label: "Administración", show: isAdminOrSupervisor },
    { to: "/dashboard-erp", icon: "📊", label: "Descargar Datos", show: isAdminOrSupervisor },
    { to: "/alerts", icon: "🔔", label: "Alertas", show: isAdminOrSupervisor },
    { to: "/consumptions", icon: "📊", label: "Consumos", show: isAdminOrSupervisor },
    { to: "/session-history", icon: "⏱️", label: "Tiempos", show: isAdminOrSupervisor },
    { divider: true, label: "Documentos", show: true },
    { to: "/document-registry", icon: "📄", label: "Lista de Documentos", show: true },
  ]

  return (
    <>
      {/* ===== OVERLAY ===== */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ===== BARRA SUPERIOR FIJA ===== */}
      <header className="topbar">
        <div className="topbar-left">
          <button 
            className="topbar-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Abrir menú"
          >
            <span className="menu-icon">
              <span /><span /><span />
            </span>
          </button>
          <div className="topbar-brand">
            <span className="topbar-logo">🐟</span>
            <span className="topbar-title">Frigolab Docs</span>
          </div>
        </div>
        <div className="topbar-center">
          <span className="topbar-page">{getPageName(location.pathname)}</span>
        </div>
        <div className="topbar-right">
          <SessionTimer />
          <UserInfo />
          <button onClick={handleLogout} className="topbar-logout" title="Cerrar sesión">
            🚪
          </button>
        </div>
      </header>

      {/* ===== SIDEBAR LATERAL ===== */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-logo">🐟</span>
            <div>
              <h2 className="sidebar-title">Frigolab Docs</h2>
              <p className="sidebar-subtitle">Frigolab "San Mateo"</p>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} title="Cerrar menú">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {navLinks.filter(l => l.show).map((link, i) => {
            if (link.divider) {
              return <div key={`div-${i}`} className="sidebar-divider">{link.label}</div>
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`sidebar-link ${isActive(link.to) ? 'sidebar-link-active' : ''}`}
                onClick={handleNavClick}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                <span className="sidebar-link-text">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{currentUser?.nombre || 'Usuario'}</span>
            <span className="sidebar-user-role">{userRole?.toUpperCase()}</span>
          </div>
          <button onClick={handleLogout} className="sidebar-logout" title="Cerrar sesión">
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>
    </>
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
    '/signatures': 'Gestión de Firmas',
    '/catalogo-firmas': 'Catálogo de Firmas',
    '/my-signature': 'Mi Firma Personal',
    '/alerts': 'Gestión de Alertas',
    '/dashboard-erp': 'Dashboard ERP',
    '/consumption-dashboard': 'Dashboard de Consumos',
    '/session-history': 'Registro de Tiempos',
    '/my-drafts': 'Mis Borradores',
    '/document-registry': 'Documentos Registrados'
  }
  
  // Para rutas dinámicas como /edit-template/:id
  if (pathname.includes('/edit-template')) return 'Editar Plantilla'
  if (pathname.includes('/edit-filled-form')) return 'Editar Formulario'
  if (pathname.includes('/view-form')) return 'Ver Formulario'
  
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
                  <ErrorBoundary>
                    <FillForm />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              
              {/* Mis Borradores - Acceso para todos los roles */}
              <Route path="/my-drafts" element={
                <ProtectedRoute>
                  <MyDrafts />
                </ProtectedRoute>
              } />
              
              {/* Editar Formulario Lleno - Acceso para todos los roles */}
              <Route path="/edit-filled-form/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <EditFilledForm />
                  </ErrorBoundary>
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
              
              {/* Dashboard ERP - Solo Admin y Supervisor */}
              <Route path="/dashboard-erp" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <ERPDashboard />
                </RoleBasedRoute>
              } />
              
              {/* NUEVAS RUTAS */}
              {/* Gestión de Firmas - Acceso para todos los roles */}
              <Route path="/signatures" element={
                <ProtectedRoute>
                  <SignatureManagement />
                </ProtectedRoute>
              } />
              
              {/* Catálogo de Firmas - Solo Admin y Supervisor */}
              <Route path="/catalogo-firmas" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <CatalogoFirmas />
                </RoleBasedRoute>
              } />
              
              {/* Mi Firma Personal - Acceso para todos los roles */}
              <Route path="/my-signature" element={
                <ProtectedRoute>
                  <MySignature />
                </ProtectedRoute>
              } />
              
              {/* Gestión de Alertas - Solo Admin y Supervisor */}
              <Route path="/alerts" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <AlertManagement />
                </RoleBasedRoute>
              } />
              
              {/* Dashboard de Consumos - Solo Admin y Supervisor */}
              <Route path="/consumptions" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <ConsumptionDashboard />
                </RoleBasedRoute>
              } />
              
              {/* Registro de Tiempos - Solo Admin y Supervisor */}
              <Route path="/session-history" element={
                <RoleBasedRoute allowedRoles={['admin', 'supervisor']}>
                  <SessionHistory />
                </RoleBasedRoute>
              } />
              
              {/* Lista de Documentos Registrados - Acceso para todos */}
              <Route path="/document-registry" element={
                <ProtectedRoute>
                  <DocumentRegistry />
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
