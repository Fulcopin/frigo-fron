# 🎯 GUÍA: SISTEMA DE FORMULARIOS MAESTROS

## 📋 **¿Qué es un Formulario Maestro?**

Un **Formulario Maestro** es un formulario especial que tiene activada la funcionalidad de **auto-suma automática** cuando escribes valores en las columnas de PESO.

### ✅ **Características:**
- ✨ Calcula automáticamente el TOTAL al escribir valores de PESO
- 🔄 Botón "Recalcular Totales" visible
- ⭐ Badge dorado "Maestro" en la tarjeta del formulario
- 📊 Ideal para formularios como "15 TINAS" donde necesitas sumar pesos

### ❌ **Formularios Normales:**
- No calculan totales automáticamente
- Puedes escribir libremente sin auto-cálculos
- Ideal para formularios de fileteo, calidad, etc.

---

## 🚀 **CÓMO USAR EL SISTEMA**

### **1️⃣ EJECUTAR EL SCRIPT SQL (SOLO UNA VEZ)**

Antes de usar el sistema, necesitas agregar la columna `IsMasterForm` a la base de datos:

1. Abre **SQL Server Management Studio** o **Azure Data Studio**
2. Conecta a tu base de datos
3. Abre el archivo: `SCRIPT_ADD_ISMASTERFORM.sql`
4. **Cambia** el nombre de la base de datos en la línea 4:
   ```sql
   USE FormBuilderDB; -- ⚠️ Cambia esto por el nombre de TU base de datos
   ```
5. Ejecuta el script (F5)
6. Verás el mensaje: `✅ Columna IsMasterForm agregada exitosamente`

---

### **2️⃣ MARCAR UN FORMULARIO COMO MAESTRO**

Hay dos formas:

#### **Opción A: Desde la página HOME (RECOMENDADO)**

1. Ve a **http://localhost:5173** (página principal)
2. Busca la tarjeta del formulario que quieres marcar
3. Activa el switch **"Marcar como Maestro"** ⭐
4. Verás el badge dorado **"⭐ Maestro"** en la esquina superior
5. ¡Listo! Ese formulario ahora tiene auto-suma activada

#### **Opción B: Usando Postman o cURL**

```bash
# Marcar formulario con ID 15 como maestro
curl -X PATCH http://localhost:5074/api/Templates/15/master-form \
  -H "Content-Type: application/json" \
  -d '{"isMasterForm": true}'

# Desmarcar
curl -X PATCH http://localhost:5074/api/Templates/15/master-form \
  -H "Content-Type: application/json" \
  -d '{"isMasterForm": false}'
```

---

### **3️⃣ VERIFICAR QUE FUNCIONA**

#### **Prueba con Formulario Maestro (ej: 15 TINAS):**

1. Abre el formulario marcado como maestro
2. Escribe valores en las columnas **PESO**:
   - PESO 1: `10.5`
   - PESO 2: `15.3`
   - PESO 3: `8.7`
3. ✅ **El TOTAL se calculará automáticamente**: `34.50`
4. Verás en consola:
   ```
   ✅ Auto-suma ACTIVADO para: "REGISTRO RECEPCIÓN 15 TINAS" (isMasterForm=true)
   ```

#### **Prueba con Formulario Normal (ej: FILETEO):**

1. Abre un formulario NO marcado como maestro
2. Escribe cualquier valor en **TOTAL CAJAS/TINAS**: `87`
3. ✅ **NO se copiará** a otras columnas automáticamente
4. Verás en consola:
   ```
   ⛔ Auto-suma DESACTIVADO para: "FILETEO"
   ```

---

## 🔧 **CÓMO FUNCIONA TÉCNICAMENTE**

### **Backend (C#)**

1. **Modelo actualizado** (`Template.cs`):
   ```csharp
   public bool IsMasterForm { get; set; } = false;
   ```

2. **Nuevo endpoint** (`TemplatesController.cs`):
   ```csharp
   [HttpPatch("{id}/master-form")]
   public async Task<IActionResult> UpdateMasterFormStatus(int id, [FromBody] MasterFormUpdate update)
   ```

3. **Base de datos**:
   - Nueva columna: `Templates.IsMasterForm` (BIT, DEFAULT 0)

### **Frontend (React)**

1. **Función helper** (`FillForm.jsx`):
   ```javascript
   const shouldEnableAutoSum = useCallback(() => {
     const isMasterFormFromBackend = selectedTemplate.isMasterForm === true;
     const isTinasForm = formName.includes('TINA') || formName.includes('15'); // Fallback
     return isMasterFormFromBackend || isTinasForm;
   }, [selectedTemplate]);
   ```

