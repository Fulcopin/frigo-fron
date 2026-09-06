// ========================================
// ACTUALIZACIÓN: FillForm.jsx - handleSubmit
// ========================================
// Ubicación: src/pages/FillForm.jsx
// BUSCAR la función handleSubmit y AGREGAR los campos de auditoría al payload

// ✅ CÓDIGO ACTUALIZADO PARA handleSubmit:

const handleSubmit = async () => {
  try {
    setIsSubmitting(true);

    // ✨ Obtener usuario actual
    const currentUser = authService.getCurrentUser();
    
    const payload = {
      templateID: parseInt(templateId, 10),
      headerData: JSON.stringify(headerValues),
      bodyData: JSON.stringify(bodyData),
      firmasData: JSON.stringify(firmasData),
      observaciones: observaciones,
      
      // ✨ NUEVO: Auditoría - Guardar quién llenó el formulario
      filledBy: currentUser?.nombre || currentUser?.username || "Usuario desconocido",
      filledByEmail: currentUser?.email || currentUser?.username || "",
      filledByRole: currentUser?.rol || "usuario"
    };

    console.log('📤 Enviando formulario:', {
      templateID: payload.templateID,
      filledBy: payload.filledBy,
      filledByEmail: payload.filledByEmail,
      filledByRole: payload.filledByRole
    });

    const response = await fetch(`${API_BASE_URL}/FilledForms`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Formulario guardado exitosamente:', data);
      
      alert('✅ Formulario guardado exitosamente');
      navigate('/filled-forms');
    } else {
      const error = await response.json();
      console.error('❌ Error al guardar:', error);
      alert(`❌ Error al guardar formulario: ${error.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('❌ Error en handleSubmit:', error);
    alert('❌ Error al enviar el formulario. Verifica tu conexión.');
  } finally {
    setIsSubmitting(false);
  }
};

// ========================================
// NOTAS IMPORTANTES:
// ========================================
// 
// 1. Asegúrate de tener authService importado:
//    import authService from '../services/authService';
//
// 2. El currentUser debe tener las propiedades:
//    - nombre o username
//    - email
//    - rol
//
// 3. Estos datos se guardarán en la BD en:
//    - FilledBy (nombre del usuario)
//    - FilledByEmail (email)
//    - FilledByRole (rol)
//
// 4. Ahora cuando veas un formulario en SignatureManagement,
//    "Creado por" mostrará el nombre REAL del usuario que lo llenó
