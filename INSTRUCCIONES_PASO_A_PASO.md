# 📝 INSTRUCCIONES PASO A PASO: Implementar Sistema de Firmas Mejorado

## 🎯 OBJETIVO

Implementar 3 mejoras:
1. ✅ Notificación por EMAIL cuando se necesite firmar
2. ✅ Eliminar canvas de dibujar - solo subir imagen
3. ✅ Firma permanente en Cloudinary

---

## ✅ PASO 1: Archivos ya creados

Los siguientes archivos ya fueron creados automáticamente:

- ✅ `src/components/MySignatureManager.jsx`
- ✅ `src/components/MySignatureManager.css`
- ✅ `CreateSignatureAlertsMethod_CON_EMAIL.cs` (referencia)

---

## 📧 PASO 2: Modificar Backend (Enviar Emails)

### **Archivo:** `SignaturesController.cs`

**Ubicación:** `C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs`

#### **2.1 Verificar que EmailService esté inyectado**

En el constructor del controlador, verificar:

```csharp
private readonly ApplicationDbContext _context;
private readonly ILogger<SignaturesController> _logger;
private readonly IEmailService _emailService;  // ✅ DEBE EXISTIR

public SignaturesController(
    ApplicationDbContext context,
    ILogger<SignaturesController> logger,
    IEmailService emailService)  // ✅ DEBE ESTAR INYECTADO
{
    _context = context;
    _logger = logger;
    _emailService = emailService;
}
```

**Si NO existe `_emailService`:**
- Agregar el campo privado
- Agregar el parámetro en el constructor
- Asignar en el constructor

#### **2.2 Reemplazar método `CreateSignatureAlertsForPendingSigners`**

**Buscar el método actual** (línea ~120-180 aprox):

```csharp
private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
{
    // ... código actual
}
```

**Reemplazar TODO EL MÉTODO** con el contenido de:
`CreateSignatureAlertsMethod_CON_EMAIL.cs`

**Cambios principales:**
- ✅ Extrae `targetName` además de `targetEmail`
- ✅ Después de crear la `Alert`, envía email con `_emailService.SendAlertEmailAsync()`
- ✅ Email con diseño HTML profesional
- ✅ Logs: `📧 EMAIL ENVIADO a {Email}`

#### **2.3 Guardar y compilar**

```bash
# En terminal PowerShell:
cd C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo
dotnet build

# Verificar que no haya errores
```

---

## 🖼️ PASO 3: Modificar Frontend (Eliminar Canvas)

### **Archivo:** `SignatureManagement.jsx`

**Ubicación:** `src/pages/SignatureManagement.jsx`

#### **3.1 Agregar import de MySignatureManager**

**Al inicio del archivo** (después de los otros imports):

```javascript
import MySignatureManager from '../components/MySignatureManager';
```

#### **3.2 Eliminar variables de estado del canvas**

**Buscar y ELIMINAR estas líneas** (aprox línea 18-26):

```javascript
// ❌ ELIMINAR:
const [signatureTab, setSignatureTab] = useState('upload');
const [isDrawing, setIsDrawing] = useState(false);

// Canvas refs
const canvasRef = useRef(null);
const contextRef = useRef(null);
```

#### **3.3 Eliminar funciones del canvas**

**Buscar y ELIMINAR todo el bloque** (aprox línea 171-240):

```javascript
// ❌ ELIMINAR TODO ESTE BLOQUE:

// === CANVAS DRAWING FUNCTIONS ===
useEffect(() => {
  if (showSignatureModal && signatureTab === 'draw' && canvasRef.current) {
    // ... código del canvas
  }
}, [showSignatureModal, signatureTab]);

const startDrawing = (e) => { /* ... */ };
const draw = (e) => { /* ... */ };
const stopDrawing = () => { /* ... */ };
const clearCanvas = () => { /* ... */ };
const saveDrawnSignature = () => { /* ... */ };
```

#### **3.4 Modificar función `openSignatureModal`**

**Buscar** (aprox línea 164-170):

```javascript
const openSignatureModal = (massive = false) => {
  if (massive && selectedForms.length === 0) {
    alert('Por favor selecciona al menos un formulario para firmar');
    return;
  }
  setIsMassive(massive);
  setSignatureTab('upload');  // ❌ ELIMINAR esta línea
  setSignatureImage('');
  setShowSignatureModal(true);
};
```

