"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import "./Home.css"
import { API_BASE_URL } from "../apiConfig";

const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ templates: 0, forms: 0 })
  const [loading, setLoading] = useState(true);
  const [mostUsedTemplates, setMostUsedTemplates] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [templatesRes, formsRes] = await Promise.all([
          fetch(API_URL_TEMPLATES),
          fetch(API_URL_FILLED_FORMS)
        ]);
        
        const templatesData = await templatesRes.json();
        const formsData = await formsRes.json();

        const templates = templatesData.$values || [];
        const forms = formsData.$values || [];

        setStats({
          templates: templates.length,
          forms: forms.length,
        });

        // 📊 Calcular plantillas más utilizadas
        const templateUsageCount = {};
        forms.forEach(form => {
          const templateId = form.templateID;
          templateUsageCount[templateId] = (templateUsageCount[templateId] || 0) + 1;
        });

        // Ordenar plantillas por uso y agregar información
        const templatesWithUsage = templates.map(template => ({
          ...template,
          usageCount: templateUsageCount[template.templateID] || 0
        }));

        const sortedTemplates = templatesWithUsage
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 6); // Top 6 más usadas

        setMostUsedTemplates(sortedTemplates);

      } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        setStats({ templates: '?', forms: '?' });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [])

  const handleFillTemplate = (templateId) => {
    console.log('🎯 Navegando a llenar plantilla:', templateId);
    navigate('/fill-form', { state: { selectedTemplateId: templateId } });
  };

  return (
    <div className="home">
      <div className="hero">
        <h1>🏠 Panel de Control - Frigolab</h1>
        <p>Acceso rápido a formularios y plantillas más utilizadas</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{loading ? '...' : stats.templates}</h3>
            <p>Plantillas Activas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{loading ? '...' : stats.forms}</h3>
            <p>Formularios Completados</p>
          </div>
        </div>
        <div 
          className="stat-card stat-card-highlight stat-card-clickable" 
          onClick={() => navigate('/daily-forms')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Por Fecha</h3>
            <p>Filtrar y exportar formularios</p>
          </div>
        </div>
      </div>

      {/* 🔥 SECCIÓN: PLANTILLAS MÁS UTILIZADAS */}
      <div className="quick-access-section">
        <div className="section-header">
          <h2>⚡ Acceso Rápido - Plantillas Más Utilizadas</h2>
          <p>Haz clic para llenar directamente estos formularios</p>
        </div>
        
        {loading ? (
          <div className="loading-state">Cargando plantillas...</div>
        ) : mostUsedTemplates.length === 0 ? (
          <div className="empty-state">
            <p>No hay plantillas disponibles aún.</p>
            <button onClick={() => navigate('/plantillas')} className="btn-primary">
              ➕ Crear Primera Plantilla
            </button>
          </div>
        ) : (
          <div className="quick-templates-grid">
            {mostUsedTemplates.map((template) => (
              <div 
                key={template.templateID} 
                className="quick-template-card"
                onClick={() => handleFillTemplate(template.templateID)}
              >
                <div className="template-header">
                  <span className="template-code">{template.codigo}</span>
                  {template.usageCount > 0 && (
                    <span className="usage-badge">📊 {template.usageCount} usos</span>
                  )}
                </div>
                <h3>{template.nombre}</h3>
                {template.proceso && (
                  <p className="template-process">🏭 {template.proceso}</p>
                )}
                <button className="btn-quick-fill">
                  ✍️ Llenar Formulario
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🎯 ACCIONES PRINCIPALES */}
      <div className="main-actions">
        <h2>🎯 Acciones Principales</h2>
        <div className="actions-grid">
          <div className="action-card" onClick={() => navigate('/plantillas')}>
            <div className="action-icon">📋</div>
            <h3>Gestionar Plantillas</h3>
            <p>Crear, editar o eliminar plantillas de formularios</p>
          </div>
          <div className="action-card" onClick={() => navigate('/fill-form')}>
            <div className="action-icon">✍️</div>
            <h3>Llenar Formulario</h3>
            <p>Completar un nuevo formulario desde cualquier plantilla</p>
          </div>
          <div className="action-card" onClick={() => navigate('/historial')}>
            <div className="action-icon">📚</div>
            <h3>Ver Historial</h3>
            <p>Consultar, exportar y analizar formularios guardados</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
