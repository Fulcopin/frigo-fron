"use client"

import { useEffect, useState } from "react"
import "./Home.css"
import { API_BASE_URL } from "../apiConfig";
// Asegúrate de que este puerto coincida con el de tu backend
//const API_URL_TEMPLATES = "https://backend-frigo.onrender.com/api/Templates";
//const API_URL_FILLED_FORMS = "https://backend-frigo.onrender.com/api/FilledForms";
//const API_URL_TEMPLATES = "http://localhost:5074/api/Templates";
//const API_URL_FILLED_FORMS = "http://localhost:5074/api/FilledForms";
const API_URL = "http://localhost:5074/api/Templates";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;
function Home() {
  const [stats, setStats] = useState({ templates: 0, forms: 0 })
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Hacemos las dos llamadas a la API al mismo tiempo para ser más eficientes
        const [templatesRes, formsRes] = await Promise.all([
          fetch(API_URL_TEMPLATES),
          fetch(API_URL_FILLED_FORMS)
        ]);
        
        
          const templatesData = await templatesRes.json();
          const formsData = await formsRes.json();

          setStats({
            // ACCEDE A .$values Y USA UN VALOR PREDETERMINADO SI NO EXISTE
            templates: (templatesData.$values || []).length,
            forms: (formsData.$values || []).length,
          });
      } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        // Si hay un error, mostramos '?' en las estadísticas
        setStats({ templates: '?', forms: '?' });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [])

  return (
    <div className="home">
      <div className="hero">
        <h1>Sistema de Formularios Dinámicos</h1>
        <p>Gestiona y crea formularios personalizados para el control de calidad y producción</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{loading ? '...' : stats.templates}</h3>
            <p>Plantillas Creadas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{loading ? '...' : stats.forms}</h3>
            <p>Formularios Llenados</p>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h2>Características del Sistema</h2>
        <div className="features-grid">
          <div className="feature">
            <h4>🎯 Formularios Dinámicos</h4>
            <p>Crea formularios con campos de encabezado, tablas dinámicas y secciones de firmas</p>
          </div>
          <div className="feature">
            <h4>💾 Base de Datos en la Nube</h4>
            <p>Todos los datos se guardan de forma centralizada y segura en Azure</p>
          </div>
          <div className="feature">
            <h4>📊 Tablas Personalizables</h4>
            <p>Define columnas con diferentes tipos de datos (texto, número, fecha, hora, temperatura)</p>
          </div>
          <div className="feature">
            <h4>✅ Validación de Datos</h4>
            <p>Campos requeridos y validación automática según el tipo de dato</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Acciones Rápidas</h2>
        <div className="actions-grid">
          <div className="action-card-info">
            <div className="action-icon">➕</div>
            <h3>Crear Plantilla</h3>
            <p>Define una nueva plantilla de formulario con campos personalizados</p>
          </div>
          <div className="action-card-info">
            <div className="action-icon">✍️</div>
            <h3>Llenar Formulario</h3>
            <p>Completa un formulario basado en una plantilla existente</p>
          </div>
          <div className="action-card-info">
            <div className="action-icon">👁️</div>
            <h3>Ver Formularios</h3>
            <p>Consulta y exporta los formularios guardados</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home