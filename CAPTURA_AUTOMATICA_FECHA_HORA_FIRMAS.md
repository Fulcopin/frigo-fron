# ⏰ Captura Automática de Fecha y Hora en Firmas

## 📋 Resumen

Sistema de captura automática de fecha y hora cuando un usuario sube o dibuja una firma digital. Los campos son editables por cualquier usuario para casos especiales o correcciones.

---

## 🎯 ¿Cómo Funciona?

### 1️⃣ **Captura Automática al Firmar**

Cuando un usuario **sube una imagen PNG** o **dibuja una firma**:

```javascript
// Se captura automáticamente:
const ahora = new Date();
const fechaActual = "2026-02-18";  // YYYY-MM-DD
const horaActual = "14:35";         // HH:MM
```

**Comportamiento:**
- ✅ Si el usuario **YA tenía** fecha/hora → Se respetan (no se sobrescriben)
- ✅ Si el usuario **NO tenía** fecha/hora → Se capturan automáticamente
- ✅ Los campos son **siempre editables** por cualquier usuario

---

## 🖼️ Interfaz de Usuario

### **Campos de Firma con Captura Automática**

```
┌─────────────────────────────────────────┐
│  SUPERVISOR GENERAL DE PRODUCCIÓN       │
├─────────────────────────────────────────┤
│  Nombre: [Juan Pérez              ]    │
│  Fecha: (Captura automática)            │
│         [18/02/2026            📅]      │
│  Hora: (Captura automática)             │
│        [14:35                  🕐]      │
│                                         │
│  Firma Digital:                         │
│  📤 Subir Imagen  ✍️ Dibujar Firma      │
└─────────────────────────────────────────┘
```

### **Indicadores Visuales**

- **Borde verde** en campos de fecha/hora → Indica captura automática
- **Fondo verde claro** → Campos con valor del sistema
- **Hint verde** "(Captura automática)" → Informa al usuario

---

## 🔧 Implementación Técnica

### **Código en `handleFirmaUpdate` (FillForm.jsx)**

```javascript
const handleFirmaUpdate = (puesto, firmaData) => {
  // Si se acaba de subir una firma, capturar fecha y hora
  let updatedFirmaData = { ...firmaData };
  
  if (firmaData.firma && !firmaData.fechaHoraCapturada) {
    const ahora = new Date();
    const fechaActual = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaActual = ahora.toTimeString().slice(0, 5);   // HH:MM
    
    updatedFirmaData = {
      ...firmaData,
      fecha: firmaData.fecha || fechaActual, // Solo si no existe
      hora: firmaData.hora || horaActual,     // Solo si no existe
      fechaHoraCapturada: true // Flag para evitar sobrescribir
    };
    
    console.log(`📅 Captura automática: ${fechaActual} ${horaActual}`);
  }
  
  setFirmasData(prev => ({...prev, [puesto]: updatedFirmaData}));
  setHasUnsavedChanges(true);
};
```

### **HTML con Campos Editables**

```jsx
<div className="form-field">
  <label>
    Fecha: <span className="auto-hint">(Captura automática)</span>
  </label>
  <input 
    type="date" 
    value={firmasData[firma.puesto]?.fecha || ""} 
    onChange={(e) => handleFirmaChange(firma.puesto, "fecha", e.target.value)}
    title="Fecha capturada automáticamente al firmar (editable)"
  />
</div>

<div className="form-field">
  <label>
    Hora: <span className="auto-hint">(Captura automática)</span>
  </label>
  <input 
    type="time" 
    value={firmasData[firma.puesto]?.hora || ""} 
    onChange={(e) => handleFirmaChange(firma.puesto, "hora", e.target.value)}
    title="Hora capturada automáticamente al firmar (editable)"
  />
</div>
```

---

## 📊 Casos de Uso

### **Caso 1: Usuario Firma por Primera Vez**

```
1. Usuario selecciona "Antonio Rodriguez"
2. Usuario sube firma PNG
   → Sistema captura: Fecha = 18/02/2026, Hora = 14:35
3. Campos se llenan automáticamente
4. Usuario puede editar si necesita
```

### **Caso 2: Usuario Edita Firma Existente**

```
1. Formulario ya tiene: Fecha = 15/02/2026, Hora = 09:00
2. Usuario reemplaza la firma
   → Sistema NO sobrescribe (respeta valores existentes)
3. Fecha y hora permanecen: 15/02/2026 09:00
```

### **Caso 3: Corrección Manual**

```
1. Sistema capturó: 18/02/2026 14:35
2. Usuario nota error (debió ser 18/02/2026 08:00)
3. Usuario edita manualmente el campo Hora → 08:00
4. Cambio guardado exitosamente
```

### **Caso 4: Auditoría o Corrección Administrativa**

```
1. Admin revisa formulario antiguo
2. Firma dice: 10/01/2026 pero debió ser 12/01/2026
3. Admin puede editar directamente los campos
4. Sistema guarda la corrección
```

---

## 🎨 Estilos CSS

### **Indicador Visual de Captura Automática**

