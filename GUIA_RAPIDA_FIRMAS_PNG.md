# 🚀 GUÍA RÁPIDA - USAR SISTEMA DE FIRMAS PNG

## ⚡ Inicio Rápido (5 minutos)

### 1️⃣ Configurar Cloudinary (SOLO UNA VEZ)

1. Ve a: https://cloudinary.com/console
2. **Settings** → **Upload** → **Add upload preset**
3. Configura:
   - **Name:** `firmas_preset`
   - **Mode:** ⚠️ **Unsigned** (IMPORTANTE)
   - **Folder:** `frigo-firmas`
   - **Formats:** `png`
4. **Save**

---

## 📤 Cómo Subir Firmas

### Opción A: Individual (Una firma)

1. Crea o edita un formulario
2. Ve a la sección **"✍️ Firmas y Aprobaciones"**
3. En cada firma:
   - Llena **Nombre** y **Fecha**
   - Haz clic en **"📤 Subir Firma (PNG)"**
   - Selecciona archivo PNG (máx 5MB)
   - Espera a que suba
   - Verás vista previa ✅

### Opción B: Masiva (Todas las firmas)

1. Prepara tus archivos PNG con nombres descriptivos:
   ```
   jefe_produccion.png
   jefe_calidad.png
   gerente.png
   supervisor.png
   ```

2. En la sección de firmas, clic en **"📦 Carga Masiva"**

3. Arrastra todos los archivos PNG a la zona de drop

4. El sistema AUTO-MAPEARÁ:
   - `jefe_produccion.png` → "Jefe de Producción"
   - `calidad.png` → "Jefe de Calidad"
   - etc.

5. Si alguno no se mapea, selecciónalo manualmente

6. Clic en **"Subir X Firmas"**

7. Espera la barra de progreso

8. ¡Listo! ✅

---

## ✏️ Cómo Editar Firmas

1. Abre un formulario existente en modo edición
2. Las firmas aparecerán con vista previa
3. Opciones:
   - **🔄 Reemplazar:** Subir nueva firma
   - **🗑️ Eliminar:** Quitar firma actual
   - **💾 Descargar:** Guardar PNG localmente
   - **🔍 Ver completo:** Modal con imagen grande

---

## 📄 Cómo Ver Firmas en PDF

1. Exporta el formulario a PDF
2. Las firmas aparecerán como **imágenes PNG incrustadas**
3. Texto bajo la imagen: "Firma Digital"

---

## 📊 Cómo Ver Firmas en Excel

1. Exporta el formulario a Excel
2. Las firmas aparecerán como **hipervínculos azules**: "🖼️ Ver Firma Digital"
3. Haz clic en el enlace para ver la imagen en el navegador

---

## 🔧 Requisitos de Archivos

| Requisito | Valor |
|----------|-------|
| **Formato** | PNG (obligatorio) |
| **Tamaño máximo** | 5MB |
| **Dimensiones** | Cualquiera (se ajusta automáticamente) |
| **Nombre de archivo** | Descriptivo para auto-mapeo (ej: `jefe_produccion.png`) |

---

## 🎨 Auto-Mapeo Inteligente

El sistema reconoce automáticamente estos patrones:

| Nombre de archivo | Se mapea a |
|------------------|-----------|
| `jefe*.png` | Jefe de Producción, Jefe de Calidad, etc. |
| `produccion*.png` | Jefe de Producción |
| `calidad*.png` | Jefe de Calidad |
| `gerente*.png` | Gerente General |
| `supervisor*.png` | Supervisor |
| `operador*.png` | Operador |
| `qa*.png` | Control de Calidad |
| `director*.png` | Director |

**Tip:** Usa nombres descriptivos para que el sistema los mapee solo. Si falla, siempre puedes mapear manualmente.

---

## ⚠️ Solución de Problemas

### "Upload preset not found"
→ No creaste el preset en Cloudinary. Ve al paso 1️⃣ arriba.

### "Only PNG files allowed"
→ Solo se permiten archivos PNG. Convierte tu imagen a PNG.

### "File too large"
→ Reduce el tamaño de la imagen a menos de 5MB.

### "CORS policy blocked"
→ El upload preset debe estar en modo **Unsigned**.

### No veo la firma en el PDF
→ Verifica que la firma se haya subido correctamente (debe aparecer vista previa en el formulario).

---

## 💡 Tips y Mejores Prácticas

### ✅ DO's
- Usa nombres descriptivos para archivos PNG
- Mantén el tamaño bajo 1MB si es posible
- Sube todas las firmas de una vez con carga masiva
- Verifica la vista previa antes de guardar

### ❌ DON'Ts
- No uses JPG, GIF, o BMP (solo PNG)
- No subas archivos muy pesados (>5MB)
- No uses nombres genéricos como `firma1.png`

---

## 🎯 Flujo de Trabajo Recomendado

1. **Preparación (Una vez):**
   - Digitaliza todas las firmas en PNG
   - Nómbralas descriptivamente
   - Organízalas en una carpeta

2. **Para cada formulario:**
   - Crea el formulario
   - Usa carga masiva para subir todas las firmas
   - Verifica que se mapearon correctamente
   - Llena el resto del formulario
   - Guarda

3. **Exportación:**
   - PDF: Firmas aparecen automáticamente
   - Excel: Clic en hipervínculo para ver

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa esta guía
2. Verifica la configuración de Cloudinary
3. Revisa `IMPLEMENTACION_FIRMAS_PNG_COMPLETA.md` para detalles técnicos

---

## 🚀 ¡Listo para Usar!

Ya puedes comenzar a usar el sistema de firmas PNG en tus formularios. ¡Disfruta! 🎉

---

**Versión:** 1.0.0  
**Última actualización:** 2024
