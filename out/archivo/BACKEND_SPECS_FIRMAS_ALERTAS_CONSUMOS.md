# 📋 ESPECIFICACIONES DEL BACKEND - MÓDULOS DE FIRMAS, ALERTAS Y CONSUMOS
## Frigolab - Sistema de Gestión de Documentos

---

## 🎯 RESUMEN EJECUTIVO

Se requieren 3 nuevos controladores en el backend de ASP.NET Core:

1. **SignaturesController** - Gestión de firmas digitales
2. **AlertsController** - Sistema de alertas por Gmail
3. **ConsumptionsController** - Análisis consolidado de consumos

---

## 📦 1. CONTROLADOR DE FIRMAS (SignaturesController)

### **Ruta Base:** `/api/Signatures`

### **Modelos de Datos Requeridos:**

```csharp
public class Signature
{
    public int Id { get; set; }
    public int FilledFormId { get; set; }
    public string SignatureImage { get; set; } // Base64 de la imagen
    public string SignedBy { get; set; } // Email del firmante
    public DateTime SignedDate { get; set; }
    public string Comments { get; set; }
    public bool IsModifiedBySGI { get; set; } = false;
    public DateTime? OriginalSignedDate { get; set; }
    
    // Navegación
    public virtual FilledForm FilledForm { get; set; }
}

public class FormSignatureStatus
{
    public int FilledFormId { get; set; }
    public bool IsSigned { get; set; }
    public bool IsRejected { get; set; }
    public DateTime? SignedDate { get; set; }
    public string SignedBy { get; set; }
    public string RejectionReason { get; set; }
}
```

### **Endpoints Requeridos:**

#### 1. `GET /api/Signatures/pending`
**Descripción:** Obtener formularios pendientes de firma
**Respuesta:**
```json
[
  {
    "id": 123,
    "templateId": 10,
    "templateName": "Control de Temperatura",
    "formCode": "TEMP-2026-001",
    "createdBy": "operador@frigolab.com",
    "createdDate": "2026-02-10T08:00:00Z",
    "area": "Producción",
    "isSigned": false
  }
]
```

#### 2. `POST /api/Signatures/sign/{formId}`
**Descripción:** Firmar un formulario individual
**Body:**
```json
{
  "formId": 123,
  "signatureImage": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "signedBy": "supervisor@frigolab.com",
  "signedDate": "2026-02-11T10:30:00Z",
  "comments": "Revisado y aprobado"
}
```
**Respuesta:**
```json
{
  "success": true,
  "message": "Formulario firmado exitosamente",
  "signatureId": 456
}
```

#### 3. `POST /api/Signatures/sign-multiple`
**Descripción:** Firmar múltiples formularios de forma masiva
**Body:**
```json
{
  "formIds": [123, 124, 125],
  "signatureImage": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "signedBy": "supervisor@frigolab.com",
  "signedDate": "2026-02-11T10:30:00Z",
  "comments": "Revisión masiva semanal"
}
```
**Respuesta:**
```json
{
  "success": true,
  "message": "3 formularios firmados exitosamente",
  "signedCount": 3,
  "failedCount": 0
}
```

#### 4. `GET /api/Signatures/history/{formId}`
**Descripción:** Obtener historial de firmas de un formulario
**Respuesta:**
```json
[
  {
    "id": 456,
    "signedBy": "supervisor@frigolab.com",
    "signedDate": "2026-02-11T10:30:00Z",
    "comments": "Revisado y aprobado",
    "isModifiedBySGI": false
  }
]
```

#### 5. `GET /api/Signatures/stats`
**Descripción:** Estadísticas de firmas
**Respuesta:**
```json
{
  "pendingCount": 15,
  "signedToday": 8,
  "totalSigned": 342,
  "rejectedCount": 3
}
```

#### 6. `POST /api/Signatures/reject/{formId}`
**Descripción:** Rechazar un formulario (solo SGI)
**Body:**
```json
{
  "formId": 123,
  "rejectedBy": "sgi@frigolab.com",
  "reason": "Datos incompletos en sección 3",
  "rejectedDate": "2026-02-11T11:00:00Z"
}
```

