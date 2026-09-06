// ARCHIVO DE PRUEBA TEMPORAL - Para debugging
// Usa esto en la consola del navegador para probar la carga de formularios

async function testFormLoad(formId) {
  const API_BASE_URL = 'http://localhost:5074/api';
  const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;
  
  try {
    console.log('🔍 Probando carga de formulario ID:', formId);
    console.log('🌐 URL:', `${API_URL_FILLED_FORMS}/${formId}`);
    
    const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`);
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('📦 Full data received:', data);
    
    if (data.Template) {
      console.log('✅ Template found:', data.Template);
      console.log('🔧 HeaderFields:', data.Template.HeaderFields);
      console.log('🔧 BodyElements:', data.Template.BodyElements);
    } else {
      console.error('❌ No Template in response');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Para probar en la consola del navegador:
// testFormLoad(1)  // Reemplaza 1 con el ID del formulario que quieres probar

console.log('🚀 Función testFormLoad() lista. Usa testFormLoad(1) para probar.');
