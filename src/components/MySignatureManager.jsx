import React, { useState, useEffect } from 'react';
import { uploadToCloudinary } from '../services/cloudinaryService';
import authService from '../services/authService';
import './MySignatureManager.css';

const MySignatureManager = ({ onSignatureSelected, autoSelect = false }) => {
  const [savedSignature, setSavedSignature] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSavedSignature();
  }, []);

  const loadSavedSignature = () => {
    const currentUser = authService.getCurrentUser();
    const signatureKey = `firma_permanente_${currentUser?.email || currentUser?.username}`;
    const saved = localStorage.getItem(signatureKey);
    
    if (saved) {
      try {
        const signatureData = JSON.parse(saved);
        setSavedSignature(signatureData);
        console.log('✅ Firma permanente cargada:', signatureData);
        
        // Si autoSelect es true, usar automáticamente la firma guardada
        if (autoSelect && onSignatureSelected) {
          onSignatureSelected(signatureData);
        }
      } catch (err) {
        console.error('❌ Error al cargar firma guardada:', err);
      }
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida (PNG, JPG, etc.)');
      return;
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      console.log('📤 Subiendo firma a Cloudinary...');

      const cloudinaryUrl = await uploadToCloudinary(file);
      console.log('✅ Firma subida exitosamente a Cloudinary:', cloudinaryUrl);

      const signatureData = {
        url: cloudinaryUrl,
        provider: 'cloudinary',
        uploadedAt: new Date().toISOString(),
        fileName: file.name
      };

      // Guardar en localStorage con key única del usuario
      const currentUser = authService.getCurrentUser();
      const signatureKey = `firma_permanente_${currentUser?.email || currentUser?.username}`;
      localStorage.setItem(signatureKey, JSON.stringify(signatureData));

      setSavedSignature(signatureData);
      
      if (onSignatureSelected) {
        onSignatureSelected(signatureData);
      }

      alert('✅ Firma guardada exitosamente en Cloudinary.\n\nAhora puedes usarla en todos tus formularios sin necesidad de subirla nuevamente.');
    } catch (err) {
      console.error('❌ Error al subir firma:', err);
      setError('Error al subir la firma a Cloudinary. Por favor intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleUseSignature = () => {
    if (savedSignature && onSignatureSelected) {
      onSignatureSelected(savedSignature);
      alert('✅ Firma seleccionada. Haz clic en "Guardar Firma" para aplicarla al formulario.');
    }
  };

  const handleDeleteSignature = () => {
    if (!confirm('¿Estás seguro de eliminar tu firma permanente?\n\nDeberás subirla nuevamente la próxima vez.')) {
      return;
    }

    const currentUser = authService.getCurrentUser();
    const signatureKey = `firma_permanente_${currentUser?.email || currentUser?.username}`;
    localStorage.removeItem(signatureKey);
    setSavedSignature(null);
    setError(null);
    console.log('🗑️ Firma permanente eliminada');
    alert('🗑️ Firma eliminada correctamente.');
  };

  return (
    <div className="my-signature-manager">
      <h3>🖊️ Mi Firma Digital Permanente</h3>
      
      {savedSignature ? (
        <div className="saved-signature-card">
          <div className="signature-preview">
            <img src={savedSignature.url} alt="Mi firma permanente" />
          </div>
          <div className="signature-info">
            <p className="signature-date">
              📅 Guardada el: {new Date(savedSignature.uploadedAt).toLocaleString('es-EC')}
            </p>
            <p className="signature-source">
              ☁️ Almacenada en: Cloudinary
            </p>
            <div className="signature-actions">
              <button 
                className="btn-use-signature"
                onClick={handleUseSignature}
                title="Usar esta firma"
              >
                ✅ Usar Mi Firma
              </button>
              <button 
                className="btn-delete-signature"
                onClick={handleDeleteSignature}
                title="Eliminar firma guardada"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-signature-card">
          <p className="no-signature-text">
            📝 Aún no tienes una firma guardada.
          </p>
          <p className="no-signature-subtext">
            Sube tu firma una vez y úsala en todos los formularios automáticamente.
          </p>
          <div className="upload-signature-section">
            <label htmlFor="signature-upload" className="btn-upload-signature">
              {uploading ? (
                <>
                  <span className="spinner"></span>
                  Subiendo a Cloudinary...
                </>
              ) : (
                <>
                  📤 Subir Mi Firma
                </>
              )}
            </label>
            <input
              id="signature-upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="signature-error">
          ⚠️ {error}
        </div>
      )}

      <div className="signature-help">
        <p><strong>💡 Consejos:</strong></p>
        <ul>
          <li>✅ Usa una imagen PNG con fondo transparente para mejor resultado</li>
          <li>✅ La firma se guarda permanentemente en Cloudinary</li>
          <li>✅ No necesitas subirla cada vez que firmes un formulario</li>
          <li>✅ Puedes cambiarla cuando quieras subiendo una nueva</li>
        </ul>
      </div>
    </div>
  );
};

export default MySignatureManager;
