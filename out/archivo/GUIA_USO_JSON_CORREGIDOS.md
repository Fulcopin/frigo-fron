# 📋 Guía de Uso de JSONs Corregidos

## 🎯 Objetivo
Los archivos JSON corregidos eliminan las **duplicaciones de nombres de columnas** que causaban que los datos se pasaran entre tablas.

## ✅ Archivos Generados

### 1. `TEMPLATE_10_CORREGIDO_FINAL.json`
**Plantilla:** CONTROL DE PRODUCCIÓN PARA FILETEO

**Problemas corregidos:**
- ❌ Antes: Todas las columnas tenían `label` pero sin `id` ni `name` únicos
- ✅ Ahora: 
  - `PESO BRUTO` → `id: "col-peso-bruto"`, `name: "PESO_BRUTO"`
  - `PESO NETO LBS.` → `id: "col-peso-neto"`, `name: "PESO_NETO_LBS"`
  - Todas las columnas tienen identificadores únicos

### 2. `TEMPLATE_9_CORREGIDO_FINAL.json`
**Plantilla:** CONTROL DE PRODUCTOS CONGELADOS (LIBERACIÓN DE TÚNELES)

**Problemas corregidos:**
- ❌ Antes: Columna "CANTIDAD" aparecía en 2 tablas diferentes sin distinción
- ✅ Ahora:
  - Tabla "Material de Empaque" → `name: "CANTIDAD_MATERIAL"`
  - Tabla "Subproductos" → `name: "CANTIDAD_SUBPRODUCTO"`
  - Ya no se cruzan los datos entre tablas

---

## 🚀 Cómo Actualizar las Plantillas

### Opción 1: Usar Postman (Recomendado)

#### Template 10 (Fileteo):
```http
PUT http://localhost:5189/api/templates/10
Content-Type: application/json

{
  "templateId": 10,
  "codigo": "FOR-PD-4",
  ...
  [Copiar todo el contenido de TEMPLATE_10_CORREGIDO_FINAL.json]
}
```

#### Template 9 (Control Congelados):
```http
PUT http://localhost:5189/api/templates/9
Content-Type: application/json

{
  "templateId": 9,
  "codigo": "FOR-CPCLT",
  ...
  [Copiar todo el contenido de TEMPLATE_9_CORREGIDO_FINAL.json]
}
```

**Pasos en Postman:**
1. Abrir Postman
2. Crear nueva request → Método: `PUT`
3. URL: `http://localhost:5189/api/templates/10` (o 9 según corresponda)
4. Tab **Headers**:
   - Key: `Content-Type`
   - Value: `application/json`
5. Tab **Body**:
   - Seleccionar `raw`
   - Seleccionar `JSON` en el dropdown
   - Copiar y pegar el contenido del archivo JSON corregido
6. Click en **Send**
7. Verificar respuesta `200 OK`

---

### Opción 2: Usar SQL Server (Alternativa)

Si prefieres actualizar directamente en la base de datos:

```sql
-- Template 10
UPDATE Templates
SET StructureJSON = '{...JSON completo aquí...}'
WHERE TemplateID = 10;

-- Template 9
UPDATE Templates
SET StructureJSON = '{...JSON completo aquí...}'
WHERE TemplateID = 9;
```

⚠️ **ADVERTENCIA:** Escapa correctamente las comillas del JSON antes de usar SQL.

---

## ✅ Verificación Post-Actualización

Después de actualizar las plantillas:

### 1. Recargar Frontend
```
F5 en el navegador
```

### 2. Abrir Formulario
- Ir a "Plantillas" o "Formularios"
- Abrir "CONTROL DE PRODUCCIÓN PARA FILETEO" (Template 10)
- O "CONTROL DE PRODUCTOS CONGELADOS" (Template 9)

### 3. Verificar Comportamiento
✅ **Checklist de Verificación:**

