# 🧪 PRUEBA: Captura Automática de Fecha y Hora

## ✅ Verificar que TODO Funciona

### **Paso 1: Abrir Consola del Navegador**
1. Presiona `F12` en tu navegador
2. Ve a la pestaña **Console**
3. Deja la consola abierta

---

### **Paso 2: Abrir Formulario Nuevo**
1. Ve a **"📝 Formularios por Fecha"**
2. Haz clic en **"+ Agregar Nueva Pestaña"**
3. Crea un formulario nuevo

---

### **Paso 3: Ir a Sección de Firmas**
1. Baja hasta **"✍️ Firmas y Aprobaciones"**
2. Verás 3 firmas (ejemplo):
   - Supervisor General de Producción
   - Jefe de Cámara
   - Obrero Producción

---

### **Paso 4: Subir una Firma**
1. Selecciona un puesto (ejemplo: "Obrero Producción")
2. Escribe un nombre (ejemplo: "Antonio Rodriguez")
3. **SUBE UNA IMAGEN PNG** (haz clic en "Subir Imagen")

---

### **Paso 5: VERIFICAR CAPTURA AUTOMÁTICA** ⏰

#### **En la Consola del Navegador deberías ver:**
```javascript
🔍 handleFirmaUpdate llamado: {
  puesto: "OBRERO PRODUCCIÓN",
  firmaData: {
    nombre: "Antonio Rodriguez",
    firma: {...}
  }
}

📊 Estado actual antes de actualizar: {
  nombre: "Antonio Rodriguez"
}

📅 ✅ CAPTURA AUTOMÁTICA para OBRERO PRODUCCIÓN: {
  fechaCapturada: "2026-02-18",
  horaCapturada: "15:45",  // ← HORA ACTUAL DEL SISTEMA
  fechaUsada: "2026-02-18",
  horaUsada: "15:45",
  yaExistia: false
}
```

#### **En la Pantalla deberías ver:**
```
┌─────────────────────────────────┐
│ OBRERO PRODUCCIÓN               │
├─────────────────────────────────┤
│ Nombre: Antonio Rodriguez       │
│                                 │
│ Fecha: (Captura automática)     │
│ [2026-02-18]  ← LLENO          │
│                                 │
│ Hora: (Captura automática)      │
│ [15:45]  ← LLENO               │
│                                 │
│ Firma Digital:                  │
│ [✅ Imagen Subida]              │
└─────────────────────────────────┘
```

---

### **Paso 6: PROBAR EDICIÓN** ✏️

#### **Editar Fecha:**
1. Haz clic en el campo **Fecha**
2. Debería abrirse el selector de fecha
3. Cambia la fecha (ejemplo: de 18/02/2026 → 15/02/2026)
4. ✅ **RESULTADO ESPERADO:** Se cambia correctamente

#### **Editar Hora:**
1. Haz clic en el campo **Hora**
2. Debería abrirse el selector de hora
3. Cambia la hora (ejemplo: de 15:45 → 08:30)
4. ✅ **RESULTADO ESPERADO:** Se cambia correctamente

---

### **Paso 7: Guardar y Verificar**
1. Haz clic en **"💾 Guardar Todo"**
2. Recarga la página
3. Abre el mismo formulario
4. ✅ **RESULTADO ESPERADO:** Fecha y hora editadas se guardaron

---

## 🐛 SOLUCIÓN SI NO FUNCIONA

### **Problema 1: Campos de Fecha/Hora NO se llenan automáticamente**

**Verificar en Consola:**
```javascript
// Busca este log:
📅 ✅ CAPTURA AUTOMÁTICA para...
```

**Si NO aparece el log:**
- La función `handleFirmaUpdate` no se está ejecutando
- Verifica que el componente `SignatureUploader` esté llamando a `onFirmaChange`

**Solución:**
1. Abre `src/components/SignatureUploader.jsx`
2. Busca la línea que dice `onFirmaChange({`
3. Debe estar pasando `firma: firmaInfo`

---

### **Problema 2: Campos NO se pueden editar**

**Verificar en Consola del Navegador:**
```javascript
// Pega esto en la consola:
document.querySelector('input[type="date"]').disabled
document.querySelector('input[type="time"]').disabled
```

**Si devuelve `true`:**
- Los campos están deshabilitados
- Revisar el código HTML en FillForm.jsx

**Si devuelve `false`:**
- Los campos NO están deshabilitados
- El problema es de CSS o evento

**Solución CSS:**
```css
/* Agregar en FillForm.css: */
.signature-fields input[type="date"],
.signature-fields input[type="time"] {
  pointer-events: auto !important;
  cursor: text !important;
}
```

---

### **Problema 3: Los campos están vacíos en formularios antiguos**

**Explicación:**
- Los formularios creados ANTES de esta actualización NO tienen `hora`
- Solo tienen `fecha`

**Solución:**
- Los formularios nuevos SÍ tendrán fecha y hora
- Para formularios antiguos, puedes editarlos manualmente

---

## 📊 TABLA DE VERIFICACIÓN

| # | Prueba | ✅ Funciona | ❌ Falla |
|---|--------|-------------|----------|
| 1 | Consola muestra log de captura | [ ] | [ ] |
| 2 | Campo Fecha se llena automáticamente | [ ] | [ ] |
| 3 | Campo Hora se llena automáticamente | [ ] | [ ] |
| 4 | Puedo hacer clic en campo Fecha | [ ] | [ ] |
| 5 | Puedo cambiar la Fecha | [ ] | [ ] |
| 6 | Puedo hacer clic en campo Hora | [ ] | [ ] |
| 7 | Puedo cambiar la Hora | [ ] | [ ] |
| 8 | Los cambios se guardan correctamente | [ ] | [ ] |

---

## 🔍 COMANDOS DE DEPURACIÓN

### **Ver estado actual de firmasData en consola:**
```javascript
// En la consola del navegador (mientras estás en el formulario):
// Esto solo funciona si tienes React DevTools instalado
```

### **Ver si los inputs están deshabilitados:**
```javascript
document.querySelectorAll('.signature-fields input').forEach(input => {
  console.log(input.type, input.disabled, input.value);
});
```

### **Forzar un valor para probar:**
```javascript
document.querySelector('input[type="date"]').value = '2026-02-18';
document.querySelector('input[type="time"]').value = '15:45';
```

---

## ✅ RESULTADO ESPERADO FINAL

### **Al subir una firma:**
✅ Fecha se llena con: `2026-02-18` (hoy)
✅ Hora se llena con: `15:45` (hora actual del sistema)
✅ Puedo editar ambos campos si necesito
✅ Al guardar, se guardan los valores correctos
✅ Al recargar, los valores persisten

---

## 📞 SI SIGUE SIN FUNCIONAR

**Revisar estos archivos:**
1. `src/pages/FillForm.jsx` línea ~2660 (handleFirmaUpdate)
2. `src/components/SignatureUploader.jsx` línea ~273 (onFirmaChange)
3. `src/pages/FillForm.css` línea ~920 (estilos de campos)

**Logs clave a buscar:**
- `🔍 handleFirmaUpdate llamado:`
- `📊 Estado actual antes de actualizar:`
- `📅 ✅ CAPTURA AUTOMÁTICA para...`

Si ves estos 3 logs, la captura está funcionando.
Si no ves los logs, el problema está en el flujo de datos.
