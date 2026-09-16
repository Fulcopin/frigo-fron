"use client"

import { useNavigate } from "react-router-dom"
import ScrollButton from "../components/ScrollButton"
import "./Home.css"

// La pantalla quedó solo con los accesos principales. Con las tarjetas de
// estadísticas y el acceso rápido se fue también la consulta que las
// alimentaba, que pedía las plantillas y todos los formularios en cada visita
// para mostrar dos números.

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <div className="hero">
        <h1>🏠 Panel de Control - Frigolab</h1>
        <p>Elegí a dónde querés ir</p>
      </div>

      {/* 🎯 ACCIONES PRINCIPALES */}
      <div className="main-actions">
        <h2>🎯 Acciones Principales</h2>
        <div className="actions-grid">
          <div className="action-card" onClick={() => navigate('/manage-templates')}>
            <div className="action-icon">📋</div>
            <h3>Gestionar Plantillas</h3>
            <p>Crear, editar o eliminar plantillas de formularios</p>
          </div>
          <div className="action-card" onClick={() => navigate('/fill-form')}>
            <div className="action-icon">✍️</div>
            <h3>Llenar Formulario</h3>
            <p>Completar un nuevo formulario desde cualquier plantilla</p>
          </div>
          <div className="action-card" onClick={() => navigate('/view-forms')}>
            <div className="action-icon">📚</div>
            <h3>Ver Historial</h3>
            <p>Consultar, exportar y analizar formularios guardados</p>
          </div>
          <div className="action-card" onClick={() => navigate('/alert-management')}>
            <div className="action-icon">🔔</div>
            <h3>Gestión de Alertas</h3>
            <p>Configura recordatorios y monitorea firmas pendientes</p>
          </div>
          <div className="action-card" onClick={() => navigate('/trazabilidad')}>
            <div className="action-icon">🔍</div>
            <h3>Consultar Trazabilidad</h3>
            <p>Busca formularios por lote o rango de fecha rápidamente</p>
          </div>

          {/* 📝 Va en el Inicio y sin restricción de rol a propósito: el que
              encuentra el problema suele ser el operario, y si tiene que
              buscarlo en un menú no lo reporta. */}
          <div className="action-card" onClick={() => navigate('/reportar-cambio')}>
            <div className="action-icon">📝</div>
            <h3>Reportar un Cambio</h3>
            <p>Pedí un ajuste o contá algo que no funciona. Seguí la respuesta acá mismo</p>
          </div>
        </div>
      </div>

      {/* 🔼🔽 Botones de scroll */}
      <ScrollButton />
    </div>
  )
}

export default Home