#### 7. `PUT /api/Signatures/update-date/{signatureId}`
**Descripción:** Modificar fecha de firma (solo SGI)
**Body:**
```json
{
  "signatureId": 456,
  "newDate": "2026-02-10T15:00:00Z"
}
```
**Nota:** Este endpoint debe validar que el usuario tenga rol 'admin' o 'sgi'

---

## 🔔 2. CONTROLADOR DE ALERTAS (AlertsController)

### **Ruta Base:** `/api/Alerts`

### **Modelos de Datos Requeridos:**

```csharp
public class Alert
{
    public int Id { get; set; }
    public string Type { get; set; } // "missing_form", "pending_signature", "overdue", "system"
    public string Priority { get; set; } // "high", "medium", "low"
    public string Title { get; set; }
    public string Message { get; set; }
    public string TargetEmail { get; set; }
    public int? FormId { get; set; }
    public string FormCode { get; set; }
    public DateTime CreatedDate { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime? ReadDate { get; set; }
    public string Status { get; set; } // "pending", "sent", "read", "failed"
    
    // Navegación
    public virtual FilledForm Form { get; set; }
}

public class AlertConfiguration
{
    public int Id { get; set; }
    public bool EnableMissingFormAlerts { get; set; } = true;
    public string DailyCheckTime { get; set; } = "18:00";
    public string MissingFormRecipients { get; set; } // JSON array de emails
    public bool EnableSignatureAlerts { get; set; } = true;
    public int SignatureAlertDelay { get; set; } = 24; // horas
    public string SignatureRecipients { get; set; } // JSON array de emails
    public string SenderEmail { get; set; } = "alertas@frigolab.com";
    public string SenderName { get; set; } = "Frigolab Alertas";
}
```

### **Configuración de Gmail API:**

En `appsettings.json`:
```json
{
  "GmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": 587,
    "EnableSsl": true,
    "SenderEmail": "tu-email@gmail.com",
    "SenderPassword": "tu-app-password",
    "SenderName": "Frigolab Alertas"
  }
}
```

**IMPORTANTE:** Crear una "Contraseña de Aplicación" en Gmail:
1. Ir a https://myaccount.google.com/security
2. Activar verificación en 2 pasos
3. Ir a "Contraseñas de aplicaciones"
4. Generar una contraseña para "Correo" / "Otro"
5. Usar esa contraseña (16 caracteres) en `appsettings.json`

### **Servicio de Email (EmailService):**

```csharp
public interface IEmailService
{
    Task<bool> SendAlertEmailAsync(string toEmail, string subject, string body);
    Task<bool> SendTestEmailAsync(string toEmail);
}

public class GmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    
    public GmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }
    
    public async Task<bool> SendAlertEmailAsync(string toEmail, string subject, string body)
    {
        try
        {
            var smtpServer = _configuration["GmailSettings:SmtpServer"];
            var smtpPort = int.Parse(_configuration["GmailSettings:SmtpPort"]);
            var senderEmail = _configuration["GmailSettings:SenderEmail"];
            var senderPassword = _configuration["GmailSettings:SenderPassword"];
            var senderName = _configuration["GmailSettings:SenderName"];
            
            using (var message = new MailMessage())
            {
                message.From = new MailAddress(senderEmail, senderName);
                message.To.Add(toEmail);
                message.Subject = subject;
                message.Body = body;
                message.IsBodyHtml = true;
                
                using (var client = new SmtpClient(smtpServer, smtpPort))
                {
                    client.EnableSsl = true;
                    client.Credentials = new NetworkCredential(senderEmail, senderPassword);
                    await client.SendMailAsync(message);
                }
            }
            
            return true;
        }
        catch (Exception ex)
        {
            // Log error
            Console.WriteLine($"Error enviando email: {ex.Message}");
            return false;
        }
    }
    
    public async Task<bool> SendTestEmailAsync(string toEmail)
    {
        var subject = "🧪 Prueba de Alertas - Frigolab";
        var body = @"
            <html>
            <body style='font-family: Arial, sans-serif;'>
                <h2 style='color: #3b82f6;'>✅ Email de Prueba</h2>
                <p>Este es un email de prueba del sistema de alertas de Frigolab.</p>
                <p>Si recibes este mensaje, la configuración de Gmail está funcionando correctamente.</p>
                <hr>
                <p style='color: #6b7280; font-size: 12px;'>
                    Enviado automáticamente por el Sistema de Gestión de Frigolab
                </p>
            </body>
            </html>
        ";
        
        return await SendAlertEmailAsync(toEmail, subject, body);
    }
}
```

