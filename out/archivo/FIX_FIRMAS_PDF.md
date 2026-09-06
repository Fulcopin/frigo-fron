# 🔧 Corrección: Firmas no se muestran en PDF

## ❌ Problema Identificado

Al generar el PDF, las firmas (especialmente las dibujadas) **no se muestran** en la sección "FIRMAS Y APROBACIONES".

**Causa raíz:**
El código solo buscaba `data.firma.url`, pero las firmas dibujadas a veces solo tienen `data.firma.base64`.

---

## ✅ Solución Implementada

### Archivo: `src/services/pdfExportService.js`

**Antes (línea ~387):**
```javascript
// Solo buscaba URL
if (data.firma && data.firma.url) {
  firmaImg = data.firma.url;
}
```

**Después (línea ~387):**
```javascript
// Busca URL O Base64
if (data.firma) {
  // Prioridad: url > base64
  firmaImg = data.firma.url || data.firma.base64 || null;
  
  console.log('🔍 Datos de firma en PDF:', {
    puesto,
    tieneFirma: !!firmaImg,
    provider: data.firma.provider,
    urlLength: data.firma.url ? data.firma.url.length : 0,
    base64Length: data.firma.base64 ? data.firma.base64.length : 0
  });
}
```

---

## 🔍 Debugging Agregado

Ahora en la consola del navegador verás información detallada al generar PDF:

```
🔍 Datos de firma en PDF: {
  puesto: "OBRERO PRODUCCIÓN",
  tieneFirma: true,
  provider: "base64-drawn",
  urlLength: 0,
  base64Length: 12847
}
```

Esto te permite verificar:
- ✅ Si la firma se está detectando
- ✅ Qué proveedor se usó (cloudinary, base64, base64-drawn)
- ✅ Si hay datos de URL o Base64

---

## 📊 Casos de Uso

### Caso 1: Firma Subida a Cloudinary
```javascript
data.firma = {
  url: "https://res.cloudinary.com/.../firma.png",
  provider: "cloudinary"
}
```
**Resultado:** ✅ Se usa `url` para el PDF

### Caso 2: Firma Subida como Base64
```javascript
data.firma = {
  base64: "data:image/png;base64,...",
  url: "data:image/png;base64,...",
  provider: "base64"
}
```
**Resultado:** ✅ Se usa `url` (o `base64` si no hay url)

### Caso 3: Firma Dibujada
```javascript
data.firma = {
  base64: "data:image/png;base64,...",
  url: "data:image/png;base64,...",
  provider: "base64-drawn"
}
```
**Resultado:** ✅ Se usa `url` o `base64` (ambos son iguales en este caso)

---

## 🧪 Cómo Verificar la Corrección

### Paso 1: Crear Formulario con Firma Dibujada
1. Abre un formulario en FillForm
2. Completa Nombre y Fecha
3. Haz clic en tab "✍️ Dibujar Firma"
4. Dibuja tu firma
5. Guarda el formulario

### Paso 2: Verificar en ViewForms
1. Abre ViewForms
2. Selecciona el formulario guardado
3. Verifica que se vea:
   - [x] Imagen de firma
   - [x] Nombre
   - [x] Fecha

### Paso 3: Generar PDF
1. Haz clic en botón "📄 PDF"
2. Abre la consola del navegador (F12)
3. Busca mensajes: `🔍 Datos de firma en PDF:`
4. Verifica que `tieneFirma: true`
5. Revisa el PDF generado

### Paso 4: Verificar PDF
Abre el PDF y verifica:
- [x] Sección "FIRMAS Y APROBACIONES" existe
- [x] Puesto en mayúsculas y negrita
- [x] Nombre del firmante
- [x] Fecha de firma
- [x] **Imagen de firma visible** ← PRINCIPAL
- [x] Texto "Firma Digital" bajo la imagen

---

## 🎯 Estructura Correcta de Datos

Para que funcione correctamente, la estructura debe ser:

