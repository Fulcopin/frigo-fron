import React, { useState, useEffect, useRef } from 'react';
import authService from '../services/authService';
import './MySignature.css';

const MySignature = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [signatureDate, setSignatureDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    loadSignature(user);
  }, []);

  // Cargar firma guardada del usuario desde localStorage
  const loadSignature = (user) => {
    if (!user) return;
    
    const keyId = (user.username || user.email || '').toLowerCase();
    const signatureKey = `signature_${keyId}`;
    const savedSignature = localStorage.getItem(signatureKey);
    const savedDate = localStorage.getItem(`${signatureKey}_date`);
    
    if (savedSignature) {
      setSignatureUrl(savedSignature);
      setSignatureDate(savedDate);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '⚠️ Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.)' });
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: '⚠️ La imagen es muy grande. Máximo 5MB permitido.' });
      return;
    }

    setSelectedFile(file);
    setMessage({ type: '', text: '' });

    // Mostrar preview Y guardar automáticamente en localStorage
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setSignatureUrl(base64);

      // ✅ AUTOGUARDADO: guardar inmediatamente en localStorage al seleccionar
      if (currentUser) {
        try {
          const keyId = (currentUser.username || currentUser.email || '').toLowerCase();
          const signatureKey = `signature_${keyId}`;
          const currentDate = new Date().toISOString();
          localStorage.setItem(signatureKey, base64);
          localStorage.setItem(`${signatureKey}_date`, currentDate);
          setSignatureDate(currentDate);
          setSelectedFile(null); // limpiar selectedFile → muestra vista "Firma Guardada"
          setMessage({
            type: 'success',
            text: '✅ Firma guardada automáticamente. Ya puedes usarla en todos tus formularios.'
          });
          setTimeout(() => setMessage({ type: '', text: '' }), 5000);
        } catch (storageError) {
          console.error('Error en autoguardado:', storageError);
          // Si falla el autoguardado, dejar selectedFile para que el usuario pueda guardar manualmente
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Guardar firma en localStorage
  const handleSave = async () => {
    if (!signatureUrl) {
      setMessage({ type: 'error', text: '⚠️ Por favor selecciona una imagen de tu firma primero' });
      return;
    }

    setLoading(true);
    try {
      // Guardar imagen base64 en localStorage
      const keyId = (currentUser.username || currentUser.email || '').toLowerCase();
      const signatureKey = `signature_${keyId}`;
      const currentDate = new Date().toISOString();
      
      localStorage.setItem(signatureKey, signatureUrl);
      localStorage.setItem(`${signatureKey}_date`, currentDate);
      
      setSignatureDate(currentDate);
      setSelectedFile(null);
      
      setMessage({ 
        type: 'success', 
        text: '✅ Firma guardada correctamente. Ahora puedes usarla en todos tus formularios.' 
      });
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Error al guardar firma:', error);
      setMessage({ type: 'error', text: '❌ Error al guardar la firma' });
    } finally {
      setLoading(false);
    }
  };

  // Actualizar firma (seleccionar nueva imagen)
  const handleUpdate = () => {
    fileInputRef.current.click();
    setMessage({ type: '', text: '' });
  };

  // Eliminar firma guardada
  const handleDelete = () => {
    if (!window.confirm('¿Estás seguro de eliminar tu firma? Tendrás que subirla nuevamente.')) {
      return;
    }

    const keyId = (currentUser.username || currentUser.email || '').toLowerCase();
    const signatureKey = `signature_${keyId}`;
    localStorage.removeItem(signatureKey);
    localStorage.removeItem(`${signatureKey}_date`);
    
    setSignatureUrl(null);
    setSignatureDate(null);
    setSelectedFile(null);
    
    setMessage({ 
      type: 'info', 
      text: 'ℹ️ Firma eliminada. Sube tu nueva firma y guárdala.' 
    });
  };

  // Cancelar y volver a vista de firma guardada
  const handleCancel = () => {
    setSelectedFile(null);
    setMessage({ type: '', text: '' });
    // Recargar firma guardada
    loadSignature(currentUser);
  };

  return (
    <div className="my-signature-container">
      <div className="page-header">
        <h1>✍️ Mi Firma Personal</h1>
        <p className="subtitle">
          Sube tu firma una sola vez y úsala en todos tus formularios
        </p>
      </div>

      <div className="signature-content">
        {/* Información del usuario */}
        <div className="user-info-card">
          <div className="user-avatar">
            {currentUser?.nombre?.charAt(0) || currentUser?.username?.charAt(0) || '👤'}
          </div>
          <div className="user-details">
            <h3>{currentUser?.nombre || currentUser?.username}</h3>
            <p>{currentUser?.email}</p>
            <span className="user-role">{currentUser?.rol || 'Usuario'}</span>
          </div>
        </div>

        {/* Mensajes de estado */}
        {message.text && (
          <div className={`message-box ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Vista de firma guardada */}
        {signatureUrl && !selectedFile && (
          <div className="signature-saved-section">
            <div className="section-header">
              <h2>🎯 Tu Firma Guardada</h2>
              <div className="signature-date">
                📅 Guardada el: {signatureDate ? new Date(signatureDate).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'N/A'}
              </div>
            </div>

            <div className="signature-preview">
              <img src={signatureUrl} alt="Tu firma" />
            </div>

            <div className="signature-info">
              <div className="info-item">
                <span className="icon">✅</span>
                <div>
                  <strong>Firma activa</strong>
                  <p>Esta firma se usará automáticamente en todos tus formularios</p>
                </div>
              </div>
              <div className="info-item">
                <span className="icon">🔒</span>
                <div>
                  <strong>Almacenamiento seguro</strong>
                  <p>Tu firma está guardada localmente en tu navegador</p>
                </div>
              </div>
              <div className="info-item">
                <span className="icon">♻️</span>
                <div>
                  <strong>Reutilizable</strong>
                  <p>No necesitas firmar cada vez, se aplicará automáticamente</p>
                </div>
              </div>
            </div>

            <div className="signature-actions">
              <button onClick={handleUpdate} className="btn-update">
                ✏️ Actualizar Firma
              </button>
              <button onClick={handleDelete} className="btn-delete">
                🗑️ Eliminar Firma
              </button>
            </div>
          </div>
        )}

        {/* Vista para subir firma */}
        {(!signatureUrl || selectedFile) && (
          <div className="signature-upload-section">
            <div className="section-header">
              <h2>{signatureUrl && selectedFile ? '✏️ Actualizar Firma' : '✨ Sube tu Firma'}</h2>
              <p>Selecciona una imagen de tu firma (PNG, JPG, etc.)</p>
            </div>

            {/* Input de archivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Botón para seleccionar archivo o área de drop */}
            <div className="upload-area" onClick={() => fileInputRef.current.click()}>
              {signatureUrl && selectedFile ? (
                <div className="preview-container">
                  <img src={signatureUrl} alt="Preview de firma" className="signature-preview-img" />
                  <p className="preview-text">✅ Imagen seleccionada - Haz clic para cambiar</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">📁</div>
                  <h3>Haz clic para seleccionar tu firma</h3>
                  <p>o arrastra y suelta una imagen aquí</p>
                  <span className="upload-hint">PNG, JPG, GIF - Máximo 5MB • Se guarda automáticamente</span>
                </>
              )}
            </div>

            <div className="upload-instructions">
              <div className="instruction">
                <span>💡</span>
                <p><strong>Tip:</strong> Usa una imagen con fondo transparente (PNG) para mejor resultado</p>
              </div>
              <div className="instruction">
                <span>📸</span>
                <p><strong>Sugerencia:</strong> Firma en papel blanco, toma foto y recorta</p>
              </div>
              <div className="instruction">
                <span>✂️</span>
                <p><strong>Recomendado:</strong> Imagen horizontal, clara y sin bordes</p>
              </div>
            </div>

            <div className="signature-actions">
              {signatureUrl && selectedFile && (
                <>
                  <button onClick={handleSave} className="btn-save" disabled={loading}>
                    {loading ? '⏳ Guardando...' : '💾 Guardar Firma'}
                  </button>
                  <button onClick={handleCancel} className="btn-cancel">
                    ❌ Cancelar
                  </button>
                </>
              )}
              {!signatureUrl && selectedFile && (
                <button onClick={handleSave} className="btn-save" disabled={loading}>
                  {loading ? '⏳ Guardando...' : '💾 Guardar Firma'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Guía de uso */}
        <div className="usage-guide">
          <h3>📖 ¿Cómo funciona?</h3>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Selecciona tu firma</h4>
                <p>Haz clic en el área de carga y elige una imagen de tu firma (PNG, JPG)</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Se guarda automáticamente ✅</h4>
                <p>Al seleccionar la imagen se guarda al instante — no necesitas presionar ningún botón</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Usa en todos tus formularios</h4>
                <p>Tu firma aparecerá automáticamente cada vez que llenes un formulario</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySignature;