### **Endpoints Requeridos:**

#### 1. `GET /api/Alerts/active`
**Descripción:** Obtener alertas activas (no leídas)
**Respuesta:**
```json
[
  {
    "id": 1,
    "type": "missing_form",
    "priority": "high",
    "title": "Registro de Temperatura No Llenado",
    "message": "El formulario de temperatura del 11/02/2026 no ha sido completado",
    "targetEmail": "supervisor@frigolab.com",
    "formId": null,
    "formCode": null,
    "createdDate": "2026-02-11T18:00:00Z",
    "isRead": false,
    "status": "sent"
  }
]
```

#### 2. `GET /api/Alerts/config`
**Descripción:** Obtener configuración de alertas

#### 3. `PUT /api/Alerts/config`
**Descripción:** Actualizar configuración de alertas
**Body:** (mismo formato que AlertConfiguration)

#### 4. `PUT /api/Alerts/mark-read/{alertId}`
**Descripción:** Marcar alerta como leída

#### 5. `POST /api/Alerts/test`
**Descripción:** Enviar email de prueba
**Body:**
```json
{
  "email": "test@ejemplo.com"
}
```

#### 6. `GET /api/Alerts/history`
**Descripción:** Historial de alertas con filtros
**Query Parameters:**
- `startDate` (opcional)
- `endDate` (opcional)
- `type` (opcional)
- `status` (opcional)

#### 7. `GET /api/Alerts/stats`
**Descripción:** Estadísticas de alertas

#### 8. `POST /api/Alerts/manual`
**Descripción:** Crear alerta manual
**Body:**
```json
{
  "type": "system",
  "priority": "high",
  "title": "Mantenimiento Programado",
  "message": "Se realizará mantenimiento el viernes 15/02",
  "targetEmail": "todos@frigolab.com"
}
```

### **Tarea en Background (Background Service):**

Crear un servicio que se ejecute cada hora para:
1. Verificar formularios con frecuencia diaria que no han sido llenados
2. Verificar formularios completos sin firma después de X horas
3. Enviar emails automáticamente

```csharp
public class AlertBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AlertBackgroundService> _logger;
    
    public AlertBackgroundService(IServiceProvider serviceProvider, ILogger<AlertBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                    
                    // 1. Verificar formularios faltantes
                    await CheckMissingFormsAsync(context, emailService);
                    
                    // 2. Verificar firmas pendientes
                    await CheckPendingSignaturesAsync(context, emailService);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en AlertBackgroundService");
            }
            
            // Ejecutar cada hora
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
    
    private async Task CheckMissingFormsAsync(ApplicationDbContext context, IEmailService emailService)
    {
        // Lógica para detectar formularios no llenados
        // Enviar alertas si es necesario
    }
    
    private async Task CheckPendingSignaturesAsync(ApplicationDbContext context, IEmailService emailService)
    {
        // Lógica para detectar firmas pendientes
        // Enviar alertas si es necesario
    }
}
```

Registrar en `Program.cs`:
```csharp
builder.Services.AddHostedService<AlertBackgroundService>();
builder.Services.AddScoped<IEmailService, GmailService>();
```

---

## 📊 3. CONTROLADOR DE CONSUMOS (ConsumptionsController)

### **Ruta Base:** `/api/Consumptions`

### **Modelos de Vista (DTOs):**

