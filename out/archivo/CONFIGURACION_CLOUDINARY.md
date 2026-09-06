# ☁️ Configuración de Cloudinary para Firmas PNG

## 🎯 Paso 1: Crear Cuenta Gratuita (2 minutos)

### 1.1. Registrarse

1. Ve a: https://cloudinary.com/users/register_free
2. Completa el formulario:
   - **Email:** tu_email@empresa.com
   - **Password:** (elige una contraseña segura)
   - **Cloud Name:** frigo-forms (o el nombre que prefieras)
3. Acepta términos y condiciones
4. Click en **"Create Account"**

### 1.2. Verificar Email

1. Revisa tu bandeja de entrada
2. Click en el link de verificación
3. ✅ Cuenta activada

---

## 🔑 Paso 2: Obtener Credenciales (1 minuto)

### 2.1. Acceder al Dashboard

1. Inicia sesión en: https://cloudinary.com/console
2. En la página principal verás:

```
┌─────────────────────────────────────────────┐
│  Cloud Name:   frigo-forms                  │
│  API Key:      123456789012345              │
│  API Secret:   abc...xyz (⚠️ PRIVADO)       │
└─────────────────────────────────────────────┘
```

### 2.2. Copiar Cloud Name

**SOLO necesitas el Cloud Name para el frontend**

```javascript
// ✅ CORRECTO: Solo Cloud Name
cloudinaryCloudName: "frigo-forms"

// ❌ INCORRECTO: NO necesitas API Secret en el frontend
// (solo se usa en backend)
```

---

## ⚙️ Paso 3: Crear Upload Preset (3 minutos)

### 3.1. Acceder a Settings

1. En el dashboard, click en el ícono de **⚙️ Settings** (esquina superior derecha)
2. En el menú lateral, click en **"Upload"**
3. Scroll hasta encontrar **"Upload presets"**

### 3.2. Crear Nuevo Preset

1. Click en **"Add upload preset"**
2. Configurar:

```yaml
┌─────────────────────────────────────────────────────────────┐
│ Preset name:         firmas_preset                          │
│                                                              │
│ Signing mode:        ⭕ Unsigned (Frontend uploads)         │
│                      ⚠️ IMPORTANTE: Debe ser "Unsigned"     │
│                                                              │
│ Folder:              frigo-firmas                           │
│                      (todas las firmas se guardan aquí)     │
│                                                              │
│ Unique filename:     ✅ Yes                                 │
│                      (evita sobrescribir archivos)          │
│                                                              │
│ Overwrite:           ❌ No                                  │
│                                                              │
│ Allowed formats:     png                                    │
│                      (solo PNG permitido)                   │
│                                                              │
│ Max file size:       5 MB                                   │
│                                                              │
│ Quality:             auto:best                              │
│                      (optimización automática)              │
│                                                              │
│ Format:              auto                                   │
│                      (convierte a WebP si el navegador      │
│                       lo soporta, fallback a PNG)           │
└─────────────────────────────────────────────────────────────┘
```

### 3.3. Configurar Transformaciones Eager (Opcional pero Recomendado)

Genera versiones optimizadas automáticamente al subir:

```yaml
┌─────────────────────────────────────────────────────────────┐
│ Eager transformations:                                       │
│                                                              │
│ 1. Thumbnail (para lista):                                  │
│    w_300,h_150,c_fit,q_auto,f_auto                         │
│                                                              │
│ 2. Preview (para modal):                                    │
│    w_800,h_400,c_fit,q_auto,f_auto                         │
│                                                              │
│ 3. Full size optimizado:                                    │
│    q_auto:best,f_auto                                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.4. Guardar

1. Click en **"Save"**
2. ✅ Upload preset creado exitosamente

---

## 📝 Paso 4: Configurar en el Proyecto

### 4.1. Crear archivo de configuración

Crea el archivo `src/config/cloudinary.config.js`:

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// ☁️ Configuración de Cloudinary
// ═══════════════════════════════════════════════════════════════════════════

export const CLOUDINARY_CONFIG = {
  // 🔑 Cloud Name (PÚBLICO - se puede compartir)
  cloudName: "frigo-forms", // ⬅️ CAMBIAR POR TU CLOUD NAME
  
  // 📤 Upload Preset (PÚBLICO)
  uploadPreset: "firmas_preset", // ⬅️ CAMBIAR POR TU PRESET NAME
  
  // 📁 Carpeta donde se guardan las firmas
  folder: "frigo-firmas",
  
  // ⚙️ Opciones de configuración
  options: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['png'],
    quality: 'auto:best',
    format: 'auto'
  },
  
  // 🎨 Transformaciones predefinidas
  transformations: {
    thumbnail: "w_300,h_150,c_fit,q_auto,f_auto",
    preview: "w_800,h_400,c_fit,q_auto,f_auto",
    full: "q_auto:best,f_auto"
  }
};

// 🛠️ Helper para construir URLs con transformaciones
export const buildCloudinaryUrl = (publicId, transformation = 'full') => {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  const transform = CLOUDINARY_CONFIG.transformations[transformation];
  return `${baseUrl}/${transform}/${publicId}`;
};

// ✅ Validar si Cloudinary está configurado
export const isCloudinaryConfigured = () => {
  return !!(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);
};
```

