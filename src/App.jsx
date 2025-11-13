import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import Home from "./pages/Home"
import CreateTemplate from "./pages/CreateTemplate"
import EditTemplate from "./pages/EditTemplate"
import FillForm from "./pages/FillForm"
import EditFilledForm from "./pages/EditFilledForm"
import ViewForms from "./pages/ViewForms"
import ManageTemplates from './pages/ManageTemplates';
import "./App.css"

function Navigation() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>Frigolab "San Mateo"</h1>
          <p>Sistema de Formularios Dinámicos</p>
        </div>
        <div className="nav-links">
          <Link to="/" className={isActive("/") ? "active" : ""}>
            Inicio
          </Link>
          <Link to="/create-template" className={isActive("/create-template") ? "active" : ""}>
            Crear Plantilla
          </Link>
          <Link to="/fill-form" className={isActive("/fill-form") ? "active" : ""}>
            Llenar Formulario
          </Link>
          <Link to="/manage-templates" className={isActive("/manage-templates") ? "active" : ""}>
            Administrar Plantillas
          </Link>
          <Link to="/view-forms" className={isActive("/view-forms") ? "active" : ""}>
            Ver Formularios
          </Link>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-template" element={<CreateTemplate />} />
            <Route path="/edit-template/:id" element={<EditTemplate />} />
            <Route path="/fill-form" element={<FillForm />} />
            <Route path="/edit-filled-form/:id" element={<EditFilledForm />} />
            <Route path="/view-forms" element={<ViewForms />} />
            <Route path="/manage-templates" element={<ManageTemplates />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
