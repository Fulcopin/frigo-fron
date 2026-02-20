"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import FormHeader from "../components/FormHeader"
import VersionIndicator from "../components/VersionIndicator"
import ScrollButton from "../components/ScrollButton"
import { loadFormWithVersionInfo } from "../utils/filledFormsUtils"
import { exportFormToPDF } from "../services/pdfExportService"
import { exportFormToExcel } from "../services/excelExportService"
import "./ViewForms.css"
import { API_BASE_URL } from "../apiConfig"; 
import authService from "../services/authService";
//const API_URL_TEMPLATES = "http://localhost:5074/api/Templates";
//const API_URL_FILLED_FORMS = "http://localhost:5074/api/FilledForms";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

function ViewForms() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🔐 Usuario actual y permisos
  const currentUser = authService.getCurrentUser();
  const canEdit   = currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor';
  const canDelete = currentUser?.rol === 'admin';

  // 🎯 NUEVO: Obtener formId pre-seleccionado desde el state de navegación
  const preSelectedFormId = location.state?.viewFormId;
  
  const [forms, setForms] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedFormVersionInfo, setSelectedFormVersionInfo] = useState(null)
  const [filterTemplate, setFilterTemplate] = useState("")
  
  // 📅 NUEVO: Estados para filtro por rango de fechas
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // 📧 NUEVO: Estados para enviar formulario por correo
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailFormTarget, setEmailFormTarget] = useState(null)

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

        const formsArray = Array.isArray(formsDataResponse) ? formsDataResponse : formsDataResponse.$values || [];
        const templatesArray = Array.isArray(templatesDataResponse) ? templatesDataResponse : templatesDataResponse.$values || [];

        // CORREGIDO: Parsear bodyElements en las plantillas
        const parsedTemplates = templatesArray.map(t => ({
          ...t,
          bodyElements: JSON.parse(t.bodyElements || '[]')
        }));
        
        // CORREGIDO: Parsear bodyData en los formularios llenados
        const parsedForms = formsArray.map(form => ({
          ...form,
          templateNombre: parsedTemplates.find(t => t.templateID === form.templateID)?.nombre || 'Plantilla Desconocida',
          templateCodigo: parsedTemplates.find(t => t.templateID === form.templateID)?.codigo || 'N/A',
          headerData: JSON.parse(form.headerData || '{}'),
          bodyData: JSON.parse(form.bodyData || '[]'), // ¡CAMBIO CLAVE!
          firmasData: JSON.parse(form.firmasData || '{}'),
        }));

        setForms(parsedForms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setTemplates(parsedTemplates); 
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // 🎯 NUEVO: Auto-abrir formulario si viene desde Home
  useEffect(() => {
    const openPreSelectedForm = async () => {
      if (preSelectedFormId && forms.length > 0 && !selectedForm) {
        console.log('🎯 Auto-abriendo formulario desde Home:', preSelectedFormId);
        const formToView = forms.find(f => f.formID === preSelectedFormId);
        if (formToView) {
          await viewFormWithVersion(formToView);
          // Limpiar el state para que no se auto-abra de nuevo
          globalThis.history.replaceState({}, document.title);
        }
      }
    };
    
    openPreSelectedForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedFormId, forms.length]); // Solo depende de preSelectedFormId y cantidad de forms

  const deleteForm = async (formId) => {
    if (window.confirm("¿Estás seguro de eliminar este formulario?")) {
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

  const editForm = (formId) => {
    navigate(`/edit-filled-form/${formId}`);
  };

  // 📋 Duplicar/Copiar formulario como uno nuevo
  const duplicateForm = async (form) => {
    if (!window.confirm('¿Deseas crear una copia de este formulario?')) return;
    try {
      // Obtener datos completos del formulario
      const response = await fetch(`${API_URL_FILLED_FORMS}/${form.formID}`);
      if (!response.ok) throw new Error('No se pudo obtener el formulario');
      const data = await response.json();

      const currentUser = authService.getCurrentUser();
      const payload = {
        templateID: data.templateID,
        headerData: data.headerData,
        bodyData: data.bodyData,
        firmasData: '{}',
        filledBy: currentUser?.nombre || currentUser?.username || 'Usuario desconocido',
        filledByEmail: currentUser?.email || '',
        filledByRole: currentUser?.rol || '',
        proceso: data.proceso || '',
        area: data.area || '',
      };

      const createResponse = await fetch(API_URL_FILLED_FORMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!createResponse.ok) throw new Error('No se pudo duplicar el formulario');
      const newForm = await createResponse.json();
      alert('✅ Formulario duplicado exitosamente');
      // Recargar lista
      const allForms = await fetch(API_URL_FILLED_FORMS).then(r => r.json());
      setForms(allForms.$values || allForms || []);
      // Abrir el nuevo formulario para editar
      navigate(`/edit-filled-form/${newForm.formID || newForm.FormID}`);
    } catch (err) {
      alert('❌ Error al duplicar: ' + err.message);
    }
  };

  // NUEVO: Función para ver formulario con información de versión
  const viewFormWithVersion = async (form) => {
    try {
      console.log('📋 Cargando formulario con versión:', form.formID);
      const formWithVersion = await loadFormWithVersionInfo(form.formID);
      
      // Mantener compatibilidad con el código existente
      const enrichedForm = {
        ...form,
        versionInfo: formWithVersion.versionInfo
      };
      
      setSelectedForm(enrichedForm);
      setSelectedFormVersionInfo(formWithVersion.versionInfo);
      
      console.log('✅ Información de versión cargada:', formWithVersion.versionInfo);
    } catch (error) {
      console.error('❌ Error al cargar versión:', error);
      // Si falla, mostrar el formulario sin información de versión
      setSelectedForm(form);
      setSelectedFormVersionInfo(null);
    }
  };

  const printForm = () => window.print();
  
  const exportToJSON = (form) => { 
    const dataStr = JSON.stringify(form, null, 2); 
    const dataBlob = new Blob([dataStr], { type: "application/json" }); 
    const url = URL.createObjectURL(dataBlob); 
    const link = document.createElement("a"); 
    link.href = url; 
    link.download = `${form.templateCodigo}_${new Date(form.createdAt).toISOString().split("T")[0]}.json`; 
    link.click();
  };

  // NUEVO: Exportar a PDF usando endpoint /with-template
  const handleExportPDF = async (form) => {
    try {
      console.log('📄 Exportando formulario a PDF...', form);
      
      // Usar el endpoint /with-template que parsea todos los datos
      const response = await fetch(`${API_URL_FILLED_FORMS}/${form.formID}/with-template`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo cargar los datos del formulario`);
      }
      
      const formData = await response.json();
      console.log('📦 Datos completos recibidos:', formData);
      console.log('� DEBUG createdAt:', {
        'formData.createdAt': formData.createdAt,
        'formData.CreatedAt': formData.CreatedAt,
        'type': typeof formData.createdAt
      });
      console.log('�📊 formData.data.body:', JSON.stringify(formData.data.body, null, 2));
      console.log('📋 formData.template.structure.bodyElements:', JSON.stringify(formData.template.structure.bodyElements, null, 2));
      
      // Transformar estructura del endpoint al formato esperado por el servicio PDF
      const transformedData = {
        formID: formData.formID,
        templateID: formData.templateID,
        createdAt: formData.createdAt,
        tipoProducto: formData.tipoProducto, // 🦐🐟 NUEVO: Tipo de producto
        observaciones: formData.observaciones,
        templateCodigo: formData.template.codigo,
        templateNombre: formData.template.nombre,
        version: formData.template.version,
        headerData: formData.data.header,
        bodyData: formData.data.body,
        firmasData: formData.data.firmas
      };
      
      const templateStructure = {
        codigo: formData.template.codigo,
        nombre: formData.template.nombre,
        version: formData.template.version,
        bodyElements: formData.template.structure.bodyElements,
        headerFields: formData.template.structure.headerFields,
        firmas: formData.template.structure.firmas
      };
      
      console.log('🔄 Datos transformados:', { transformedData, templateStructure });
      
      // Los datos ya vienen parseados desde el backend
      const result = await exportFormToPDF(transformedData, templateStructure);
      if (result.success) {
        alert(`✅ PDF generado exitosamente: ${result.fileName}`);
      }
    } catch (error) {
      console.error('❌ Error al exportar PDF:', error);
      alert(`❌ Error al generar PDF: ${error.message}`);
    }
  };

  // NUEVO: Exportar a Excel usando endpoint /with-template
  const handleExportExcel = async (form) => {
    try {
      console.log('📊 Exportando formulario a Excel...', form);
      
      // Usar el endpoint /with-template que parsea todos los datos
      const response = await fetch(`${API_URL_FILLED_FORMS}/${form.formID}/with-template`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo cargar los datos del formulario`);
      }
      
      const formData = await response.json();
      console.log('📦 Datos completos recibidos:', formData);
      
      // Transformar estructura del endpoint al formato esperado por el servicio Excel
      const transformedData = {
        formID: formData.formID,
        templateID: formData.templateID,
        createdAt: formData.createdAt,
        tipoProducto: formData.tipoProducto, // 🦐🐟 NUEVO: Tipo de producto
        observaciones: formData.observaciones,
        templateCodigo: formData.template.codigo,
        templateNombre: formData.template.nombre,
        version: formData.template.version,
        headerData: formData.data.header,
        bodyData: formData.data.body,
        firmasData: formData.data.firmas
      };
      
      const templateStructure = {
        codigo: formData.template.codigo,
        nombre: formData.template.nombre,
        version: formData.template.version,
        bodyElements: formData.template.structure.bodyElements,
        headerFields: formData.template.structure.headerFields,
        firmas: formData.template.structure.firmas
      };
      
      console.log('🔄 Datos transformados:', { transformedData, templateStructure });
      
      // Los datos ya vienen parseados desde el backend
      const result = await exportFormToExcel(transformedData, templateStructure);
      if (result.success) {
        alert(`✅ Excel generado exitosamente: ${result.fileName}`);
      }
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert(`❌ Error al generar Excel: ${error.message}`);
    }
  };

  // 📧 NUEVO: Enviar formulario por correo electrónico
  const openEmailModal = (form) => {
    setEmailFormTarget(form);
    // 🆕 Pre-llenar destinatarios con emails de los firmantes
    const firmaEmails = [];
    if (form.firmasData && typeof form.firmasData === 'object') {
      Object.values(form.firmasData).forEach(data => {
        if (data && data.email && data.email.includes('@')) {
          firmaEmails.push(data.email);
        }
      });
    }
    setEmailTo(firmaEmails.length > 0 ? firmaEmails.join(', ') : '');
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailTo.includes('@')) {
      alert('⚠️ Ingresa un email válido');
      return;
    }

    setSendingEmail(true);
    try {
      const form = emailFormTarget;
      const correspondingTpl = templates.find(t => t.templateID === form.templateID);

      // Construir header data
      const headerData = {};
      if (form.headerData && typeof form.headerData === 'object') {
        Object.entries(form.headerData).forEach(([key, value]) => {
          headerData[key] = value || '';
        });
      }

      // Construir body sections
      const bodySections = [];
      if (correspondingTpl && form.bodyData && Array.isArray(form.bodyData)) {
        form.bodyData.forEach((elementData, idx) => {
          const templateElement = correspondingTpl.bodyElements?.[idx];
          if (!templateElement) return;

          if (templateElement.type === 'table') {
            let tableRows = [];
            if (elementData?.rows && Array.isArray(elementData.rows)) {
              tableRows = elementData.rows;
            } else if (elementData?.data && Array.isArray(elementData.data)) {
              tableRows = elementData.data;
            } else if (Array.isArray(elementData)) {
              tableRows = elementData;
            }

            const columns = (templateElement.columns || []).map(col => col.label || col.header || col.name || col.id || '');
            
            // Mapear rows a columnas correctas
            const mappedRows = tableRows.map(row => {
              const mapped = {};
              columns.forEach(colLabel => {
                // Buscar valor con lógica similar a la de renderizado
                let val = row[colLabel];
                if (val === undefined || val === null || val === '') {
                  const foundKey = Object.keys(row).find(k => 
                    k.toUpperCase().replace(/[^A-Z0-9]/g, '') === colLabel.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  );
                  if (foundKey) val = row[foundKey];
                }
                mapped[colLabel] = val !== undefined && val !== null ? String(val) : '-';
              });
              return mapped;
            });

            bodySections.push({
              title: templateElement.title || `Tabla ${idx + 1}`,
              type: 'table',
              columns: columns,
              rows: mappedRows,
            });
          } else if (templateElement.type === 'section') {
            const sectionData = elementData?.data || {};
            bodySections.push({
              title: templateElement.title || `Sección ${idx + 1}`,
              type: 'section',
              data: sectionData,
            });
          }
        });
      }

      // Construir firmas
      const firmas = [];
      if (form.firmasData && typeof form.firmasData === 'object') {
        Object.entries(form.firmasData).forEach(([puesto, data]) => {
          firmas.push({
            puesto: puesto,
            nombre: data?.nombre || null,
            fecha: data?.fecha || null,
            tieneFirma: !!(data?.firma?.url || data?.firma?.base64),
          });
        });
      }

      const requestBody = {
        email: emailTo,
        formName: form.templateNombre || 'Formulario',
        formCode: form.templateCodigo || 'N/A',
        createdAt: new Date(form.createdAt).toLocaleString('es-EC'),
        observaciones: form.observaciones || '',
        headerData: headerData,
        bodySections: bodySections,
        firmas: firmas,
      };

      console.log('📧 Enviando formulario por correo:', requestBody);

      const response = await fetch(`${API_BASE_URL}/Alerts/send-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ ${result.message}`);
        setShowEmailModal(false);
        setEmailTo('');
      } else {
        alert(`❌ ${result.message || 'Error al enviar el correo'}`);
      }
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      alert(`❌ Error al enviar el correo: ${error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // 🔍 FILTRADO MEJORADO: Template + Rango de Fechas
  const filteredForms = forms.filter((form) => {
    // Filtro por template
    const matchesTemplate = filterTemplate ? form.templateCodigo === filterTemplate : true;
    
    // Filtro por rango de fechas
    let matchesDateRange = true;
    if (startDate || endDate) {
      const formDate = new Date(form.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Ajustar end date para incluir todo el día
      if (end) {
        end.setHours(23, 59, 59, 999);
      }
      
      if (start && formDate < start) matchesDateRange = false;
      if (end && formDate > end) matchesDateRange = false;
    }
    
    return matchesTemplate && matchesDateRange;
  });

  if (loading) return <div className="view-forms"><h1>Cargando formularios...</h1></div>;
  if (error) return <div className="view-forms"><h1 className="error-message">Error: {error}</h1></div>;

  if (selectedForm) {
    // Usar el snapshot del template si está disponible (versión histórica)
    // Si no, buscar el template actual de la lista
    let correspondingTemplate;
    
    if (selectedFormVersionInfo && selectedFormVersionInfo.templateSnapshot) {
      // Usar el snapshot guardado con el formulario (versión histórica)
      console.log('📸 Usando snapshot de template (versión histórica)');
      correspondingTemplate = selectedFormVersionInfo.templateSnapshot;
    } else {
      // Buscar el template actual en la lista
      console.log('📋 Usando template actual de la lista');
      correspondingTemplate = templates.find(t => t.templateID === selectedForm.templateID);
    }

    return (
      <div className="view-forms">
        <div className="form-viewer-header">
          <button onClick={() => setSelectedForm(null)} className="btn-back">← Volver a la lista</button>
          <div className="viewer-actions">
            <button onClick={printForm} className="btn-secondary">🖨️ Imprimir</button>
            <button onClick={() => handleExportPDF(selectedForm)} className="btn-pdf" title="Exportar a PDF">📄 PDF</button>
            <button onClick={() => handleExportExcel(selectedForm)} className="btn-excel" title="Exportar a Excel">📊 Excel</button>
            <button onClick={() => openEmailModal(selectedForm)} className="btn-email" title="Enviar por correo">📧 Correo</button>
            <button onClick={() => exportToJSON(selectedForm)} className="btn-secondary">📥 JSON</button>
            {canEdit && (
              <button onClick={() => duplicateForm(selectedForm)} className="btn-secondary" title="Duplicar formulario">📋 Copiar</button>
            )}
            {canEdit && (
              <button onClick={() => editForm(selectedForm.formID)} className="btn-primary">✏️ Editar</button>
            )}
            {canDelete && (
              <button onClick={() => deleteForm(selectedForm.formID)} className="btn-danger">🗑️ Eliminar</button>
            )}
          </div>
        </div>
        <div className="form-viewer-document">
          {(() => {
            // 📅 FECHA DE VERSIÓN: Usar fechaVersion del template, NO createdAt del formulario
            let fechaFinal;
            
            if (correspondingTemplate?.fechaVersion) {
              // Usar la fecha de versión de la plantilla
              fechaFinal = new Date(correspondingTemplate.fechaVersion).toLocaleDateString("es-EC");
              console.log('✅ ViewForms usando fechaVersion de la plantilla:', correspondingTemplate.fechaVersion);
            } else {
              // Fallback: usar fecha de creación del formulario
              console.warn('⚠️ Template sin fechaVersion, usando createdAt del formulario como fallback');
              fechaFinal = new Date(selectedForm.createdAt).toLocaleDateString("es-EC");
            }
            
            return (
              <FormHeader 
                title={selectedForm.templateNombre} 
                code={selectedForm.templateCodigo} 
                version={correspondingTemplate?.version || "1"} 
                date={fechaFinal}
                tipoProducto={selectedForm.tipoProducto} // 🦐🐟 NUEVO: Pasar tipo de producto
              />
            );
          })()}
          
          {/* NUEVO: Indicador de versión de plantilla */}
          {selectedFormVersionInfo && (
            <VersionIndicator 
              versionInfo={selectedFormVersionInfo}
              templateInfo={{ nombre: selectedForm.templateNombre, codigo: selectedForm.templateCodigo }}
            />
          )}
          
          {/* Campos del Header usando el template */}
          {correspondingTemplate && correspondingTemplate.headerFields && correspondingTemplate.headerFields.length > 0 ? (
            <div className="data-section">
              <h3>Información General</h3>
              <div className="data-grid">
                {correspondingTemplate.headerFields.map((field, index) => {
                  // Buscar el valor usando múltiples estrategias
                  let value = selectedForm.headerData[field.label] 
                           || selectedForm.headerData[field.name] 
                           || selectedForm.headerData[field.id];
                  
                  // Si no encontró el valor, buscar por label normalizado (sin acentos)
                  if (!value) {
                    const normalizeString = (str) => str?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    const normalizedFieldLabel = normalizeString(field.label);
                    
                    const matchingKey = Object.keys(selectedForm.headerData).find(key => 
                      normalizeString(key) === normalizedFieldLabel
                    );
                    
                    if (matchingKey) {
                      value = selectedForm.headerData[matchingKey];
                    }
                  }
                  
                  return (
                    <div key={index} className="data-item">
                      <span className="data-label">{field.label || field.name || field.id}:</span>
                      <span className="data-value">{value || "-"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="data-section">
              <h3>⚠️ No hay campos de header definidos en el template</h3>
              <div className="data-grid">
                <div className="data-item">
                  <span className="data-label">Template ID:</span>
                  <span className="data-value">{selectedForm.templateID}</span>
                </div>
                <div className="data-item">
                  <span className="data-label">Template tiene headerFields:</span>
                  <span className="data-value">{correspondingTemplate?.headerFields ? 'Sí' : 'No'}</span>
                </div>
                {correspondingTemplate?.headerFields && (
                  <div className="data-item">
                    <span className="data-label">Cantidad de campos:</span>
                    <span className="data-value">{correspondingTemplate.headerFields.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- NUEVO: RENDERIZADO DEL CUERPO DINÁMICO --- */}
          {correspondingTemplate && selectedForm.bodyData && Array.isArray(selectedForm.bodyData) && selectedForm.bodyData.map((elementData, elementIndex) => {
            const templateElement = correspondingTemplate.bodyElements[elementIndex];
            if (!templateElement) return null;
            
            // Renderizar una SECCIÓN
            if (templateElement.type === 'section') {
              const sectionData = elementData && elementData.data ? elementData.data : {};
              return (
                <div key={templateElement.id} className="data-section">
                  <h3>{templateElement.title}</h3>
                  <div className="data-grid">
                    {Object.entries(sectionData).map(([key, value]) => (
                      <div key={key} className="data-item"><span className="data-label">{key}:</span><span className="data-value">{value || "-"}</span></div>
                    ))}
                  </div>
                </div>
              );
            }

            // Renderizar una TABLA
            if (templateElement.type === 'table') {
              // Manejo seguro de datos de tabla con múltiples formatos
              let tableRows = [];
              
              if (elementData) {
                // Formato nuevo: {rows: [...]}
                if (elementData.rows && Array.isArray(elementData.rows)) {
                  tableRows = elementData.rows;
                }
                // Formato legacy: {data: [...]}
                else if (elementData.data && Array.isArray(elementData.data)) {
                  tableRows = elementData.data;
                }
                // Si elementData es directamente un array
                else if (Array.isArray(elementData)) {
                  tableRows = elementData;
                }
              }
              
              return (
                <div key={templateElement.id} className="data-section">
                  <h3>{templateElement.title}</h3>
                  <div className="table-wrapper">
                    <table className="view-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {templateElement.columns.map((col, colIndex) => {
                            // 🐛 DEBUG: Log para ver qué columnas se renderizan
                            if (colIndex < 3) {
                              console.log(`🔍 Renderizando header columna ${colIndex}:`, {
                                id: col.id,
                                label: col.label,
                                header: col.header,
                                name: col.name
                              });
                            }
                            return (
                              <th key={`header-${colIndex}`}>{col.label || col.header || col.name || col.id || `Col ${colIndex + 1}`}</th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, rowIndex) => {
                          // Obtener la fila del template para mapear nombres de celdas
                          const templateRow = templateElement.rows ? templateElement.rows[rowIndex] : null;
                          
                          return (
                            <tr key={`row-${rowIndex}`}>
                              <td>{rowIndex + 1}</td>
                             {templateElement.columns.map((col, colIndex) => {
                              const rowKeys = Object.keys(row);
                              const colLabel = (col.label || col.header || "").trim();
                              const colId = (col.id || col.name || "").trim();
                              const colIdUpper = colId.toUpperCase();
                              const colLabelUpper = colLabel.toUpperCase();

                              // 1. 🎯 INTENTO DE BÚSQUEDA DIRECTA (EXACTA)
                              // Probamos todas las combinaciones posibles de nombres que vienen en el template
                              let cellValue = row[colLabel] ?? row[col.header] ?? row[colId] ?? row[col.name];

                              // 2. 🔍 BÚSQUEDA INTELIGENTE (Si el primer intento falló)
                              if (cellValue === undefined || cellValue === null || cellValue === "") {
                                // Normalizamos el objetivo: "TEMP. °C" -> "TEMPC"
                                const targetClean = colLabelUpper.replace(/[^A-Z0-9]/g, "");

                                const foundKey = rowKeys.find(key => {
                                  const keyUpper = key.toUpperCase();
                                  const keyClean = keyUpper.replace(/[^A-Z0-9]/g, "");
                                  
                                  // Coincidencia exacta de texto limpio (ej: "TEMP. °C" con "TEMP C")
                                  if (keyClean === targetClean && targetClean !== "") return true;
                                  
                                  // Coincidencia con sufijos (ej: "TOTAL CAJAS/TINAS_col7" contiene "TOTAL CAJAS/TINAS")
                                  if (keyUpper.includes(colLabelUpper) && colLabelUpper !== "") return true;
                                  
                                  return false;
                                });

                                if (foundKey) cellValue = row[foundKey];
                              }

                              // 3. ⚖️ LÓGICA ESPECÍFICA PARA PESOS/TINAS (Si el valor sigue vacío)
                              // Esto mantiene la compatibilidad con el formato de 15 tinas
                              if (cellValue === undefined || cellValue === null || cellValue === "") {
                                const isPesoColumn = colIdUpper.includes('PESO') || colLabelUpper.includes('PESO');
                                const isTotalColumn = colIdUpper.includes('TOTAL') || colLabelUpper.includes('TOTAL');

                                if (isPesoColumn) {
                                  const pesoMatch = (colId || colLabel).match(/\d+/);
                                  const pesoNum = pesoMatch ? pesoMatch[0] : '';
                                  const pesoKey = rowKeys.find(k => k.toUpperCase().includes(`PESO${pesoNum}`) && !k.toUpperCase().includes('TOTAL'));
                                  if (pesoKey) cellValue = row[pesoKey];
                                } 
                                else if (isTotalColumn) {
                                  const totalKey = rowKeys.find(k => k.toUpperCase().includes('TOTAL'));
                                  if (totalKey) cellValue = row[totalKey];
                                }
                              }

                              return (
                                <td key={`cell-${rowIndex}-${colIndex}`} style={{ textAlign: 'center', minWidth: '100px' }}>
                                  {cellValue !== undefined && cellValue !== null && cellValue !== "" 
                                    ? String(cellValue) 
                                    : "-"}
                                </td>
                              );
                            })}
                            </tr>
                          );
                        })}
                        {tableRows.length === 0 && (
                          <tr><td colSpan={templateElement.columns.length + 1}>No hay datos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
            return null;
          })}


          {selectedForm.observaciones && (
            <div className="data-section"><h3>Observaciones</h3><div className="observations-box">{selectedForm.observaciones}</div></div>
          )}

         {Object.keys(selectedForm.firmasData).length > 0 && (
            <div className="data-section">
              <h3>Firmas y Aprobaciones</h3>
              <div className="signatures-grid">
                {(() => {
                  // 🔧 FILTRAR: Solo mostrar firmas que existen en la plantilla actual
                  const templateFirmas = correspondingTemplate?.firmas || [];
                  const puestosValidos = templateFirmas.map(f => f.puesto);
                  
                  console.log('🔍 Firmas en template:', puestosValidos);
                  console.log('🔍 Firmas en formulario guardado:', Object.keys(selectedForm.firmasData));
                  
                  // Filtrar firmasData para solo incluir puestos que están en la plantilla
                  const firmasFiltradas = Object.entries(selectedForm.firmasData)
                    .filter(([puesto]) => puestosValidos.includes(puesto));
                  
                  if (firmasFiltradas.length === 0) {
                    return <p style={{ color: '#666', fontStyle: 'italic' }}>No hay firmas registradas</p>;
                  }
                  
                  return firmasFiltradas.map(([puesto, data]) => (
                  <div key={puesto} className="signature-box-view">
                    <h4>{puesto}</h4>
                    <div className="signature-data">
                      {/* Mostrar imagen si existe */}
                      {data.firma && (data.firma.url || data.firma.base64) ? (
                        <div className="signature-image-container" style={{ textAlign: 'center', marginBottom: '10px' }}>
                          <img 
                            src={data.firma.url || data.firma.base64} 
                            alt={`Firma ${puesto}`} 
                            style={{ 
                              maxHeight: '100px', 
                              maxWidth: '100%', 
                              border: '1px solid #eee',
                              padding: '5px',
                              backgroundColor: 'white',
                              borderRadius: '4px'
                            }} 
                          />
                          {/* Indicador del método de firma */}
                          <div style={{ 
                            fontSize: '10px', 
                            color: '#666', 
                            marginTop: '4px',
                            fontStyle: 'italic'
                          }}>
                            {data.firma.provider === 'cloudinary' && '☁️ Firma subida'}
                            {data.firma.provider === 'base64' && '💾 Firma subida (local)'}
                            {data.firma.provider === 'base64-drawn' && '✍️ Firma dibujada'}
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', color: '#999' }}>(Sin firma digital)</p>
                      )}
                      
                      <p><strong>Nombre:</strong> {data.nombre || "-"}</p>
                      {data.email && (
                        <p><strong>📧 Email:</strong> <a href={`mailto:${data.email}`} style={{ color: '#1976d2' }}>{data.email}</a></p>
                      )}
                      <p><strong>Fecha:</strong> {data.fecha || "-"}</p>
                      <p style={{ marginTop: '4px' }}>
                        {data.firma && (data.firma.url || data.firma.base64) 
                          ? <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Firmado</span>
                          : <span style={{ color: '#e65100' }}>⏳ Pendiente de firma</span>
                        }
                      </p>
                    </div>
                    <div className="signature-line">Firma: _______________________</div>
                  </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // La vista para la lista de formularios mejorada con botón de editar
  return (
    <div className="view-forms">
      <div className="page-header">
        <h1>📋 Formularios Guardados</h1>
        
        {/* 🔍 SECCIÓN DE FILTROS MEJORADA */}
        <div className="filters-container-view">
          <div className="filter-row">
            <div className="filter-group">
              <label>📂 Plantilla:</label>
              <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)}>
                <option value="">Todas las plantillas</option>
                {templates.map((t) => (
                  <option key={t.templateID} value={t.codigo}>
                    {t.codigo} - {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>📅 Desde:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
              />
            </div>
            
            <div className="filter-group">
              <label>📅 Hasta:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
            
            <button 
              className="btn-clear-filters" 
              onClick={() => {
                setFilterTemplate("");
                setStartDate("");
                setEndDate("");
              }}
              title="Limpiar todos los filtros"
            >
              🔄 Limpiar
            </button>
          </div>
          
          {/* Contador de resultados */}
          <div className="results-count">
            {filteredForms.length} formulario{filteredForms.length !== 1 ? 's' : ''} encontrado{filteredForms.length !== 1 ? 's' : ''}
            {(filterTemplate || startDate || endDate) && ` (filtrado de ${forms.length} total${forms.length !== 1 ? 'es' : ''})`}
          </div>
        </div>
      </div>

      {filteredForms.length === 0 ? (
        <div className="empty-state-card">
          <p>No hay formularios guardados{filterTemplate || startDate || endDate ? " con los filtros seleccionados" : ""}.</p>
          {(filterTemplate || startDate || endDate) && (
            <button 
              className="btn-secondary" 
              onClick={() => {
                setFilterTemplate("");
                setStartDate("");
                setEndDate("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
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
                  <button 
                    onClick={() => viewFormWithVersion(form)} 
                    className="btn-view"
                    title="Ver detalles completos"
                  >
                    👁️ Ver
                  </button>
                  {canEdit && (
                  <button 
                    onClick={() => editForm(form.formID)} 
                    className="btn-edit"
                    title="Editar este formulario"
                  >
                    ✏️ Editar
                  </button>
                  )}
                  <button 
                    onClick={() => handleExportPDF(form)} 
                    className="btn-pdf"
                    title="Exportar a PDF"
                  >
                    📄 PDF
                  </button>
                  <button 
                    onClick={() => handleExportExcel(form)} 
                    className="btn-excel"
                    title="Exportar a Excel"
                  >
                    📊 Excel
                  </button>
                  <button 
                    onClick={() => openEmailModal(form)} 
                    className="btn-email"
                    title="Enviar por correo"
                  >
                    📧
                  </button>
                  <button 
                    onClick={() => exportToJSON(form)} 
                    className="btn-export"
                    title="Exportar a JSON"
                  >
                    📥
                  </button>
                  {canEdit && (
                  <button 
                    onClick={() => duplicateForm(form)} 
                    className="btn-edit"
                    title="Duplicar formulario"
                  >
                    📋
                  </button>
                  )}
                  {canDelete && (
                  <button 
                    onClick={() => deleteForm(form.formID)} 
                    className="btn-delete"
                    title="Eliminar formulario"
                  >
                    🗑️
                  </button>
                  )}
                </div>
              </div>
              <div className="form-card-meta">
                <span>📅 {new Date(form.createdAt).toLocaleString("es-EC")}</span>
                <span>👤 {form.filledBy || 'No registrado'}</span>
                {(() => {
                  const template = templates.find(t => t.templateID === form.templateID);
                  const proceso = form.proceso || template?.proceso;
                  return proceso ? <span>🏢 {proceso}</span> : null;
                })()}
                {form.updatedAt && form.updatedAt !== form.createdAt && (
                  <span className="updated-badge">🔄 Editado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 📧 MODAL: Enviar formulario por correo */}
      {showEmailModal && (
        <div className="email-modal-overlay" onClick={() => !sendingEmail && setShowEmailModal(false)}>
          <div className="email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <h3>📧 Enviar Formulario por Correo</h3>
              <button 
                className="email-modal-close" 
                onClick={() => !sendingEmail && setShowEmailModal(false)}
                disabled={sendingEmail}
              >
                ✕
              </button>
            </div>
            <div className="email-modal-body">
              <div className="email-form-info">
                <p><strong>📋 Formulario:</strong> {emailFormTarget?.templateNombre}</p>
                <p><strong>🔖 Código:</strong> {emailFormTarget?.templateCodigo}</p>
                <p><strong>📅 Fecha:</strong> {emailFormTarget ? new Date(emailFormTarget.createdAt).toLocaleString('es-EC') : ''}</p>
              </div>
              <div className="email-input-group">
                <label htmlFor="emailTo">📧 Correo del destinatario:</label>
                <input
                  id="emailTo"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  disabled={sendingEmail}
                  autoFocus
                />
              </div>
              <p className="email-modal-note">
                💡 Se enviará un resumen completo del formulario con todos sus datos, tablas y firmas al correo indicado.
              </p>
            </div>
            <div className="email-modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
              >
                Cancelar
              </button>
              <button 
                className="btn-email-send" 
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailTo}
              >
                {sendingEmail ? '⏳ Enviando...' : '📧 Enviar Correo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔼🔽 Botones de scroll */}
      <ScrollButton />
    </div>
  );
}

export default ViewForms;