### 4.2. Actualizar FillForm.jsx

Importar configuración:

```javascript
import { CLOUDINARY_CONFIG, isCloudinaryConfigured } from '../config/cloudinary.config';
```

Usar en componentes:

```javascript
<SignatureUploader
  puesto={firma.puesto}
  firmaData={firmasData[firma.puesto]}
  onFirmaChange={(data) => handleFirmaChange(firma.puesto, data)}
  cloudinaryCloudName={CLOUDINARY_CONFIG.cloudName}
  cloudinaryUploadPreset={CLOUDINARY_CONFIG.uploadPreset}
/>
```

---

## 🧪 Paso 5: Probar la Configuración (2 minutos)

### 5.1. Test Manual Rápido

1. Abre Postman o usa curl:

```bash
curl -X POST \
  https://api.cloudinary.com/v1_1/frigo-forms/image/upload \
  -F "file=@firma_test.png" \
  -F "upload_preset=firmas_preset"
```

2. Respuesta esperada (200 OK):

```json
{
  "public_id": "frigo-firmas/abc123",
  "version": 1706621234,
  "signature": "...",
  "width": 800,
  "height": 400,
  "format": "png",
  "resource_type": "image",
  "created_at": "2026-01-30T10:30:34Z",
  "bytes": 125432,
  "type": "upload",
  "url": "http://res.cloudinary.com/frigo-forms/image/upload/v1706621234/frigo-firmas/abc123.png",
  "secure_url": "https://res.cloudinary.com/frigo-forms/image/upload/v1706621234/frigo-firmas/abc123.png"
}
```

### 5.2. Test en la Aplicación

1. Ejecuta el frontend: `npm run dev`
2. Abre un formulario
3. Ve a la sección de firmas
4. Click en "📤 Subir PNG"
5. Selecciona un archivo PNG
6. Verifica en consola:

```
📤 Subiendo a Cloudinary: firma_jefe.png
✅ Imagen subida a Cloudinary: https://res.cloudinary.com/...
🎉 Firma cargada exitosamente para: Jefe de Producción
```

7. Verifica en Cloudinary Dashboard → Media Library:
   - Debe aparecer en la carpeta `frigo-firmas`
   - Con las transformaciones eager generadas

---

## 🔒 Seguridad y Buenas Prácticas

### ✅ DO (Hacer):

1. **Usar Upload Preset "Unsigned"** para frontend directo
2. **Configurar folder** para organizar archivos
3. **Limitar formatos** (solo PNG)
4. **Establecer max file size** (5MB)
5. **Usar transformaciones eager** para performance
6. **Validar archivos en frontend** antes de subir

### ❌ DON'T (No Hacer):

1. **NO exponer API Secret** en el frontend (solo se usa en backend)
2. **NO usar preset "Signed"** sin backend (requiere firma de API)
3. **NO permitir formatos no validados** (solo PNG)
4. **NO olvidar validar tamaño** de archivo

---

## 📊 Monitoreo y Límites del Plan Gratuito

### Plan Free de Cloudinary:

| Recurso | Límite Mensual | Uso Típico |
|---------|----------------|------------|
| **Almacenamiento** | 25 GB | ~50,000 firmas PNG (500KB c/u) |
| **Bandwidth** | 25 GB | ~50,000 descargas |
| **Transformaciones** | 25 créditos | ~25,000 transformaciones |
| **Requests** | Ilimitadas | ✅ Sin límite |

