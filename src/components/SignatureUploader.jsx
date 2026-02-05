import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
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
 */
const SignatureUploader = ({
  puesto,
  firmaData,
  onFirmaChange,
  cloudinaryCloudName,
  cloudinaryUploadPreset
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' o 'draw'
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Refs para canvas
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Determinar modo de operación
  const useCloudinary = cloudinaryCloudName && cloudinaryUploadPreset;
  const firmaUrl = firmaData?.firma?.url || firmaData?.firma?.base64;
  const hasFirma = !!firmaUrl;

  /**
   * 🔥 MÉTODO 1: Subir a Cloudinary
   */
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

  /**
   * 🔥 MÉTODO 2: Convertir a Base64 (Fallback)
   */
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      console.log('📝 Convirtiendo a Base64:', file.name);
      
      const reader = new FileReader();
      
      reader.onloadend = () => {
        console.log('✅ Conversión a Base64 completada');
        resolve({
          base64: reader.result,
          url: reader.result, // Para compatibilidad con preview
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

  /**
   * 🎯 Handler principal de carga de archivo
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 Archivo seleccionado:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);

    // Validar tipo de archivo
    if (!file.type.includes('png')) {
      setError('❌ Solo se permiten archivos PNG');
      return;
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError(`❌ El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Máximo: 5MB`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      let firmaInfo;

      if (useCloudinary) {
        // Intentar Cloudinary primero
        try {
          firmaInfo = await uploadToCloudinary(file);
          console.log('✅ Cloudinary exitoso');
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary falló, usando Base64 como fallback:', cloudinaryError.message);
          firmaInfo = await convertToBase64(file);
        }
      } else {
        // Usar Base64 directamente si no hay configuración de Cloudinary
        console.log('ℹ️ Usando Base64 (Cloudinary no configurado)');
        firmaInfo = await convertToBase64(file);
      }

      // Actualizar datos de la firma
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

  /**
   * 🗑️ Eliminar firma
   */
  const handleRemoveFirma = () => {
    if (confirm(`¿Eliminar la firma de ${puesto}?`)) {
      const updatedFirma = { ...firmaData };
      delete updatedFirma.firma;
      onFirmaChange(updatedFirma);
      console.log('🗑️ Firma eliminada:', puesto);
    }
  };

  /**
   * ⬇️ Descargar firma
   */
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

  /**
   * 🎨 FUNCIONES DE CANVAS PARA DIBUJAR FIRMA
   */
  
  // Inicializar canvas
  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth * 2; // Mejor resolución
      canvas.height = canvas.offsetHeight * 2;
      canvas.style.width = `${canvas.offsetWidth}px`;
      canvas.style.height = `${canvas.offsetHeight}px`;
      
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.lineCap = 'round';
      context.strokeStyle = '#000';
      context.lineWidth = 2;
      contextRef.current = context;
      
      console.log('🎨 Canvas inicializado para dibujar firma');
    }
  }, [activeTab]);

  // Iniciar dibujo
  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  // Dibujar
  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  // Finalizar dibujo
  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  // Limpiar canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    console.log('🧹 Canvas limpiado');
  };

  // Guardar firma dibujada
  const saveDrawnSignature = async () => {
    const canvas = canvasRef.current;
    
    // Verificar que hay algo dibujado
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((channel, index) => {
      // Verificar si hay píxeles con alpha > 0
      return index % 4 === 3 && channel > 0;
    });
    
    if (!hasContent) {
      setError('⚠️ Por favor dibuja tu firma antes de guardar');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convertir canvas a blob
      const dataUrl = canvas.toDataURL('image/png');
      
      let firmaInfo;

      if (useCloudinary) {
        // Intentar subir a Cloudinary
        try {
          // Convertir dataURL a File
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `firma_${puesto}_${Date.now()}.png`, { type: 'image/png' });
          
          firmaInfo = await uploadToCloudinary(file);
          console.log('✅ Firma dibujada subida a Cloudinary');
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
        // Guardar como Base64
        firmaInfo = {
          base64: dataUrl,
          url: dataUrl,
          uploaded_at: new Date().toISOString(),
          provider: 'base64-drawn'
        };
      }

      // Actualizar datos de la firma
      onFirmaChange({
        ...firmaData,
        firma: firmaInfo
      });

      console.log('🎉 Firma dibujada guardada para:', puesto);
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
      
      {/* ℹ️ Nota informativa si faltan nombre o fecha */}
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
        // 📤 Estado: Sin firma - Mostrar tabs para elegir método
        <div className="signature-empty">
          
          {/* 🆕 TABS PARA ELEGIR MÉTODO DE FIRMA */}
          <div className="signature-tabs">
            <button
              className={`signature-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📤 Subir Imagen
            </button>
            <button
              className={`signature-tab ${activeTab === 'draw' ? 'active' : ''}`}
              onClick={() => setActiveTab('draw')}
            >
              ✍️ Dibujar Firma
            </button>
          </div>

          {/* CONTENIDO DEL TAB ACTIVO */}
          {activeTab === 'upload' ? (
            // TAB 1: Subir imagen
            <div className="signature-upload-content">
              <div className="signature-empty-icon">📷</div>
              <p className="signature-empty-text">Sin firma cargada</p>
              
              <label htmlFor={`upload-${puesto}`} className="btn-upload">
                {uploading ? '⏳ Subiendo...' : '📤 Subir PNG'}
              </label>
              
              <input
                id={`upload-${puesto}`}
                type="file"
                accept=".png,image/png"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />

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
            // TAB 2: Dibujar firma
            <div className="signature-draw-content">
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  className="signature-canvas"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
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
        // ✅ Estado: Firma cargada
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

      {/* ❌ Mensaje de error */}
      {error && (
        <div className="signature-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn-error-close">✕</button>
        </div>
      )}

      {/* 🔍 Modal de vista previa completa */}
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
    </div>
  );
};

// PropTypes para validación
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