**Cambiar a:**

```javascript
const openSignatureModal = (massive = false) => {
  if (massive && selectedForms.length === 0) {
    alert('Por favor selecciona al menos un formulario para firmar');
    return;
  }
  setIsMassive(massive);
  setSignatureImage('');  // Solo resetear la imagen
  setShowSignatureModal(true);
};
```

#### **3.5 Modificar el JSX del modal**

**Buscar el modal de firma** (aprox línea 580-710):

**ANTES:**
```jsx
{showSignatureModal && (
  <div className="signature-modal-overlay">
    <div className="signature-modal">
      <h2>✍️ Firmar Formulario(s)</h2>
      
      {/* ❌ ELIMINAR las pestañas */}
      <div style={{ display: 'flex', marginBottom: '20px' }}>
        <button onClick={() => setSignatureTab('upload')}>
          📁 Subir Imagen
        </button>
        <button onClick={() => setSignatureTab('draw')}>
          ✏️ Dibujar Firma
        </button>
      </div>

      {/* ❌ ELIMINAR todo el canvas */}
      {signatureTab === 'upload' && (
        <input type="file" ... />
      )}
      
      {signatureTab === 'draw' && (
        <canvas ref={canvasRef} ... />
      )}
      
      {/* ... resto del modal */}
    </div>
  </div>
)}
```

**DESPUÉS:**
```jsx
{showSignatureModal && (
  <div className="signature-modal-overlay" onClick={() => setShowSignatureModal(false)}>
    <div className="signature-modal" onClick={(e) => e.stopPropagation()}>
      <h2>✍️ Firmar Formulario(s)</h2>
      
      {/* ✅ NUEVO: Componente de firma permanente */}
      <MySignatureManager 
        onSignatureSelected={(sig) => {
          setSignatureImage(sig.url);
          console.log('✅ Firma seleccionada:', sig.url);
        }}
        autoSelect={true}
      />
      
      {/* ✅ NUEVO: Sección simplificada de subir */}
      <div style={{
        marginTop: '20px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '10px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#2c3e50' }}>
          📤 O sube una imagen nueva (solo para este formulario)
        </h3>
        <input
          type="file"
          accept="image/png,image/jpeg,image/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => {
                setSignatureImage(reader.result);
                console.log('✅ Imagen cargada desde archivo');
              };
              reader.readAsDataURL(file);
            }
          }}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px dashed #cbd5e0',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        />
        <p style={{ color: '#6c757d', fontSize: '13px', margin: '10px 0 0 0' }}>
          💡 Tip: Sube tu firma permanente arriba para no tener que cargarla cada vez
        </p>
      </div>

      {/* Vista previa de la firma seleccionada */}
      {signatureImage && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#e7f3ff',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 10px 0', color: '#1976D2', fontWeight: 'bold' }}>
            ✅ Firma seleccionada:
          </p>
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '8px',
            border: '2px solid #2196F3'
          }}>
            <img 
              src={signatureImage} 
              alt="Firma seleccionada" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '150px',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      )}

      {/* Comentarios */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
          💬 Comentarios (opcional):
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Agrega un comentario sobre esta firma..."
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            resize: 'vertical',
            minHeight: '80px',
            fontFamily: 'Arial, sans-serif'
          }}
        />
      </div>

      {/* Botones de acción */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginTop: '24px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={() => setShowSignatureModal(false)}
          style={{
            padding: '12px 24px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#f5f5f5',
            color: '#333',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ❌ Cancelar
        </button>
        <button
          onClick={handleSign}
          disabled={!signatureImage}
          style={{
            padding: '12px 32px',
            border: 'none',
            borderRadius: '8px',
            background: signatureImage 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : '#ccc',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            cursor: signatureImage ? 'pointer' : 'not-allowed',
            boxShadow: signatureImage ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none'
          }}
        >
          ✍️ Guardar Firma
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 🧪 PASO 4: Probar la Implementación

### **Test 1: Verificar firma permanente**

```bash
# 1. Iniciar frontend
cd c:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron
npm run dev

