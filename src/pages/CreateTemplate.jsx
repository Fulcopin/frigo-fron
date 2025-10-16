"use client"

import { useState } from "react"
import "./CreateTemplate.css"

// La dirección correcta de tu API que encontramos en launchSettings.json
const API_URL = "https://backend-frigo.onrender.com/api/Templates";

function CreateTemplate() {
  const initialState = {
    codigo: "",
    nombre: "",
    version: "1",
    objetivo: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    headerFields: [],
    tableColumns: [],
    firmas: [],
  };

  const [template, setTemplate] = useState(initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null); // Nuevo estado para manejar errores de la API

  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "date", label: "Fecha" },
    { value: "time", label: "Hora" },
    { value: "datetime", label: "Fecha y Hora" },
    { value: "temperature", label: "Temperatura (°C)" },
    { value: "select", label: "Selección" },
    { value: "textarea", label: "Área de texto" },
  ];

  const handleInputChange = (field, value) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  // --- El resto de las funciones para manipular el estado no cambian ---
  const addHeaderField = () => setTemplate((prev) => ({ ...prev, headerFields: [...prev.headerFields, { label: "", type: "text", required: false, options: [] }] }));
  const updateHeaderField = (index, field, value) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeHeaderField = (index) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.filter((_, i) => i !== index) }));
  const addTableColumn = () => setTemplate((prev) => ({ ...prev, tableColumns: [...prev.tableColumns, { label: "", type: "text", required: false, options: [] }] }));
  const updateTableColumn = (index, field, value) => setTemplate((prev) => ({ ...prev, tableColumns: prev.tableColumns.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeTableColumn = (index) => setTemplate((prev) => ({ ...prev, tableColumns: prev.tableColumns.filter((_, i) => i !== index) }));
  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "" }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  // --- REEMPLAZO TOTAL DE handleSaveTemplate ---
  const handleSaveTemplate = async () => {
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null); // Limpiar cualquier error anterior

    // Preparamos el objeto para enviar a la API.
    // Los campos de array/objeto se convierten a strings JSON.
    const payload = {
        ...template,
        headerFields: JSON.stringify(template.headerFields),
        tableColumns: JSON.stringify(template.tableColumns),
        firmas: JSON.stringify(template.firmas),
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // Si el servidor responde con un error, lo capturamos
            const errorText = await response.text();
            throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        // Si la respuesta es exitosa:
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

        // Reseteamos el formulario al estado inicial
        setTemplate(initialState);

    } catch (error) {
        console.error("Hubo un error al guardar la plantilla:", error);
        setError(`No se pudo guardar la plantilla. Verifica que el backend esté corriendo y que no haya errores de red. Detalle: ${error.message}`);
    }
  };

  // --- REEMPLAZO DE loadExistingTemplate (pendiente de implementar) ---
  const loadExistingTemplate = () => {
    // Esta función ahora necesitaría llamar al endpoint GET /api/Templates/{id}
    // o GET /api/Templates y luego filtrar.
    alert("Funcionalidad de cargar desde la base de datos está pendiente de implementación.");
  };

  return (
    <div className="create-template">
      <div className="page-header">
        <h1>Crear Plantilla de Formulario</h1>
        <div className="header-actions">
          <button onClick={loadExistingTemplate} className="btn-secondary">
            Cargar Plantilla Existente
          </button>
          <button onClick={handleSaveTemplate} className="btn-primary">
            💾 Guardar Plantilla
          </button>
        </div>
      </div>

      {/* Mensajes de éxito y error para el usuario */}
      {showSuccess && <div className="success-message">✅ Plantilla guardada exitosamente en la base de datos.</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <div className="form-section">
        <h2>Información General</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Código *</label>
            <input
              type="text"
              value={template.codigo}
              onChange={(e) => handleInputChange("codigo", e.target.value)}
              placeholder="Ej: FOR-CA-1"
            />
          </div>

          <div className="form-group">
            <label>Versión</label>
            <input
              type="text"
              value={template.version}
              onChange={(e) => handleInputChange("version", e.target.value)}
              placeholder="Ej: 1, 2, 1.1"
            />
          </div>

          <div className="form-group full-width">
            <label>Nombre del Registro *</label>
            <input
              type="text"
              value={template.nombre}
              onChange={(e) => handleInputChange("nombre", e.target.value)}
              placeholder="Ej: CONTROL DE TEMPERATURA DE TÚNELES"
            />
          </div>

          <div className="form-group full-width">
            <label>Objetivo</label>
            <textarea
              value={template.objetivo}
              onChange={(e) => handleInputChange("objetivo", e.target.value)}
              placeholder="Describe el objetivo del formulario"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Proceso</label>
            <input
              type="text"
              value={template.proceso}
              onChange={(e) => handleInputChange("proceso", e.target.value)}
              placeholder="Ej: Producción, Calidad, Recepción"
            />
          </div>

          <div className="form-group">
            <label>Cuándo se usa</label>
            <input
              type="text"
              value={template.cuandoSeUsa}
              onChange={(e) => handleInputChange("cuandoSeUsa", e.target.value)}
              placeholder="Ej: Posterior a congelación"
            />
          </div>

          <div className="form-group">
            <label>Quién lo llena</label>
            <input
              type="text"
              value={template.quienLoLlena}
              onChange={(e) => handleInputChange("quienLoLlena", e.target.value)}
              placeholder="Ej: Asistente de Cámara"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Campos del Encabezado</h2>
          <button onClick={addHeaderField} className="btn-add">
            + Agregar Campo
          </button>
        </div>

        {template.headerFields.map((field, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group">
                <label>Etiqueta</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateHeaderField(index, "label", e.target.value)}
                  placeholder="Ej: Fecha, Lote, Turno"
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)}>
                  {fieldTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateHeaderField(index, "required", e.target.checked)}
                  />
                  Requerido
                </label>
              </div>

              <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">
                🗑️
              </button>
            </div>

            {field.type === "select" && (
              <div className="form-group">
                <label>Opciones (separadas por coma)</label>
                <input
                  type="text"
                  value={field.options?.join(", ") || ""}
                  onChange={(e) =>
                    updateHeaderField(
                      index,
                      "options",
                      e.target.value.split(",").map((o) => o.trim()),
                    )
                  }
                  placeholder="Opción 1, Opción 2, Opción 3"
                />
              </div>
            )}
          </div>
        ))}

        {template.headerFields.length === 0 && (
          <p className="empty-state">No hay campos de encabezado. Agrega al menos uno.</p>
        )}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Columnas de la Tabla de Datos</h2>
          <button onClick={addTableColumn} className="btn-add">
            + Agregar Columna
          </button>
        </div>

        {template.tableColumns.map((column, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group">
                <label>Nombre de Columna</label>
                <input
                  type="text"
                  value={column.label}
                  onChange={(e) => updateTableColumn(index, "label", e.target.value)}
                  placeholder="Ej: Hora, Lote, Temperatura"
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select value={column.type} onChange={(e) => updateTableColumn(index, "type", e.target.value)}>
                  {fieldTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={column.required}
                    onChange={(e) => updateTableColumn(index, "required", e.target.checked)}
                  />
                  Requerido
                </label>
              </div>

              <button onClick={() => removeTableColumn(index)} className="btn-remove" title="Eliminar columna">
                🗑️
              </button>
            </div>

            {column.type === "select" && (
              <div className="form-group">
                <label>Opciones (separadas por coma)</label>
                <input
                  type="text"
                  value={column.options?.join(", ") || ""}
                  onChange={(e) =>
                    updateTableColumn(
                      index,
                      "options",
                      e.target.value.split(",").map((o) => o.trim()),
                    )
                  }
                  placeholder="Opción 1, Opción 2, Opción 3"
                />
              </div>
            )}
          </div>
        ))}

        {template.tableColumns.length === 0 && (
          <p className="empty-state">No hay columnas definidas. Agrega al menos una.</p>
        )}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Firmas</h2>
          <button onClick={addFirma} className="btn-add">
            + Agregar Firma
          </button>
        </div>

        {template.firmas.map((firma, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group">
                <label>Puesto</label>
                <input
                  type="text"
                  value={firma.puesto}
                  onChange={(e) => updateFirma(index, "puesto", e.target.value)}
                  placeholder="Ej: Supervisor de Calidad"
                />
              </div>
              <button onClick={() => removeFirma(index)} className="btn-remove" title="Eliminar firma">
                🗑️
              </button>
            </div>
          </div>
        ))}

        {template.firmas.length === 0 && <p className="empty-state">No hay firmas definidas.</p>}
      </div>

      <div className="form-actions">
        <button onClick={handleSaveTemplate} className="btn-primary btn-large">
          💾 Guardar Plantilla
        </button>
      </div>
    </div>
  )
}

export default CreateTemplate