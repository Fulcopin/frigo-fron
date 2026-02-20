# ⚡ GUÍA RÁPIDA - INICIO INMEDIATO

## 🚀 PARA EMPEZAR AHORA MISMO

### 1️⃣ **Verificar que el Frontend Está Listo**

```bash
# Entrar al directorio del proyecto
cd c:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron

# Iniciar el servidor de desarrollo
npm run dev
# o
yarn dev
```

Deberías ver:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### 2️⃣ **Probar los Nuevos Módulos**

Abre tu navegador y ve a:

#### **✍️ FIRMAS:**
```
http://localhost:5173/signatures
```

**Lo que verás:**
- 📊 Dashboard con estadísticas (pendientes, firmados, etc.)
- 📋 Lista de formularios pendientes de firma
- 🔍 Filtros por área, plantilla, búsqueda
- ✍️ Botón para firmar individual o masivo

#### **🔔 ALERTAS:**
```
http://localhost:5173/alerts
```

**Lo que verás:**
- 🔔 Alertas activas
- ⚙️ Panel de configuración
- 📜 Historial de alertas
- 🧪 Opción para enviar email de prueba

#### **📊 CONSUMOS:**
```
http://localhost:5173/consumptions
```

**Lo que verás:**
- 📊 Dashboard de estadísticas
- 📦 Vista consolidada de consumos
- 📈 Opciones de comparación
- 📥 Botón para exportar a Excel

---

### 3️⃣ **Acceso Según Roles**

**Usuario Normal:**
- ✅ Puede ver y firmar documentos
- ❌ No puede acceder a Alertas ni Consumos

**Admin/Supervisor:**
- ✅ Acceso completo a todos los módulos
- ✅ Puede configurar alertas
- ✅ Puede ver consumos consolidados

---

## 🔧 BACKEND - PASOS RÁPIDOS

### **Paso 1: Crear los Controladores**

En tu proyecto backend, crear 3 archivos nuevos:

```
Backend/Controllers/
├── SignaturesController.cs
├── AlertsController.cs
└── ConsumptionsController.cs
```

### **Paso 2: Copiar el Código Base**

Abre el archivo:
```
BACKEND_SPECS_FIRMAS_ALERTAS_CONSUMOS.md
```

Ese archivo tiene TODO el código que necesitas:
- ✅ Modelos de datos
- ✅ Endpoints completos
- ✅ Ejemplos de código
- ✅ Configuración de Gmail

### **Paso 3: Configurar Gmail**

1. **Obtener App Password:**
   - Ir a: https://myaccount.google.com/security
   - Activar: "Verificación en 2 pasos"
   - Ir a: "Contraseñas de aplicaciones"
   - Crear password para "Correo"
   - Copiar el código de 16 caracteres

2. **Configurar en appsettings.json:**
```json
{
  "GmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": 587,
    "EnableSsl": true,
    "SenderEmail": "tu-correo@gmail.com",
    "SenderPassword": "xxxx xxxx xxxx xxxx"
  }
}
```

### **Paso 4: Instalar Paquetes**

```bash
dotnet add package EPPlus
```

### **Paso 5: Crear Migraciones**

```bash
dotnet ef migrations add AddSignaturesAlertsConsumptions
dotnet ef database update
```

### **Paso 6: Iniciar Backend**

```bash
dotnet run
```

---

## 📧 PROBAR ALERTAS DE EMAIL

### **Endpoint de Prueba:**

```http
POST http://localhost:5074/api/Alerts/test
Content-Type: application/json

{
  "email": "tu-email-de-prueba@gmail.com"
}
```

Si todo está bien configurado, recibirás un email de prueba.

---

## 🧪 EJEMPLOS POSTMAN

### **1. Obtener Formularios Pendientes de Firma:**

```http
GET http://localhost:5074/api/Signatures/pending
```

**Respuesta esperada:**
```json
[
  {
    "id": 123,
    "templateName": "Control de Temperatura",
    "formCode": "TEMP-2026-001",
    "createdBy": "operador@frigolab.com",
    "createdDate": "2026-02-11T08:00:00Z",
    "isSigned": false
  }
]
```

---

### **2. Firmar un Formulario:**

```http
POST http://localhost:5074/api/Signatures/sign/123
Content-Type: application/json

{
  "formId": 123,
  "signatureImage": "data:image/png;base64,iVBORw0KGgo...",
  "signedBy": "supervisor@frigolab.com",
  "signedDate": "2026-02-11T10:30:00Z",
  "comments": "Revisado y aprobado"
}
```

---

### **3. Obtener Consumos Consolidados:**

```http
GET http://localhost:5074/api/Consumptions/consolidated?startDate=2026-01-01&endDate=2026-02-11&groupBy=product
```

**Respuesta esperada:**
```json
[
  {
    "productName": "Sal",
    "totalQuantity": 450.75,
    "unit": "kg",
    "formCount": 28,
    "areas": ["Producción", "Empaque"]
  }
]
```

---

## 🎨 CAPTURAS DE PANTALLA (Esperadas)