```css
/* Hint verde para indicar captura automática */
.auto-hint {
  font-size: 10px;
  color: #10b981;
  font-style: italic;
  margin-left: 4px;
  font-weight: normal;
}

/* Campos con borde y fondo verde claro */
.signature-fields input[type="date"],
.signature-fields input[type="time"] {
  border-left: 3px solid #10b981;
  background-color: #f0fdf4;
}

/* Focus state */
.signature-fields input[type="date"]:focus,
.signature-fields input[type="time"]:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  background-color: white;
}
```

---

## ✅ Ventajas del Sistema

| Característica | Beneficio |
|----------------|-----------|
| **Captura automática** | Elimina errores humanos en fecha/hora |
| **Editable por todos** | Flexibilidad para correcciones |
| **No sobrescribe** | Respeta valores existentes |
| **Visual claro** | Indicadores verdes muestran origen automático |
| **Auditable** | Permite correcciones administrativas |

---

## 🔄 Flujo Completo de Datos

```
1. Usuario sube/dibuja firma
   ↓
2. handleFirmaUpdate detecta nueva firma
   ↓
3. Sistema verifica si ya hay fecha/hora
   ↓
4. Si NO existe → Captura del sistema
   Si SÍ existe → Respeta valores
   ↓
5. Actualiza firmasData con:
   - nombre
   - fecha (auto o existente)
   - hora (auto o existente)
   - firma (imagen)
   - fechaHoraCapturada: true
   ↓
6. Usuario puede editar campos si necesita
   ↓
7. Al guardar formulario → Se envía todo a backend
```

---

## 🧪 Pruebas de Funcionamiento

### **Test 1: Captura Automática**

```bash
1. Abrir formulario nuevo
2. Seleccionar puesto "Jefe de Cámara"
3. Escribir nombre "Pedro González"
4. Subir firma PNG
5. ✅ ESPERADO: Fecha y hora se llenan automáticamente
```

### **Test 2: Edición Manual**

```bash
1. Después de captura automática
2. Hacer clic en campo "Hora"
3. Cambiar de 14:35 a 08:00
4. Guardar formulario
5. ✅ ESPERADO: Se guarda 08:00 (valor editado)
```

### **Test 3: Respeto de Valores Existentes**

```bash
1. Formulario con fecha previa: 15/02/2026 10:00
2. Reemplazar firma con nueva imagen
3. ✅ ESPERADO: Fecha sigue siendo 15/02/2026 10:00
```

### **Test 4: Campos Vacíos**

```bash
1. Abrir formulario
2. NO subir firma
3. Campos fecha/hora están vacíos
4. Subir firma
5. ✅ ESPERADO: Fecha y hora se capturan al instante
```

---

## 📝 Ejemplo de Datos Guardados

### **Estructura JSON en Base de Datos**

```json
{
  "firmas": [
    {
      "puesto": "Supervisor General de Producción",
      "nombre": "Juan Pérez",
      "fecha": "2026-02-18",
      "hora": "14:35",
      "fechaHoraCapturada": true,
      "firma": {
        "url": "https://res.cloudinary.com/...",
        "provider": "cloudinary",
        "uploaded_at": "2026-02-18T14:35:22.000Z"
      }
    },
    {
      "puesto": "Jefe de Cámara",
      "nombre": "María García",
      "fecha": "2026-02-18",
      "hora": "14:40",
      "fechaHoraCapturada": true,
      "firma": {
        "base64": "data:image/png;base64,...",
        "provider": "base64"
      }
    }
  ]
}
```

---

## 🚀 Mejoras Futuras (Opcional)

### **Ideas para Evolucionar el Sistema**

1. **Timestamp completo con segundos**
   ```javascript
   horaActual = "14:35:22" // Incluir segundos
   ```

2. **Zona horaria del usuario**
   ```javascript
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   // "America/Guayaquil"
   ```

3. **Log de cambios**
   ```json
   "historialCambios": [
     {"fecha": "2026-02-18 14:35", "origen": "captura_automatica"},
     {"fecha": "2026-02-18 15:00", "usuario": "admin", "cambio": "correccion_manual"}
   ]
   ```

4. **Bloqueo después de guardar**
   ```javascript
   const bloqueado = formularioEnviado && !authService.isAdmin();
   ```

---

## 📞 Soporte

Si tienes dudas o necesitas ajustes:

1. **Cambiar formato de hora**: Modificar `slice(0, 5)` en `handleFirmaUpdate`
2. **Cambiar formato de fecha**: Modificar `split('T')[0]` 
3. **Bloquear edición**: Agregar `disabled={condicion}` a inputs

---

## 🎉 Resumen Ejecutivo

**¿Qué hace?**
- Captura fecha y hora del sistema cuando subes una firma

**¿Cuándo?**
- Al subir PNG o dibujar firma

**¿Se puede editar?**
- ✅ SÍ, todos los usuarios pueden editar si necesitan

**¿Sobrescribe valores?**
- ❌ NO, respeta fecha/hora existentes

**¿Cómo se ve?**
- Campos con borde verde + hint "(Captura automática)"
