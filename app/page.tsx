"use client"

import { useState } from "react"
import Home from "../src/pages/Home"
import CreateTemplate from "../src/pages/CreateTemplate"
import FillForm from "../src/pages/FillForm"
import ViewForms from "../src/pages/ViewForms"
import "../src/index.css"
import "../src/App.css"

export default function Page() {
  const [currentPage, setCurrentPage] = useState("home")

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home />
      case "create-template":
        return <CreateTemplate />
      case "fill-form":
        return <FillForm />
      case "view-forms":
        return <ViewForms />
      default:
        return <Home />
    }
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">
            <h1>Frigolab "San Mateo"</h1>
            <p>Sistema de Formularios Dinámicos</p>
          </div>
          <div className="nav-links">
            <button onClick={() => setCurrentPage("home")} className={currentPage === "home" ? "active" : ""}>
              Inicio
            </button>
            <button
              onClick={() => setCurrentPage("create-template")}
              className={currentPage === "create-template" ? "active" : ""}
            >
              Crear Plantilla
            </button>
            <button onClick={() => setCurrentPage("fill-form")} className={currentPage === "fill-form" ? "active" : ""}>
              Llenar Formulario
            </button>
            <button
              onClick={() => setCurrentPage("view-forms")}
              className={currentPage === "view-forms" ? "active" : ""}
            >
              Ver Formularios
            </button>
          </div>
        </div>
      </nav>
      <main className="main-content">{renderPage()}</main>
    </div>
  )
}
