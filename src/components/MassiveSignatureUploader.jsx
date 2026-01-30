import React, { useState, useRef } from 'react';
import './MassiveSignatureUploader.css';

/**
 * 🚀 MassiveSignatureUploader - Carga masiva de múltiples firmas PNG
 * 
 * Permite:
 * - Arrastrar y soltar múltiples archivos PNG
 * - Mapeo automático por nombre de archivo
 * - Mapeo manual si no hay coincidencia
 * - Progreso de carga en tiempo real
 * - Preview de todas las firmas antes de confirmar
 * 
 * Props:
 * @param {array} puestos - Array de nombres de puestos disponibles
 * @param {object} firmasData - Objeto con datos actuales de firmas
 * @param {function} onFirmasChange - Callback con todas las firmas actualizadas
 * @param {string} cloudinaryCloudName - (Opcional) Cloud name
 * @param {string} cloudinaryUploadPreset - (Opcional) Upload preset
 */
const MassiveSignatureUploader = ({
  puestos = [],
  firmasData = {},
  onFirmasChange,
  cloudinaryCloudName = null,
  cloudinaryUploadPreset = null,
  onClose
}) => {
  const [files, setFiles] = useState([]);
  const [mapping, setMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const useCloudinary = cloudinaryCloudName && cloudinaryUploadPreset;

  /**
   * 🎯 Normalizar texto para comparación
   */
  const normalize = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]/g, ''); // Solo letras y números
  };

  /**
   * 🧠 Mapeo automático inteligente por nombre de archivo
   */
  const autoMapFileToPuesto = (filename) => {
    const filenameNorm = normalize(filename.replace('.png', ''));
    
    // Buscar coincidencia exacta
    for (const puesto of puestos) {
      const puestoNorm = normalize(puesto);
      if (filenameNorm === puestoNorm) {
        return puesto;
      }
    }

    // Buscar coincidencia parcial (contiene)
    for (const puesto of puestos) {
      const puestoNorm = normalize(puesto);
      if (filenameNorm.includes(puestoNorm) || puestoNorm.includes(filenameNorm)) {
        return puesto;
      }
    }

    // Mapeo por palabras clave comunes
    const keywords = {
      'jefe': ['jefe', 'chief', 'head'],
      'produccion': ['produccion', 'production'],
      'calidad': ['calidad', 'quality', 'qa', 'qc'],
      'supervisor': ['supervisor', 'super'],
      'gerente': ['gerente', 'manager', 'gerencia'],
      'control': ['control', 'controlador'],
      'laboratorio': ['laboratorio', 'lab', 'laboratorista']
    };

    for (const puesto of puestos) {
      const puestoNorm = normalize(puesto);
      for (const [key, aliases] of Object.entries(keywords)) {
        if (puestoNorm.includes(key) && aliases.some(alias => filenameNorm.includes(alias))) {
          return puesto;
        }
      }
    }

    return null; // No se encontró coincidencia
  };

  /**
   * 📂 Handler para selección/drop de archivos
   */
  const handleFiles = (selectedFiles) => {
    const pngFiles = Array.from(selectedFiles).filter(file => {
      if (!file.type.includes('png')) {
        console.warn('⚠️ Archivo ignorado (no es PNG):', file.name);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        console.warn('⚠️ Archivo ignorado (>5MB):', file.name);
        return false;
      }
      return true;
    });

    if (pngFiles.length === 0) {
      setError('❌ No se encontraron archivos PNG válidos');
      return;
    }

    console.log(`📁 ${pngFiles.length} archivos PNG válidos seleccionados`);

    // Crear previews y mapeo automático
    const newFiles = pngFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }));

    setFiles(newFiles);

    // Intentar mapeo automático
    const autoMapping = {};
    newFiles.forEach((fileObj, index) => {
      const suggestedPuesto = autoMapFileToPuesto(fileObj.name);
      autoMapping[index] = suggestedPuesto || ''; // Vacío si no hay match
    });

    setMapping(autoMapping);
    setError(null);
  };

  /**
   * 🖱️ Drag & Drop handlers
   */
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  /**
   * 📤 Subir a Cloudinary
   */
  const uploadToCloudinary = async (file, puesto) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryUploadPreset);
    formData.append('folder', 'frigo-firmas');
    formData.append('public_id', `firma_${normalize(puesto)}_${Date.now()}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) throw new Error('Error al subir a Cloudinary');

    const data = await response.json();
    return {
      url: data.secure_url,
      thumbnail: data.secure_url.replace('/upload/', '/upload/w_300,h_150,c_fit/'),
      public_id: data.public_id,
      uploaded_at: new Date().toISOString(),
      provider: 'cloudinary'
    };
  };

  /**
   * 💾 Convertir a Base64
   */
  const convertToBase64 = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: reader.result,
          url: reader.result,
          filename: file.name,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          provider: 'base64'
        });
      };
      reader.readAsDataURL(file);
    });
  };

  /**
   * 🚀 Confirmar y subir todas las firmas
   */
  const handleConfirmUpload = async () => {
    // Validar que todos los archivos tengan un puesto asignado
    const unmapped = files.filter((_, index) => !mapping[index]);
    if (unmapped.length > 0) {
      setError(`❌ ${unmapped.length} archivo(s) sin puesto asignado`);
      return;
    }

    // Validar que no haya puestos duplicados
    const assignedPuestos = Object.values(mapping);
    const duplicates = assignedPuestos.filter((puesto, index) => 
      assignedPuestos.indexOf(puesto) !== index
    );
    if (duplicates.length > 0) {
      setError(`❌ Puestos duplicados: ${duplicates.join(', ')}`);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress({ current: 0, total: files.length });

    const updatedFirmas = { ...firmasData };
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        const puesto = mapping[i];

        console.log(`📤 Subiendo ${i + 1}/${files.length}: ${fileObj.name} → ${puesto}`);
        setProgress({ current: i + 1, total: files.length });

        try {
          let firmaInfo;

          if (useCloudinary) {
            try {
              firmaInfo = await uploadToCloudinary(fileObj.file, puesto);
            } catch (cloudinaryError) {
              console.warn('⚠️ Cloudinary falló, usando Base64:', cloudinaryError);
              firmaInfo = await convertToBase64(fileObj.file);
            }
          } else {
            firmaInfo = await convertToBase64(fileObj.file);
          }

          // Actualizar firma del puesto
          if (!updatedFirmas[puesto]) {
            updatedFirmas[puesto] = { nombre: '', fecha: '' };
          }
          updatedFirmas[puesto].firma = firmaInfo;

          successCount++;
          console.log(`✅ Firma subida: ${puesto}`);
        } catch (fileError) {
          console.error(`❌ Error en archivo ${fileObj.name}:`, fileError);
        }
      }

      // Actualizar todas las firmas de una vez
      onFirmasChange(updatedFirmas);

      alert(`✅ ${successCount}/${files.length} firmas cargadas exitosamente`);
      onClose();
    } catch (err) {
      console.error('❌ Error en carga masiva:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * 🗑️ Eliminar archivo de la lista
   */
  const handleRemoveFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newMapping = {};
    Object.keys(mapping).forEach(key => {
      const idx = parseInt(key);
      if (idx < index) {
        newMapping[idx] = mapping[idx];
      } else if (idx > index) {
        newMapping[idx - 1] = mapping[idx];
      }
    });
    setFiles(newFiles);
    setMapping(newMapping);
  };

  return (
    <div className="massive-uploader-overlay">
      <div className="massive-uploader-modal">
        {/* Header */}
        <div className="massive-uploader-header">
          <h2>📸 Carga Masiva de Firmas PNG</h2>
          <button 
            className="btn-close-modal"
            onClick={onClose}
            disabled={uploading}
          >
            ✕
          </button>
        </div>

        {/* Drop Zone */}
        {files.length === 0 && (
          <div 
            className={`dropzone ${isDragging ? 'dropzone-dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">📁</div>
            <p className="dropzone-text">
              Arrastra y suelta archivos PNG aquí
            </p>
            <p className="dropzone-subtext">
              o haz click para seleccionar
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Lista de archivos */}
        {files.length > 0 && (
          <div className="files-list">
            <div className="files-header">
              <h3>📋 {files.length} archivo(s) seleccionado(s)</h3>
              <button 
                className="btn-add-more"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                ➕ Agregar más
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,image/png"
                multiple
                onChange={(e) => handleFiles([...files.map(f => f.file), ...Array.from(e.target.files)])}
                style={{ display: 'none' }}
              />
            </div>

            {files.map((fileObj, index) => (
              <div key={index} className="file-item">
                <div className="file-preview">
                  <img src={fileObj.preview} alt={fileObj.name} />
                </div>
                
                <div className="file-info">
                  <p className="file-name">{fileObj.name}</p>
                  <p className="file-size">{(fileObj.size / 1024).toFixed(2)} KB</p>
                </div>

                <div className="file-mapping">
                  <label>Asignar a:</label>
                  <select
                    value={mapping[index] || ''}
                    onChange={(e) => setMapping({ ...mapping, [index]: e.target.value })}
                    disabled={uploading}
                    className={!mapping[index] ? 'mapping-empty' : ''}
                  >
                    <option value="">-- Seleccionar puesto --</option>
                    {puestos.map(puesto => (
                      <option key={puesto} value={puesto}>
                        {puesto}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  className="btn-remove-file"
                  onClick={() => handleRemoveFile(index)}
                  disabled={uploading}
                  title="Eliminar archivo"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso */}
        {uploading && (
          <div className="progress-bar-container">
            <div className="progress-bar-label">
              Subiendo {progress.current} de {progress.total}...
            </div>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="massive-error">
            {error}
          </div>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="massive-actions">
            <button 
              className="btn-cancel"
              onClick={onClose}
              disabled={uploading}
            >
              ❌ Cancelar
            </button>
            <button 
              className="btn-confirm"
              onClick={handleConfirmUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? '⏳ Subiendo...' : `✅ Confirmar y Subir (${files.length})`}
            </button>
          </div>
        )}

        {/* Info */}
        <div className="massive-info">
          <p>ℹ️ Solo archivos PNG | Máximo 5MB por archivo</p>
          {useCloudinary && <p>☁️ Cloudinary configurado</p>}
          {!useCloudinary && <p>💾 Modo Base64 (sin Cloudinary)</p>}
        </div>
      </div>
    </div>
  );
};

export default MassiveSignatureUploader;
