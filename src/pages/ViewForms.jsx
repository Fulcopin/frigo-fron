"use client"

import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import FormHeader from "../components/FormHeader"
import VersionIndicator from "../components/VersionIndicator"
import ScrollButton from "../components/ScrollButton"
import SignatureUploader from "../components/SignatureUploader"
import { loadFormWithVersionInfo, updateFilledForm } from "../utils/filledFormsUtils"
import { exportFormToPDF } from "../services/pdfExportService"
import { exportFormToExcel } from "../services/excelExportService"
import { CLOUDINARY_CONFIG } from "../config/cloudinary.config"
import "./ViewForms.css"
import { API_BASE_URL } from "../apiConfig"; 
import authService from "../services/authService";
import { evaluarFormula, buildGroupedRowAlias, buildComputedRow, mergeCrossTableRow } from "../utils/formulaEngine";
//const API_URL_TEMPLATES = "http://localhost:5074/api/Templates";
//const API_URL_FILLED_FORMS = "http://localhost:5074/api/FilledForms";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

// Parser seguro: si ya es objeto lo devuelve tal cual, si es string lo parsea, si falla devuelve fallback
const safeParse = (val, fallback) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

// 🖼️ Helper: detectar si un valor es URL de imagen y renderizar apropiadamente
const isImageUrl = (val) => {
  if (typeof val !== 'string') return false;
  const lower = val.toLowerCase();
  return (
    lower.includes('cloudinary.com') ||
    lower.includes('res.cloudinary') ||
    lower.startsWith('data:image/') ||
    /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i.test(val)
  );
};

