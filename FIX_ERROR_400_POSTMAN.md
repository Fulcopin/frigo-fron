# 🚨 SOLUCIÓN AL ERROR 400 - Formato Correcto para Postman

## ❌ Error que estabas recibiendo:

```json
{
    "status": 400,
    "errors": {
        "template": [
            "The template field is required."
        ],
        "$.headerFields": [
            "The JSON value could not be converted to System.String..."
        ]
    }
}
```

## ✅ Problema Identificado:

Tu API backend espera:
- Un objeto `template` que contenga todos los campos
- Los campos `headerFields`, `bodyElements` y `firmas` como **STRINGS JSON**, no como objetos

---

## 📦 ARCHIVOS CORREGIDOS (NUEVOS)

He creado nuevos archivos con el formato correcto:

### 1. `TEMPLATE_10_CORREGIDO_POSTMAN.json` ✅
- **Formato correcto:** Campos JSON como strings
- **Usa este:** En lugar de `TEMPLATE_10_CORREGIDO_FINAL.json`

### 2. `TEMPLATE_9_CORREGIDO_POSTMAN.json` ✅
- **Formato correcto:** Campos JSON como strings
- **Usa este:** En lugar de `TEMPLATE_9_CORREGIDO_FINAL.json`

---

## 🚀 CÓMO USAR EN POSTMAN (CORRECTO)

### Template 10:

```
Método: PUT
URL: http://localhost:5189/api/templates/10
Headers:
  Content-Type: application/json

Body (raw JSON):
{Copiar TODO el contenido de TEMPLATE_10_CORREGIDO_POSTMAN.json}
```

**Ejemplo del formato correcto:**
```json
{
  "template": {
    "templateId": 10,
    "codigo": "FOR-PD-4",
    "nombre": "CONTROL DE PRODUCCIÓN PARA FILETEO",
    "headerFields": "[{\"id\":\"fecha\",\"name\":\"fecha\"...}]",
    "bodyElements": "[{\"id\":\"tabla-fileteo\",\"type\":\"table\"...}]",
    "firmas": "[{\"id\":\"firma-asistente\"...}]"
  }
}
```

**Nota:** Los campos `headerFields`, `bodyElements` y `firmas` son **STRINGS** (con comillas y escapadas).

---

### Template 9:

```
Método: PUT
URL: http://localhost:5189/api/templates/9
Headers:
  Content-Type: application/json

Body (raw JSON):
{Copiar TODO el contenido de TEMPLATE_9_CORREGIDO_POSTMAN.json}
```

---

## 📋 PASOS DETALLADOS EN POSTMAN

### 1️⃣ Abrir Postman

### 2️⃣ Crear nuevo Request
- Click en "New" → "HTTP Request"
- O usar una request existente

### 3️⃣ Configurar Request para Template 10:
```
Método: PUT (dropdown)
URL: http://localhost:5189/api/templates/10
```

### 4️⃣ Agregar Header:
- Tab "Headers"
- Key: `Content-Type`
- Value: `application/json`

### 5️⃣ Agregar Body:
- Tab "Body"
- Seleccionar: `raw`
- Dropdown a la derecha: `JSON`
- Copiar y pegar **TODO** el contenido de `TEMPLATE_10_CORREGIDO_POSTMAN.json`

### 6️⃣ Enviar:
- Click en "Send"
- Deberías recibir: `200 OK`

### 7️⃣ Repetir para Template 9:
- Cambiar URL a: `http://localhost:5189/api/templates/9`
- Copiar contenido de `TEMPLATE_9_CORREGIDO_POSTMAN.json`
- Click en "Send"

---

## ✅ VERIFICAR QUE FUNCIONÓ

### Opción 1: PowerShell
```powershell
.\verificar-templates-corregidos.ps1
```

### Opción 2: Postman GET
```
GET http://localhost:5189/api/templates/10
GET http://localhost:5189/api/templates/9
```

Verifica que las respuestas contengan los campos corregidos con `name` únicos.

---