```csharp
public class ConsolidatedConsumption
{
    public string ProductName { get; set; }
    public decimal TotalQuantity { get; set; }
    public string Unit { get; set; }
    public int FormCount { get; set; }
    public List<string> Areas { get; set; }
    public DateTime? LastDate { get; set; }
}

public class ConsumptionDetail
{
    public DateTime Date { get; set; }
    public string FormName { get; set; }
    public string Area { get; set; }
    public string ProductName { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; }
    public string BatchCode { get; set; }
    public string Responsible { get; set; }
}

public class ConsumptionStats
{
    public int TotalProducts { get; set; }
    public decimal TotalConsumption { get; set; }
    public int TotalForms { get; set; }
    public int TotalAreas { get; set; }
}
```

### **Endpoints Requeridos:**

#### 1. `GET /api/Consumptions/consolidated`
**Descripción:** Obtener consumos consolidados
**Query Parameters:**
- `startDate` (opcional): fecha inicio (formato: 2026-01-01)
- `endDate` (opcional): fecha fin
- `product` (opcional): nombre del producto
- `area` (opcional): área específica
- `groupBy` (opcional): "product", "area", "date", "template"

**Lógica:**
- Extraer de `FilledForms.FormData` (JSON) todos los campos que contengan cantidades
- Buscar campos con nombres como: "cantidad", "peso", "kg", "litros", etc.
- Agrupar por el criterio especificado
- Sumar cantidades

**Respuesta:**
```json
[
  {
    "productName": "Sal",
    "totalQuantity": 450.75,
    "unit": "kg",
    "formCount": 28,
    "areas": ["Producción", "Empaque"],
    "lastDate": "2026-02-11T00:00:00Z"
  },
  {
    "productName": "Hielo",
    "totalQuantity": 1250.50,
    "unit": "kg",
    "formCount": 45,
    "areas": ["Producción"],
    "lastDate": "2026-02-11T00:00:00Z"
  }
]
```

#### 2. `GET /api/Consumptions/by-product/{productName}`
**Descripción:** Consumos detallados de un producto específico
**Query Parameters:**
- `startDate` (opcional)
- `endDate` (opcional)

**Respuesta:**
```json
[
  {
    "date": "2026-02-10T00:00:00Z",
    "formName": "Control de Producción",
    "area": "Producción",
    "productName": "Sal",
    "quantity": 15.5,
    "unit": "kg",
    "batchCode": "LOTE-2026-045",
    "responsible": "operador@frigolab.com"
  }
]
```

#### 3. `GET /api/Consumptions/by-area/{area}`
**Descripción:** Consumos por área específica

#### 4. `GET /api/Consumptions/products`
**Descripción:** Lista de productos disponibles con totales
**Respuesta:**
```json
[
  {
    "name": "Sal",
    "totalConsumption": 450.75,
    "unit": "kg"
  }
]
```

#### 5. `GET /api/Consumptions/areas`
**Descripción:** Lista de áreas disponibles
**Respuesta:**
```json
[
  {
    "name": "Producción",
    "productCount": 12
  }
]
```

#### 6. `GET /api/Consumptions/stats`
**Descripción:** Estadísticas generales de consumos
**Query Parameters:**
- `startDate` (opcional)
- `endDate` (opcional)

#### 7. `GET /api/Consumptions/export/excel`
**Descripción:** Exportar consumos a Excel
**Query Parameters:** (mismos que consolidated)
**Respuesta:** Archivo Excel (.xlsx)

Usar librería EPPlus o ClosedXML:
```csharp
[HttpGet("export/excel")]
public async Task<IActionResult> ExportToExcel([FromQuery] ConsumptionFilters filters)
{
    var consumptions = await GetConsolidatedConsumptions(filters);
    
    using (var package = new ExcelPackage())
    {
        var worksheet = package.Workbook.Worksheets.Add("Consumos");
        
        // Headers
        worksheet.Cells[1, 1].Value = "Producto";
        worksheet.Cells[1, 2].Value = "Cantidad Total";
        worksheet.Cells[1, 3].Value = "Unidad";
        worksheet.Cells[1, 4].Value = "Registros";
        worksheet.Cells[1, 5].Value = "Áreas";
        
        // Data
        int row = 2;
        foreach (var item in consumptions)
        {
            worksheet.Cells[row, 1].Value = item.ProductName;
            worksheet.Cells[row, 2].Value = item.TotalQuantity;
            worksheet.Cells[row, 3].Value = item.Unit;
            worksheet.Cells[row, 4].Value = item.FormCount;
            worksheet.Cells[row, 5].Value = string.Join(", ", item.Areas);
            row++;
        }
        
        var excelData = package.GetAsByteArray();
        return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                    $"consumos_{DateTime.Now:yyyyMMdd}.xlsx");
    }
}
```

