// DEBUG HELPER - Script para probar la carga de datos en la consola

// Función para probar la estructura de datos
async function debugFormStructure(formId) {
    const API_BASE_URL = 'http://localhost:5074/api';
    
    try {
        console.log('🔍 ==> INICIANDO DEBUG DE ESTRUCTURA DE FORMULARIO <==');
        
        // 1. Probar endpoint directo
        const response = await fetch(`${API_BASE_URL}/FilledForms/${formId}`);
        const rawData = await response.json();
        
        console.log('📦 1. DATOS RAW DEL SERVIDOR:');
        console.log(JSON.stringify(rawData, null, 2));
        
        // 2. Verificar estructura de BodyData
        console.log('\n🔧 2. ANÁLISIS DE BODYDATA:');
        console.log('BodyData tipo:', typeof rawData.BodyData);
        console.log('BodyData valor:', rawData.BodyData);
        
        if (rawData.BodyData) {
            try {
                const parsedBodyData = JSON.parse(rawData.BodyData);
                console.log('BodyData parseado:', parsedBodyData);
                console.log('BodyData es array?', Array.isArray(parsedBodyData));
                
                if (Array.isArray(parsedBodyData)) {
                    parsedBodyData.forEach((item, index) => {
                        console.log(`Item ${index}:`, item);
                        console.log(`Item ${index} tiene .rows?`, item.hasOwnProperty('rows'));
                    });
                }
            } catch (e) {
                console.error('Error parsing BodyData:', e);
            }
        }
        
        // 3. Verificar Template
        console.log('\n🔧 3. ANÁLISIS DE TEMPLATE:');
        if (rawData.Template) {
            console.log('Template encontrado:', !!rawData.Template);
            console.log('Template.BodyElements:', rawData.Template.BodyElements);
            
            try {
                const parsedBodyElements = JSON.parse(rawData.Template.BodyElements || '[]');
                console.log('BodyElements parseados:', parsedBodyElements);
                
                parsedBodyElements.forEach((element, index) => {
                    console.log(`Elemento ${index}:`, {
                        tipo: element.type,
                        titulo: element.title,
                        columnas: element.columns?.length || 0
                    });
                });
            } catch (e) {
                console.error('Error parsing BodyElements:', e);
            }
        }
        
        console.log('\n✅ DEBUG COMPLETADO');
        return rawData;
        
    } catch (error) {
        console.error('❌ Error en debug:', error);
    }
}

// Para usar en consola del navegador:
// debugFormStructure(1)  // Cambiar 1 por el ID real del formulario

console.log('🚀 Función debugFormStructure() cargada. Usa debugFormStructure(formId) para analizar.');
