import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../apiConfig';
import './SignatureUploader.css';

/**
 * 📸 SignatureUploader - Componente para subir firmas PNG o dibujar firma
 * 
 * Soporta 3 modos de firma:
 * 1. Subir PNG + Cloudinary (CDN profesional)
 * 2. Subir PNG + Base64 (Fallback local)
 * 3. Dibujar firma en canvas (manual)
 * 
 * Props:
 * @param {string} puesto - Nombre del puesto (ej: "Jefe de Producción")
 * @param {object} firmaData - Datos actuales de la firma { nombre, fecha, firma }
 * @param {function} onFirmaChange - Callback cuando cambia la firma
 * @param {string} cloudinaryCloudName - (Opcional) Cloud name de Cloudinary
 * @param {string} cloudinaryUploadPreset - (Opcional) Upload preset de Cloudinary
 * @param {object} currentUser - (Opcional) Usuario actual de la sesión
 * @param {boolean} canSign - (Opcional) Si el usuario puede firmar este puesto
 */
const SignatureUploader = ({
  puesto,
  firmaData,
  onFirmaChange,
  cloudinaryCloudName,
  cloudinaryUploadPreset,
  currentUser,
  canSign = true
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [isDrawing, setIsDrawing] = useState(false);
  const [autoLoadedSignature, setAutoLoadedSignature] = useState(false);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawingRef = useRef(false);

  const useCloudinary = cloudinaryCloudName && cloudinaryUploadPreset;
  const firmaUrl = firmaData?.firma?.url || firmaData?.firma?.base64;
  const hasFirma = !!firmaUrl;

  // 🔐 VALIDACIÓN: ¿El usuario actual puede firmar?
  const selectedName = firmaData?.nombre || '';
  const currentUserName = currentUser?.nombre || currentUser?.username || '';
  const isCurrentUserSelected = selectedName && selectedName.toLowerCase() === currentUserName.toLowerCase();
  const canUploadSignature = !selectedName || canSign || isCurrentUserSelected;

  // Auto-carga de firma guardada cuando el nombre seleccionado coincide con el usuario actual
  useEffect(() => {
    if (hasFirma || autoLoadedSignature) return;
    if (!selectedName) return;
    if (!isCurrentUserSelected) return;
    
    const userId = currentUser?.username || currentUser?.email || currentUser?.nombre || '';
    if (!userId) return;

    const loadSavedSignature = async () => {
      // 1. Primero intentar localStorage (caché rápida)
      const signatureKey = `signature_${userId.toLowerCase()}`;
      const savedSignature = localStorage.getItem(signatureKey);

      if (savedSignature) {
        console.log(`✅ Auto-cargando firma desde caché local para: ${currentUser.nombre || currentUser.username} en puesto: ${puesto}`);
        
        onFirmaChange({
          ...firmaData,
          firma: {
            base64: savedSignature.startsWith('data:') ? savedSignature : undefined,
            url: savedSignature,
            provider: 'mysignature-auto',
            uploaded_at: new Date().toISOString()
          }
        });
        setAutoLoadedSignature(true);
        return;
      }

      // 2. Si no hay en localStorage, buscar en backend (CatalogoFirmas)
      try {
        const nombre = currentUser.nombre || currentUser.username || '';
        if (nombre) {
          const response = await fetch(`${API_BASE_URL}/CatalogoFirmas/by-nombre/${encodeURIComponent(nombre)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.firmaImageUrl) {
              console.log(`✅ Auto-cargando firma desde servidor para: ${nombre} en puesto: ${puesto}`);
              
              // Guardar en localStorage como caché
              localStorage.setItem(signatureKey, data.firmaImageUrl);
              localStorage.setItem(`${signatureKey}_date`, data.fechaCreacion || new Date().toISOString());

              onFirmaChange({
                ...firmaData,
                firma: {
                  url: data.firmaImageUrl,
                  provider: 'mysignature-auto',
                  uploaded_at: data.fechaCreacion || new Date().toISOString()
                }
              });
              setAutoLoadedSignature(true);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ No se pudo cargar firma desde backend en auto-carga:', err);
      }
    };

    loadSavedSignature();
  }, [selectedName, isCurrentUserSelected, hasFirma, autoLoadedSignature]);

  const uploadToCloudinary = async (file) => {
    console.log('📤 Subiendo a Cloudinary:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryUploadPreset);
    formData.append('folder', 'frigo-firmas');
    formData.append('public_id', `firma_${puesto.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al subir imagen');
      }

      const data = await response.json();
      
      console.log('✅ Imagen subida a Cloudinary:', data.secure_url);

      return {
        url: data.secure_url,
        thumbnail: data.secure_url.replace('/upload/', '/upload/w_300,h_150,c_fit/'),
        public_id: data.public_id,
        uploaded_at: new Date().toISOString(),
        provider: 'cloudinary'
      };
    } catch (err) {
      console.error('❌ Error en Cloudinary:', err);
      throw err;
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      console.log('📝 Convirtiendo a Base64:', file.name);
      
      const reader = new FileReader();
      
      reader.onloadend = () => {
        console.log('✅ Conversión a Base64 completada');
        resolve({
          base64: reader.result,
          url: reader.result,
          filename: file.name,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          provider: 'base64'
        });
      };
      
      reader.onerror = (error) => {
        console.error('❌ Error al convertir a Base64:', error);
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  };

  const handleLoadSavedSignature = async () => {
    try {
      setUploading(true);
      setError(null);

      // Obtener identificador del usuario
      const userId = currentUser?.username || currentUser?.email || currentUser?.nombre || '';
      
      if (!userId) {
        setError('⚠️ No hay usuario logueado');
        setUploading(false);
        return;
      }

      console.log('🔍 Buscando firma guardada para:', userId);

      const signatureKey = `signature_${userId.toLowerCase()}`;
      let savedSignature = localStorage.getItem(signatureKey);
      let savedDate = localStorage.getItem(`${signatureKey}_date`);

      // Si no hay en localStorage, buscar en el backend
      if (!savedSignature) {
        console.log('🔍 No hay firma en localStorage, buscando en servidor...');
        try {
          const nombre = currentUser?.nombre || currentUser?.username || '';
          if (nombre) {
            const response = await fetch(`${API_BASE_URL}/CatalogoFirmas/by-nombre/${encodeURIComponent(nombre)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.firmaImageUrl) {
                savedSignature = data.firmaImageUrl;
                savedDate = data.fechaCreacion;
                // Guardar en localStorage como caché
                localStorage.setItem(signatureKey, savedSignature);
                localStorage.setItem(`${signatureKey}_date`, savedDate || new Date().toISOString());
                console.log('✅ Firma cargada desde servidor');
              }
            } else {
              console.warn('⚠️ Servidor respondió:', response.status);
            }
          }
        } catch (err) {
          console.warn('⚠️ No se pudo buscar firma en servidor:', err.message);
        }
      }

      if (!savedSignature) {
        setError('⚠️ No tienes una firma guardada. Ve a "Mi Firma" para guardar una.');
        setUploading(false);
        return;
      }

      console.log(`✅ Cargando firma guardada para: ${userId} (tipo: ${savedSignature.startsWith('http') ? 'URL' : 'base64'})`);

      let firmaInfo;

      // Si es una URL (Cloudinary u otra), usarla directamente
      if (savedSignature.startsWith('http')) {
        firmaInfo = {
          url: savedSignature,
          provider: 'cloudinary',
          uploaded_at: savedDate || new Date().toISOString()
        };
        console.log('✅ Usando URL directamente:', savedSignature);
      } else if (savedSignature.startsWith('data:')) {
        // Es base64 válido, usarlo directamente sin re-upload
        firmaInfo = {
          base64: savedSignature,
          url: savedSignature,
          provider: 'base64',
          uploaded_at: savedDate || new Date().toISOString()
        };
        console.log('✅ Usando base64 directamente');
      } else {
        // Dato corrupto o formato desconocido
        console.warn('⚠️ Formato de firma no reconocido, eliminando caché corrupta');
        localStorage.removeItem(signatureKey);
        localStorage.removeItem(`${signatureKey}_date`);
        setError('⚠️ La firma guardada estaba corrupta. Ve a "Mi Firma" para guardar una nueva.');
        setUploading(false);
        return;
      }

      onFirmaChange({
        ...firmaData,
        firma: firmaInfo
      });

      setError(null);
      setUploading(false);
      console.log('🎉 Firma guardada aplicada exitosamente');

    } catch (err) {
      console.error('❌ Error al cargar firma guardada:', err);
      setError(`❌ Error al cargar firma: ${err.message || 'Error desconocido'}`);
      setUploading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 Archivo seleccionado:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);

    if (!file.type.includes('png')) {
      setError('❌ Solo se permiten archivos PNG');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`❌ El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Máximo: 5MB`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      let firmaInfo;

      if (useCloudinary) {
        try {
          firmaInfo = await uploadToCloudinary(file);
          console.log('✅ Cloudinary exitoso');
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary falló, usando Base64 como fallback:', cloudinaryError.message);
          firmaInfo = await convertToBase64(file);
        }
      } else {
        console.log('ℹ️ Usando Base64 (Cloudinary no configurado)');
        firmaInfo = await convertToBase64(file);
      }

      onFirmaChange({
        ...firmaData,
        firma: firmaInfo
      });

      console.log('🎉 Firma cargada exitosamente para:', puesto);
    } catch (err) {
      console.error('❌ Error al cargar firma:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleRemoveFirma = () => {
    setShowDeleteConfirm(true);
  };

  const confirmRemoveFirma = () => {
    const updatedFirma = { ...firmaData };
    delete updatedFirma.firma;
    onFirmaChange(updatedFirma);
    setShowDeleteConfirm(false);
    console.log('🗑️ Firma eliminada:', puesto);
  };

  const cancelRemoveFirma = () => {
    setShowDeleteConfirm(false);
  };

  const handleDownloadFirma = () => {
    if (!firmaUrl) return;

    const link = document.createElement('a');
    link.href = firmaUrl;
    link.download = `firma_${puesto.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('⬇️ Firma descargada:', puesto);
  };

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const displayWidth = rect.width || 300;
      const displayHeight = rect.height || 150;
      
      canvas.width = displayWidth * 2;
      canvas.height = displayHeight * 2;
      
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.lineCap = 'round';
      context.strokeStyle = '#000';
      context.lineWidth = 2;
      contextRef.current = context;
      
      console.log('🎨 Canvas inicializado para dibujar firma');

      const getTouchCoords = (e) => {
        const r = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
          return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
        }
        return { x: 0, y: 0 };
      };

      const handleTouchStart = (e) => {
        e.preventDefault();
        if (!contextRef.current) return;
        const { x, y } = getTouchCoords(e);
        contextRef.current.beginPath();
        contextRef.current.moveTo(x, y);
        isDrawingRef.current = true;
        setIsDrawing(true);
        console.log('👆 Touch start:', x, y);
      };

      const handleTouchMove = (e) => {
        e.preventDefault();
        if (!isDrawingRef.current || !contextRef.current) return;
        const { x, y } = getTouchCoords(e);
        contextRef.current.lineTo(x, y);
        contextRef.current.stroke();
      };

      const handleTouchEnd = (e) => {
        e.preventDefault();
        if (contextRef.current) {
          contextRef.current.closePath();
        }
        isDrawingRef.current = false;
        setIsDrawing(false);
        console.log('✋ Touch end');
      };

      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        contextRef.current = null;
        isDrawingRef.current = false;
        setIsDrawing(false);
      };
    }
    
    return () => {
      contextRef.current = null;
      isDrawingRef.current = false;
      setIsDrawing(false);
    };
  }, [activeTab]);

  const getEventCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    if (e.nativeEvent) {
      return {
        x: (e.nativeEvent.offsetX !== undefined) ? e.nativeEvent.offsetX : (e.clientX - rect.left),
        y: (e.nativeEvent.offsetY !== undefined) ? e.nativeEvent.offsetY : (e.clientY - rect.top)
      };
    }
    return {
      x: (e.clientX || 0) - rect.left,
      y: (e.clientY || 0) - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!contextRef.current) return;
    e.preventDefault();
    const { x, y } = getEventCoords(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    isDrawingRef.current = true;
    console.log('🖱️ Mouse start:', x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !contextRef.current) return;
    e.preventDefault();
    const { x, y } = getEventCoords(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = (e) => {
    if (e) e.preventDefault();
    if (contextRef.current) {
      contextRef.current.closePath();
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    console.log('🛑 Drawing stopped');
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    console.log('🧹 Canvas limpiado');
  };

  const saveDrawnSignature = async () => {
    if (!canvasRef.current) {
      setError('⚠️ Canvas no disponible');
      return;
    }
    const canvas = canvasRef.current;
    
    const context = canvas.getContext('2d');
    if (!context) {
      setError('⚠️ No se pudo obtener contexto del canvas');
      return;
    }
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let hasContent = false;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        hasContent = true;
        break;
      }
    }
    
    if (!hasContent) {
      setError('⚠️ Por favor dibuja tu firma antes de guardar');
      console.warn('⚠️ Canvas vacío - no hay contenido para guardar');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      console.log('📸 Canvas convertido a dataURL, tamaño:', dataUrl.length, 'bytes');
      
      let firmaInfo;

      if (useCloudinary) {
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `firma_${puesto}_${Date.now()}.png`, { type: 'image/png' });
          
          firmaInfo = await uploadToCloudinary(file);
          console.log('✅ Firma dibujada subida a Cloudinary:', firmaInfo.url);
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary falló, usando Base64 como fallback:', cloudinaryError.message);
          firmaInfo = {
            base64: dataUrl,
            url: dataUrl,
            uploaded_at: new Date().toISOString(),
            provider: 'base64-drawn'
          };
        }
      } else {
        firmaInfo = {
          base64: dataUrl,
          url: dataUrl,
          uploaded_at: new Date().toISOString(),
          provider: 'base64-drawn'
        };
        console.log('💾 Firma dibujada guardada como Base64');
      }

      onFirmaChange({
        ...firmaData,
        firma: firmaInfo
      });

      console.log('🎉 Firma dibujada guardada para:', puesto);
      
      setTimeout(() => {
        setUploading(false);
      }, 500);
      
    } catch (err) {
      console.error('❌ Error al guardar firma dibujada:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="signature-uploader">
      <label className="signature-label">Firma Digital:</label>
      
      {!canUploadSignature && selectedName ? (
        <div style={{
          padding: '15px',
          marginTop: '10px',
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#856404',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            🔒 <strong>{selectedName}</strong> debe firmar este documento
          </div>
          <div style={{
            fontSize: '12px',
            color: '#856404',
            fontStyle: 'italic'
          }}>
            Solo esta persona puede subir o dibujar su firma.
          </div>
        </div>
      ) : (
        <>
          {!hasFirma && (!firmaData?.nombre || !firmaData?.fecha) && (
            <div className="signature-info-warning" style={{
              padding: '8px 12px',
              marginBottom: '10px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#856404'
            }}>
              ⚠️ <strong>Importante:</strong> Completa el Nombre y Fecha arriba antes de firmar.
            </div>
          )}

      {!hasFirma ? (
        <div className="signature-empty">
          
          {/* Ocultar tabs en tablets/móviles - solo mostrar "Subir Imagen" */}
          <div className="signature-tabs signature-tabs-desktop">
            <button
              className={`signature-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📤 Subir Imagen
            </button>
           
          </div>

          {activeTab === 'upload' ? (
            <div className="signature-upload-content">
              <div className="signature-empty-icon">📷</div>
              <p className="signature-empty-text">Sin firma cargada</p>
              
              <button
                onClick={handleLoadSavedSignature}
                className="btn-load-saved"
                disabled={uploading || !canUploadSignature}
                title={!canUploadSignature ? `Solo ${selectedName} puede subir su firma` : ''}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '10px',
                  backgroundColor: uploading || !canUploadSignature ? '#95a5a6' : '#1cc88a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: uploading || !canUploadSignature ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(28, 200, 138, 0.3)',
                  opacity: uploading || !canUploadSignature ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (!uploading && canUploadSignature) {
                    e.target.style.backgroundColor = '#17a673';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(28, 200, 138, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!uploading && canUploadSignature) {
                    e.target.style.backgroundColor = '#1cc88a';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(28, 200, 138, 0.3)';
                  }
                }}
              >
                {uploading ? '⏳ Cargando firma a Cloudinary...' : '📥 Usar Mi Firma Guardada'}
              </button>

              <div style={{ 
                textAlign: 'center', 
                margin: '10px 0', 
                color: '#6c757d',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                - O -
              </div>
              
              <label 
                htmlFor={canUploadSignature ? `upload-${puesto}` : undefined}
                className="btn-upload"
                title={!canUploadSignature ? `Solo ${selectedName} puede subir su firma` : ''}
                style={{
                  opacity: canUploadSignature ? 1 : 0.5,
                  cursor: canUploadSignature ? 'pointer' : 'not-allowed',
                  backgroundColor: canUploadSignature ? undefined : '#95a5a6'
                }}
              >
                {uploading ? '⏳ Subiendo...' : '📤 Subir Nueva PNG'}
              </label>
              
              <input
                id={`upload-${puesto}`}
                type="file"
                accept=".png,image/png"
                onChange={handleFileUpload}
                disabled={uploading || !canUploadSignature}
                style={{ display: 'none' }}
              />

              {!canUploadSignature && selectedName && (
                <div style={{
                  marginTop: '15px',
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  color: '#856404',
                  fontSize: '13px',
                  fontWeight: '600',
                  textAlign: 'center',
                  lineHeight: '1.5'
                }}>
                  🔒 <strong>Solo {selectedName}</strong> puede subir su firma para este puesto.
                  <br />
                  <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
                    No puedes firmar por otra persona.
                  </span>
                </div>
              )}

              {useCloudinary && (
                <p className="signature-info">
                  ☁️ Cloudinary configurado
                </p>
              )}
              {!useCloudinary && (
                <p className="signature-info">
                  💾 Se guardará en Base64
                </p>
              )}
            </div>
          ) : (
            <div className="signature-draw-content">
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  className="signature-canvas"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{ touchAction: 'none' }}
                />
                <div className="canvas-placeholder">✍️ Dibuja tu firma aquí</div>
              </div>

              <div className="canvas-actions">
                <button
                  onClick={clearCanvas}
                  className="btn-canvas-action btn-clear"
                  disabled={uploading}
                >
                  🧹 Limpiar
                </button>
                <button
                  onClick={saveDrawnSignature}
                  className="btn-canvas-action btn-save"
                  disabled={uploading}
                >
                  {uploading ? '⏳ Guardando...' : '💾 Guardar Firma'}
                </button>
              </div>

              {useCloudinary && (
                <p className="signature-info">
                  ☁️ Se subirá a Cloudinary
                </p>
              )}
              {!useCloudinary && (
                <p className="signature-info">
                  💾 Se guardará en Base64
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="signature-loaded">
          <div 
            className="signature-preview"
            onClick={() => setShowPreview(true)}
            title="Click para ver en tamaño completo"
          >
            <img 
              src={firmaData.firma.thumbnail || firmaUrl} 
              alt={`Firma de ${puesto}`}
              className="signature-image"
            />
            <div className="signature-overlay">
              <span>🔍 Ver completa</span>
            </div>
          </div>

          <div className="signature-info-loaded">
            <span className="signature-status">✅ Firma cargada</span>
            {firmaData.firma.uploaded_at && (
              <span className="signature-date">
                📅 {new Date(firmaData.firma.uploaded_at).toLocaleString('es-EC')}
              </span>
            )}
            {firmaData.firma.provider && (
              <span className="signature-provider">
                {firmaData.firma.provider === 'cloudinary' ? '☁️ Cloudinary' : '💾 Base64'}
              </span>
            )}
          </div>

          <div className="signature-actions">
            <label htmlFor={`replace-${puesto}`} className="btn-action btn-replace">
              🔄 Cambiar
            </label>
            <input
              id={`replace-${puesto}`}
              type="file"
              accept=".png,image/png"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            
            <button 
              onClick={handleDownloadFirma}
              className="btn-action btn-download"
              title="Descargar firma"
            >
              ⬇️ Descargar
            </button>
            
            <button 
              onClick={handleRemoveFirma}
              className="btn-action btn-remove"
              title="Eliminar firma"
            >
              🗑️ Eliminar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="signature-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn-error-close">✕</button>
        </div>
      )}

      {showPreview && firmaUrl && (
        <div className="signature-modal" onClick={() => setShowPreview(false)}>
          <div className="signature-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="signature-modal-close"
              onClick={() => setShowPreview(false)}
            >
              ✕
            </button>
            <h3>Firma de {puesto}</h3>
            <img 
              src={firmaUrl} 
              alt={`Firma completa de ${puesto}`}
              className="signature-modal-image"
            />
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="signature-modal" onClick={cancelRemoveFirma}>
          <div className="signature-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '12px' }}>🗑️ Eliminar Firma</h3>
            <p style={{ marginBottom: '16px', color: '#555' }}>¿Estás seguro de eliminar la firma de <strong>{puesto}</strong>?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={cancelRemoveFirma}
                style={{ padding: '8px 20px', border: '1px solid #ddd', borderRadius: '6px', background: '#f5f5f5', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRemoveFirma}
                style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#ef5350', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

SignatureUploader.propTypes = {
  puesto: PropTypes.string.isRequired,
  firmaData: PropTypes.shape({
    nombre: PropTypes.string,
    fecha: PropTypes.string,
    firma: PropTypes.shape({
      url: PropTypes.string,
      base64: PropTypes.string,
      thumbnail: PropTypes.string,
      public_id: PropTypes.string,
      uploaded_at: PropTypes.string,
      provider: PropTypes.string,
      filename: PropTypes.string,
      size: PropTypes.number
    })
  }),
  onFirmaChange: PropTypes.func.isRequired,
  cloudinaryCloudName: PropTypes.string,
  cloudinaryUploadPreset: PropTypes.string
};

SignatureUploader.defaultProps = {
  firmaData: {},
  cloudinaryCloudName: null,
  cloudinaryUploadPreset: null
};

export default SignatureUploader;