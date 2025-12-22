"use client"

import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // Asumiendo que usas react-router-dom
import "./ManageTemplates.css"; // Crearemos este archivo CSS a continuación
import { API_BASE_URL } from "../apiConfig";
import TemplateVersionHistory from "../components/TemplateVersionHistory";
//const API_URL_TEMPLATES = "http://localhost:5074/api/Templates";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;

function ManageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(API_URL_TEMPLATES);
        if (!response.ok) {
          throw new Error("No se pudieron cargar las plantillas.");
        }
        const data = await response.json();
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        setTemplates(templatesArray);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleDeleteTemplate = async (templateId) => {
    // 1. Pedir confirmación al usuario
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta PLANTILLA? Esta acción es permanente y no se puede deshacer.")) {
      return;
    }

    try {
      // 2. Enviar la petición DELETE al backend
      const response = await fetch(`${API_URL_TEMPLATES}/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la plantilla desde el servidor.");
      }

      // 3. Actualizar el estado local para remover la plantilla de la lista
      setTemplates(prevTemplates => prevTemplates.filter(t => t.templateID !== templateId));
      alert("Plantilla eliminada exitosamente.");

    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    }
  };

  const handleViewVersionHistory = (template) => {
    setSelectedTemplate(template);
    setShowVersionHistory(true);
  };

  const handleCloseVersionHistory = () => {
    setShowVersionHistory(false);
    setSelectedTemplate(null);
  };

  if (loading) return <div className="manage-templates"><h1>Cargando plantillas...</h1></div>;
  if (error) return <div className="manage-templates"><h1 className="error-message">Error: {error}</h1></div>;

  return (
    <div className="manage-templates">
      <div className="page-header">
        <h1>Administrar Plantillas de Formularios</h1>
        <Link to="/create-template" className="btn-primary">
          + Crear Nueva Plantilla
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state-card">
          <p>No hay plantillas disponibles. ¡Crea la primera!</p>
        </div>
      ) : (
        <div className="templates-list">
          {templates.map((template) => (
            <div key={template.templateID} className="template-card-manage">
              <div className="template-card-info">
                <span className="template-code">{template.codigo}</span>
                <h3>{template.nombre}</h3>
                <span className="template-version">Versión: {template.version}</span>
              </div>
              <div className="template-card-actions">
                <button 
                  onClick={() => handleViewVersionHistory(template)} 
                  className="btn-info"
                  title="Ver historial de versiones"
                >
                  📚 Historial
                </button>
                <Link 
                  to={`/edit-template/${template.templateID}`} 
                  className="btn-secondary"
                >
                  ✏️ Editar
                </Link>
                <button 
                  onClick={() => handleDeleteTemplate(template.templateID)} 
                  className="btn-danger"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Historial de Versiones */}
      {showVersionHistory && selectedTemplate && (
        <TemplateVersionHistory
          templateId={selectedTemplate.templateID}
          templateName={selectedTemplate.nombre}
          onClose={handleCloseVersionHistory}
        />
      )}
    </div>
  );
}

export default ManageTemplates;