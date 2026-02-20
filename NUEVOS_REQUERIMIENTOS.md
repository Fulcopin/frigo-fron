# 🚀 NUEVOS REQUERIMIENTOS - Sistema de Formularios

## ✅ 1. RESTRICCIÓN DE FIRMAS (COMPLETADO)

### Cambio Implementado:
**Solo pueden firmar personas del catálogo de firmas, nadie de la API externa**

### Código Modificado:
- **Archivo:** `src/pages/FillForm.jsx` (línea ~5763)
- **Cambio:** Eliminada combinación con API externa
- **Ahora:** `const uniqueUsers = firmasCatalogo` (solo catálogo)

### Impacto:
- ❌ Usuarios de API externa NO aparecen en selector
- ✅ SOLO firmas registradas en `/catalogo-firmas`
- ⚠️ Si no hay firmas en catálogo para un puesto, selector vacío

### Log en Consola:
```javascript
🔒 Usuarios SOLO del catálogo para Supervisor general Producción:
  - catalogo: 1
  - total: 1
```

---

## 📋 2. INFORMACIÓN GENERAL - Frecuencia de Llenado

### Requerimiento:
Agregar campo "Frecuencia de llenado" en información general del template

### Opciones Sugeridas:
- Diario
- Semanal
- Quincenal
- Mensual
- Trimestral
- Anual
- Otro (especificar)

### Implementación Requerida:

#### Backend (Models/Template.cs):
```csharp
public class Template
{
    // ... campos existentes ...
    
    [StringLength(50)]
    public string? FrecuenciaLlenado { get; set; }  // NUEVO
}
```

#### Migración:
```bash
dotnet ef migrations add AgregarFrecuenciaLlenado
dotnet ef database update
```

#### Frontend (CreateTemplate.jsx):
```jsx
// En información general, después de "Proceso"
<div className="form-group">
  <label>Frecuencia de Llenado *</label>
  <select
    value={formData.frecuenciaLlenado || ''}
    onChange={(e) => setFormData({...formData, frecuenciaLlenado: e.target.value})}
    required
  >
    <option value="">Seleccionar...</option>
    <option value="Diario">Diario</option>
    <option value="Semanal">Semanal</option>
    <option value="Quincenal">Quincenal</option>
    <option value="Mensual">Mensual</option>
    <option value="Trimestral">Trimestral</option>
    <option value="Anual">Anual</option>
    <option value="Otro">Otro</option>
  </select>
</div>
```

#### Mostrar en FillForm.jsx:
```jsx
{selectedTemplate.frecuenciaLlenado && (
  <div className="info-row">
    <span className="info-label">📅 Frecuencia:</span>
    <span className="info-value">{selectedTemplate.frecuenciaLlenado}</span>
  </div>
)}
```

---

## ☑️ 3. CASILLAS DE VERIFICACIÓN (Checkboxes)

### Requerimiento:
Para opciones simples (máximo 3 opciones), usar checkboxes/radio buttons en vez de dropdown

### Tipos de Controles:

#### A) Si/No → Radio Buttons
```jsx
<div className="radio-group">
  <label>
    <input type="radio" name="pregunta1" value="Si" />
    Sí
  </label>
  <label>
    <input type="radio" name="pregunta1" value="No" />
    No
  </label>
</div>
```

#### B) 3 Opciones → Radio Buttons
```jsx
<div className="radio-group">
  <label>
    <input type="radio" name="pregunta2" value="Bueno" />
    Bueno
  </label>
  <label>
    <input type="radio" name="pregunta2" value="Regular" />
    Regular
  </label>
  <label>
    <input type="radio" name="pregunta2" value="Malo" />
    Malo
  </label>
</div>
```

#### C) Múltiple Selección → Checkboxes
```jsx
<div className="checkbox-group">
  <label>
    <input type="checkbox" value="Opcion1" />
    Opción 1
  </label>
  <label>
    <input type="checkbox" value="Opcion2" />
    Opción 2
  </label>
</div>
```

### Implementación en CreateTemplate.jsx:

```jsx
// Al agregar campo tipo dropdown
<div className="form-group">
  <label>Tipo de Control</label>
  <select onChange={(e) => setTipoControl(e.target.value)}>
    <option value="dropdown">Menú Desplegable (más de 3 opciones)</option>
    <option value="radio">Botones de Opción (2-3 opciones)</option>
    <option value="checkbox">Casillas de Verificación (múltiple selección)</option>
  </select>
</div>

// Guardar en campo:
{
  type: 'dropdown',
  opciones: ['Opción 1', 'Opción 2'],
  tipoControl: 'radio', // 'dropdown', 'radio', 'checkbox'
  multipleSelection: false
}
```

### Renderizado en FillForm.jsx:

```jsx
// Detectar automáticamente
const tipoControl = field.tipoControl || 
  (field.opciones && field.opciones.length <= 3 ? 'radio' : 'dropdown');

if (tipoControl === 'radio') {
  return (
    <div className="radio-group">
      {field.opciones.map((opcion, i) => (
        <label key={i}>
          <input 
            type="radio" 
            name={field.label} 
            value={opcion}
            checked={value === opcion}
            onChange={(e) => onChange(e.target.value)}
          />
          {opcion}
        </label>
      ))}
    </div>
  );
}
```