```javascript
firmasData = {
  "OBRERO PRODUCCIÓN": {
    nombre: "fulo",
    fecha: "2026-02-24",
    firma: {
      url: "data:image/png;base64,iVBORw0KGgoAAAA...",  // ← Requerido
      base64: "data:image/png;base64,iVBORw0KGgoAAAA...", // ← Alternativa
      provider: "base64-drawn",
      uploaded_at: "2026-02-05T..."
    }
  }
}
```

**Importante:** Al menos uno debe existir: `url` O `base64`

---

## 🐛 Posibles Problemas y Soluciones

### Problema 1: Firma sigue sin aparecer
**Causa:** Datos de firma vacíos o malformados
**Solución:** 
1. Revisa consola del navegador
2. Busca error: "Error al agregar imagen de firma"
3. Verifica estructura de `firmasData`

### Problema 2: Error "Failed to add image"
**Causa:** Base64 inválido o corrupto
**Solución:**
1. Vuelve a dibujar/subir la firma
2. Guarda de nuevo el formulario
3. Genera PDF nuevamente

### Problema 3: Solo se ve línea, no imagen
**Causa:** El código cayó en el `catch` del error
**Solución:**
1. Revisa consola para ver el error específico
2. Verifica que el Base64 comience con `data:image/png;base64,`
3. Prueba subir la firma como archivo PNG en vez de dibujar

---

## 📝 Código Completo de Renderizado

```javascript
// 🆕 Renderizar firma PNG si existe
if (firmaImg) {
  try {
    // Dimensiones de la imagen de firma
    const firmaImgWidth = anchoColumna - 8;
    const firmaImgHeight = 20;
    
    // Añadir imagen de firma (Base64 o URL)
    doc.addImage(firmaImg, 'PNG', xPos, localY, firmaImgWidth, firmaImgHeight);
    localY += firmaImgHeight + 2;
    
    // Texto "Firma Digital" centrado bajo la imagen
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const firmaTextWidth = doc.getTextWidth('Firma Digital');
    doc.text('Firma Digital', xPos + (firmaImgWidth - firmaTextWidth) / 2, localY + 3.5);
    doc.setTextColor(...COLORS.text);
    localY += 5;
  } catch (error) {
    console.error('❌ Error al agregar imagen de firma:', error);
    // Fallback: línea tradicional
    doc.line(xPos, localY, xPos + (anchoColumna - 8), localY);
    doc.text('Firma', xPos, localY + 3.5);
  }
} else {
  // Sin imagen: línea tradicional
  doc.line(xPos, localY, xPos + (anchoColumna - 8), localY);
  doc.text('Firma', xPos, localY + 3.5);
}
```

---

## ✅ Resultado Esperado en PDF

```
╔═══════════════════════════════════════════╗
║  FIRMAS Y APROBACIONES                    ║
╠═══════════════════════════════════════════╣
║                                           ║
║  OBRERO PRODUCCIÓN:          SUPERVISOR..║
║  fulo                        cere         ║
║  2026-02-24                  2026-02-18   ║
║                                           ║
║  ┌─────────────────────┐   ┌───────────┐ ║
║  │ [Firma dibujada]    │   │ [Firma]   │ ║
║  └─────────────────────┘   └───────────┘ ║
║    Firma Digital            Firma Digital ║
║                                           ║
║                                           ║
║  JEFE DE CÁMARA:                          ║
║  poli                                     ║
║  2026-02-27                               ║
║                                           ║
║  ┌─────────────────────┐                 ║
║  │ [Firma dibujada]    │                 ║
║  └─────────────────────┘                 ║
║    Firma Digital                          ║
║                                           ║
╚═══════════════════════════════════════════╝
```

---

## 🎉 Estado: CORREGIDO

- ✅ Detecta firmas con `url`
- ✅ Detecta firmas con `base64`
- ✅ Funciona con firmas subidas
- ✅ Funciona con firmas dibujadas
- ✅ Muestra nombre y fecha
- ✅ Muestra imagen de firma
- ✅ Fallback si hay error
- ✅ Logs de debugging

---

**Fecha:** 05 de Febrero, 2026  
**Archivo:** `pdfExportService.js`  
**Estado:** ✅ CORREGIDO Y FUNCIONAL