### Ver Uso Actual:

1. Dashboard → **Reports**
2. Click en **"Usage"**
3. Gráficos de:
   - Storage usado
   - Bandwidth consumido
   - Transformaciones realizadas

### Si excedes límites:

1. **Opción 1:** Upgrade a plan de pago ($89/mes)
2. **Opción 2:** Implementar Base64 como fallback
3. **Opción 3:** Configurar CDN propio

---

## 🚀 URLs de Transformación On-the-Fly

### Estructura de URL:

```
https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}
```

### Ejemplos:

```javascript
// Original (sin transformación)
https://res.cloudinary.com/frigo-forms/image/upload/frigo-firmas/firma_jefe.png

// Thumbnail 300x150
https://res.cloudinary.com/frigo-forms/image/upload/w_300,h_150,c_fit/frigo-firmas/firma_jefe.png

// Preview 800x400
https://res.cloudinary.com/frigo-forms/image/upload/w_800,h_400,c_fit/frigo-firmas/firma_jefe.png

// Escala de grises (para PDF B&W)
https://res.cloudinary.com/frigo-forms/image/upload/e_grayscale/frigo-firmas/firma_jefe.png

// Formato optimizado automático (WebP si el navegador lo soporta)
https://res.cloudinary.com/frigo-forms/image/upload/f_auto,q_auto/frigo-firmas/firma_jefe.png

// Combinación múltiple
https://res.cloudinary.com/frigo-forms/image/upload/w_500,h_250,c_fit,f_auto,q_auto:best/frigo-firmas/firma_jefe.png
```

---

## 🛠️ Troubleshooting

### Error: "Upload preset not found"

**Causa:** El preset no existe o tiene un nombre diferente

**Solución:**
1. Verifica en Dashboard → Settings → Upload → Upload presets
2. Copia el nombre exacto del preset
3. Actualiza `uploadPreset` en la configuración

---

### Error: "Unsigned upload not allowed"

**Causa:** El preset está configurado como "Signed" en vez de "Unsigned"

**Solución:**
1. Dashboard → Settings → Upload → Upload presets
2. Edit preset → Signing mode: **Unsigned**
3. Save

---

### Error: "Invalid file format"

**Causa:** El archivo no es PNG o el preset no permite PNG

**Solución:**
1. Validar extensión del archivo: `.png`
2. Verificar en preset: Allowed formats incluye `png`

---

### Error: "File size too large"

**Causa:** El archivo excede 5MB

**Solución:**
1. Comprimir imagen antes de subir
2. Usar herramientas como TinyPNG o Squoosh
3. Ajustar `Max file size` en preset si es necesario

---

### Imágenes se cargan lento

**Causa:** No se están usando transformaciones optimizadas

**Solución:**
1. Usar `f_auto,q_auto` en URLs
2. Configurar eager transformations en preset
3. Usar thumbnails para listas, full size solo en modales

---

## ✅ Checklist de Configuración

- [ ] Cuenta de Cloudinary creada
- [ ] Email verificado
- [ ] Cloud Name copiado
- [ ] Upload Preset "firmas_preset" creado con:
  - [ ] Signing mode: Unsigned
  - [ ] Folder: frigo-firmas
  - [ ] Allowed formats: png
  - [ ] Max file size: 5MB
  - [ ] Eager transformations configuradas
- [ ] Archivo `cloudinary.config.js` creado
- [ ] Cloud Name y Upload Preset actualizados en config
- [ ] Test manual ejecutado con éxito
- [ ] Test en aplicación funciona correctamente
- [ ] Imagen visible en Media Library de Cloudinary

---

## 🎉 ¡Listo para Producción!

Una vez completados todos los pasos del checklist, tu sistema de carga de firmas PNG estará completamente funcional y profesional.

**Próximos pasos:**
1. Integrar componentes en FillForm.jsx
2. Probar carga individual
3. Probar carga masiva
4. Validar persistencia en base de datos
5. Exportar PDF con firmas incluidas

---

## 📞 Soporte

- **Documentación oficial:** https://cloudinary.com/documentation
- **API Reference:** https://cloudinary.com/documentation/image_upload_api_reference
- **Support:** https://support.cloudinary.com/

**Dashboard:** https://cloudinary.com/console
**Media Library:** https://cloudinary.com/console/media_library
