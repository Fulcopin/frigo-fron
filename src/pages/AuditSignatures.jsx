import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../apiConfig';
import authService from '../services/authService';
import { Link } from 'react-router-dom';
import './AuditSignatures.css';

export default function AuditSignatures() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Estados para agrupamiento y paginación
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupPages, setGroupPages] = useState({});
  const itemsPerPage = 5; // 5 formularios por página dentro de cada grupo para no saturar

  // Campos del modal de edición
  const [newDate, setNewDate] = useState('');
  const [newHour, setNewHour] = useState('');
  const [auditReason, setAuditReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Estados para reasignación, edición de fecha y limpieza masiva de firmas
  const [showMassiveModal, setShowMassiveModal] = useState(false);
  const [massiveTab, setMassiveTab] = useState('date'); // 'date', 'move', 'clear'
  const [massiveSigner, setMassiveSigner] = useState('');
  const [massiveFromPuesto, setMassiveFromPuesto] = useState('');
  const [massiveToPuesto, setMassiveToPuesto] = useState('Jefe Control de Calidad');
  const [massiveDate, setMassiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [massiveHour, setMassiveHour] = useState('');
  const [massiveReason, setMassiveReason] = useState('');
  const [massiveProcessing, setMassiveProcessing] = useState(false);

  // Estados para reasignación visual por selección directa en tarjeta
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveSourceSlot, setMoveSourceSlot] = useState(null);
  const [moveToPuesto, setMoveToPuesto] = useState('');
  const [moveMassiveApply, setMoveMassiveApply] = useState(false);

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadAuditForms();
  }, []);

  const getArray = (arr) => Array.isArray(arr) ? arr : (arr?.$values || []);

  const loadAuditForms = async (searchQuery = '') => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE_URL}/Signatures/audit-forms`);
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      url.searchParams.append('limit', '5000'); // Cargar hasta 5000 registros para agrupar todas las plantillas

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        const list = getArray(data);
        setForms(list);

        // Expandir por defecto el primer grupo cargado
        const groups = {};
        list.forEach(f => {
          const key = f.formCode && f.formCode !== 'N/A' 
            ? `[${f.formCode}] ${f.templateName}` 
            : f.templateName || 'Sin Plantilla';
          if (!groups[key]) groups[key] = true;
        });
        const firstKey = Object.keys(groups)[0];
        if (firstKey) {
          setExpandedGroups({ [firstKey]: true });
        }
      } else {
        console.error('Error al cargar formularios para auditoría');
      }
    } catch (error) {
      console.error('Error de red al obtener formularios de auditoría:', error);
    } finally {
      setLoading(false);
    }
  };

  // Clasificar y agrupar formularios por plantilla
  const groupedForms = useMemo(() => {
    const groups = {};
    forms.forEach(form => {
      const key = form.formCode && form.formCode !== 'N/A' 
        ? `[${form.formCode}] ${form.templateName}` 
        : form.templateName || 'Sin Plantilla';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(form);
    });
    return groups;
  }, [forms]);

  const { distinctSigners, distinctPuestos } = useMemo(() => {
    const signersSet = new Set();
    const puestosSet = new Set();
    forms.forEach(form => {
      const sigs = getArray(form.signatures);
      sigs.forEach(s => {
        if (s.puesto) puestosSet.add(s.puesto);
        if (s.isSigned && (s.nombre || s.email)) {
          if (s.nombre && s.nombre !== '-' && s.nombre !== 'Sin asignar') signersSet.add(s.nombre);
          else if (s.email) signersSet.add(s.email);
        }
      });
    });
    return {
      distinctSigners: Array.from(signersSet).sort(),
      distinctPuestos: Array.from(puestosSet).sort()
    };
  }, [forms]);

  const openMoveModal = (form, slot) => {
    setMoveSourceSlot({ form, slot });
    const sigs = getArray(form.signatures);
    const otherPuestos = sigs.filter(s => s.puesto !== slot.puesto).map(s => s.puesto);
    setMoveToPuesto(otherPuestos.length > 0 ? otherPuestos[0] : '');
    setMoveMassiveApply(false);
    setShowMoveModal(true);
  };

  const handleSaveMoveSlot = async (e) => {
    e.preventDefault();
    if (!moveSourceSlot || !moveToPuesto) {
      alert('Por favor selecciona el puesto destino.');
      return;
    }
    const { form, slot } = moveSourceSlot;
    const signer = slot.nombre || slot.email;

    const msg = moveMassiveApply
      ? `¿Estás seguro de trasladar TODAS las firmas de "${signer}" en el puesto "${slot.puesto}" hacia el puesto "${moveToPuesto}" en los formularios de la plantilla "${form.templateName}"?`
      : `¿Estás seguro de mover la firma de "${signer}" del puesto "${slot.puesto}" al puesto "${moveToPuesto}" para este formulario #${form.formId}?`;

    if (!confirm(msg)) return;

    try {
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/Signatures/audit-move-signatures-massive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPuesto: slot.puesto,
          toPuesto: moveToPuesto,
          signerNameOrEmail: signer,
          formId: moveMassiveApply ? null : form.formId,
          templateId: moveMassiveApply ? form.templateId : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setShowMoveModal(false);
        loadAuditForms(searchTerm);
      } else {
        alert(`❌ Error: ${data.message || 'No se pudo mover la firma.'}`);
      }
    } catch (err) {
      alert('❌ Error de conexión al mover la firma.');
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const handlePageChange = (groupKey, newPage) => {
    setGroupPages(prev => ({
      ...prev,
      [groupKey]: newPage
    }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAuditForms(searchTerm);
  };

  const openEditModal = (form, slot) => {
    setSelectedSlot({ form, slot });
    setNewDate(slot.fecha || new Date().toISOString().split('T')[0]);
    setNewHour(slot.hora || '');
    setAuditReason('');
    setShowModal(true);
  };

  const handleSaveAuditDate = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (!newDate) {
      alert('Por favor selecciona una nueva fecha de firma');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/Signatures/audit-update-date/${selectedSlot.form.formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          puesto: selectedSlot.slot.puesto,
          newDate: newDate,
          newHour: newHour,
          reason: auditReason,
          updatedBy: currentUser?.email || currentUser?.nombre || 'Auditor SGI'
        })
      });

      if (response.ok) {
        alert('✅ Fecha de firma actualizada correctamente para auditoría y trazabilidad.');
        setShowModal(false);
        loadAuditForms(searchTerm);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`❌ Error al actualizar fecha: ${errData.message || 'No se pudo procesar la solicitud.'}`);
      }
    } catch (error) {
      console.error('Error al guardar fecha por auditoría:', error);
      alert('❌ Error de conexión con el servidor al intentar actualizar la fecha.');
    } finally {
      setSaving(false);
    }
  };

  const handleMassiveMove = async () => {
    if (!massiveToPuesto) {
      alert('Por favor indica el puesto destino al cual se deben trasladar las firmas.');
      return;
    }
    if (!confirm(`¿Estás seguro de trasladar todas las firmas erróneas de "${massiveSigner}" del puesto "${massiveFromPuesto || 'Cualquier puesto'}" hacia el puesto "${massiveToPuesto}"?`)) {
      return;
    }
    try {
      setMassiveProcessing(true);
      const res = await fetch(`${API_BASE_URL}/Signatures/audit-move-signatures-massive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPuesto: massiveFromPuesto,
          toPuesto: massiveToPuesto,
          signerNameOrEmail: massiveSigner
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setShowMassiveModal(false);
        loadAuditForms(searchTerm);
      } else {
        alert(`❌ Error: ${data.message || 'No se pudo completar el traslado.'}`);
      }
    } catch (e) {
      alert('❌ Error de red al intentar trasladar firmas.');
    } finally {
      setMassiveProcessing(false);
    }
  };

  const handleMassiveClear = async () => {
    if (!confirm(`¿Estás seguro de LIMPIAR / ELIMINAR todas las firmas erróneas de "${massiveSigner}" en el puesto "${massiveFromPuesto || 'Todos los puestos'}" para permitir firmar de nuevo?`)) {
      return;
    }
    try {
      setMassiveProcessing(true);
      const res = await fetch(`${API_BASE_URL}/Signatures/audit-clear-signatures-massive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puesto: massiveFromPuesto,
          signerNameOrEmail: massiveSigner
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setShowMassiveModal(false);
        loadAuditForms(searchTerm);
      } else {
        alert(`❌ Error: ${data.message || 'No se pudo completar la limpieza.'}`);
      }
    } catch (e) {
      alert('❌ Error de red al intentar limpiar firmas.');
    } finally {
      setMassiveProcessing(false);
    }
  };

  const handleMassiveUpdateDate = async () => {
    if (!massiveDate) {
      alert('Por favor selecciona la nueva fecha para la edición masiva');
      return;
    }
    if (!confirm(`¿Estás seguro de actualizar masivamente la fecha de firma a "${massiveDate}"${massiveHour ? ' ' + massiveHour : ''} para ${massiveSigner ? 'las firmas de "' + massiveSigner + '"' : 'todas las firmas'}${massiveFromPuesto ? ' en el puesto "' + massiveFromPuesto + '"' : ''}?`)) {
      return;
    }
    try {
      setMassiveProcessing(true);
      const res = await fetch(`${API_BASE_URL}/Signatures/audit-update-date-massive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerNameOrEmail: massiveSigner,
          puesto: massiveFromPuesto,
          templateCodeOrName: searchTerm,
          newDate: massiveDate,
          newHour: massiveHour,
          reason: massiveReason,
          updatedBy: currentUser?.email || currentUser?.nombre || 'Auditor SGI'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`✅ ${data.message || 'Edición masiva de fechas completada exitosamente.'}`);
        setShowMassiveModal(false);
        loadAuditForms(searchTerm);
      } else {
        alert(`❌ Error: ${data.message || 'No se pudo actualizar masivamente las fechas.'}`);
      }
    } catch (error) {
      console.error('Error en edición masiva de fechas:', error);
      alert('❌ Error de red al intentar la edición masiva de fechas.');
    } finally {
      setMassiveProcessing(false);
    }
  };

  const handleClearSingleSlot = async (form, slot) => {
    if (!confirm(`¿Estás seguro de limpiar / eliminar la firma de "${slot.puesto}" en el formulario #${form.formId}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/Signatures/audit-clear-signatures-massive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.formId,
          puesto: slot.puesto
        })
      });
      if (res.ok) {
        alert('✅ Firma limpiada correctamente.');
        loadAuditForms(searchTerm);
      } else {
        alert('❌ Error al limpiar firma.');
      }
    } catch (e) {
      alert('❌ Error de red al limpiar firma.');
    }
  };

  return (
    <div className="audit-signatures-container">
      {/* Header */}
      <div className="audit-header">
        <div>
          <h1>📑 Auditoría y Control de Tiempos de Firma</h1>
          <p>Supervisa, audita y corrige las fechas y horas de firma por formulario ante revisiones de calidad (SGI)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => { setMassiveTab('date'); setShowMassiveModal(true); }}
            style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            🛠️ Edición Masiva (Fecha / Reasignar / Limpiar)
          </button>
          <Link to="/signatures" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
            ← Volver a Firmas
          </Link>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <form onSubmit={handleSearchSubmit} className="audit-search-bar">
        <input
          type="text"
          placeholder="🔍 Buscar por código de formulario (ej. FOR-CC-18), nombre de plantilla o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="audit-search-input"
        />
        <button type="submit" className="audit-btn audit-btn-primary">
          🔍 Buscar
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={() => { setSearchTerm(''); loadAuditForms(''); }}
            className="audit-btn"
            style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Lista de Grupos Clasificados */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px auto', width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ fontSize: '16px', fontWeight: '600' }}>Clasificando y cargando formularios para auditoría...</p>
        </div>
      ) : Object.keys(groupedForms).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '48px' }}>📂</span>
          <h3 style={{ margin: '16px 0 8px 0', color: '#1e293b' }}>No se encontraron formularios</h3>
          <p style={{ color: '#64748b', margin: 0 }}>Intenta buscar con otro código o palabra clave en el filtro superior.</p>
        </div>
      ) : (
        <div className="audit-groups-list">
          {Object.entries(groupedForms).map(([groupKey, groupForms]) => {
            const isExpanded = !!expandedGroups[groupKey];
            const currentPage = groupPages[groupKey] || 1;
            const totalPages = Math.ceil(groupForms.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedForms = groupForms.slice(startIndex, startIndex + itemsPerPage);

            return (
              <div key={groupKey} className="audit-group-container">
                {/* Cabecera del Grupo / Acordeón */}
                <div className="audit-group-header" onClick={() => toggleGroup(groupKey)}>
                  <div className="audit-group-title">
                    <span>📁 {groupKey}</span>
                    <span className="audit-group-badge">{groupForms.length} registro{groupForms.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="audit-group-toggle">
                    {isExpanded ? '▼ Desplegado' : '▶ Clic para Desplegar'}
                  </div>
                </div>

                {/* Contenido Desplegado con Paginación */}
                {isExpanded && (
                  <div className="audit-group-body">
                    <div className="audit-forms-grid">
                      {paginatedForms.map((form) => {
                        const sigList = getArray(form.signatures);
                        return (
                          <div key={form.formId} className="audit-form-card">
                            <div className="audit-form-header">
                              <div className="audit-form-title">
                                <span className="audit-form-id">#{form.formId}</span>
                                <span className="audit-form-name">{form.templateName}</span>
                              </div>
                              <div className="audit-form-meta">
                                <span><strong>Área:</strong> {form.area}</span>
                                <span><strong>Creado:</strong> {new Date(form.createdAt).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                <span><strong>Por:</strong> {form.filledBy}</span>
                              </div>
                            </div>

                            <div className="audit-slots-list">
                              {sigList.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontStyle: 'italic', gridColumn: '1 / -1', margin: 0 }}>
                                  Este formulario no tiene puestos de firma configurados.
                                </p>
                              ) : (
                                sigList.map((slot) => (
                                  <div
                                    key={slot.puesto}
                                    className={`audit-slot-card ${slot.isSigned ? 'signed' : 'pending'}`}
                                  >
                                    <div>
                                      <div className="audit-slot-header">
                                        <span className="audit-slot-puesto">✍️ {slot.puesto}</span>
                                        <span className={`audit-status-badge ${slot.isSigned ? 'badge-signed' : 'badge-pending'}`}>
                                          {slot.isSigned ? 'Firmado' : 'Pendiente'}
                                        </span>
                                      </div>

                                      <div className="audit-slot-details">
                                        <p style={{ margin: '0 0 4px 0' }}>
                                          <strong>Responsable:</strong> {slot.nombre || slot.email || <span style={{ color: '#94a3b8' }}>Sin asignar</span>}
                                        </p>
                                        <p style={{ margin: '0 0 4px 0' }}>
                                          <strong>Fecha Registrada:</strong>{' '}
                                          <span style={{ color: slot.fecha && slot.fecha !== '-' ? '#0f172a' : '#94a3b8', fontWeight: 'bold' }}>
                                            {slot.fecha && slot.fecha !== '-' ? new Date(slot.fecha + 'T00:00:00').toLocaleDateString('es-EC') : 'Sin fecha'}
                                          </span>
                                        </p>
                                        <p style={{ margin: '0 0 4px 0' }}>
                                          <strong>Hora Registrada:</strong>{' '}
                                          <span style={{ color: slot.hora && slot.hora !== '-' ? '#0f172a' : '#94a3b8' }}>
                                            {(slot.hora && slot.hora !== '-') ? slot.hora : '--:--'}
                                          </span>
                                        </p>
                                        {slot.isModifiedBySGI && (
                                          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#d97706', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                            ⚠️ Fecha ajustada por auditoría SGI
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="audit-slot-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(form, slot)}
                                        className="audit-edit-btn"
                                      >
                                        ✏️ Modificar Fecha / Hora (Auditoría)
                                      </button>
                                      {slot.isSigned && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openMoveModal(form, slot)}
                                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                          >
                                            🔀 Mover a otro puesto
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleClearSingleSlot(form, slot)}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                          >
                                            🧹 Limpiar Firma
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Paginación interna del grupo */}
                    {totalPages > 1 && (
                      <div className="audit-pagination">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => handlePageChange(groupKey, currentPage - 1)}
                          className="audit-page-btn"
                        >
                          ← Anterior
                        </button>
                        
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', padding: '0 8px' }}>
                          Página {currentPage} de {totalPages} ({groupForms.length} registros en total)
                        </span>

                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => handlePageChange(groupKey, currentPage + 1)}
                          className="audit-page-btn"
                        >
                          Siguiente →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Modificar Fecha */}
      {showModal && selectedSlot && (
        <div className="audit-modal-overlay">
          <div className="audit-modal">
            <div className="audit-modal-header">
              <h3>✏️ Ajustar Fecha de Firma (SGI Auditoría)</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAuditDate}>
              <div className="audit-modal-body">
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>Formulario:</strong> #{selectedSlot.form.formId} - {selectedSlot.form.templateName}</p>
                  <p style={{ margin: 0 }}><strong>Puesto:</strong> {selectedSlot.slot.puesto}</p>
                </div>

                <div className="audit-form-group">
                  <label htmlFor="auditNewDate">Nueva Fecha de Firma *</label>
                  <input
                    id="auditNewDate"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                  />
                </div>

                <div className="audit-form-group">
                  <label htmlFor="auditNewHour">Nueva Hora (opcional)</label>
                  <input
                    id="auditNewHour"
                    type="time"
                    value={newHour}
                    onChange={(e) => setNewHour(e.target.value)}
                  />
                </div>

                <div className="audit-form-group">
                  <label htmlFor="auditReason">Motivo de la corrección / Referencia de Auditoría *</label>
                  <textarea
                    id="auditReason"
                    rows="3"
                    placeholder="Ej. Ajuste de fecha de firma según acta de auditoría interna SGI o solicitud de calidad."
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>

              <div className="audit-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="audit-btn"
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="audit-btn audit-btn-primary"
                >
                  {saving ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Masivo de Edición de Fechas, Reasignación y Limpieza */}
      {showMassiveModal && (
        <div className="audit-modal-overlay">
          <div className="audit-modal" style={{ maxWidth: '600px' }}>
            <div className="audit-modal-header" style={{ background: '#f59e0b' }}>
              <h3>🛠️ Herramientas Masivas de Auditoría de Firmas</h3>
              <button
                type="button"
                onClick={() => setShowMassiveModal(false)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Pestañas del Modal */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setMassiveTab('date')}
                style={{ flex: 1, padding: '12px', border: 'none', background: massiveTab === 'date' ? 'white' : 'transparent', fontWeight: 'bold', color: massiveTab === 'date' ? '#2563eb' : '#64748b', borderBottom: massiveTab === 'date' ? '3px solid #2563eb' : 'none', cursor: 'pointer' }}
              >
                📅 Cambiar Fecha
              </button>
              <button
                type="button"
                onClick={() => setMassiveTab('move')}
                style={{ flex: 1, padding: '12px', border: 'none', background: massiveTab === 'move' ? 'white' : 'transparent', fontWeight: 'bold', color: massiveTab === 'move' ? '#10b981' : '#64748b', borderBottom: massiveTab === 'move' ? '3px solid #10b981' : 'none', cursor: 'pointer' }}
              >
                🚀 Reasignar Puesto
              </button>
              <button
                type="button"
                onClick={() => setMassiveTab('clear')}
                style={{ flex: 1, padding: '12px', border: 'none', background: massiveTab === 'clear' ? 'white' : 'transparent', fontWeight: 'bold', color: massiveTab === 'clear' ? '#ef4444' : '#64748b', borderBottom: massiveTab === 'clear' ? '3px solid #ef4444' : 'none', cursor: 'pointer' }}
              >
                🗑️ Limpiar Firmas
              </button>
            </div>

            <div className="audit-modal-body" style={{ padding: '20px' }}>
              {massiveTab === 'date' && (
                <div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                    Esta opción permite actualizar en masa la <strong>Fecha de Firma</strong> para todos los formularios (o filtrando por firmante / puesto / plantilla buscada en la barra).
                  </p>

                  <div className="audit-form-group">
                    <label>👤 Filtrar por Firmante (Opcional - Dejar vacío para aplicar a todos)</label>
                    <select
                      value={distinctSigners.includes(massiveSigner) ? massiveSigner : ''}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Todos los firmantes --</option>
                      {distinctSigners.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={massiveSigner}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      placeholder="O escribe manualmente el nombre o email..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                    />
                  </div>

                  <div className="audit-form-group" style={{ marginTop: '14px' }}>
                    <label>📌 Filtrar por Puesto (Opcional - Dejar vacío para aplicar a todos los puestos)</label>
                    <select
                      value={distinctPuestos.includes(massiveFromPuesto) ? massiveFromPuesto : ''}
                      onChange={(e) => setMassiveFromPuesto(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Todos los Puestos --</option>
                      {distinctPuestos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                    <div className="audit-form-group">
                      <label>📅 Nueva Fecha de Firma *</label>
                      <input
                        type="date"
                        value={massiveDate}
                        onChange={(e) => setMassiveDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                      />
                    </div>
                    <div className="audit-form-group">
                      <label>⏰ Nueva Hora (Opcional)</label>
                      <input
                        type="time"
                        value={massiveHour}
                        onChange={(e) => setMassiveHour(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div className="audit-form-group" style={{ marginTop: '14px' }}>
                    <label>📝 Motivo / Observación SGI (Opcional)</label>
                    <input
                      type="text"
                      value={massiveReason}
                      onChange={(e) => setMassiveReason(e.target.value)}
                      placeholder="Ej: Ajuste masivo por auditoría interna de calidad"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              )}

              {massiveTab === 'move' && (
                <div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                    Corrige automáticamente los registros donde una firma cayó en un puesto erróneo y la traslada como titular a su puesto correcto.
                  </p>

                  <div className="audit-form-group">
                    <label>👤 Selecciona o escribe el Firmante Erróneo *</label>
                    <select
                      value={distinctSigners.includes(massiveSigner) ? massiveSigner : ''}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Seleccionar de la lista de firmantes --</option>
                      {distinctSigners.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={massiveSigner}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      placeholder="O escribe manualmente el nombre o email..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                    />
                  </div>

                  <div className="audit-form-group" style={{ marginTop: '14px' }}>
                    <label>📤 Puesto Origen (donde quedó mal ubicada la firma)</label>
                    <select
                      value={distinctPuestos.includes(massiveFromPuesto) ? massiveFromPuesto : ''}
                      onChange={(e) => setMassiveFromPuesto(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Cualquier Puesto --</option>
                      {distinctPuestos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="audit-form-group" style={{ marginTop: '14px' }}>
                    <label>📥 Puesto Destino (hacia donde mover la firma)</label>
                    <select
                      value={distinctPuestos.includes(massiveToPuesto) ? massiveToPuesto : ''}
                      onChange={(e) => setMassiveToPuesto(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Seleccionar Puesto Destino --</option>
                      {distinctPuestos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {massiveTab === 'clear' && (
                <div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                    Elimina o limpia en masa las firmas de un firmante o puesto para permitir volver a firmar limpiamente desde cero.
                  </p>

                  <div className="audit-form-group">
                    <label>👤 Selecciona o escribe el Firmante a Limpiar *</label>
                    <select
                      value={distinctSigners.includes(massiveSigner) ? massiveSigner : ''}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Seleccionar de la lista de firmantes --</option>
                      {distinctSigners.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={massiveSigner}
                      onChange={(e) => setMassiveSigner(e.target.value)}
                      placeholder="O escribe manualmente el nombre o email..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                    />
                  </div>

                  <div className="audit-form-group" style={{ marginTop: '14px' }}>
                    <label>📌 Puesto Origen a Limpiar</label>
                    <select
                      value={distinctPuestos.includes(massiveFromPuesto) ? massiveFromPuesto : ''}
                      onChange={(e) => setMassiveFromPuesto(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Todos los puestos --</option>
                      {distinctPuestos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="audit-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setShowMassiveModal(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', background: '#e2e8f0', border: 'none', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>

              {massiveTab === 'date' && (
                <button
                  type="button"
                  disabled={massiveProcessing}
                  onClick={handleMassiveUpdateDate}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: '#2563eb', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {massiveProcessing ? 'Procesando...' : '📅 Actualizar Fechas en Masa'}
                </button>
              )}

              {massiveTab === 'move' && (
                <button
                  type="button"
                  disabled={massiveProcessing}
                  onClick={handleMassiveMove}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {massiveProcessing ? 'Procesando...' : '🚀 Trasladar al Destino'}
                </button>
              )}

              {massiveTab === 'clear' && (
                <button
                  type="button"
                  disabled={massiveProcessing}
                  onClick={handleMassiveClear}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {massiveProcessing ? 'Procesando...' : '🗑️ Limpiar en Masa'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Interactivo Individual / por Plantilla para Trasladar Firma seleccionando con clic */}
      {showMoveModal && moveSourceSlot && (
        <div className="audit-modal-overlay">
          <div className="audit-modal" style={{ maxWidth: '540px' }}>
            <div className="audit-modal-header" style={{ background: '#10b981' }}>
              <h3>🔀 Mover Firma de Puesto</h3>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMoveSlot}>
              <div className="audit-modal-body" style={{ padding: '20px' }}>
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Formulario:</strong> #{moveSourceSlot.form.formId} - {moveSourceSlot.form.templateName}</p>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Firmante actual:</strong> <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{moveSourceSlot.slot.nombre || moveSourceSlot.slot.email}</span></p>
                  <p style={{ margin: 0 }}><strong>Puesto actual (Origen):</strong> <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>{moveSourceSlot.slot.puesto}</span></p>
                </div>

                <div className="audit-form-group">
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    🎯 ¿A qué puesto del formulario deseas mover esta firma? *
                  </label>
                  <select
                    value={moveToPuesto}
                    onChange={(e) => setMoveToPuesto(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #10b981', fontSize: '14px', fontWeight: '600' }}
                  >
                    <option value="">-- Selecciona el puesto correcto --</option>
                    {getArray(moveSourceSlot.form.signatures)
                      .filter(s => s.puesto !== moveSourceSlot.slot.puesto)
                      .map(s => (
                        <option key={s.puesto} value={s.puesto}>
                          {s.puesto} {s.isSigned ? `(Ocupado por: ${s.nombre || s.email})` : '(Disponible)'}
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ marginTop: '20px', padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>
                    <input
                      type="checkbox"
                      checked={moveMassiveApply}
                      onChange={(e) => setMoveMassiveApply(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>
                      ☑️ Aplicar este cambio a TODOS los formularios de "{moveSourceSlot.form.templateName}" donde "{moveSourceSlot.slot.nombre || moveSourceSlot.slot.email}" esté en "{moveSourceSlot.slot.puesto}"
                    </span>
                  </label>
                </div>
              </div>

              <div className="audit-modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', background: '#e2e8f0', border: 'none', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 20px', borderRadius: '8px', background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {saving ? 'Moviendo...' : '🚀 Confirmar y Mover Firma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