### **Dashboard de Firmas:**
```
┌─────────────────────────────────────────────────────┐
│  ✍️ Gestión de Firmas                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   📝     │  │   ✅     │  │   📊     │         │
│  │   15     │  │    8     │  │   342    │         │
│  │Pendientes│  │Hoy       │  │Total     │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                      │
│  🔍 [Buscar...] [Área▼] [Plantilla▼]               │
│                                                      │
│  ┌────────────────────────────────────────┐        │
│  │ ☐ Control de Temperatura               │        │
│  │   📅 11/02/2026  👤 operador@...       │        │
│  │   [✍️ Firmar] [👁️ Ver]                │        │
│  └────────────────────────────────────────┘        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### **Dashboard de Alertas:**
```
┌─────────────────────────────────────────────────────┐
│  🔔 Gestión de Alertas                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [🔔 Activas] [⚙️ Configuración] [📜 Historial]    │
│                                                      │
│  ┌────────────────────────────────────────┐        │
│  │ 🔴 ALTA - Formulario No Llenado        │        │
│  │ El registro de temperatura del         │        │
│  │ 11/02 no ha sido completado            │        │
│  │ [👁️ Ver] [✅ Marcar Leída]            │        │
│  └────────────────────────────────────────┘        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### **Dashboard de Consumos:**
```
┌─────────────────────────────────────────────────────┐
│  📊 Consumos de Suministros                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📅 [2026-01-01] → [2026-02-11]  🔍 [Aplicar]      │
│                                                      │
│  ┌─────────────────────────────────────────┐       │
│  │ Producto    │ Cantidad │ Unidad │ Usos  │       │
│  ├─────────────────────────────────────────┤       │
│  │ Sal         │  450.75  │  kg    │  28   │       │
│  │ Hielo       │ 1250.50  │  kg    │  45   │       │
│  │ Cloro       │   85.30  │  L     │  12   │       │
│  └─────────────────────────────────────────┘       │
│                                                      │
│  [📥 Exportar a Excel]                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🐛 PROBLEMAS COMUNES Y SOLUCIONES

### **Problema 1: No aparecen los módulos en el menú**

**Solución:**
1. Verificar que estás logueado
2. Verificar tu rol de usuario
3. Presionar F5 para refrescar

---

### **Problema 2: Error 404 en las APIs**

**Solución:**
1. Verificar que el backend está corriendo
2. Verificar las URLs en `.env`
3. Implementar los controladores del backend

---

### **Problema 3: No se envían emails**

**Solución:**
1. Verificar que tienes Gmail App Password
2. Verificar configuración en `appsettings.json`
3. Verificar que Gmail permite "Aplicaciones menos seguras"
4. Revisar logs del backend

---

### **Problema 4: Los datos no aparecen**

**Solución:**
1. Verificar que hay formularios en la BD
2. Verificar que los endpoints devuelven datos
3. Abrir DevTools (F12) y revisar Network tab

---

## 📞 CHEATSHEET DE COMANDOS

### **Frontend:**
```bash
# Iniciar desarrollo
npm run dev

# Build producción
npm run build

# Preview build
npm run preview
```

### **Backend:**
```bash
# Iniciar servidor
dotnet run

# Crear migración
dotnet ef migrations add NombreMigracion

# Aplicar migración
dotnet ef database update

# Ver migraciones
dotnet ef migrations list
```

### **Git:**
```bash
# Ver cambios
git status

# Agregar cambios
git add .

# Commit
git commit -m "Implementados módulos de firmas, alertas y consumos"

# Push
git push origin main
```

---

## 🎯 CHECKLIST RÁPIDO

Antes de considerar terminado:

- [ ] ✅ Frontend corre sin errores
- [ ] ✅ Backend compila sin errores
- [ ] ✅ Base de datos migrada
- [ ] ✅ Gmail configurado y probado
- [ ] ✅ Endpoints responden correctamente
- [ ] ✅ Frontend se conecta al backend
- [ ] ✅ Roles y permisos funcionan
- [ ] ✅ Todas las vistas cargan
- [ ] ✅ Exportación a Excel funciona
- [ ] ✅ Emails se envían correctamente

---

## 🌟 SIGUIENTE NIVEL

Una vez que todo funciona:

1. **Personalizar Emails:**
   - Agregar logo de Frigolab
   - Mejorar plantillas HTML
   - Agregar botones de acción directa

2. **Gráficos:**
   - Instalar Chart.js
   - Agregar gráficos de consumo
   - Agregar gráficos de firmas por tiempo

3. **Optimizaciones:**
   - Cachear datos frecuentes
   - Paginación en tablas grandes
   - Lazy loading de imágenes

4. **Mobile:**
   - PWA (Progressive Web App)
   - Mejoras de responsive
   - Touch gestures

---

## 📚 RECURSOS ÚTILES

**Documentación Completa:**
- `README_NUEVOS_MODULOS.md` - Guía completa
- `BACKEND_SPECS_FIRMAS_ALERTAS_CONSUMOS.md` - Especificaciones técnicas
- `RESUMEN_VISUAL_IMPLEMENTACION.md` - Vista general

**Código:**
- `src/services/` - Lógica de API calls
- `src/pages/` - Componentes de UI
- `src/App.jsx` - Rutas y navegación

**Ayuda Externa:**
- Gmail API: https://support.google.com/accounts/answer/185833
- EPPlus Docs: https://github.com/EPPlusSoftware/EPPlus
- React Router: https://reactrouter.com/

---

## 🎉 ¡LISTO PARA USAR!

El sistema está **100% funcional del lado del frontend**.

Solo falta implementar el backend según las especificaciones proporcionadas.

**Tiempo estimado de implementación backend:** 6-8 horas

**¡Mucho éxito! 🚀**
