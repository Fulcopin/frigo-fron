import { useState, useEffect, useRef } from 'react';
import signatureService from '../services/signatureService';
import authService from '../services/authService';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './SignatureManagement.css';

export default function SignatureManagement() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'timing' ? 'timing' : 'pending';

  const [pendingForms, setPendingForms] = useState([]);
  const [selectedForms, setSelectedForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureImage, setSignatureImage] = useState('');
  const [comments, setComments] = useState('');
  const [isMassive, setIsMassive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [signatureTab, setSignatureTab] = useState('upload'); // 'upload' o 'draw'
  const [isDrawing, setIsDrawing] = useState(false);

  // Estado para modal de rechazo con motivo opcional
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectFormId, setRejectFormId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Estado para pestaña principal: 'pending' o 'timing'
  const [mainTab, setMainTab] = useState(initialTab);
  const [timingReport, setTimingReport] = useState(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingDays, setTimingDays] = useState(30);
  const [timingFilter, setTimingFilter] = useState('all'); // all, signed, pending, rejected

  // Canvas refs
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const currentUser = authService.getCurrentUser();
  const isSGI = currentUser?.rol === 'admin' || currentUser?.rol === 'sgi';

  useEffect(() => {
    loadData();
    // Si la URL tiene ?tab=timing, cargar el reporte de tiempos automáticamente
    if (initialTab === 'timing') {
      loadTimingReport();
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 1. Cargar formularios pendientes de firma DESDE EL BACKEND REAL
      let pendingData = [];
      try {
        const pendingResponse = await fetch(`${API_BASE_URL}/Signatures/pending`);
        if (pendingResponse.ok) {
          const rawPending = await pendingResponse.json();
          pendingData = Array.isArray(rawPending) ? rawPending : rawPending.$values || [];
        }
      } catch (err) {
        console.warn('⚠️ No se pudo cargar /Signatures/pending:', err);
      }

      // 2. Cargar templates para enriquecer datos
      let templatesData = [];
      try {
        const templatesResponse = await fetch(`${API_BASE_URL}/Templates`);
        if (templatesResponse.ok) {
          const rawTemplates = await templatesResponse.json();
          templatesData = Array.isArray(rawTemplates) ? rawTemplates : rawTemplates.$values || [];
          setTemplates(templatesData);
        }
      } catch (err) {
        console.warn('⚠️ No se pudieron cargar templates:', err);
      }

      // 3. Enriquecer formularios pendientes con datos del template
      const enrichedForms = pendingData.map(form => {
        const template = templatesData.find(t => t.templateID === (form.templateId || form.templateID));
        // Determinar si las firmasData del formulario están llenas
        let hasSignatureImages = false;
        let firmasDataParsed = null;
        
        if (form.firmasData) {
          try {
            const firmas = typeof form.firmasData === 'string' ? JSON.parse(form.firmasData) : form.firmasData;
            firmasDataParsed = firmas;
            hasSignatureImages = Object.values(firmas).some(f => 
              f && typeof f === 'object' && f.firma && (f.firma.url || f.firma.base64)
            );
          } catch { /* ignore */ }
        }

        return {
          id: form.id || form.formID,
          templateId: form.templateId || form.templateID,
          templateName: form.templateName || template?.nombre || 'Plantilla Desconocida',
          formCode: form.formCode || template?.codigo || 'N/A',
          area: form.area || template?.proceso || 'Sin área',
          proceso: template?.proceso || '',
          // ✅ USAR CAMPOS CORRECTOS DE AUDITORÍA (FilledBy del usuario que creó/llenó)
          createdBy: form.filledBy || form.createdBy || 'No registrado',
          createdByEmail: form.filledByEmail || form.createdByEmail || '',
          createdByRole: form.filledByRole || form.createdByRole || '',
          createdDate: form.createdDate || form.createdAt,
          isSigned: form.isSigned || false,
          hasSignatureImages, // Si el formulario YA tiene firmas PNG dentro
          status: form.isSigned ? 'signed' : 'pending',
          signed: form.isSigned || false,
          firmasData: firmasDataParsed, // ✅ Agregar FirmasData parseado para filtrado
        };
      });

      setPendingForms(enrichedForms);

      // 4. Cargar estadísticas DESDE EL BACKEND REAL
      try {
        const statsResponse = await fetch(`${API_BASE_URL}/Signatures/stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            pendingCount: statsData.pendingCount || 0,
            signedToday: statsData.signedToday || 0,
            totalSigned: statsData.totalSigned || 0,
            rejectedCount: statsData.rejectedCount || 0,
            totalForms: enrichedForms.length,
          });
        }
      } catch {
        // Calcular localmente si el backend falla
        setStats({
          pendingCount: enrichedForms.length,
          signedToday: 0,
          totalSigned: 0,
          rejectedCount: 0,
          totalForms: enrichedForms.length,
        });
      }

    } catch (error) {
      console.error('Error al cargar datos:', error);
      setPendingForms([]);
      setStats({
        pendingCount: 0,
        signedToday: 0,
        totalSigned: 0,
        rejectedCount: 0,
        totalForms: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = (formId) => {
    setSelectedForms(prev => {
      if (prev.includes(formId)) {
        return prev.filter(id => id !== formId);
      } else {
        return [...prev, formId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedForms.length === filteredForms.length) {
      setSelectedForms([]);
    } else {
      setSelectedForms(filteredForms.map(form => form.id));
    }
  };

  const openSignatureModal = (massive = false) => {
    if (massive && selectedForms.length === 0) {
      alert('Por favor selecciona al menos un formulario para firmar');
      return;
    }
    setIsMassive(massive);
    setSignatureTab('upload');
    setSignatureImage('');
    setShowSignatureModal(true);
  };

  // === CANVAS DRAWING FUNCTIONS ===
  useEffect(() => {
    if (showSignatureModal && signatureTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.lineCap = 'round';
      context.strokeStyle = '#000';
      context.lineWidth = 2;
      contextRef.current = context;
    }
  }, [showSignatureModal, signatureTab]);

  const startDrawing = (e) => {
    if (!canvasRef.current || !contextRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current || !contextRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (contextRef.current) {
      contextRef.current.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureImage('');
    }
  };

  const saveDrawnSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((channel, index) => index % 4 === 3 && channel > 0);
    
    if (!hasContent) {
      alert('⚠️ Por favor dibuja tu firma antes de guardar');
      return;
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureImage(dataUrl);
    alert('✅ Firma dibujada guardada');
  };

  const handleSign = async () => {
    if (!signatureImage) {
      alert('Por favor selecciona o dibuja tu firma');
      return;
    }

    try {
      const signatureData = {
        signatureImage,
        signedBy: currentUser.email,
        signedDate: new Date().toISOString(),
        comments,
      };

      if (isMassive) {
        await signatureService.signMultipleForms(selectedForms, signatureData);
        alert(`✅ ${selectedForms.length} formularios firmados exitosamente`);
        setSelectedForms([]);
      } else {
        await signatureService.signForm(selectedForms[0], signatureData);
        alert('✅ Formulario firmado exitosamente');
      }

      setShowSignatureModal(false);
      setSignatureImage('');
      setComments('');
      loadData();
    } catch (error) {
      console.error('Error al firmar:', error);
      alert('❌ Error al firmar los formularios: ' + error.message);
    }
  };

  // Abrir modal de rechazo
  const openRejectModal = (formId) => {
    if (!isSGI) {
      alert('Solo SGI puede rechazar formularios');
      return;
    }
    setRejectFormId(formId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Confirmar rechazo desde el modal
  const handleRejectConfirm = async () => {
    if (!rejectFormId) return;

    try {
      await signatureService.rejectForm(rejectFormId, {
        rejectedBy: currentUser.email,
        reason: rejectReason || '', // Campo OPCIONAL
      });
      
      alert('✅ Formulario rechazado exitosamente');
      setShowRejectModal(false);
      setRejectFormId(null);
      setRejectReason('');
      loadData();
    } catch (error) {
      console.error('Error al rechazar:', error);
      alert('❌ Error al rechazar el formulario: ' + error.message);
    }
  };

  // Cargar reporte de tiempos
  const loadTimingReport = async (daysParam) => {
    try {
      setTimingLoading(true);
      const report = await signatureService.getTimingReport(daysParam || timingDays);
      setTimingReport(report);
    } catch (error) {
      console.error('Error al cargar reporte de tiempos:', error);
      setTimingReport(null);
    } finally {
      setTimingLoading(false);
    }
  };

  // ✅ Función para verificar si el usuario está asignado para firmar este formulario
  const isUserAssignedToSign = (form) => {
    // Si no hay usuario logueado o no hay firmas, no mostrar
    if (!currentUser?.email || !form.firmasData) {
      return false;
    }

    const userEmail = currentUser.email.toLowerCase();

    // Revisar cada puesto en FirmasData
    for (const [puesto, firmaInfo] of Object.entries(form.firmasData)) {
      if (!firmaInfo || typeof firmaInfo !== 'object') continue;

      // Verificar si este puesto tiene el email del usuario
      const emailAsignado = firmaInfo.email?.toLowerCase();
      const nombreAsignado = firmaInfo.nombre?.toLowerCase();

      // Si el email coincide
      if (emailAsignado === userEmail) {
        // Verificar si YA firmó (tiene imagen de firma)
        const yaFirmo = firmaInfo.firma?.url || firmaInfo.firma?.base64;
        
        // Solo mostrar si AÚN NO ha firmado
        if (!yaFirmo) {
          return true;
        }
      }
      
      // Fallback: si nombre contiene @ y coincide con email
      if (nombreAsignado && nombreAsignado.includes('@') && nombreAsignado === userEmail) {
        const yaFirmo = firmaInfo.firma?.url || firmaInfo.firma?.base64;
        if (!yaFirmo) {
          return true;
        }
      }
    }

    return false;
  };

  // Filtrado de formularios
  const filteredForms = pendingForms.filter(form => {
    const matchesSearch = form.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.formCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = !filterArea || form.area === filterArea;
    const matchesTemplate = !filterTemplate || form.templateId === filterTemplate;
    
    // ✅ NUEVO FILTRO: Solo mostrar formularios donde el usuario está asignado para firmar
    const isAssignedToUser = isUserAssignedToSign(form);
    
    return matchesSearch && matchesArea && matchesTemplate && isAssignedToUser;
  });

  // Obtener áreas y plantillas únicas para filtros
  const uniqueAreas = [...new Set(pendingForms.map(f => f.area).filter(Boolean))];
  const uniqueTemplates = [...new Set(pendingForms.map(f => ({ id: f.templateId, name: f.templateName })))];

  if (loading) {
    return (
      <div className="signature-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando formularios pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signature-management">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>✍️ Gestión de Firmas</h1>
          <p className="subtitle">Revisa y firma los registros completados</p>
        </div>
        <div className="header-actions">
          <Link to="/" className="btn-secondary">
            ← Volver al Inicio
          </Link>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card pending">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <h3>{stats.pendingCount || 0}</h3>
              <p>Pendientes de Firma</p>
            </div>
          </div>
          <div className="stat-card signed">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.signedToday || 0}</h3>
              <p>Firmados Hoy</p>
            </div>
          </div>
          <div className="stat-card total">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.totalSigned || 0}</h3>
              <p>Total Firmados</p>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <h3>{stats.rejectedCount || 0}</h3>
              <p>Rechazados</p>
            </div>
          </div>
        </div>
      )}

      {/* Pestañas Principales - visible para todos los usuarios autenticados */}
      {currentUser && (
        <div className="main-tabs" style={{
          display: 'flex',
          gap: 0,
          marginBottom: '1.5rem',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #e5e7eb'
        }}>
          <button
            onClick={() => setMainTab('pending')}
            style={{
              flex: 1,
              padding: '12px 20px',
              border: 'none',
              background: mainTab === 'pending' ? 'linear-gradient(135deg, #1e40af, #3b82f6)' : '#f8fafc',
              color: mainTab === 'pending' ? '#fff' : '#64748b',
              fontWeight: mainTab === 'pending' ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📝 Firmas Pendientes
          </button>
          <button
            onClick={() => { setMainTab('timing'); loadTimingReport(); }}
            style={{
              flex: 1,
              padding: '12px 20px',
              border: 'none',
              borderLeft: '1px solid #e5e7eb',
              background: mainTab === 'timing' ? 'linear-gradient(135deg, #1e40af, #3b82f6)' : '#f8fafc',
              color: mainTab === 'timing' ? '#fff' : '#64748b',
              fontWeight: mainTab === 'timing' ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ⏱️ Tiempos y Rechazos
          </button>
        </div>
      )}

      {/* === PESTAÑA: FIRMAS PENDIENTES === */}
      {mainTab === 'pending' && (
        <>
      {/* Controles y Filtros */}
      <div className="controls-section">
        <div className="filters">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="filter-select"
          >
            <option value="">Todas las Áreas</option>
            {uniqueAreas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          <select
            value={filterTemplate}
            onChange={(e) => setFilterTemplate(e.target.value)}
            className="filter-select"
          >
            <option value="">Todas las Plantillas</option>
            {uniqueTemplates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>

        <div className="actions">
          <button
            onClick={handleSelectAll}
            className="btn-secondary"
            disabled={filteredForms.length === 0}
          >
            {selectedForms.length === filteredForms.length ? '☑️ Deseleccionar Todo' : '☐ Seleccionar Todo'}
          </button>
          
          <button
            onClick={() => openSignatureModal(true)}
            className="btn-primary"
            disabled={selectedForms.length === 0}
          >
            ✍️ Firmar Seleccionados ({selectedForms.length})
          </button>
        </div>
      </div>

      {/* Lista de Formularios Pendientes */}
      <div className="forms-container">
        {filteredForms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No hay formularios pendientes</h3>
            <p>Todos los formularios han sido firmados o no hay registros para mostrar</p>
          </div>
        ) : (
          <div className="forms-grid">
            {filteredForms.map(form => (
              <div
                key={form.id}
                className={`form-card ${selectedForms.includes(form.id) ? 'selected' : ''}`}
              >
                <div className="form-card-header">
                  <input
                    type="checkbox"
                    checked={selectedForms.includes(form.id)}
                    onChange={() => handleSelectForm(form.id)}
                    className="form-checkbox"
                  />
                  <div className="form-info">
                    <h3>{form.templateName}</h3>
                    <span className="form-code">{form.formCode}</span>
                  </div>
                </div>

                <div className="form-card-body">
                  <div className="form-detail">
                    <span className="detail-label">📅 Fecha:</span>
                    <span className="detail-value">
                      {new Date(form.createdDate).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                  
                  <div className="form-detail">
                    <span className="detail-label">👤 Creado por:</span>
                    <span className="detail-value">
                      {form.createdBy}
                      {form.createdByEmail && (
                        <span className="created-by-email" style={{ 
                          display: 'block', 
                          fontSize: '0.85em', 
                          color: '#666',
                          marginTop: '2px'
                        }}>
                          📧 {form.createdByEmail}
                        </span>
                      )}
                    </span>
                  </div>

                  {form.area && (
                    <div className="form-detail">
                      <span className="detail-label">🏢 Área:</span>
                      <span className="detail-value">{form.area}</span>
                    </div>
                  )}

                  <div className="form-detail">
                    <span className="detail-label">⏰ Pendiente:</span>
                    <span className="detail-value pending-time">
                      {calculatePendingTime(form.createdDate)}
                    </span>
                  </div>
                </div>

                <div className="form-card-actions">
                  <button
                    onClick={() => {
                      setSelectedForms([form.id]);
                      openSignatureModal(false);
                    }}
                    className="btn-sign"
                  >
                    ✍️ Firmar
                  </button>
                  
                  <Link
                    to={`/view-form/${form.id}`}
                    className="btn-view"
                  >
                    👁️ Ver
                  </Link>

                  {isSGI && (
                    <button
                      onClick={() => openRejectModal(form.id)}
                      className="btn-reject"
                    >
                      ❌ Rechazar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* === PESTAÑA: TIEMPOS Y RECHAZOS === */}
      {mainTab === 'timing' && (
        <div className="timing-dashboard">
          {/* Controles del reporte */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>Período:</label>
            <select
              value={timingDays}
              onChange={(e) => { setTimingDays(Number(e.target.value)); loadTimingReport(Number(e.target.value)); }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                background: 'white'
              }}
            >
              <option value={7}>Últimos 7 días</option>
              <option value={15}>Últimos 15 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={60}>Últimos 60 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>

            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem', marginLeft: '12px' }}>Filtrar:</label>
            <select
              value={timingFilter}
              onChange={(e) => setTimingFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.9rem',
                background: 'white'
              }}
            >
              <option value="all">Todos</option>
              <option value="signed">Firmados</option>
              <option value="pending">Pendientes</option>
              <option value="rejected">Rechazados</option>
            </select>

            <button
              onClick={() => loadTimingReport()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔄 Actualizar
            </button>
          </div>

          {timingLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="loading-spinner"></div>
              <p>Cargando reporte de tiempos...</p>
            </div>
          ) : timingReport ? (
            <>
              {/* Resumen de tiempos */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #3b82f6',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e40af' }}>
                    {timingReport.averageHoursToSign < 24
                      ? `${Math.round(timingReport.averageHoursToSign)}h`
                      : `${Math.round(timingReport.averageHoursToSign / 24)}d`}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Promedio para firmar</div>
                </div>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #10b981',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>
                    {timingReport.fastestHours < 1
                      ? `${Math.round(timingReport.fastestHours * 60)}min`
                      : timingReport.fastestHours < 24
                        ? `${Math.round(timingReport.fastestHours)}h`
                        : `${Math.round(timingReport.fastestHours / 24)}d`}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Más rápido</div>
                </div>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #f59e0b',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>
                    {timingReport.slowestHours < 24
                      ? `${Math.round(timingReport.slowestHours)}h`
                      : `${Math.round(timingReport.slowestHours / 24)}d`}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Más lento</div>
                </div>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #ef4444',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>
                    {timingReport.totalRejected}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Rechazados</div>
                </div>
              </div>

              {/* Barras de distribución */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1rem' }}>📊 Distribución de tiempos de firma</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#374151' }}>✅ Menos de 24h</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{timingReport.signedWithin24h}</span>
                    </div>
                    <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${timingReport.totalSigned > 0 ? (timingReport.signedWithin24h / timingReport.totalSigned) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                        borderRadius: '5px',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#374151' }}>⚠️ 24h - 72h</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{timingReport.signedAfter24h}</span>
                    </div>
                    <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${timingReport.totalSigned > 0 ? (timingReport.signedAfter24h / timingReport.totalSigned) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                        borderRadius: '5px',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#374151' }}>🔴 Más de 72h</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{timingReport.signedAfter72h}</span>
                    </div>
                    <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${timingReport.totalSigned > 0 ? (timingReport.signedAfter72h / timingReport.totalSigned) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                        borderRadius: '5px',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla detallada */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1rem' }}>📋 Detalle de formularios</h3>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {(timingReport.details || []).filter(d => timingFilter === 'all' || d.status === timingFilter).length} registros
                  </span>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Formulario</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Área</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Creado</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Estado</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Tiempo</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>Firmado por / Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(timingReport.details || [])
                        .filter(d => timingFilter === 'all' || d.status === timingFilter)
                        .map((item, idx) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: item.status === 'rejected' ? '#fef2f2' : item.status === 'signed' ? '#f0fdf4' : '#fffbeb'
                          }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#1f2937' }}>{item.templateName}</div>
                              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.formCode} · #{item.filledFormId}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#4b5563' }}>{item.area}</td>
                            <td style={{ padding: '10px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                              {new Date(item.createdDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: item.status === 'signed' ? '#dcfce7' : item.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                color: item.status === 'signed' ? '#166534' : item.status === 'rejected' ? '#991b1b' : '#92400e'
                              }}>
                                {item.status === 'signed' ? '✅ Firmado' : item.status === 'rejected' ? '❌ Rechazado' : '⏳ Pendiente'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: item.hoursToSign != null ? (item.hoursToSign < 24 ? '#059669' : item.hoursToSign < 72 ? '#d97706' : '#dc2626') : '#6b7280' }}>
                              {item.timingLabel || (item.status === 'pending' ? calculatePendingTime(item.createdDate) : '—')}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {item.status === 'signed' && (
                                <div>
                                  <div style={{ color: '#374151' }}>{item.signedBy}</div>
                                  {item.signedDate && (
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                      {new Date(item.signedDate).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                </div>
                              )}
                              {item.status === 'rejected' && (
                                <div>
                                  <div style={{ color: '#991b1b', fontWeight: 500 }}>
                                    {item.rejectionReason || 'Sin motivo especificado'}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                    Por: {item.rejectedBy}
                                    {item.rejectedDate && ` · ${new Date(item.rejectedDate).toLocaleDateString('es-ES')}`}
                                  </div>
                                </div>
                              )}
                              {item.status === 'pending' && (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Esperando firma...</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {(timingReport.details || []).filter(d => timingFilter === 'all' || d.status === timingFilter).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      No hay datos para el filtro seleccionado
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <p>No se pudo cargar el reporte. Haz clic en "Actualizar" para intentar nuevamente.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Firma */}
      {showSignatureModal && (
        <div className="modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="modal-content signature-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✍️ {isMassive ? `Firmar ${selectedForms.length} Formularios` : 'Firmar Formulario'}</h2>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="signature-section">
                <label className="form-label">Firma Digital:</label>

                {/* Tabs: Subir / Dibujar */}
                <div className="signature-tabs" style={{ display: 'flex', gap: '0', marginBottom: '12px' }}>
                  <button
                    onClick={() => setSignatureTab('upload')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '8px 0 0 8px',
                      background: signatureTab === 'upload' ? '#3b82f6' : '#f5f5f5',
                      color: signatureTab === 'upload' ? '#fff' : '#333',
                      fontWeight: signatureTab === 'upload' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    📁 Subir Imagen
                  </button>
                  <button
                    onClick={() => setSignatureTab('draw')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '0 8px 8px 0',
                      background: signatureTab === 'draw' ? '#3b82f6' : '#f5f5f5',
                      color: signatureTab === 'draw' ? '#fff' : '#333',
                      fontWeight: signatureTab === 'draw' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✏️ Dibujar Firma
                  </button>
                </div>

                {/* Tab: Subir imagen */}
                {signatureTab === 'upload' && (
                  <div className="signature-input-container">
                    
                    {/* NUEVO: Botón para usar firma guardada */}
                    <button
                      onClick={() => {
                        const currentUser = JSON.parse(localStorage.getItem('fishcort_user') || '{}');
                        if (!currentUser.username && !currentUser.email) {
                          alert('⚠️ No hay usuario logueado');
                          return;
                        }
                        
                        const signatureKey = `signature_${(currentUser.username || currentUser.email || '').toLowerCase()}`;
                        const savedSignature = localStorage.getItem(signatureKey);
                        
                        if (!savedSignature) {
                          alert('⚠️ No tienes una firma guardada. Ve a "Mi Firma" para guardar una.');
                          return;
                        }
                        
                        console.log('✅ Cargando firma guardada para:', currentUser.nombre || currentUser.username);
                        setSignatureImage(savedSignature);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '10px',
                        backgroundColor: '#1cc88a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(28, 200, 138, 0.3)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#17a673';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 8px rgba(28, 200, 138, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = '#1cc88a';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(28, 200, 138, 0.3)';
                      }}
                    >
                      📥 Usar Mi Firma Guardada
                    </button>

                    <div style={{ textAlign: 'center', margin: '10px 0', color: '#6c757d', fontSize: '12px' }}>
                      - O -
                    </div>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSignatureImage(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="signature-file-input"
                    />
                    <p className="help-text" style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                      Sube una imagen de tu firma (PNG, JPG)
                    </p>
                  </div>
                )}

                {/* Tab: Dibujar firma en canvas */}
                {signatureTab === 'draw' && (
                  <div className="signature-draw-container">
                    <div style={{
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      background: '#fafafa',
                      position: 'relative',
                      marginBottom: '10px'
                    }}>
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                        onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                        onTouchEnd={stopDrawing}
                        style={{
                          width: '100%',
                          height: '180px',
                          cursor: 'crosshair',
                          touchAction: 'none',
                          display: 'block'
                        }}
                      />
                      {!isDrawing && !signatureImage && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#bbb',
                          fontSize: '14px',
                          pointerEvents: 'none',
                          textAlign: 'center'
                        }}>
                          ✏️ Dibuja tu firma aquí
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={clearCanvas}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        🧹 Limpiar
                      </button>
                      <button
                        onClick={saveDrawnSignature}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '6px',
                          background: '#4caf50',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 'bold'
                        }}
                      >
                        � Guardar Firma Dibujada
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview de firma (cualquier método) */}
                {signatureImage && (
                  <div className="signature-preview" style={{ marginTop: '12px', textAlign: 'center' }}>
                    <p style={{ color: '#4caf50', fontWeight: 'bold', marginBottom: '8px' }}>✅ Firma lista:</p>
                    <img
                      src={signatureImage}
                      alt="Firma"
                      style={{ maxWidth: '250px', maxHeight: '120px', border: '1px solid #ddd', borderRadius: '8px', padding: '8px', background: '#fff' }}
                    />
                    <br />
                    <button
                      onClick={() => setSignatureImage('')}
                      style={{ marginTop: '8px', padding: '6px 12px', border: '1px solid #ef5350', borderRadius: '6px', background: '#fff', color: '#ef5350', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🗑️ Eliminar firma
                    </button>
                  </div>
                )}
              </div>

              <div className="comments-section">
                <label className="form-label">Comentarios (opcional):</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Agrega comentarios sobre la revisión..."
                  className="comments-textarea"
                  rows="4"
                />
              </div>

              <div className="signature-info">
                <p><strong>Firmado por:</strong> {currentUser.email}</p>
                <p><strong>Fecha y hora:</strong> {new Date().toLocaleString('es-ES')}</p>
                {isSGI && (
                  <p className="sgi-note">
                    ⚠️ Como SGI, podrás modificar la fecha después de firmar
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowSignatureModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSign}
                className="btn-primary"
                disabled={!signatureImage}
              >
                ✍️ Confirmar Firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rechazo con Motivo Opcional */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            maxWidth: '500px',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              padding: '1.2rem 1.5rem'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>❌ Rechazar Formulario</h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="modal-close"
                style={{ color: 'white', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#374151', marginBottom: '1rem', fontSize: '0.95rem' }}>
                Estás por rechazar el formulario <strong>#{rejectFormId}</strong>.
              </p>
              
              <label style={{
                display: 'block',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px',
                fontSize: '0.9rem'
              }}>
                Motivo del rechazo <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: Datos incorrectos, falta información, requiere corrección..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>
                Puedes dejar este campo vacío si no deseas especificar un motivo.
              </p>

              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '1.5rem'
              }}>
                <button
                  onClick={() => setShowRejectModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRejectConfirm}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  ❌ Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Función auxiliar para calcular tiempo pendiente
function calculatePendingTime(createdDate) {
  const now = new Date();
  const created = new Date(createdDate);
  const diffMs = now - created;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
  }
}
