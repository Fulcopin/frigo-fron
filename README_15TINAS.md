# 📝 Ejemplo POST - Formulario de 15 Tinas

Este directorio contiene ejemplos completos para crear un formulario de control de 15 tinas mediante POST a la API.

## 📁 Archivos Incluidos

1. **`ejemplo_15tinas_POST.json`** - JSON completo listo para usar
2. **`crear_15tinas.js`** - Script JavaScript para ejecutar desde el navegador
3. **`enviar_15tinas.ps1`** - Script PowerShell para ejecutar desde terminal
4. **`src/utils/filledFormsUtils.js`** - Función `createFilledForm()` agregada

---

## 🚀 Opción 1: Desde el Navegador (Consola)

### Pasos:
1. Abre tu aplicación en el navegador
2. Presiona `F12` para abrir DevTools
3. Ve a la pestaña **Console**
4. Abre el archivo `crear_15tinas.js`
5. **IMPORTANTE**: Cambia el `TEMPLATE_ID` en la línea 10
6. Copia TODO el contenido del archivo
7. Pega en la consola y presiona Enter

### Resultado:
```
📝 Preparando formulario de 15 tinas...
📦 Payload a enviar: {...}
🌐 URL: http://188.40.197.172:8094/api/FilledForms
✅ ¡FORMULARIO CREADO EXITOSAMENTE!
📋 Respuesta completa: {...}
🆔 FormID creado: 789
```

---

## 🚀 Opción 2: Desde PowerShell (Terminal)

### Pasos:
1. Abre PowerShell
2. Navega a la carpeta del proyecto:
   ```powershell
   cd "c:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron"
   ```
3. Ejecuta el script:
   ```powershell
   .\enviar_15tinas.ps1
   ```

### Con TemplateID personalizado:
```powershell
.\enviar_15tinas.ps1 -TemplateID 456
```

### Con API diferente:
```powershell
.\enviar_15tinas.ps1 -TemplateID 456 -ApiUrl "http://localhost:5000/api"
```

### Resultado:
```
📝 CREANDO FORMULARIO DE 15 TINAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Configuración:
   • Template ID: 123
   • API URL: http://188.40.197.172:8094/api
   • Fecha: 2026-02-05

🚀 Enviando POST a la API...

✅ ¡FORMULARIO CREADO EXITOSAMENTE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 FormID creado: 789
```

---

## 🚀 Opción 3: Desde tu Código React

### Importar la función:
```javascript
import { createFilledForm } from '../utils/filledFormsUtils';
```