- [ ] Las columnas se muestran correctamente
- [ ] No hay columnas duplicadas visualmente
- [ ] Al escribir en "PESO BRUTO", el valor NO se copia a otra columna
- [ ] Al escribir en "CANTIDAD" (tabla Material), el valor NO se copia a "CANTIDAD" (tabla Subproductos)
- [ ] El auto-guardado funciona sin errores
- [ ] Los datos se guardan correctamente en la base de datos
- [ ] Al recargar el formulario guardado, los datos aparecen en las columnas correctas

### 4. Revisar Consola (F12)
- No deben aparecer errores de duplicados
- Los logs deben mostrar nombres únicos para cada columna

---

## 🔑 Conceptos Clave

### ¿Por qué se duplicaban los datos?

**Problema anterior:**
```json
// Tabla 1
{"label": "CANTIDAD", "type": "number"}

// Tabla 2
{"label": "CANTIDAD", "type": "number"}
```

Cuando el frontend guardaba los datos, usaba `label` como identificador, entonces:
- Escribías `100` en Tabla 1 → Se guardaba como `{CANTIDAD: 100}`
- Escribías `50` en Tabla 2 → Se guardaba como `{CANTIDAD: 50}` ← **SOBRESCRIBÍA EL ANTERIOR**

**Solución:**
```json
// Tabla 1
{"id": "col-cantidad-material", "name": "CANTIDAD_MATERIAL", "label": "CANTIDAD"}

// Tabla 2
{"id": "col-cantidad-subprod", "name": "CANTIDAD_SUBPRODUCTO", "label": "CANTIDAD"}
```

Ahora los datos se guardan como:
- Tabla 1: `{CANTIDAD_MATERIAL: 100}`
- Tabla 2: `{CANTIDAD_SUBPRODUCTO: 50}`

✅ **YA NO SE SOBRESCRIBEN**

---

## 🛠️ Si Necesitas Corregir Más Plantillas

### Reglas para evitar duplicados:

1. **Cada columna DEBE tener un `id` único** en toda la plantilla
   ```json
   "id": "col-peso-bruto-tabla1"
   ```

2. **Cada columna DEBE tener un `name` único** en toda la plantilla
   ```json
   "name": "PESO_BRUTO_FILETEO"
   ```

3. **El `label` puede repetirse** (es solo para mostrar)
   ```json
   "label": "PESO BRUTO"  // Puede repetirse visualmente
   ```

4. **Nomenclatura recomendada para `name`:**
   - Usar MAYÚSCULAS
   - Separar con guion bajo `_`
   - Incluir contexto de la tabla: `CANTIDAD_MATERIAL` vs `CANTIDAD_SUBPRODUCTO`
   - Ser descriptivo: `PESO_BRUTO` vs `PESO_NETO`

### Ejemplo de estructura correcta:
```json
{
  "id": "tabla-produccion",
  "type": "table",
  "title": "Registro de Producción",
  "columns": [
    {
      "id": "col-prod-peso-bruto",
      "name": "PESO_BRUTO_PRODUCCION",
      "label": "PESO BRUTO",
      "type": "number"
    },
    {
      "id": "col-prod-peso-neto",
      "name": "PESO_NETO_PRODUCCION",
      "label": "PESO NETO",
      "type": "number"
    }
  ]
}
```

---

## 📞 Soporte

Si después de aplicar los cambios los datos aún se duplican:

1. Verifica que el backend esté actualizado
2. Limpia la caché del navegador (Ctrl + Shift + Delete)
3. Revisa la consola del navegador (F12) para ver errores
4. Verifica que el JSON fue actualizado correctamente en la DB

---

## 📝 Notas Finales

- ✅ Los archivos JSON están listos para usar en Postman
- ✅ No necesitas modificar código del frontend
- ✅ Solo actualiza las plantillas en el backend/DB
- ✅ El sistema automáticamente usará los nuevos `name` únicos
- ✅ Los formularios ya guardados seguirán funcionando (migración automática)

**Recuerda:** Haz un respaldo de la base de datos antes de actualizar!
