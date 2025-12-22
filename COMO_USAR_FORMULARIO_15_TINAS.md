# 📋 Cómo Usar el Formulario de 15 Tinas

## 🌐 Acceso al Formulario

### Tienes DOS versiones disponibles:

#### 1️⃣ **Registro 15 Tinas (Versión Fija)**
- **URL:** http://localhost:5173/registro-15-tinas
- **Características:**
  - ✅ 15 tinas fijas (T1 a T15)
  - ✅ 5 columnas de peso por tina
  - ✅ No se pueden agregar/quitar tinas
  - ✅ Estructura simple y rápida

#### 2️⃣ **Registro Tinas Dinámico**
- **URL:** http://localhost:5173/registro-15-tinas-dinamico
- **Características:**
  - ✅ Puedes agregar/quitar tinas dinámicamente
  - ✅ Puedes agregar/quitar columnas de peso
  - ✅ Más flexible
  - ✅ Ideal si no siempre usas las 15 tinas

---

## 📝 Estructura del Formulario

### 📋 Sección de Encabezado

Campos obligatorios:
- **Fecha**: Fecha del registro
- **Turno**: Seleccionar entre Mañana, Tarde o Noche
- **Responsable**: Nombre del responsable
- **Lote**: Código del lote

### 📊 Tabla de 15 Tinas

Cada **FILA** representa una **TINA** completa:

```
┌──────────┬──────┬─────────┬─────────┬─────────┬─────────┬─────────┬──────────┐
│ ⏰ HORA  │ 🔵   │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ 📊      │
│          │ TINA │ PESO 1  │ PESO 2  │ PESO 3  │ PESO 4  │ PESO 5  │ TOTAL    │
├──────────┼──────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────┤
│ [input]  │  T1  │ [input] │ [input] │ [input] │ [input] │ [input] │ [auto]   │
│ [input]  │  T2  │ [input] │ [input] │ [input] │ [input] │ [input] │ [auto]   │
│ [input]  │  T3  │ [input] │ [input] │ [input] │ [input] │ [input] │ [auto]   │
│   ...    │ ...  │   ...   │   ...   │   ...   │   ...   │   ...   │   ...    │
│ [input]  │  T15 │ [input] │ [input] │ [input] │ [input] │ [input] │ [auto]   │
└──────────┴──────┴─────────┴─────────┴─────────┴─────────┴─────────┴──────────┘

🏆 TOTAL GENERAL: [calculado automáticamente]
```

---

## 🚀 Cómo Llenar el Formulario

### Paso 1: Encabezado

1. **Fecha**: Click en el campo y selecciona la fecha
2. **Turno**: Click y selecciona (Mañana/Tarde/Noche)
3. **Responsable**: Escribe el nombre
4. **Lote**: Escribe el código del lote

### Paso 2: Llenar Tinas (Una por Una)

#### Para la TINA T1:
1. **HORA**: Escribe la hora (ej: `08:00`)
2. **TINA**: Ya viene pre-llenado con `T1`
3. **PESO 1**: Escribe el primer peso (ej: `25.5`)
4. **PESO 2**: Escribe el segundo peso (ej: `30.2`)
5. **PESO 3**: Escribe el tercer peso (ej: `22.8`)
6. **PESO 4**: Escribe el cuarto peso (ej: `28.0`)
7. **PESO 5**: Escribe el quinto peso (ej: `24.5`)
8. **TOTAL**: ✅ Se calcula automáticamente (131.0 kg)

#### Repite para T2, T3... hasta T15

**💡 Tip:** Si una tina no tiene datos, déjala en ceros.

### Paso 3: Firmas (Opcional)

Al final del formulario puedes agregar:
- Nombre del Asistente
- Nombre del Supervisor
- Nombre del Jefe de Calidad

### Paso 4: Guardar

1. Click en el botón **💾 Guardar Formulario**
2. Si hay advertencias (campos vacíos), te preguntará si deseas continuar
3. Al guardar exitosamente, verás:
   - ✅ Alert: "Formulario guardado exitosamente"
   - ✅ Redirección a la lista de formularios

---

## ⚡ Características Automáticas

### 📊 Cálculos Automáticos

- **Total por Tina**: Se calcula automáticamente sumando los 5 pesos
- **Total General**: Se calcula automáticamente sumando todos los totales de tinas

### ✅ Validaciones

- **Advertencias amigables**: Si faltan campos importantes, te lo indica pero permite continuar
- **Confirmación**: Si hay advertencias, te pregunta si deseas guardar de todas formas