# 2. Abrir navegador: http://localhost:5173/signatures
```

**Pasos:**
1. Iniciar sesión
2. Click en "Firmar" en cualquier formulario
3. **Verificar:** Aparece "🖊️ Mi Firma Digital Permanente"
4. **Verificar:** NO hay canvas de dibujar
5. **Verificar:** Solo hay "📤 Subir Mi Firma"
6. Subir una imagen PNG
7. **Verificar:** Mensaje "Subiendo a Cloudinary..."
8. **Verificar:** Alert "✅ Firma guardada exitosamente en Cloudinary"
9. **Verificar:** Firma aparece en vista previa
10. Click "✍️ Guardar Firma"
11. **Verificar:** Formulario se firma correctamente

### **Test 2: Verificar reutilización de firma**

1. Abrir `/signatures` nuevamente
2. Click en "Firmar" en OTRO formulario
3. **Verificar:** Firma guardada aparece automáticamente
4. **Verificar:** Muestra fecha y "☁️ Almacenada en: Cloudinary"
5. Click "✍️ Guardar Firma" (sin subir archivo nuevo)
6. **Verificar:** Se firma correctamente

### **Test 3: Verificar email de notificación**

```bash
# 1. Iniciar backend con logs
cd C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo
dotnet run
```

**Pasos:**
1. Usuario A crea formulario
2. Asigna Usuario B y Usuario C como firmantes
3. Usuario A firma
4. **Verificar en logs backend:**
   ```
   📋 Procesando alertas y emails para formulario 50
   🔍 Puesto Jefe Aseguramiento: Usuario asignado = Jose (jmontesdeoca@frigolab.com.ec)
   ⏳ Puesto pendiente de firma
   ✅ ALERTA CREADA para jmontesdeoca@frigolab.com.ec
   📧 EMAIL ENVIADO a jmontesdeoca@frigolab.com.ec (Jose)
   ```
5. **Verificar:** Usuario B recibe email en su bandeja
6. **Verificar:** Email tiene diseño correcto con botón "✍️ Ir a Firmar Ahora"

---

## ⚠️ TROUBLESHOOTING

### **Problema 1: No se suben imágenes a Cloudinary**

**Síntoma:** Error "Failed to upload to Cloudinary"

**Solución:**
1. Verificar `.env`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=tu_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset
   ```
2. Verificar `cloudinaryService.js`:
   ```javascript
   const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
   const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
   ```
3. Reiniciar frontend: `npm run dev`

### **Problema 2: No se envían emails**

**Síntoma:** Log muestra "❌ Error al enviar email"

**Solución:**
1. Verificar que `IEmailService` esté registrado en `Program.cs`:
   ```csharp
   builder.Services.AddScoped<IEmailService, EmailService>();
   ```
2. Verificar configuración SMTP en `appsettings.json`
3. Verificar logs para ver error específico

### **Problema 3: Canvas todavía aparece**

**Síntoma:** Aún se ve la opción "✏️ Dibujar Firma"

**Solución:**
1. Verificar que eliminaste todas las líneas del PASO 3
2. Guardar archivo `SignatureManagement.jsx`
3. Refrescar navegador con `Ctrl + R`
4. Si persiste, limpiar caché: `Ctrl + Shift + R`

---

## ✅ CHECKLIST FINAL

- [ ] `MySignatureManager.jsx` existe en `src/components/`
- [ ] `MySignatureManager.css` existe en `src/components/`
- [ ] `SignaturesController.cs` tiene `_emailService` inyectado
- [ ] Método `CreateSignatureAlertsForPendingSigners` actualizado con email
- [ ] `SignatureManagement.jsx` importa `MySignatureManager`
- [ ] Variables de canvas eliminadas de `SignatureManagement.jsx`
- [ ] Funciones de canvas eliminadas de `SignatureManagement.jsx`
- [ ] Modal actualizado sin pestañas ni canvas
- [ ] Backend compila sin errores: `dotnet build`
- [ ] Frontend inicia sin errores: `npm run dev`
- [ ] Test 1 pasado: Firma permanente funciona
- [ ] Test 2 pasado: Reutilización funciona
- [ ] Test 3 pasado: Emails se envían correctamente

---

**Fecha:** 17 de febrero de 2026  
**Tiempo estimado:** 30-45 minutos  
**Prioridad:** ALTA
