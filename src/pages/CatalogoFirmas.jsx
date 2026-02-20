import { useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";
import "./CatalogoFirmas.css";

const API_URL = `${API_BASE_URL}/CatalogoFirmas`;

function CatalogoFirmas() {
  const [firmas, setFirmas] = useState([]);
  const [editingFirma, setEditingFirma] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    puesto: "",
    nombreCompleto: "",
    area: "",
    correo: "",
    activo: true
  });

  useEffect(() => {
    fetchFirmas();
  }, []);

  const fetchFirmas = async () => {
    console.log("🔍 Cargando firmas desde:", `${API_URL}?soloActivos=false`);
    try {
      const response = await fetch(`${API_URL}?soloActivos=false`);
      console.log("🔍 Respuesta:", response.status, response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Firmas recibidas RAW:", data);
        console.log("✅ Tipo de dato:", typeof data);
        console.log("✅ Es array?:", Array.isArray(data));
        console.log("✅ Keys del objeto:", Object.keys(data));
        
        // Si viene envuelto en un objeto con una propiedad, extraerla
        let firmasArray = data;
        if (!Array.isArray(data) && data.$values) {
          console.log("🔧 Extrayendo $values");
          firmasArray = data.$values;
        } else if (!Array.isArray(data) && typeof data === 'object') {
          console.log("🔧 Convirtiendo objeto a array");
          firmasArray = Object.values(data);
        }
        
        console.log("✅ Array final:", firmasArray);
        console.log("✅ Total de firmas:", Array.isArray(firmasArray) ? firmasArray.length : 0);
        setFirmas(Array.isArray(firmasArray) ? firmasArray : []);
      } else {
        const errorText = await response.text();
        console.error("❌ Error al cargar:", response.status, errorText);
        setFirmas([]);
      }
    } catch (error) {
      console.error("❌ Error al cargar firmas:", error);
      setFirmas([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingFirma 
        ? `${API_URL}/${editingFirma.catalogoFirmaID}` 
        : API_URL;
      
      const method = editingFirma ? "PUT" : "POST";
      
      console.log("🔵 Enviando:", method, url, formData);
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      console.log("🔵 Respuesta:", response.status, response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Firma guardada:", result);
        alert(editingFirma ? "✅ Firma actualizada correctamente" : "✅ Firma creada correctamente");
        await fetchFirmas();
        resetForm();
      } else {
        const errorText = await response.text();
        console.error("❌ Error del servidor:", response.status, errorText);
        alert(`❌ Error al guardar: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("❌ Error al guardar firma:", error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleEdit = (firma) => {
    setEditingFirma(firma);
    setFormData({
      puesto: firma.puesto,
      nombreCompleto: firma.nombreCompleto || "",
      area: firma.area || "",
      correo: firma.correo || "",
      activo: firma.activo
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Desactivar esta firma?")) return;
    
    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      fetchFirmas();
    } catch (error) {
      console.error("Error al eliminar firma:", error);
    }
  };

  const resetForm = () => {
    setFormData({ puesto: "", nombreCompleto: "", area: "", correo: "", activo: true });
    setEditingFirma(null);
    setShowForm(false);
  };

  return (
    <div className="catalogo-firmas-container">
      <div className="page-header">
        <h1>📋 Catálogo de Firmas</h1>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn-primary"
        >
          {showForm ? "❌ Cancelar" : "+ Nueva Firma"}
        </button>
      </div>

      {showForm && (
        <div className="form-section">
          <h2>{editingFirma ? "Editar Firma" : "Nueva Firma"}</h2>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Puesto *</label>
              <input
                type="text"
                required
                value={formData.puesto}
                onChange={(e) => setFormData({...formData, puesto: e.target.value})}
                placeholder="Ej: Supervisor de Calidad"
              />
            </div>

            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text"
                value={formData.nombreCompleto}
                onChange={(e) => setFormData({...formData, nombreCompleto: e.target.value})}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="form-group">
              <label>Área</label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({...formData, area: e.target.value})}
                placeholder="Ej: Producción"
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={formData.correo}
                onChange={(e) => setFormData({...formData, correo: e.target.value})}
                placeholder="Ej: nombre@empresa.com"
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                />
                Activo
              </label>
            </div>

            <div className="form-actions" style={{gridColumn: '1 / -1'}}>
              <button type="submit" className="btn-primary">
                {editingFirma ? "💾 Actualizar" : "➕ Crear"}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="firmas-list">
        <h2>Listado de Firmas</h2>
        <div className="table-responsive">
          <table className="firmas-table">
            <thead>
              <tr>
                <th>Puesto</th>
                <th>Nombre</th>
                <th>Área</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {firmas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No hay firmas registradas
                  </td>
                </tr>
              ) : (
                firmas.map((firma) => (
                  <tr key={firma.catalogoFirmaID} className={!firma.activo ? 'inactive' : ''}>
                    <td><strong>{firma.puesto}</strong></td>
                    <td>{firma.nombreCompleto || "-"}</td>
                    <td>{firma.area || "-"}</td>
                    <td>{firma.correo || "-"}</td>
                    <td>
                      <span className={`status-badge ${firma.activo ? 'active' : 'inactive'}`}>
                        {firma.activo ? "✅ Activo" : "❌ Inactivo"}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleEdit(firma)} 
                        className="btn-edit"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      {firma.activo && (
                        <button 
                          onClick={() => handleDelete(firma.catalogoFirmaID)} 
                          className="btn-delete"
                          title="Desactivar"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CatalogoFirmas;
