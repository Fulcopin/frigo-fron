# ✅ CHECKLIST BACKEND - IMPLEMENTACIÓN PASO A PASO

## 📋 PREPARACIÓN INICIAL

- [ ] Abrir el proyecto backend en Visual Studio / VS Code
- [ ] Leer `BACKEND_SPECS_FIRMAS_ALERTAS_CONSUMOS.md` (2 horas)
- [ ] Tener listo Postman para pruebas
- [ ] Verificar que el proyecto compila sin errores

---

## 📦 1. INSTALACIÓN DE PAQUETES

```bash
# En la terminal del proyecto backend
dotnet add package EPPlus
# O si prefieres ClosedXML:
dotnet add package ClosedXML
```

- [ ] EPPlus o ClosedXML instalado
- [ ] Compilar proyecto para verificar: `dotnet build`

---

## 📧 2. CONFIGURACIÓN DE GMAIL

### Paso 2.1: Obtener App Password de Gmail

- [ ] Ir a: https://myaccount.google.com/security
- [ ] Activar "Verificación en 2 pasos"
- [ ] Ir a "Contraseñas de aplicaciones"
- [ ] Crear contraseña para "Correo" / "Otro (Frigolab)"
- [ ] Copiar el código de 16 caracteres

### Paso 2.2: Configurar appsettings.json

- [ ] Abrir `appsettings.json`
- [ ] Agregar sección `GmailSettings`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "tu-connection-string-existente"
  },
  "GmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": 587,
    "EnableSsl": true,
    "SenderEmail": "TU-EMAIL@gmail.com",
    "SenderPassword": "xxxx xxxx xxxx xxxx",
    "SenderName": "Frigolab Alertas"
  }
}
```

- [ ] Guardar archivo
- [ ] **NO** subir a Git (verificar .gitignore)

---

## 🗄️ 3. CREAR MODELOS DE DATOS

### Paso 3.1: Modelo Signature

- [ ] Crear archivo `Models/Signature.cs`
- [ ] Copiar código del archivo de especificaciones

```csharp
public class Signature
{
    public int Id { get; set; }
    public int FilledFormId { get; set; }
    public string SignatureImage { get; set; }
    public string SignedBy { get; set; }
    public DateTime SignedDate { get; set; }
    public string Comments { get; set; }
    public bool IsModifiedBySGI { get; set; } = false;
    public DateTime? OriginalSignedDate { get; set; }
    
    public virtual FilledForm FilledForm { get; set; }
}
```

### Paso 3.2: Modelo Alert

- [ ] Crear archivo `Models/Alert.cs`
- [ ] Copiar código del archivo de especificaciones

```csharp
public class Alert
{
    public int Id { get; set; }
    public string Type { get; set; }
    public string Priority { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string TargetEmail { get; set; }
    public int? FormId { get; set; }
    public string FormCode { get; set; }
    public DateTime CreatedDate { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime? ReadDate { get; set; }
    public string Status { get; set; }
    
    public virtual FilledForm Form { get; set; }
}
```

### Paso 3.3: Modelo AlertConfiguration

- [ ] Crear archivo `Models/AlertConfiguration.cs`
- [ ] Copiar código del archivo de especificaciones

### Paso 3.4: DTOs de Consumos

- [ ] Crear archivo `Models/DTOs/ConsumptionDTOs.cs`
- [ ] Agregar: `ConsolidatedConsumption`, `ConsumptionDetail`, `ConsumptionStats`

---

## 🔌 4. ACTUALIZAR DbContext

- [ ] Abrir `ApplicationDbContext.cs` (o como se llame tu DbContext)
- [ ] Agregar DbSets:

```csharp
public DbSet<Signature> Signatures { get; set; }
public DbSet<Alert> Alerts { get; set; }
public DbSet<AlertConfiguration> AlertConfigurations { get; set; }
```

- [ ] Compilar: `dotnet build`

---

## 🗃️ 5. CREAR MIGRACIONES

```bash
dotnet ef migrations add AddSignaturesAlertsConsumptions
```

- [ ] Verificar que la migración se creó en `Migrations/`
- [ ] Revisar el archivo de migración

```bash
dotnet ef database update
```

- [ ] Verificar que la BD se actualizó
- [ ] Verificar tablas en SQL Server Management Studio / Azure Data Studio

**Tablas esperadas:**
- `Signatures`
- `Alerts`
- `AlertConfigurations`

---

## 📧 6. CREAR SERVICIO DE EMAIL

### Paso 6.1: Crear Interfaz

- [ ] Crear archivo `Services/IEmailService.cs`

```csharp
public interface IEmailService
{
    Task<bool> SendAlertEmailAsync(string toEmail, string subject, string body);
    Task<bool> SendTestEmailAsync(string toEmail);
}
```

### Paso 6.2: Implementar GmailService

- [ ] Crear archivo `Services/GmailService.cs`
- [ ] Copiar código completo del archivo de especificaciones
- [ ] Agregar `using System.Net.Mail;`
- [ ] Agregar `using System.Net;`

### Paso 6.3: Registrar Servicio

- [ ] Abrir `Program.cs`
- [ ] Agregar:

```csharp
builder.Services.AddScoped<IEmailService, GmailService>();
```

---

## ⚙️ 7. CREAR BACKGROUND SERVICE

### Paso 7.1: Crear AlertBackgroundService

- [ ] Crear archivo `Services/AlertBackgroundService.cs`
- [ ] Copiar código del archivo de especificaciones
- [ ] Implementar lógica de `CheckMissingFormsAsync`
- [ ] Implementar lógica de `CheckPendingSignaturesAsync`

### Paso 7.2: Registrar Background Service

- [ ] Abrir `Program.cs`
- [ ] Agregar:

```csharp
builder.Services.AddHostedService<AlertBackgroundService>();
```

---

## 🎮 8. CREAR CONTROLADORES

### Paso 8.1: SignaturesController

- [ ] Crear archivo `Controllers/SignaturesController.cs`
- [ ] Copiar esqueleto del archivo de especificaciones
- [ ] Implementar 9 endpoints:

1. - [ ] `GET /api/Signatures/pending`
2. - [ ] `POST /api/Signatures/sign/{formId}`
3. - [ ] `POST /api/Signatures/sign-multiple`
4. - [ ] `GET /api/Signatures/history/{formId}`
5. - [ ] `GET /api/Signatures/stats`
6. - [ ] `POST /api/Signatures/reject/{formId}`
7. - [ ] `PUT /api/Signatures/update-date/{signatureId}`

- [ ] Compilar: `dotnet build`

### Paso 8.2: AlertsController

- [ ] Crear archivo `Controllers/AlertsController.cs`
- [ ] Implementar 8 endpoints:

1. - [ ] `GET /api/Alerts/active`
2. - [ ] `GET /api/Alerts/config`
3. - [ ] `PUT /api/Alerts/config`
4. - [ ] `PUT /api/Alerts/mark-read/{alertId}`
5. - [ ] `POST /api/Alerts/test`
6. - [ ] `GET /api/Alerts/history`
7. - [ ] `GET /api/Alerts/stats`
8. - [ ] `POST /api/Alerts/manual`

- [ ] Compilar: `dotnet build`

### Paso 8.3: ConsumptionsController

- [ ] Crear archivo `Controllers/ConsumptionsController.cs`
- [ ] Implementar lógica de extracción del JSON
- [ ] Implementar 8 endpoints:

1. - [ ] `GET /api/Consumptions/consolidated`
2. - [ ] `GET /api/Consumptions/by-product/{productName}`
3. - [ ] `GET /api/Consumptions/by-area/{area}`
4. - [ ] `GET /api/Consumptions/products`
5. - [ ] `GET /api/Consumptions/areas`
6. - [ ] `GET /api/Consumptions/stats`
7. - [ ] `GET /api/Consumptions/export/excel`
8. - [ ] `POST /api/Consumptions/compare`

- [ ] Compilar: `dotnet build`

---

## 🧪 9. PRUEBAS CON POSTMAN

### Paso 9.1: Configurar Postman

- [ ] Crear colección "Frigolab - Nuevos Módulos"
- [ ] Agregar variable `{{baseUrl}}` = `http://localhost:5074/api`

### Paso 9.2: Probar Firmas

- [ ] GET Formularios pendientes: `{{baseUrl}}/Signatures/pending`
- [ ] POST Firmar formulario: `{{baseUrl}}/Signatures/sign/1`
- [ ] GET Stats: `{{baseUrl}}/Signatures/stats`

### Paso 9.3: Probar Alertas

- [ ] POST Email de prueba: `{{baseUrl}}/Alerts/test`
  - Body: `{ "email": "tu-email@gmail.com" }`
- [ ] **Verificar que el email llegó a tu bandeja**
- [ ] GET Alertas activas: `{{baseUrl}}/Alerts/active`
- [ ] GET Configuración: `{{baseUrl}}/Alerts/config`

### Paso 9.4: Probar Consumos

- [ ] GET Consolidado: `{{baseUrl}}/Consumptions/consolidated`
- [ ] GET Productos: `{{baseUrl}}/Consumptions/products`
- [ ] GET Stats: `{{baseUrl}}/Consumptions/stats`

---

## 🔗 10. INTEGRACIÓN CON FRONTEND

### Paso 10.1: Verificar CORS

- [ ] Abrir `Program.cs`
- [ ] Verificar que CORS permite `http://localhost:5173`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ...

app.UseCors("AllowFrontend");
```

### Paso 10.2: Iniciar Backend y Frontend

Terminal 1:
```bash
# Backend
cd ruta-al-backend
dotnet run
```

Terminal 2:
```bash
# Frontend
cd c:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron
npm run dev
```

### Paso 10.3: Probar Integración

- [ ] Ir a: `http://localhost:5173/signatures`
- [ ] Verificar que carga sin errores
- [ ] Verificar que muestra datos
- [ ] Probar firmar un formulario

- [ ] Ir a: `http://localhost:5173/alerts`
- [ ] Verificar configuración
- [ ] Enviar email de prueba
- [ ] Verificar recepción

- [ ] Ir a: `http://localhost:5173/consumptions`
- [ ] Verificar que muestra datos consolidados
- [ ] Probar exportación a Excel
- [ ] Probar comparación de períodos

---

## 🐛 11. DEBUGGING

### Si algo no funciona:

#### Error: No se conecta al backend
- [ ] Verificar que el backend está corriendo
- [ ] Verificar URL en `.env` del frontend
- [ ] Verificar CORS en `Program.cs`
- [ ] Abrir DevTools (F12) → Network → Ver errores

#### Error: No se envían emails
- [ ] Verificar Gmail App Password en `appsettings.json`
- [ ] Verificar que la contraseña no tiene espacios extra
- [ ] Verificar logs del backend
- [ ] Probar manualmente con código de prueba

#### Error: No aparecen consumos
- [ ] Verificar que hay formularios con datos
- [ ] Verificar estructura del JSON en FormData
- [ ] Ajustar lógica de extracción según tus campos
- [ ] Revisar logs del backend

#### Error: Migraciones fallan
- [ ] Verificar connection string en `appsettings.json`
- [ ] Verificar que SQL Server está corriendo
- [ ] Eliminar migración y recrear
- [ ] Verificar que los modelos no tienen errores

---

## ✅ 12. VALIDACIÓN FINAL

- [ ] Backend compila sin errores
- [ ] Todas las migraciones aplicadas
- [ ] Email de prueba enviado y recibido
- [ ] Todos los endpoints responden en Postman
- [ ] Frontend se conecta correctamente
- [ ] Se pueden firmar formularios
- [ ] Se reciben alertas por email
- [ ] Se visualizan consumos
- [ ] Exportación a Excel funciona

---

## 📊 PROGRESO

```
Preparación:        [ ] [ ] [ ] [ ]
Gmail:              [ ] [ ] [ ] [ ]
Modelos:            [ ] [ ] [ ] [ ]
DbContext:          [ ] [ ]
Migraciones:        [ ] [ ]
Email Service:      [ ] [ ] [ ]
Background Service: [ ] [ ]
Controladores:      [ ] [ ] [ ]
Pruebas Postman:    [ ] [ ] [ ]
Integración:        [ ] [ ] [ ]
Validación:         [ ] [ ] [ ]

Total: 0 / 42 tareas completadas
```

---

## 🎯 TIEMPO ESTIMADO

| Fase | Tiempo Estimado |
|------|----------------|
| Preparación y lectura | 2 horas |
| Configuración Gmail | 30 min |
| Modelos y migraciones | 1 hora |
| Email Service | 1 hora |
| SignaturesController | 2 horas |
| AlertsController | 1.5 horas |
| ConsumptionsController | 2.5 horas |
| Pruebas e integración | 1.5 horas |
| **TOTAL** | **12 horas** |

---

## 📚 ARCHIVOS DE REFERENCIA

Durante la implementación, consultar:

1. **Código de ejemplo:** `BACKEND_SPECS_FIRMAS_ALERTAS_CONSUMOS.md`
2. **Troubleshooting:** `GUIA_RAPIDA_INICIO.md`
3. **Postman:** `GUIA_RAPIDA_INICIO.md` → Sección "Ejemplos Postman"
4. **Funcionalidades:** `README_NUEVOS_MODULOS.md`

---

## 🎉 ¡CUANDO TERMINES!

- [ ] Hacer commit de los cambios
- [ ] Actualizar documentación si hiciste cambios
- [ ] Celebrar 🎊

```bash
git add .
git commit -m "feat: Implementados módulos de firmas, alertas y consumos"
git push origin main
```

---

**¡Mucho éxito con la implementación! 🚀**