2. **Auto-suma condicional**:
   ```javascript
   const isAutoSumEnabled = shouldEnableAutoSum();
   if (isAutoSumEnabled) {
     // Calcular total automáticamente
   }
   ```

3. **UI para marcar** (`Home.jsx`):
   - Switch toggle en cada tarjeta de formulario
   - Badge visual "⭐ Maestro"
   - Llamada PATCH al backend

---

## 📊 **CASOS DE USO**

### ✅ **Cuándo marcar como MAESTRO:**

- 📦 Formulario "15 TINAS" (suma de pesos por tina)
- ⚖️ Formulario "Control de Peso" (totales de balanzas)
- 📊 Formulario "Producción Diaria" (suma de lotes)
- 🏭 Cualquier formulario con cálculos automáticos de TOTAL

### ❌ **Cuándo NO marcar como MAESTRO:**

- 🐟 Formulario "Fileteo" (datos independientes)
- 🧪 Formulario "Calidad Sensorial" (evaluaciones cualitativas)
- 📝 Formulario "Observaciones" (texto libre)
- 📋 Formulario "Checklist" (sin cálculos numéricos)

---

## 🐛 **SOLUCIÓN DE PROBLEMAS**

### **Problema 1: El switch no aparece en Home**

**Solución:**
1. Verifica que ejecutaste el script SQL
2. Reinicia el backend: `dotnet run`
3. Recarga la página (F5)

### **Problema 2: El auto-suma no funciona**

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca el mensaje:
   - ✅ `Auto-suma ACTIVADO` → Está funcionando
   - ⛔ `Auto-suma DESACTIVADO` → El formulario no está marcado como maestro
3. Marca el formulario como maestro desde Home
4. Recarga el formulario

### **Problema 3: Error "Column IsMasterForm does not exist"**

**Solución:**
1. Ejecuta el script SQL: `SCRIPT_ADD_ISMASTERFORM.sql`
2. Verifica que la columna existe:
   ```sql
   SELECT TOP 5 TemplateID, Nombre, IsMasterForm FROM Templates;
   ```

### **Problema 4: El total se calcula en formularios que no quiero**

**Solución:**
1. Ve a Home
2. Desactiva el switch "Marcar como Maestro" en ese formulario
3. Recarga el formulario

---

## 🎓 **EJEMPLOS PRÁCTICOS**

### **Ejemplo 1: Marcar "15 TINAS" como Maestro**

```javascript
// Desde la consola del navegador (F12)
await fetch('http://localhost:5074/api/Templates/15/master-form', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isMasterForm: true })
});
```

### **Ejemplo 2: Verificar estado actual**

```javascript
// Obtener info del formulario
const response = await fetch('http://localhost:5074/api/Templates/15');
const template = await response.json();
console.log('Es maestro?', template.isMasterForm); // true o false
```

---

## 📚 **ARCHIVOS MODIFICADOS**

### **Backend:**
- `Models/Template.cs` → Campo `IsMasterForm`
- `Controllers/TemplatesController.cs` → Endpoint PATCH `/master-form`
- `SCRIPT_ADD_ISMASTERFORM.sql` → Script de migración

### **Frontend:**
- `src/pages/FillForm.jsx` → Función `shouldEnableAutoSum()`
- `src/pages/Home.jsx` → Switch toggle para marcar maestros
- `src/pages/Home.css` → Estilos del badge y switch

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

- [ ] Ejecutar script SQL `SCRIPT_ADD_ISMASTERFORM.sql`
- [ ] Verificar que la columna existe en la base de datos
- [ ] Reiniciar el backend (`dotnet run`)
- [ ] Recargar el frontend (F5)
- [ ] Marcar "15 TINAS" como Formulario Maestro
- [ ] Probar auto-suma en formulario maestro
- [ ] Verificar que formularios normales NO tienen auto-suma
- [ ] Confirmar que aparece el badge "⭐ Maestro"

---

## 🎯 **RESULTADO FINAL**

Ahora tienes un sistema **flexible y escalable** donde:

1. ✅ Solo los formularios que TÚ marques tendrán auto-suma
2. ✅ El resto de formularios funcionan normalmente
3. ✅ Puedes cambiar el estado en cualquier momento desde Home
4. ✅ El sistema detecta automáticamente desde el backend
5. ✅ Compatible con formularios existentes (fallback por nombre)

---

**¿Dudas?** Revisa los logs en la consola del navegador (F12) para ver si el auto-suma está activado o no.

**¡Listo para usar!** 🚀