#### 8. `POST /api/Consumptions/compare`
**Descripción:** Comparar consumos entre dos períodos
**Body:**
```json
{
  "period1": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "period2": {
    "start": "2026-02-01",
    "end": "2026-02-11"
  }
}
```

**Respuesta:**
```json
{
  "period1Total": 2500.50,
  "period2Total": 1850.25,
  "difference": -650.25,
  "percentageChange": -26.01,
  "products": [
    {
      "name": "Sal",
      "period1": 450.75,
      "period2": 380.50,
      "difference": -70.25,
      "percentageChange": -15.58
    }
  ]
}
```

### **Lógica de Extracción de Consumos:**

El mayor desafío es extraer los datos de consumo del JSON en `FilledForms.FormData`.

**Estrategia Recomendada:**

```csharp
private List<ConsumptionDetail> ExtractConsumptionsFromForm(FilledForm form)
{
    var consumptions = new List<ConsumptionDetail>();
    
    try
    {
        var formData = JsonSerializer.Deserialize<Dictionary<string, object>>(form.FormData);
        
        // Buscar en secciones
        if (formData.ContainsKey("sections"))
        {
            var sections = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(
                formData["sections"].ToString());
            
            foreach (var section in sections)
            {
                if (section.ContainsKey("rows"))
                {
                    var rows = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(
                        section["rows"].ToString());
                    
                    foreach (var row in rows)
                    {
                        // Buscar campos con cantidades
                        var productName = ExtractProductName(row);
                        var quantity = ExtractQuantity(row);
                        
                        if (!string.IsNullOrEmpty(productName) && quantity > 0)
                        {
                            consumptions.Add(new ConsumptionDetail
                            {
                                Date = form.FechaCreacion,
                                FormName = form.Template.Name,
                                Area = ExtractArea(form),
                                ProductName = productName,
                                Quantity = quantity,
                                Unit = ExtractUnit(row) ?? "kg",
                                BatchCode = ExtractBatchCode(row),
                                Responsible = form.CreatedBy
                            });
                        }
                    }
                }
            }
        }
    }
    catch (Exception ex)
    {
        // Log error
    }
    
    return consumptions;
}

private string ExtractProductName(Dictionary<string, object> row)
{
    // Buscar columnas con nombres como: "producto", "insumo", "material", "item"
    var productKeys = new[] { "producto", "insumo", "material", "item", "descripcion" };
    
    foreach (var key in productKeys)
    {
        if (row.ContainsKey(key))
        {
            return row[key]?.ToString();
        }
    }
    
    return null;
}

private decimal ExtractQuantity(Dictionary<string, object> row)
{
    // Buscar columnas con nombres como: "cantidad", "peso", "kg", "litros"
    var quantityKeys = new[] { "cantidad", "peso", "kg", "litros", "unidades", "total" };
    
    foreach (var key in quantityKeys)
    {
        if (row.ContainsKey(key))
        {
            if (decimal.TryParse(row[key]?.ToString(), out decimal value))
            {
                return value;
            }
        }
    }
    
    return 0;
}
```

---

## 🔧 CONFIGURACIÓN DEL PROYECTO

### **1. Instalar Paquetes NuGet:**

```bash
dotnet add package EPPlus
# O
dotnet add package ClosedXML
```

### **2. Actualizar `Program.cs`:**

```csharp
// Servicios
builder.Services.AddScoped<IEmailService, GmailService>();
builder.Services.AddHostedService<AlertBackgroundService>();

// CORS (si es necesario)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
```

### **3. Migraciones de Base de Datos:**

```bash
dotnet ef migrations add AddSignaturesAlertsConsumptions
dotnet ef database update
```

