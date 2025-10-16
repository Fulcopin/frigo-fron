"use client"

import { useState, useEffect } from "react"
import FormHeader from "../components/FormHeader"
import "./ViewForms.css"

// Asegúrate de que este puerto coincida con el de tu backend
const API_URL_TEMPLATES = "https://backend-frigo.onrender.com/api/Templates";
const API_URL_FILLED_FORMS = "https://backend-frigo.onrender.com/api/FilledForms";

function ViewForms() {
  const [forms, setForms] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedForm, setSelectedForm] = useState(null)
  const [filterTemplate, setFilterTemplate] = useState("")

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [formsResponse, templatesResponse] = await Promise.all([
          fetch(API_URL_FILLED_FORMS),
          fetch(API_URL_TEMPLATES)
        ]);
        if (!formsResponse.ok || !templatesResponse.ok) throw new Error('No se pudieron cargar los datos.');

       let formsDataResponse = await formsResponse.json();
        let templatesDataResponse = await templatesResponse.json();

        // --- INICIO DEL CAMBIO ---
        const formsArray = formsDataResponse.$values || [];
        const templatesArray = templatesDataResponse.$values || [];
        // --- FIN DEL CAMBIO ---

        // Ahora usa los arrays extraídos para el resto de la lógica
        const parsedForms = formsArray.map(form => ({
          ...form,
          templateNombre: templatesArray.find(t => t.templateID === form.templateID)?.nombre || 'Plantilla Desconocida',
          templateCodigo: templatesArray.find(t => t.templateID === form.templateID)?.codigo || 'N/A',
          headerData: JSON.parse(form.headerData || '{}'),
          firmasData: JSON.parse(form.firmasData || '{}'),
          // Aquí hay un posible error futuro: 'form.tableRows' podría no ser un array si no lo incluyes en la API.
          // Pero por ahora, el problema de .map se soluciona.
          tableRows: form.tableRows ? form.tableRows.$values.map(tr => JSON.parse(tr.rowData || '{}')) : []
        }));

        setForms(parsedForms.reverse());
        setTemplates(templatesArray);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const deleteForm = async (formId) => {
    if (confirm("¿Estás seguro de eliminar este formulario de la base de datos? Es una acción permanente.")) {
      try {
        const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('No se pudo eliminar el formulario.');
        
        setForms(prev => prev.filter(f => f.formID !== formId));
        setSelectedForm(null);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const printForm = () => window.print();
  const exportToJSON = (form) => { /* Tu función de exportar no cambia */
    const dataStr = JSON.stringify(form, null, 2); const dataBlob = new Blob([dataStr], { type: "application/json" }); const url = URL.createObjectURL(dataBlob); const link = document.createElement("a"); link.href = url; link.download = `${form.templateCodigo}_${new Date(form.createdAt).toISOString().split("T")[0]}.json`; link.click();
  };

  const filteredForms = filterTemplate ? forms.filter((f) => f.templateCodigo === filterTemplate) : forms;

  if (loading) return <div className="view-forms"><h1>Cargando formularios desde la base de datos...</h1></div>;
  if (error) return <div className="view-forms"><h1 className="error-message">Error: {error}</h1></div>;

  if (selectedForm) {
    return (
      <div className="view-forms">
        <div className="form-viewer-header">
          <button onClick={() => setSelectedForm(null)} className="btn-back">← Volver a la lista</button>
          <div className="viewer-actions">
            <button onClick={printForm} className="btn-secondary">🖨️ Imprimir</button>
            <button onClick={() => exportToJSON(selectedForm)} className="btn-secondary">📥 Exportar JSON</button>
            <button onClick={() => deleteForm(selectedForm.formID)} className="btn-danger">🗑️ Eliminar</button>
          </div>
        </div>
        <div className="form-viewer-document">
          <FormHeader title={selectedForm.templateNombre} code={selectedForm.templateCodigo} version="1" date={new Date(selectedForm.createdAt).toLocaleDateString("es-EC")} />
          
          {Object.keys(selectedForm.headerData).length > 0 && (
            <div className="data-section">
              <h3>Información General</h3>
              <div className="data-grid">
                {Object.entries(selectedForm.headerData).map(([key, value]) => (<div key={key} className="data-item"><span className="data-label">{key}:</span><span className="data-value">{value || "-"}</span></div>))}
              </div>
            </div>
          )}

          {selectedForm.tableRows.length > 0 && selectedForm.tableRows[0] && (
            <div className="data-section">
              <h3>Registro de Datos</h3>
              <div className="table-wrapper">
                <table className="view-table">
                  <thead><tr><th>#</th>{Object.keys(selectedForm.tableRows[0]).map((key) => (<th key={key}>{key}</th>))}</tr></thead>
                  <tbody>{selectedForm.tableRows.map((row, index) => (<tr key={index}><td>{index + 1}</td>{Object.values(row).map((value, i) => (<td key={i}>{value || "-"}</td>))}</tr>))}</tbody>
                </table>
              </div>
            </div>
          )}

          {selectedForm.observaciones && (
            <div className="data-section"><h3>Observaciones</h3><div className="observations-box">{selectedForm.observaciones}</div></div>
          )}

          {Object.keys(selectedForm.firmasData).length > 0 && (
            <div className="data-section">
              <h3>Firmas y Aprobaciones</h3>
              <div className="signatures-grid">
                {Object.entries(selectedForm.firmasData).map(([puesto, data]) => (<div key={puesto} className="signature-box-view"><h4>{puesto}</h4><div className="signature-data"><p><strong>Nombre:</strong> {data.nombre || "-"}</p><p><strong>Fecha:</strong> {data.fecha || "-"}</p></div><div className="signature-line">Firma: _______________________</div></div>))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="view-forms">
      <div className="page-header">
        <h1>Formularios Guardados</h1>
        <div className="filter-section">
          <label>Filtrar por plantilla:</label>
          <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)}>
            <option value="">Todas las plantillas</option>
            {templates.map((t) => (<option key={t.templateID} value={t.codigo}>{t.codigo} - {t.nombre}</option>))}
          </select>
        </div>
      </div>

      {filteredForms.length === 0 ? (
        <div className="empty-state-card"><p>No hay formularios guardados{filterTemplate ? " para esta plantilla" : ""}.</p></div>
      ) : (
        <div className="forms-list">
          {filteredForms.map((form) => (
            <div key={form.formID} className="form-card">
              <div className="form-card-header">
                <div>
                  <span className="form-code">{form.templateCodigo}</span>
                  <h3>{form.templateNombre}</h3>
                </div>
                <div className="form-card-actions">
                  <button onClick={() => setSelectedForm(form)} className="btn-view">👁️ Ver</button>
                  <button onClick={() => exportToJSON(form)} className="btn-export">📥</button>
                  <button onClick={() => deleteForm(form.formID)} className="btn-delete">🗑️</button>
                </div>
              </div>
              <div className="form-card-meta">
                <span>📅 {new Date(form.createdAt).toLocaleString("es-EC")}</span>
                <span>📊 {form.tableRows.length} registro(s)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewForms;