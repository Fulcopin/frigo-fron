/**
 * 🚀 SCRIPT DE EJEMPLO PARA CREAR FORMULARIO DE 15 TINAS
 * 
 * Cómo usar:
 * 1. Abre la consola del navegador (F12) en tu aplicación
 * 2. Copia y pega este código completo
 * 3. Ajusta el templateID (línea 10)
 * 4. Ejecuta presionando Enter
 * 5. Verás el resultado en consola
 */

// ⚙️ CONFIGURACIÓN
const TEMPLATE_ID = 123; // 👈 CAMBIA ESTO por tu templateID real
const API_BASE_URL = 'http://188.40.197.172:8094/api'; // Ajustar si es diferente

// 📦 DATOS DE LAS 15 TINAS
const formularioTinas = {
  templateID: TEMPLATE_ID,
  headerData: {
    "Fecha": new Date().toISOString().split('T')[0], // Fecha de hoy
    "Lote": "L-2026-001",
    "Turno": "Mañana",
    "Responsable": "Juan Pérez",
    "Hora Inicio": "08:00",
    "Hora Fin": "16:00"
  },
  bodyData: [
    {
      rows: [
        { "Tina": "T1", "Peso Ingreso (kg)": "1200.50", "Peso Salida (kg)": "1100.25", "Merma (kg)": "100.25", "Merma (%)": "8.35", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" },
        { "Tina": "T2", "Peso Ingreso (kg)": "1300.00", "Peso Salida (kg)": "1180.50", "Merma (kg)": "119.50", "Merma (%)": "9.19", "Temperatura (°C)": "-19.0", "Observaciones": "Normal" },
        { "Tina": "T3", "Peso Ingreso (kg)": "1250.75", "Peso Salida (kg)": "1160.00", "Merma (kg)": "90.75", "Merma (%)": "7.26", "Temperatura (°C)": "-18.0", "Observaciones": "Revisar sello" },
        { "Tina": "T4", "Peso Ingreso (kg)": "1400.00", "Peso Salida (kg)": "1290.00", "Merma (kg)": "110.00", "Merma (%)": "7.86", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" },
        { "Tina": "T5", "Peso Ingreso (kg)": "1150.50", "Peso Salida (kg)": "1050.25", "Merma (kg)": "100.25", "Merma (%)": "8.71", "Temperatura (°C)": "-19.5", "Observaciones": "Normal" },
        { "Tina": "T6", "Peso Ingreso (kg)": "1320.00", "Peso Salida (kg)": "1210.00", "Merma (kg)": "110.00", "Merma (%)": "8.33", "Temperatura (°C)": "-18.0", "Observaciones": "Normal" },
        { "Tina": "T7", "Peso Ingreso (kg)": "1280.50", "Peso Salida (kg)": "1175.00", "Merma (kg)": "105.50", "Merma (%)": "8.24", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" },
        { "Tina": "T8", "Peso Ingreso (kg)": "1350.00", "Peso Salida (kg)": "1240.50", "Merma (kg)": "109.50", "Merma (%)": "8.11", "Temperatura (°C)": "-19.0", "Observaciones": "Normal" },
        { "Tina": "T9", "Peso Ingreso (kg)": "1220.00", "Peso Salida (kg)": "1115.00", "Merma (kg)": "105.00", "Merma (%)": "8.61", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" },
        { "Tina": "T10", "Peso Ingreso (kg)": "1380.00", "Peso Salida (kg)": "1270.00", "Merma (kg)": "110.00", "Merma (%)": "7.97", "Temperatura (°C)": "-18.0", "Observaciones": "Normal" },
        { "Tina": "T11", "Peso Ingreso (kg)": "1290.50", "Peso Salida (kg)": "1185.00", "Merma (kg)": "105.50", "Merma (%)": "8.18", "Temperatura (°C)": "-19.0", "Observaciones": "Normal" },
        { "Tina": "T12", "Peso Ingreso (kg)": "1310.00", "Peso Salida (kg)": "1200.00", "Merma (kg)": "110.00", "Merma (%)": "8.40", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" },
        { "Tina": "T13", "Peso Ingreso (kg)": "1270.00", "Peso Salida (kg)": "1165.00", "Merma (kg)": "105.00", "Merma (%)": "8.27", "Temperatura (°C)": "-18.0", "Observaciones": "Normal" },
        { "Tina": "T14", "Peso Ingreso (kg)": "1340.00", "Peso Salida (kg)": "1230.00", "Merma (kg)": "110.00", "Merma (%)": "8.21", "Temperatura (°C)": "-19.5", "Observaciones": "Normal" },
        { "Tina": "T15", "Peso Ingreso (kg)": "1260.00", "Peso Salida (kg)": "1155.00", "Merma (kg)": "105.00", "Merma (%)": "8.33", "Temperatura (°C)": "-18.5", "Observaciones": "Normal" }
      ]
    }
  ],
  firmasData: {
    "Operario": {
      "nombre": "Juan Pérez",
      "fecha": new Date().toISOString().split('T')[0],
      "firma": "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/juan_perez.png"
    },
    "Supervisor": {
      "nombre": "María García",
      "fecha": new Date().toISOString().split('T')[0],
      "firma": "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/maria_garcia.png"
    },
    "Jefe de Producción": {
      "nombre": "Carlos Rodríguez",
      "fecha": new Date().toISOString().split('T')[0],
      "firma": "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/carlos_rodriguez.png"
    }
  },
  observaciones: "Control de tinas - Proceso de congelación normal. Merma promedio: 8.29%"
};

// 🚀 FUNCIÓN PARA ENVIAR EL POST
async function crearFormularioTinas() {
  console.log('📝 Preparando formulario de 15 tinas...');
  
  try {
    // Preparar payload según formato esperado por el backend
    const payload = {
      templateID: formularioTinas.templateID,
      headerData: JSON.stringify(formularioTinas.headerData),
      bodyData: JSON.stringify(formularioTinas.bodyData),
      firmasData: JSON.stringify(formularioTinas.firmasData),
      observaciones: formularioTinas.observaciones
    };

    console.log('📦 Payload a enviar:', payload);
    console.log('🌐 URL:', `${API_BASE_URL}/FilledForms`);

    const response = await fetch(`${API_BASE_URL}/FilledForms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Si necesitas token: 'Authorization': `Bearer ${localStorage.getItem('fishcort_token')}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ ¡FORMULARIO CREADO EXITOSAMENTE!');
    console.log('📋 Respuesta completa:', result);
    console.log('🆔 FormID creado:', result.FormID || result.formID);
    
    alert(`✅ Formulario creado con éxito!\nFormID: ${result.FormID || result.formID}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ ERROR al crear formulario:', error);
    alert(`❌ Error: ${error.message}`);
    throw error;
  }
}

// 🎯 EJECUTAR
console.log('🚀 Ejecutando creación de formulario...');
crearFormularioTinas();