const renderCellValue = (value, fieldType) => {
  if (value === undefined || value === null || value === '' || value === '-') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  const strVal = String(value);
  
  // Formatear fechas ISO (quitar la "T" y mostrar bonito)
  // Detecta: 2026-03-18T16:03, 2026-03-18T16:03:00, etc.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(strVal)) {
    const d = new Date(strVal);
    if (!Number.isNaN(d.getTime())) {
      const fecha = d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${fecha}  ${hora}`;
    }
  }
  // Detecta fecha sola: 2026-03-18
  if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    const [y, m, day] = strVal.split('-');
    return `${day}/${m}/${y}`;
  }
  
  // Checkbox visual rendering
  if (fieldType === 'checkbox') {
    if (strVal === 'SI' || strVal === 'true') {
      return <span style={{ color: '#059669', fontWeight: '700', fontSize: '1.1em' }}>✓</span>;
    }
    return <span style={{ color: '#9ca3af' }}>—</span>;
  }
  
  if (isImageUrl(strVal)) {
    console.log('🖼️ renderCellValue: detectada imagen →', strVal.substring(0, 80));
    return (
      <div style={{ padding: '8px 0' }}>
        <img 
          src={strVal} 
          alt="Imagen" 
          style={{ 
            maxWidth: '300px', 
            maxHeight: '250px', 
            borderRadius: '8px', 
            border: '2px solid #e5e7eb',
            cursor: 'pointer',
            objectFit: 'contain',
            display: 'block',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onClick={() => window.open(strVal, '_blank')}
          title="Click para ver en tamaño completo"
        />
      </div>
    );
  }
  return strVal;
};

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

  // 🔐 Estado para firmas interactivas en vista
  const [viewFirmasData, setViewFirmasData] = useState({})
  const [savingSignature, setSavingSignature] = useState(false)

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

        // CORREGIDO: Parsear bodyElements, headerFields y firmas en las plantillas
        const parsedTemplates = templatesArray.map(t => ({
          ...t,
          bodyElements: safeParse(t.bodyElements, []),
          headerFields: safeParse(t.headerFields, []),
          firmas: safeParse(t.firmas, []),
        }));
        
        // CORREGIDO: Parsear bodyData en los formularios llenados
        const parsedForms = formsArray.map(form => ({
          ...form,
          templateNombre: parsedTemplates.find(t => t.templateID === form.templateID)?.nombre || 'Plantilla Desconocida',
          templateCodigo: parsedTemplates.find(t => t.templateID === form.templateID)?.codigo || 'N/A',
          headerData: safeParse(form.headerData, {}),
          bodyData: safeParse(form.bodyData, []),
          firmasData: safeParse(form.firmasData, {}),
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
      
      // 🔧 FIX: Usar los datos del formData descargado para asegurar que bodyData esté correcto
      const formData = formWithVersion.formData;
      
      // Mantener compatibilidad con el código existente,
      // pero sobrescribir bodyData/headerData/firmasData con los parseados frescos
      const enrichedForm = {
        ...form,
        headerData: formData?.headerData ?? form.headerData,
        bodyData: formData?.bodyData ?? form.bodyData,
        firmasData: formData?.firmasData ?? form.firmasData,
        versionInfo: formWithVersion.versionInfo
      };
      
      setSelectedForm(enrichedForm);
      setSelectedFormVersionInfo(formWithVersion.versionInfo);
      
      console.log('✅ Información de versión cargada:', formWithVersion.versionInfo);
      console.log('📦 bodyData listo:', Array.isArray(enrichedForm.bodyData) ? enrichedForm.bodyData.length + ' elementos' : typeof enrichedForm.bodyData);
    } catch (error) {
      console.error('❌ Error al cargar versión:', error);
      // Si falla, mostrar el formulario sin información de versión
      setSelectedForm(form);
      setSelectedFormVersionInfo(null);
    }
  };

  // 🔐 Sincronizar viewFirmasData cuando se selecciona un formulario
  useEffect(() => {
    if (selectedForm?.firmasData) {
      setViewFirmasData({ ...selectedForm.firmasData });
    }
  }, [selectedForm]);

  // ✍️ Handler para actualizar firma desde la vista
  const handleViewFirmaUpdate = async (puesto, firmaData) => {
    console.log('✍️ Actualizando firma en vista para:', puesto);
    
    // Auto-captura de fecha y hora
    let updatedFirmaData = { ...firmaData };
    if (firmaData.firma) {
      const now = new Date();
      // 🔧 FIX: Usar fecha LOCAL (no UTC) para evitar desfase de día en zona horaria Ecuador (UTC-5)
      const fechaActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const horaActual = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      // 🔧 FIX: SIEMPRE capturar fecha/hora actual al firmar (no usar fallback de fecha vieja)
      updatedFirmaData = {
        ...firmaData,
        fecha: fechaActual,
        hora: horaActual,
        fechaHoraCapturada: true
      };
    }
    
    const newFirmasData = { ...viewFirmasData, [puesto]: updatedFirmaData };
    setViewFirmasData(newFirmasData);

    // Guardar automáticamente en el backend
    try {
      setSavingSignature(true);
      await updateFilledForm(selectedForm.formID, {
        templateID: selectedForm.templateID,
        headerData: selectedForm.headerData,
        bodyData: selectedForm.bodyData,
        firmasData: newFirmasData,
        observaciones: selectedForm.observaciones
      });
      
      // Actualizar el formulario en el estado local
      setSelectedForm(prev => ({
        ...prev,
        firmasData: newFirmasData
      }));
      
      // Actualizar en la lista de formularios
      setForms(prev => prev.map(f => 
        f.formID === selectedForm.formID 
          ? { ...f, firmasData: newFirmasData }
          : f
      ));
      
      console.log('✅ Firma guardada exitosamente');
    } catch (error) {
      console.error('❌ Error al guardar firma:', error);
      alert('❌ Error al guardar la firma: ' + error.message);
    } finally {
      setSavingSignature(false);
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
      // Buscar el template actual en la lista (comparar como string para evitar Number vs String mismatch)
      console.log('📋 Usando template actual de la lista');
      correspondingTemplate = templates.find(t => String(t.templateID) === String(selectedForm.templateID));
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
            // 📅 FECHA: Prioridad → fechaVersion del template → createdAt del template → createdAt del formulario
            const rawFecha = correspondingTemplate?.fechaVersion 
              || correspondingTemplate?.createdAt
              || selectedForm?.createdAt;
            const fechaFinal = rawFecha ? new Date(rawFecha).toLocaleDateString("es-EC") : "Sin fecha";
            
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
                  
                  // Renderizar valor (detectar imágenes)
                  const displayValue = renderCellValue(value, field.type);
                  const isImg = typeof value === 'string' && isImageUrl(value);
                  
                  return (
                    <div key={index} className={`data-item ${isImg ? 'data-item-image' : ''}`} style={isImg ? { gridColumn: '1 / -1' } : {}}>
                      <span className="data-label">{field.label || field.name || field.id}:</span>
                      <div className="data-value">{displayValue}</div>
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
              // 🔧 FIX: Soportar tanto elementData.data como elementData.rows para secciones
              const sectionData = (elementData && (elementData.data || elementData.rows)) ? (elementData.data || elementData.rows) : {};
              return (
                <div key={templateElement.id} className="data-section">
                  <h3>{templateElement.title}</h3>
                  <div className="data-grid">
                    {Object.entries(sectionData).map(([key, value]) => {
                      const isImg = typeof value === 'string' && isImageUrl(value);
                      return (
                        <div key={key} className={`data-item ${isImg ? 'data-item-image' : ''}`} style={isImg ? { gridColumn: '1 / -1' } : {}}>
                          <span className="data-label">{key}:</span>
                          <div className="data-value">{renderCellValue(value, templateElement.fields?.find(f => f.label === key || f.id === key || f.name === key)?.type)}</div>
                        </div>
                      );
                    })}
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
                  <div className="table-wrapper" style={templateElement.columns.length > 10 ? { fontSize: '0.78rem' } : {}}>
                    <table className={`view-table${templateElement.columns.length > 8 ? ' view-table-compact' : ''}`}>
                      <thead>
                        {/* Grouped column headers */}
                        {templateElement.columns.some(col => col.group) && (() => {
                          // Build group spans: consecutive columns with same group get merged
                          const headerItems = [];
                          templateElement.columns.forEach((col) => {
                            if (!col.group) {
                              // Non-grouped column: render individually with rowSpan=2
                              headerItems.push({ type: 'single', label: col.label || col.header || col.name || col.id, span: 1 });
                            } else {
                              const last = headerItems[headerItems.length - 1];
                              if (last && last.type === 'group' && last.name === col.group) {
                                last.span++;
                              } else {
                                headerItems.push({ type: 'group', name: col.group, span: 1 });
                              }
                            }
                          });
                          return (
                            <tr>
                              <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>#</th>
                              {headerItems.map((item, i) => (
                                item.type === 'single'
                                  ? <th key={`hdr-${i}`} rowSpan={2} style={{ verticalAlign: 'bottom', fontSize: '0.8rem' }}>{item.label}</th>
                                  : <th key={`hdr-${i}`} colSpan={item.span} style={{ textAlign: 'center', background: '#eef2ff', color: '#3730a3', fontWeight: '700', fontSize: '0.8rem', borderBottom: '2px solid #6366f1' }}>{item.name}</th>
                              ))}
                            </tr>
                          );
                        })()}
                        <tr>
                          {!templateElement.columns.some(col => col.group) && <th>#</th>}
                          {templateElement.columns.map((col, colIndex) => {
                            // Skip non-grouped columns (they already have rowSpan=2 in the group row)
                            if (templateElement.columns.some(c => c.group) && !col.group) return null;
                            return (
                              <th key={`subhdr-${colIndex}`} style={{ fontSize: '0.8rem' }}>{col.label || col.header || col.name || col.id || `Col ${colIndex + 1}`}</th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, rowIndex) => {
                          // Obtener la fila del template para mapear nombres de celdas
                          const templateRow = templateElement.rows ? templateElement.rows[rowIndex] : null;
                          // Pre-calcular fórmulas para permitir encadenamiento entre columnas
                          const computedRow = buildComputedRow(mergeCrossTableRow(row, rowIndex, selectedForm.bodyData), templateElement.columns || [], tableRows, rowIndex);
                          
                          return (
                            <tr key={`row-${rowIndex}`}>
                              <td>{rowIndex + 1}</td>
                             {templateElement.columns.map((col, colIndex) => {
                              const rowKeys = Object.keys(row);
                              const colLabel = (col.label || col.header || "").trim();
                              const colId = (col.id || col.name || "").trim();
                              const colIdUpper = colId.toUpperCase();
                              const colLabelUpper = colLabel.toUpperCase();

                              // 1. 🔑 PRIORIDAD MÁXIMA: clave exacta _colN (igual que hace el PDF)
                              // Para tablas agrupadas con etiquetas duplicadas, FillForm guarda
                              // "Termómetro_col2", "Termómetro_col6", etc. La búsqueda por sufijo
                              // es la más precisa porque usa el índice exacto de la columna.
                              const preciseKey = rowKeys.find(k => k.endsWith(`_col${colIndex}`));
                              let cellValue = preciseKey !== undefined ? row[preciseKey] : undefined;

                              // 2. 🎯 BÚSQUEDA DIRECTA EXACTA (etiquetas únicas sin sufijo)
                              if (cellValue === undefined || cellValue === null || cellValue === "") {
                                cellValue = row[colLabel] ?? row[col.header] ?? row[colId] ?? row[col.name];
                              }

                              // 3. 🔍 BÚSQUEDA NORMALIZADA (caracteres especiales, acentos, espacios)
                              if (cellValue === undefined || cellValue === null || cellValue === "") {
                                const targetClean = colLabelUpper.replace(/[^A-Z0-9]/g, "");
                                const foundKey = rowKeys.find(key => {
                                  const keyClean = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                  // Solo coincidencia limpia exacta: evita que "TERMÓMETRO" coincida
                                  // con "TERMÓMETRO_COL2" (diferente grupo) via includes()
                                  return keyClean === targetClean && targetClean !== "";
                                });
                                if (foundKey) cellValue = row[foundKey];
                              }

                              // 4. ⚖️ LÓGICA ESPECÍFICA PARA PESOS/TINAS
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

                              // 5. 🧮 Columnas de fórmula: recalcular con computedRow (encadenamiento habilitado)
                              if ((col.type === 'formula' || col.type === 'calculated') && col.formula) {
                                const rowAlias = buildGroupedRowAlias(computedRow, templateElement.columns, colIndex);
                                const calculado = evaluarFormula(col.formula, rowAlias, tableRows, rowIndex);
                                if (calculado && calculado !== '⚠️' && calculado !== 'ERR') {
                                  cellValue = calculado;
                                }
                              }

                              return (
                                <td key={`cell-${rowIndex}-${colIndex}`} style={{ textAlign: 'center', minWidth: templateElement.columns.length > 12 ? '60px' : templateElement.columns.length > 8 ? '75px' : '100px' }}>
                                  {renderCellValue(cellValue, col.type)}
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
                      
                      {/* 📊 FILA DE TOTALES POR COLUMNA */}
                      {tableRows.length > 0 && (correspondingTemplate?.autoSumColumns === true || correspondingTemplate?.AutoSumColumns === true) && (
                        <tfoot>
                          <tr style={{ backgroundColor: '#eef2ff', fontWeight: 'bold', borderTop: '3px solid #6366f1' }}>
                            <td style={{ textAlign: 'center', color: '#4338ca', fontWeight: '800', fontSize: '0.9em', padding: '8px 4px' }}>Σ</td>
                            {templateElement.columns.map((col, colIndex) => {
                              const colLabel = (col.label || col.header || '').toUpperCase();
                              const colId = (col.id || col.name || '').toUpperCase();
                              
                              // Sumar valores de esta columna en todas las filas
                              let columnTotal = 0;
                              let hasValues = false;

                              tableRows.forEach(row => {
                                const rowKeys = Object.keys(row);
                                const colLabelSearch = (col.label || col.header || "").trim();
                                const colIdSearch = (col.id || col.name || "").trim();

                                // Buscar valor igual que en el renderizado
                                let cellValue = row[colLabelSearch] ?? row[col.header] ?? row[colIdSearch] ?? row[col.name];

                                if (cellValue === undefined || cellValue === null || cellValue === "") {
                                  const targetClean = colLabel.replace(/[^A-Z0-9]/g, "");
                                  const foundKey = rowKeys.find(key => {
                                    const keyClean = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                    if (keyClean === targetClean && targetClean !== "") return true;
                                    if (key.toUpperCase().includes(colLabel) && colLabel !== "") return true;
                                    return false;
                                  });
                                  if (foundKey) cellValue = row[foundKey];
                                }

                                // Para PESO/TOTAL buscar específicamente
                                if (cellValue === undefined || cellValue === null || cellValue === "") {
                                  if (colLabel.includes('PESO') || colId.includes('PESO')) {
                                    const pesoMatch = (col.id || col.label || '').match(/\d+/);
                                    const pesoNum = pesoMatch ? pesoMatch[0] : '';
                                    const pesoKey = rowKeys.find(k => k.toUpperCase().includes(`PESO${pesoNum}`) && !k.toUpperCase().includes('TOTAL'));
                                    if (pesoKey) cellValue = row[pesoKey];
                                  } else if (colLabel.includes('TOTAL') || colId.includes('TOTAL')) {
                                    const totalKey = rowKeys.find(k => k.toUpperCase().includes('TOTAL'));
                                    if (totalKey) cellValue = row[totalKey];
                                  }
                                }

                                const val = parseFloat(cellValue);
                                if (!isNaN(val)) {
                                  columnTotal += val;
                                  hasValues = true;
                                }
                              });

                              return (
                                <td key={`total-${colIndex}`} style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '1.05em',
                                  padding: '8px 4px',
                                  color: hasValues ? '#4338ca' : '#9ca3af',
                                  backgroundColor: hasValues ? '#e0e7ff' : 'transparent'
                                }}>
                                  {hasValues ? columnTotal.toFixed(2) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            }

            // Renderizar TINAS (Control de Tinas)
            if (templateElement.type === 'tinas') {
              const config = templateElement.config || {};
              const groups = config.groups || [];
              const fields = config.fields || [];
              const cycles = config.cycles || 3;
              const tinasData = (elementData && elementData.data) ? elementData.data : {};

              const allTinas = groups.flatMap((g, gIdx) =>
                Array.from({ length: g.count }, (_, tIdx) => ({
                  key: `g${gIdx}_t${tIdx}`,
                  label: (g.labels || [])[tIdx] || `TINA ${tIdx + 1}`,
                  groupName: g.name || `Grupo ${gIdx + 1}`,
                  groupIdx: gIdx,
                  count: g.count
                }))
              );

              return (
                <div key={templateElement.id} className="data-section">
                  <h3>🧊 {templateElement.title || 'Control de Tinas'}</h3>
                  <div className="table-wrapper">
                    <table className="view-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ background: '#035b8d', color: 'white', minWidth: '120px' }}>Ciclo / Campo</th>
                          {groups.map((g, gIdx) => (
                            <th key={gIdx} colSpan={g.count} style={{ background: '#035b8d', color: 'white', textAlign: 'center' }}>
                              {g.name}
                              {g.subtitle && <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>{g.subtitle}</div>}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {allTinas.map(tina => (
                            <th key={tina.key} style={{ background: '#0284c7', color: 'white', textAlign: 'center', fontSize: '11px' }}>
                              {tina.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: cycles }).map((_, cycleIdx) =>
                          fields.map((field, fi) => (
                            <tr key={`${cycleIdx}-${fi}`} style={{ background: (cycleIdx * fields.length + fi) % 2 === 0 ? '#fff' : '#f8fafc' }}>
                              <td style={{ fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                                C{cycleIdx + 1} - {field.label}{field.suffix ? ` (${field.suffix})` : ''}
                              </td>
                              {allTinas.map(tina => {
                                const val = tinasData[tina.key]?.[cycleIdx]?.[field.label] ?? '';
                                return (
                                  <td key={`${tina.key}-${cycleIdx}-${fi}`} style={{ textAlign: 'center' }}>
                                    {renderCellValue(val, field.type)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
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

         {Object.keys(viewFirmasData).length > 0 && (
            <div className="data-section">
              <h3>Firmas y Aprobaciones {savingSignature && <span style={{ fontSize: '12px', color: '#1976d2' }}>💾 Guardando...</span>}</h3>
              <div className="signatures-grid">
                {(() => {
                  // 🔧 FILTRAR: Solo mostrar firmas que existen en la plantilla actual
                  const templateFirmas = correspondingTemplate?.firmas || [];
                  const puestosValidos = templateFirmas.map(f => f.puesto);
                  
                  // Filtrar firmasData para solo incluir puestos que están en la plantilla
                  const firmasFiltradas = Object.entries(viewFirmasData)
                    .filter(([puesto]) => puestosValidos.includes(puesto));
                  
                  if (firmasFiltradas.length === 0) {
                    return <p style={{ color: '#4b5563', fontStyle: 'italic' }}>No hay firmas registradas</p>;
                  }
                  
                  return firmasFiltradas.map(([puesto, data]) => {
                    // 🔐 Verificar si el usuario logueado es el asignado a este puesto
                    const nombreAsignado = (data.nombre || '').toLowerCase().trim();
                    const currentUserName = (currentUser?.nombre || currentUser?.username || '').toLowerCase().trim();
                    const isCurrentUserSlot = nombreAsignado && currentUserName && nombreAsignado === currentUserName;
                    const yaFirmado = !!(data.firma && (data.firma.url || data.firma.base64));
                    // El usuario puede firmar si: es su slot Y aún no ha firmado
                    const canSignHere = isCurrentUserSlot && !yaFirmado;
                    
                    console.log(`🔐 [${puesto}] Validación de firma:`, {
                      nombreAsignado,
                      currentUserName,
                      isCurrentUserSlot,
                      yaFirmado,
                      canSignHere
                    });
                    
                    return (
                      <div key={puesto} className="signature-box-view" style={{
                        border: isCurrentUserSlot ? '2px solid #1976d2' : undefined,
                        borderRadius: '8px',
                        position: 'relative'
                      }}>
                        {isCurrentUserSlot && (
                          <div style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '10px',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            👤 Tu firma
                          </div>
                        )}
                        <h4>{puesto}</h4>
                        <div className="signature-data">
                          {/* Mostrar imagen si ya firmó */}
                          {yaFirmado ? (
                            <div className="signature-image-container" style={{ textAlign: 'center', marginBottom: '10px' }}>
                              <img 
                                src={data.firma.url || data.firma.base64} 
                                alt={`Firma ${puesto}`} 
                                style={{ 
                                  maxHeight: '150px', 
                                  maxWidth: '100%', 
                                  minHeight: '60px',
                                  objectFit: 'contain',
                                  border: '1px solid #eee',
                                  padding: '5px',
                                  backgroundColor: 'white',
                                  borderRadius: '4px'
                                }} 
                              />
                              <div style={{ 
                                fontSize: '10px', 
                                color: '#4b5563', 
                                marginTop: '4px',
                                fontStyle: 'italic'
                              }}>
                                {data.firma.provider === 'cloudinary' && '☁️ Firma subida'}
                                {data.firma.provider === 'base64' && '💾 Firma subida (local)'}
                                {data.firma.provider === 'base64-drawn' && '✍️ Firma dibujada'}
                                {data.firma.provider === 'mysignature-auto' && '🔄 Firma automática'}
                              </div>
                            </div>
                          ) : canSignHere ? (
                            /* 🔓 Si es el slot del usuario actual y no ha firmado → mostrar SignatureUploader */
                            <SignatureUploader
                              puesto={puesto}
                              firmaData={data}
                              onFirmaChange={(updatedData) => handleViewFirmaUpdate(puesto, updatedData)}
                              cloudinaryCloudName={CLOUDINARY_CONFIG.cloudName}
                              cloudinaryUploadPreset={CLOUDINARY_CONFIG.uploadPreset}
                              currentUser={currentUser}
                              canSign={true}
                            />
                          ) : (
                            <p style={{ fontStyle: 'italic', color: '#6b7280' }}>(Sin firma digital)</p>
                          )}
                          
                          {/* Nombre bloqueado (readonly) */}
                          <p><strong>Nombre:</strong> {data.nombre || "-"}</p>
                          {data.email && (
                            <p><strong>📧 Email:</strong> <a href={`mailto:${data.email}`} style={{ color: '#1976d2' }}>{data.email}</a></p>
                          )}
                          <p><strong>Fecha:</strong> {data.fecha ? new Date(data.fecha + 'T00:00:00').toLocaleDateString('es-EC') : "-"}</p>
                          {data.hora && (
                            <p><strong>Hora:</strong> {data.hora}</p>
                          )}
                          <p style={{ marginTop: '4px' }}>
                            {yaFirmado
                              ? <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Firmado</span>
                              : <span style={{ color: '#e65100' }}>⏳ Pendiente de firma</span>
                            }
                          </p>
                        </div>
                        <div className="signature-line">Firma: _______________________</div>
                      </div>
                    );
                  });
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