# Guía para actualizar Template 10 en Postman

## Paso 1: Obtener el JSON actual

**Método:** GET  
**URL:** `http://localhost:5189/api/templates/10`

Copia la respuesta completa.

---

## Paso 2: Corregir el JSON

Busca en `bodyElements[0].columns` (la primera tabla) las columnas que se llaman "PESO BRUTO".

**PROBLEMA:** Tienes dos columnas con el mismo nombre:
```json
{
  "id": "peso-bruto-col4",
  "label": "PESO BRUTO",
  "type": "number"
},
{
  "id": "peso-bruto-col5",
  "label": "PESO BRUTO",
  "type": "number"
}
```

**SOLUCIÓN:** Cambiar los `id` y `name` para que sean únicos:

```json
{
  "id": "peso-bruto-1",
  "name": "PESO BRUTO 1",
  "label": "PESO BRUTO",
  "type": "number"
},
{
  "id": "peso-bruto-2",
  "name": "PESO BRUTO 2",
  "label": "PESO BRUTO",
  "type": "number"
}
```

---

## Paso 3: Actualizar en Postman

**Método:** PUT  
**URL:** `http://localhost:5189/api/templates/10`  
**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "templateID": 10,
  "nombre": "CONTROL DE PRODUCTOS CONGELADOS (LIBERACIÓN DE TÚNELES)",
  "structureJSON": {
    "headerData": [
      {
        "id": "fecha",
        "label": "Fecha",
        "type": "date",
        "required": true,
        "editable": false
      }
    ],
    "bodyElements": [
      {
        "id": "tabla-principal",
        "type": "table",
        "defaultRows": 10,
        "columns": [
          {
            "id": "hora",
            "label": "HORA",
            "type": "time"
          },
          {
            "id": "tina",
            "label": "TINA *",
            "type": "text",
            "required": true
          },
          {
            "id": "codigos",
            "label": "CÓDIGOS DE MAT. PRIMA",
            "type": "text"
          },
          {
            "id": "especie",
            "label": "ESPECIE / PRESENTACIÓN",
            "type": "text"
          },
          {
            "id": "peso-bruto-1",
            "name": "PESO BRUTO 1",
            "label": "PESO BRUTO",
            "type": "number"
          },
          {
            "id": "peso-bruto-2",
            "name": "PESO BRUTO 2",
            "label": "PESO BRUTO",
            "type": "number"
          }
        ]
      }
    ]
  },
  "isMasterForm": false
}
```

---

## Paso 4: Verificar

1. Recarga tu aplicación frontend (F5)
2. Abre el formulario "CONTROL DE PRODUCTOS CONGELADOS"
3. Verifica que ambas columnas "PESO BRUTO" estén vacías
4. Los valores NO deben copiarse entre columnas

---

## Notas Importantes

⚠️ **No uses el mismo `id` o `name` para columnas diferentes**, aunque tengan el mismo `label`.

✅ **Buena práctica:**
- `id`: único (peso-bruto-1, peso-bruto-2)
- `name`: único (PESO BRUTO 1, PESO BRUTO 2)
- `label`: puede repetirse (PESO BRUTO, PESO BRUTO)

❌ **Mala práctica:**
```json
{
  "id": "peso-bruto",  // ❌ DUPLICADO
  "label": "PESO BRUTO"
},
{
  "id": "peso-bruto",  // ❌ DUPLICADO
  "label": "PESO BRUTO"
}
```

---

## Script SQL Alternativo

Si prefieres actualizar directamente en la base de datos:

```sql
-- Primero obtén el JSON actual
SELECT StructureJSON 
FROM Templates 
WHERE TemplateID = 10;

-- Luego actualiza con el JSON corregido
UPDATE Templates
SET StructureJSON = '{...tu JSON corregido...}'
WHERE TemplateID = 10;
```