---

## 🦐🐟 4. DIFERENCIACIÓN CAMARÓN/PESCADO

### Requerimiento:
Opción para diferenciar entre registros de camarón y pescado

### Opción 1: Selector al inicio del formulario
```jsx
// En FillForm.jsx, al inicio
<div className="tipo-producto-selector">
  <label>Tipo de Producto:</label>
  <div className="radio-group">
    <label>
      <input 
        type="radio" 
        name="tipoProducto" 
        value="camaron"
        checked={tipoProducto === 'camaron'}
        onChange={(e) => setTipoProducto(e.target.value)}
      />
      🦐 Camarón
    </label>
    <label>
      <input 
        type="radio" 
        name="tipoProducto" 
        value="pescado"
        checked={tipoProducto === 'pescado'}
        onChange={(e) => setTipoProducto(e.target.value)}
      />
      🐟 Pescado
    </label>
  </div>
</div>
```

### Opción 2: Campo en template
```csharp
// Backend - Models/Template.cs
public string? TipoProductoAplicable { get; set; }  // "Camarón", "Pescado", "Ambos"
```

```jsx
// Frontend - Mostrar solo si aplica
{selectedTemplate.tipoProductoAplicable === 'Camarón' && (
  <div className="badge-camaron">🦐 Formulario para Camarón</div>
)}
```

### Opción 3: Templates separados
- Crear templates específicos: "Control Camarón", "Control Pescado"
- Filtrar en lista de templates por tipo de producto

---

## 🔔 5. SISTEMA DE NOTIFICACIONES MEJORADO

### Requerimiento:
Nuevas notificaciones para el sistema

### Tipos de Notificaciones Sugeridas:

#### A) Notificaciones de Firmas
- ✅ **Ya existe:** Firma pendiente (24h después de llenar formulario)
- 🆕 **Nueva:** Firma recibida (cuando alguien firma)
- 🆕 **Nueva:** Recordatorio de firma (cada 2 días si no firma)
- 🆕 **Nueva:** Formulario completado (todas las firmas recibidas)

#### B) Notificaciones de Formularios
- 🆕 **Nueva:** Formulario vencido (no se llenó en el período)
- 🆕 **Nueva:** Formulario próximo a vencer (1 día antes)
- 🆕 **Nueva:** Formulario rechazado/requiere corrección

#### C) Notificaciones de Sistema
- 🆕 **Nueva:** Nuevo template creado
- 🆕 **Nueva:** Template modificado
- 🆕 **Nueva:** Alerta de calidad (valores fuera de rango)

### Implementación Backend:

```csharp
// Models/AlertType.cs (enum)
public enum AlertType
{
    PendingSignature,           // Existente
    SignatureReceived,          // Nueva
    SignatureReminder,          // Nueva
    FormCompleted,              // Nueva
    FormOverdue,                // Nueva
    FormDueSoon,                // Nueva
    FormRejected,               // Nueva
    TemplateCreated,            // Nueva
    TemplateModified,           // Nueva
    QualityAlert                // Nueva
}

// Models/Alert.cs
public class Alert
{
    public int AlertId { get; set; }
    public AlertType Type { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string[] Recipients { get; set; }  // Array de emails
    public DateTime CreatedDate { get; set; }
    public DateTime? SentDate { get; set; }
    public bool IsSent { get; set; }
    public int? FormId { get; set; }
    public int? TemplateId { get; set; }
    public string? Severity { get; set; }  // "info", "warning", "error"
}
```

### Service de Notificaciones:

```csharp
// Services/INotificationService.cs
public interface INotificationService
{
    Task SendSignatureReceivedNotification(int formId, string signerName);
    Task SendFormCompletedNotification(int formId);
    Task SendFormOverdueNotification(int templateId);
    Task SendQualityAlertNotification(int formId, string field, string value);
}
```

### Frontend - Centro de Notificaciones:

```jsx
// components/NotificationCenter.jsx
const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  return (
    <div className="notification-center">
      <button className="notification-bell">
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      
      <div className="notification-dropdown">
        {notifications.map(notif => (
          <div key={notif.id} className={`notification ${notif.severity}`}>
            <div className="notif-icon">{getIcon(notif.type)}</div>
            <div className="notif-content">
              <strong>{notif.title}</strong>
              <p>{notif.message}</p>
              <small>{notif.timestamp}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 📝 PLAN DE IMPLEMENTACIÓN

### Fase 1: Básico (1-2 días)
- [x] Restricción de firmas (COMPLETADO)
- [ ] Frecuencia de llenado
- [ ] Radio buttons para Si/No

### Fase 2: Intermedio (2-3 días)
- [ ] Checkboxes para opciones múltiples
- [ ] Diferenciación Camarón/Pescado
- [ ] Notificación de firma recibida

### Fase 3: Avanzado (3-5 días)
- [ ] Sistema completo de notificaciones
- [ ] Centro de notificaciones en frontend
- [ ] Notificaciones en tiempo real (SignalR)

---

## 🔧 PRÓXIMOS PASOS INMEDIATOS

1. ✅ **Restricción de firmas** → COMPLETADO
2. **Frecuencia de llenado** → ¿Implementar ahora?
3. **Radio buttons Si/No** → ¿Implementar ahora?

**¿Qué implemento primero?**