## 🔍 DIFERENCIA ENTRE ARCHIVOS

### ❌ Archivos ANTERIORES (NO USAR):
- `TEMPLATE_10_CORREGIDO_FINAL.json` ← Formato incorrecto
- `TEMPLATE_9_CORREGIDO_FINAL.json` ← Formato incorrecto

Estos tenían `headerFields` como objeto JSON, pero la API espera string.

### ✅ Archivos NUEVOS (USAR):
- `TEMPLATE_10_CORREGIDO_POSTMAN.json` ← Formato correcto ✅
- `TEMPLATE_9_CORREGIDO_POSTMAN.json` ← Formato correcto ✅

Estos tienen `headerFields`, `bodyElements` y `firmas` como strings JSON escapados.

---

## 📊 ESTRUCTURA CORRECTA

### Lo que la API espera:

```json
{
  "template": {                                    ← Objeto contenedor
    "templateId": 10,
    "codigo": "...",
    "nombre": "...",
    "headerFields": "[{...},{...}]",              ← STRING (no objeto)
    "bodyElements": "[{...},{...}]",              ← STRING (no objeto)
    "firmas": "[{...}]"                           ← STRING (no objeto)
  }
}
```

### ❌ Lo que NO funciona:

```json
{
  "templateId": 10,                               ← Sin "template" wrapper
  "headerFields": [{...}]                         ← Objeto (no string)
}
```

---

## 🎯 RESUMEN DE CAMBIOS EN LOS TEMPLATES

Ambos archivos corregidos (`TEMPLATE_10_CORREGIDO_POSTMAN.json` y `TEMPLATE_9_CORREGIDO_POSTMAN.json`) mantienen los mismos cambios que solucionan la duplicación:

### Template 10:
- ✅ `PESO_BRUTO` (name único)
- ✅ `PESO_NETO_LBS` (name único)
- ✅ Todos los campos con `id` y `name` únicos

### Template 9:
- ✅ `CANTIDAD_MATERIAL` (en tabla Material de Empaque)
- ✅ `CANTIDAD_SUBPRODUCTO` (en tabla Subproductos)
- ✅ Todos los campos con `id` y `name` únicos

---

## 🔧 TROUBLESHOOTING

### Si sigues recibiendo error 400:

1. **Verifica el backend esté corriendo:**
   ```powershell
   # En terminal backend-frigo
   dotnet run
   ```

2. **Verifica la URL en Postman:**
   ```
   http://localhost:5189/api/templates/10
   ```
   (Sin `/api/templates/10/update` u otra variación)

3. **Verifica el Content-Type:**
   ```
   Headers tab → Content-Type: application/json
   ```

4. **Copia el JSON completo:**
   - Abre `TEMPLATE_10_CORREGIDO_POSTMAN.json` en VS Code
   - Ctrl + A (seleccionar todo)
   - Ctrl + C (copiar)
   - Pega en Postman Body

5. **Verifica que sea método PUT:**
   - No GET, no POST
   - PUT específicamente

---

## ✅ RESULTADO ESPERADO

Después de enviar el PUT request exitosamente:

```json
// Respuesta 200 OK
{
  "message": "Template updated successfully",
  "templateId": 10
}
```

O similar (depende de tu API).

---

## 🎉 PRÓXIMOS PASOS

Una vez que ambos templates se actualicen exitosamente:

1. ✅ Ejecutar: `.\verificar-templates-corregidos.ps1`
2. ✅ Recargar frontend (F5)
3. ✅ Probar formularios
4. ✅ Verificar que NO haya duplicación de datos

---

**Usa los archivos:** 
- ✅ `TEMPLATE_10_CORREGIDO_POSTMAN.json`
- ✅ `TEMPLATE_9_CORREGIDO_POSTMAN.json`

**Ignora los archivos:**
- ❌ `TEMPLATE_10_CORREGIDO_FINAL.json`
- ❌ `TEMPLATE_9_CORREGIDO_FINAL.json`

¡Buena suerte! 🚀
