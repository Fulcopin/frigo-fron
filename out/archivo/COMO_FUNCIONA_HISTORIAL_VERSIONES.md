# 📚 Cómo Funciona el Historial de Versiones

## ✅ Estado Actual

El sistema de historial **ESTÁ FUNCIONANDO CORRECTAMENTE**.

Tu captura de pantalla muestra:
- ✅ "Versión 1 (ACTUAL)"
- ✅ 3 formularios usando esta versión
- ✅ Fechas de primer y último uso

**Esto es correcto** porque solo existe 1 versión en la base de datos para la plantilla "nnjknjl".

## 🔑 Cómo se Guardan las Versiones

### El sistema guarda un snapshot SOLO cuando:

```
Versión Anterior ≠ Versión Nueva
```

**Ejemplo:**
- ❌ Editas sin cambiar versión (1 → 1): **NO se guarda snapshot**
- ✅ Cambias versión (1 → 2): **SÍ se guarda snapshot**

### Código que lo controla:

```csharp
// En TemplatesController.cs línea ~127
if (oldTemplate.Version != template.Version)
{
    // Guarda snapshot de la versión anterior
    var versionSnapshot = new TemplateVersion { ... };
    _context.TemplateVersions.Add(versionSnapshot);
}
```

## 🎯 Cómo Crear Múltiples Versiones

### Paso 1: Editar Plantilla
1. Ve a "Gestionar Plantillas"
2. Click en "Editar" en tu plantilla "nnjknjl"

### Paso 2: Cambiar Número de Versión
3. Busca el campo "Versión" (actualmente: "1")
4. **Cámbialo a "2"**

### Paso 3: Hacer Cambios (Opcional)
5. Puedes hacer cambios adicionales o dejar todo igual
6. El snapshot se guardará por el cambio de versión

### Paso 4: Guardar
7. Click en "Guardar"
8. El sistema guardará un snapshot de la "Versión 1" en TemplateVersions

### Paso 5: Verificar Historial
9. Ve a "Historial de Versiones"
10. Ahora deberías ver:
    - **Versión 2 (ACTUAL)** ← Nueva
    - **Versión 1** ← Snapshot guardado

## 📊 Resultado en Base de Datos

Después de cambiar de versión 1 → 2:

```
TemplateVersions:
┌─────────┬─────────────┬────────────┬──────────────────────┐
│ Version │ TemplateID  │ CreatedAt  │ ChangeDescription    │
├─────────┼─────────────┼────────────┼──────────────────────┤
│    1    │     39      │ 26/12/2025 │ Versión histórica... │
│    1    │     39      │ 26/12/2025 │ Actualización de...  │  ← NUEVO
└─────────┴─────────────┴────────────┴──────────────────────┘

Templates:
┌─────────────┬─────────┬─────────┐
│ TemplateID  │ Nombre  │ Version │
├─────────────┼─────────┼─────────┤
│     39      │ nnjknjl │    2    │  ← Actualizada
└─────────────┴─────────┴─────────┘
```

## 🧪 Script de Prueba Rápida

He creado un script para simular el cambio: `probar-cambio-version.ps1`

Ejecuta:
```powershell
.\backend-frigo\probar-cambio-version.ps1
```

## ❓ Preguntas Frecuentes

### ¿Por qué no veo mis cambios en el historial?
**Respuesta:** No cambiaste el número de versión. Solo editar campos no guarda snapshot.

### ¿Puedo ver todos los cambios que hice?
**Respuesta:** Solo verás cambios cuando cambies el número de versión. Cada cambio de versión guarda un snapshot completo.

### ¿Qué pasa con los formularios ya llenados?
**Respuesta:** Los formularios llenados mantienen su versión original. Si llenaste con "Versión 1", siempre se verá con esa versión.

### ¿Cuándo debo cambiar la versión?
**Respuesta:** Cuando hagas cambios significativos:
- Añadir/quitar campos importantes
- Cambiar la estructura del formulario
- Modificar firmas requeridas
- Cambios que afecten el llenado

## 📈 Ejemplo de Uso Real

```
Día 1: Creas plantilla "Control de Calidad" - Versión 1
       ↓
Día 5: Añades campo "Temperatura" → Cambias a Versión 1.1
       ↓ (Snapshot guardado)
Día 10: Modificas firmas → Cambias a Versión 1.2
       ↓ (Snapshot guardado)
Día 20: Reestructuras todo → Cambias a Versión 2.0
       ↓ (Snapshot guardado)

Historial:
- Versión 2.0 (ACTUAL)
- Versión 1.2
- Versión 1.1
- Versión 1.0
```

## ✨ Ventajas de Este Sistema

1. **No guarda cambios menores** (correcciones de typos)
2. **Control manual** de qué es una "nueva versión"
3. **Snapshots completos** - puedes restaurar cualquier versión
4. **Trazabilidad** - sabes cuándo y por qué cambió

## 🚀 Próximos Pasos

1. **Inicia el backend**: `cd backend-frigo ; dotnet run`
2. **Edita tu plantilla** "nnjknjl"
3. **Cambia versión** de "1" a "2"
4. **Guarda y verifica** el historial

¡El sistema está listo para usar! 🎉