### **4. Variables de Entorno (appsettings.json):**

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "tu-connection-string"
  },
  "GmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": 587,
    "EnableSsl": true,
    "SenderEmail": "TU-EMAIL@gmail.com",
    "SenderPassword": "TU-APP-PASSWORD-DE-16-CARACTERES",
    "SenderName": "Frigolab Alertas"
  },
  "JwtSettings": {
    "SecretKey": "tu-secret-key",
    "Issuer": "FrigolabAPI",
    "Audience": "FrigolabFrontend"
  }
}
```

---

## 📧 CONFIGURACIÓN DE GMAIL

### **Pasos Detallados:**

1. **Ir a tu cuenta de Google:**
   - https://myaccount.google.com/

2. **Activar Verificación en 2 Pasos:**
   - Seguridad → Verificación en 2 pasos → Activar

3. **Generar Contraseña de Aplicación:**
   - Seguridad → Contraseñas de aplicaciones
   - Selecciona "Correo" y "Otro (nombre personalizado)"
   - Escribe "Frigolab Backend"
   - Copiar la contraseña de 16 caracteres generada

4. **Configurar en appsettings.json:**
   ```json
   "SenderEmail": "tu-email@gmail.com",
   "SenderPassword": "xxxx xxxx xxxx xxxx"
   ```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Firmas:**
- [ ] Crear modelo `Signature`
- [ ] Crear `SignaturesController`
- [ ] Implementar endpoint `GET /pending`
- [ ] Implementar endpoint `POST /sign/{formId}`
- [ ] Implementar endpoint `POST /sign-multiple`
- [ ] Implementar endpoint `GET /history/{formId}`
- [ ] Implementar endpoint `GET /stats`
- [ ] Implementar endpoint `POST /reject/{formId}`
- [ ] Implementar endpoint `PUT /update-date/{signatureId}`
- [ ] Validar roles para operaciones SGI
- [ ] Migración de base de datos

### **Alertas:**
- [ ] Crear modelo `Alert`
- [ ] Crear modelo `AlertConfiguration`
- [ ] Implementar `GmailService` con SMTP
- [ ] Configurar Gmail App Password
- [ ] Crear `AlertsController`
- [ ] Implementar todos los endpoints
- [ ] Crear `AlertBackgroundService`
- [ ] Registrar servicio en `Program.cs`
- [ ] Probar envío de emails
- [ ] Migración de base de datos

### **Consumos:**
- [ ] Crear DTOs (`ConsolidatedConsumption`, etc.)
- [ ] Crear `ConsumptionsController`
- [ ] Implementar lógica de extracción de JSON
- [ ] Implementar endpoint `GET /consolidated`
- [ ] Implementar endpoint `GET /by-product/{name}`
- [ ] Implementar endpoint `GET /by-area/{area}`
- [ ] Implementar endpoint `GET /products`
- [ ] Implementar endpoint `GET /areas`
- [ ] Implementar endpoint `GET /stats`
- [ ] Implementar endpoint `GET /export/excel`
- [ ] Implementar endpoint `POST /compare`
- [ ] Instalar EPPlus o ClosedXML

---

## 🧪 EJEMPLOS DE PRUEBA (POSTMAN)

### **Firmar Formulario:**
```
POST http://localhost:5074/api/Signatures/sign/123
Content-Type: application/json

{
  "formId": 123,
  "signatureImage": "data:image/png;base64,iVBORw0KGgo...",
  "signedBy": "supervisor@frigolab.com",
  "signedDate": "2026-02-11T10:30:00Z",
  "comments": "Aprobado"
}
```

### **Enviar Email de Prueba:**
```
POST http://localhost:5074/api/Alerts/test
Content-Type: application/json

{
  "email": "tu-email@ejemplo.com"
}
```

### **Obtener Consumos:**
```
GET http://localhost:5074/api/Consumptions/consolidated?startDate=2026-01-01&endDate=2026-02-11&groupBy=product
```

---

## 📞 SOPORTE

Si tienes dudas durante la implementación:
1. Revisa los logs del backend
2. Verifica las conexiones en appsettings.json
3. Asegúrate de que Gmail App Password esté configurado
4. Revisa que las migraciones se hayan aplicado correctamente

---

**¡Éxito con la implementación! 🚀**