### Usar la función:
```javascript
const handleCrearFormulario = async () => {
  try {
    const nuevoFormulario = {
      templateID: 123, // Tu ID de plantilla
      headerData: {
        "Fecha": "2026-02-05",
        "Lote": "L-2026-001",
        "Turno": "Mañana",
        "Responsable": "Juan Pérez"
      },
      bodyData: [
        {
          rows: [
            {
              "Tina": "T1",
              "Peso Ingreso (kg)": "1200.50",
              "Peso Salida (kg)": "1100.25",
              "Merma (kg)": "100.25",
              "Merma (%)": "8.35",
              "Temperatura (°C)": "-18.5",
              "Observaciones": "Normal"
            },
            // ... más filas
          ]
        }
      ],
      firmasData: {
        "Operario": {
          "nombre": "Juan Pérez",
          "fecha": "2026-02-05",
          "firma": "https://res.cloudinary.com/.../firma.png"
        }
      },
      observaciones: "Control de tinas normal"
    };

    const resultado = await createFilledForm(nuevoFormulario);
    console.log('✅ Formulario creado:', resultado);
    alert(`Formulario creado con ID: ${resultado.FormID || resultado.formID}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert(`Error: ${error.message}`);
  }
};
```

---

## 📊 Estructura de los Datos

### HeaderData (Encabezado)
```json
{
  "Fecha": "2026-02-05",
  "Lote": "L-2026-001",
  "Turno": "Mañana",
  "Responsable": "Juan Pérez",
  "Hora Inicio": "08:00",
  "Hora Fin": "16:00"
}
```

### BodyData (Tabla de 15 Tinas)
```json
[
  {
    "rows": [
      {
        "Tina": "T1",
        "Peso Ingreso (kg)": "1200.50",
        "Peso Salida (kg)": "1100.25",
        "Merma (kg)": "100.25",
        "Merma (%)": "8.35",
        "Temperatura (°C)": "-18.5",
        "Observaciones": "Normal"
      },
      // ... T2 a T15
    ]
  }
]
```

### FirmasData (Firmas)
```json
{
  "Operario": {
    "nombre": "Juan Pérez",
    "fecha": "2026-02-05",
    "firma": "https://res.cloudinary.com/.../firma_operario.png"
  },
  "Supervisor": {
    "nombre": "María García",
    "fecha": "2026-02-05",
    "firma": "https://res.cloudinary.com/.../firma_supervisor.png"
  },
  "Jefe de Producción": {
    "nombre": "Carlos Rodríguez",
    "fecha": "2026-02-05",
    "firma": "https://res.cloudinary.com/.../firma_jefe.png"
  }
}
```

---

## 🔧 Personalización

### Cambiar el TemplateID:
- **JavaScript**: Edita línea 10 de `crear_15tinas.js`
- **PowerShell**: Usa parámetro `-TemplateID 456`
- **Código React**: Cambia `templateID: 123`

### Cambiar la URL de la API:
- **JavaScript**: Edita línea 11 de `crear_15tinas.js`
- **PowerShell**: Usa parámetro `-ApiUrl "http://..."`
- **Código React**: Verifica `src/apiConfig.js`

### Agregar Autenticación (Token):
En el script JavaScript, descomenta la línea:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('fishcort_token')}` // 👈 Descomentar
}
```

En PowerShell:
```powershell
$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer TU_TOKEN_AQUI"
}

Invoke-RestMethod -Uri "$ApiUrl/FilledForms" -Method Post -Body $bodyJson -Headers $headers
```

---

## 📝 Datos de Ejemplo

El JSON incluye:
- ✅ 15 tinas (T1 a T15)
- ✅ Peso de ingreso y salida para cada tina
- ✅ Cálculo de merma en kg y porcentaje
- ✅ Temperatura de cada tina
- ✅ Observaciones
- ✅ 3 firmas (Operario, Supervisor, Jefe de Producción)
- ✅ Datos de encabezado (Fecha, Lote, Turno, Responsable)

### Merma Promedio: 8.29%

---

## 🐛 Troubleshooting

### Error: "Template not found"
- Verifica que el `templateID` existe en la base de datos
- Consulta la tabla `Templates` para ver los IDs disponibles

### Error: "Unauthorized"
- Agrega el token de autenticación en los headers
- Verifica que el token sea válido

### Error: "Invalid JSON"
- Verifica que los datos estén en formato correcto
- Usa `JSON.stringify()` para headerData, bodyData y firmasData

### Error: "Network error"
- Verifica que la URL de la API sea correcta
- Verifica que el servidor esté corriendo
- Chequea el firewall/CORS

---

## 📚 Referencias

- **API Endpoint**: `POST /api/FilledForms`
- **Función JS**: `createFilledForm()` en `src/utils/filledFormsUtils.js`
- **Formato esperado**: HeaderData, BodyData y FirmasData como strings JSON

---

## ✨ Próximos Pasos

Después de crear el formulario:
1. Ve a **"Ver Formularios Llenos"** en la app
2. Busca el formulario por fecha o lote
3. Verifica que las 15 tinas se muestren correctamente
4. Verifica que las firmas se vean (si usaste URLs reales de Cloudinary)
5. Descarga el PDF o Excel para verificar la exportación

---

**Última actualización**: 5 de febrero de 2026