---

## 🎨 Navegación

### Desde el Menú Principal:

```
┌─────────────────────────────────────────┐
│ 🏠 Inicio                               │
│ 📝 Crear Formulario                     │
│ 📋 Gestionar Formularios                │
│ 👁️  Ver Formularios Llenados            │
│ ➕ Llenar Formulario                    │
│ 📊 Registro 15 Tinas       ← AQUÍ      │
│ 📊 Registro Tinas Dinámico ← O AQUÍ    │
└─────────────────────────────────────────┘
```

### Atajos de Teclado:

- **Tab**: Navegar entre campos
- **Shift + Tab**: Volver al campo anterior
- **Enter**: Siguiente campo (en algunos navegadores)

---

## 📊 Ejemplo Completo

### Datos de Ejemplo para Probar:

```
ENCABEZADO:
- Fecha: 22/12/2025
- Turno: Mañana
- Responsable: Juan Pérez
- Lote: LOTE-001

TINA T1:
- Hora: 08:00
- Peso 1: 25.5 kg
- Peso 2: 30.2 kg
- Peso 3: 22.8 kg
- Peso 4: 28.0 kg
- Peso 5: 24.5 kg
→ Total: 131.0 kg ✅

TINA T2:
- Hora: 08:15
- Peso 1: 27.3 kg
- Peso 2: 29.1 kg
- Peso 3: 26.4 kg
- Peso 4: 25.7 kg
- Peso 5: 31.2 kg
→ Total: 139.7 kg ✅

... (continúa con T3 a T15)

TOTAL GENERAL: 2,112.0 kg 🏆
```

---

## 🔍 Verificar Datos Guardados

### Desde PowerShell:

```powershell
# Ver todos los formularios guardados
Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/FilledForms/template/36" -Method GET | ConvertTo-Json -Depth 10
```

### Desde el Frontend:

1. Click en **👁️ Ver Formularios Llenados**
2. Verás la lista de formularios guardados
3. Click en uno para ver los detalles

---

## ⚠️ Solución de Problemas

### ❌ "Failed to fetch" o no se guarda

**Solución:**
1. Verifica que el backend esté corriendo:
   ```powershell
   netstat -ano | findstr :5074
   ```
2. Verifica la consola del navegador (F12)
3. Asegúrate de que el `.env` tenga: `VITE_API_BASE_URL=http://127.0.0.1:5074/api`

### ❌ Los totales no se calculan

**Solución:**
1. Recarga la página (F5)
2. Verifica que los pesos sean números válidos
3. No uses comas, usa puntos para decimales (25.5 ✅, 25,5 ❌)

### ❌ No aparece el diseño CSS

**Solución:**
1. Recarga con caché limpio (Ctrl + Shift + R)
2. Verifica que el archivo `Registro15Tinas.css` exista
3. Abre la consola (F12) y busca errores

---

## 🎯 URLs Directas

### Formularios:
- **Fijo**: http://localhost:5173/registro-15-tinas
- **Dinámico**: http://localhost:5173/registro-15-tinas-dinamico

### Otras páginas:
- **Inicio**: http://localhost:5173/
- **Ver Formularios**: http://localhost:5173/view-forms
- **Crear Template**: http://localhost:5173/create-template

---

## 📱 Responsividad

El formulario se adapta a diferentes tamaños de pantalla:

- **Desktop (>1200px)**: Tabla completa visible
- **Tablet (768px-1199px)**: Scroll horizontal para ver todas las columnas
- **Mobile (<768px)**: Vista de tarjetas (cards) apiladas

---

## 💡 Tips de Uso

1. **Guarda frecuentemente**: El formulario no tiene autoguardado aún
2. **Usa Tab**: Es más rápido que el mouse para navegar
3. **Revisa los totales**: Verifica que los cálculos automáticos sean correctos
4. **Deja en ceros**: Si una tina no se usó, déjala en ceros (no elimines la fila)
5. **Copia los datos**: Puedes copiar/pegar desde Excel si tienes los datos ahí

---

## 📞 Siguiente Paso: Probar el Formulario

**¡Ya está todo listo!** 🎉

1. ✅ El formulario ya está abierto en VS Code
2. ✅ Prueba llenarlo con datos de ejemplo
3. ✅ Haz click en **💾 Guardar Formulario**
4. ✅ Verifica que se guardó correctamente

---

**Última actualización:** 22/12/2025  
**Template ID:** 36  
**Código:** FRM-TINAS-15-VERTICAL
