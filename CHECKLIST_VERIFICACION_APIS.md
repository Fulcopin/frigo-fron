# ✅ Checklist de Verificación - APIs Implementadas

## 🔍 Verificación de Implementación

Usa este checklist para asegurarte de que todo funciona correctamente.

---

## 1️⃣ Verificar el Código

- [x] **Estados agregados** - `apiCatalogData` existe en FillForm.jsx
- [x] **Función `ensureApiToken()`** - Maneja autenticación
- [x] **Función `loadApiCatalog()`** - Carga datos de un endpoint
- [x] **Función `loadAllApiCatalogs()`** - Carga todos los catálogos
- [x] **`renderField()` modificado** - Detecta `apiEndpoint` y carga opciones
- [x] **Carga en confirmación de lotes** - `loadAllApiCatalogs()` se ejecuta
- [x] **Carga en modo manual** - `loadAllApiCatalogs()` se ejecuta
- [x] **Carga en modo edición** - `loadAllApiCatalogs()` se ejecuta

---

## 2️⃣ Verificar Endpoints Disponibles

Verifica que estos endpoints funcionen en tu backend:

| Endpoint | URL | Método | Token Requerido |
|----------|-----|--------|-----------------|
| Auth | `http://188.40.197.172:8094/api/Auth/login` | POST | ❌ No |
| Balanzas | `http://188.40.197.172:8094/api/Balanzas` | GET | ✅ Sí |
| Choferes | `http://188.40.197.172:8094/api/Choferes` | GET | ✅ Sí |
| Especies | `http://188.40.197.172:8094/api/Especies` | GET | ✅ Sí |
| Pesqueros | `http://188.40.197.172:8094/api/Pesqueros` | GET | ✅ Sí |
| Productos | `http://188.40.197.172:8094/api/Productos` | GET | ✅ Sí |
| Proveedores | `http://188.40.197.172:8094/api/Proveedores` | GET | ✅ Sí |
| Configuraciones | `http://188.40.197.172:8094/api/Configuraciones` | GET | ✅ Sí |

**Cómo verificar:**
1. Abre Postman o Thunder Client
2. Haz login en `/Auth/login` con las credenciales
3. Copia el token
4. Prueba cada endpoint con `Authorization: Bearer {token}`

---

## 3️⃣ Verificar en la Aplicación

### Paso 1: Abrir la Aplicación
```bash
npm run dev
```

### Paso 2: Crear un Template de Prueba
1. Ve a **"Crear Template"**
2. Crea un template con este campo en Header:
   ```json
   {
     "label": "Proveedor de Prueba",
     "type": "select",
     "apiEndpoint": "PROVEEDORES"
   }
   ```
3. Guarda el template

### Paso 3: Llenar un Formulario
1. Ve a **"Llenar Formulario"**
2. Selecciona el template creado
3. Selecciona "Modo Manual"
4. **Abre la consola del navegador (F12)**

### Paso 4: Verificar Logs
Deberías ver en consola:
```
🔄 Cargando catálogos de la API externa...
📡 Cargando Balanzas...
📡 Cargando Choferes...
📡 Cargando Especies...
📡 Cargando Pesqueros...
📡 Cargando Productos...
📡 Cargando Proveedores...
📡 Cargando Configuraciones...
✅ X Balanzas cargados
✅ X Choferes cargados
✅ X Especies cargados
✅ X Pesqueros cargados
✅ X Productos cargados
✅ X Proveedores cargados
✅ X Configuraciones cargados
✅ X Configuraciones FRIGO cargadas
✅ Catálogos cargados completamente
```

### Paso 5: Verificar el Select
1. Abre el campo "Proveedor de Prueba"
2. Debe mostrar opciones cargadas de la API
3. **Si aparece "Seleccione..." y opciones → ✅ Funciona!**

---

## 4️⃣ Pruebas por Endpoint

### Test 1: PROVEEDORES
- [ ] Crear campo con `apiEndpoint: "PROVEEDORES"`
- [ ] Verificar que muestra razones sociales
- [ ] Seleccionar un proveedor
- [ ] Guardar formulario
- [ ] Verificar que se guardó correctamente

### Test 2: CHOFERES
- [ ] Crear campo con `apiEndpoint: "CHOFERES"`
- [ ] Verificar que muestra nombres completos
- [ ] Seleccionar un chofer
- [ ] Guardar formulario

### Test 3: ESPECIES
- [ ] Crear columna de tabla con `apiEndpoint: "ESPECIES"`
- [ ] Verificar que cada fila tiene el select
- [ ] Seleccionar especies diferentes en cada fila
- [ ] Guardar formulario

### Test 4: PRODUCTOS
- [ ] Crear columna de tabla con `apiEndpoint: "PRODUCTOS"`
- [ ] Verificar que muestra descripciones
- [ ] Seleccionar productos
- [ ] Guardar formulario

### Test 5: BALANZAS
- [ ] Crear campo con `apiEndpoint: "BALANZAS"`
- [ ] Verificar que muestra nombres de balanzas
- [ ] Seleccionar una balanza
- [ ] Guardar formulario

### Test 6: PESQUEROS
- [ ] Crear campo con `apiEndpoint: "PESQUEROS"`
- [ ] Verificar que muestra nombres de pesqueros
- [ ] Seleccionar un pesquero
- [ ] Guardar formulario

### Test 7: CONFIGURACIONES_FRIGO
- [ ] Crear campo con `apiEndpoint: "CONFIGURACIONES_FRIGO"`
- [ ] Verificar que solo muestra configuraciones con "FRIGO"
- [ ] Seleccionar una configuración
- [ ] Guardar formulario

---

## 5️⃣ Verificar Modo Edición

1. Crea y guarda un formulario con campos de API
2. Ve a **"Historial"**
3. Edita el formulario guardado
4. Verifica en consola que se cargan los catálogos
5. Verifica que los selects muestran las opciones
6. Verifica que los valores guardados se muestran correctamente

---

## 6️⃣ Verificar con Lotes de la API

1. Ve a **"Llenar Formulario"**
2. Selecciona un template
3. Busca lotes por fecha
4. Selecciona uno o más lotes
5. Confirma
6. Verifica en consola que se cargan:
   - Los detalles de los lotes
   - Los catálogos de la API
7. Verifica que las tablas se llenan con datos de los lotes
8. Verifica que los selects con `apiEndpoint` funcionan

---

## 7️⃣ Errores Comunes y Soluciones

### ❌ "No se cargan las opciones en el select"

**Posibles causas:**
1. El `apiEndpoint` no está escrito correctamente
   - ✅ Correcto: `"apiEndpoint": "PROVEEDORES"`
   - ❌ Incorrecto: `"apiEndpoint": "proveedores"` (minúsculas)
   
2. El endpoint no existe en el backend
   - Verifica en Swagger: `http://188.40.197.172:8094/swagger`
   
3. El token expiró
   - Recarga la página

### ❌ "Error de autenticación"

**Solución:**
1. Verifica las credenciales en `ensureApiToken()`:
   ```javascript
   username: "iflogin",
   password: "ifpwd25"
   ```
2. Verifica que el endpoint de login funciona

### ❌ "Las opciones se duplican"

**Solución:**
- Esto es normal si recargas los catálogos varias veces
- Se soluciona recargando la página

### ❌ "No aparece ninguna opción pero no hay error"

**Solución:**
1. Verifica en consola si los datos se cargaron:
   ```javascript
   console.log(apiCatalogData.proveedores);
   ```
2. Verifica que el campo del API existe:
   - `PROVEEDORES` usa `razonSocial`
   - `CHOFERES` usa `nombreCompleto`
   - etc.

---

## 8️⃣ Verificación Final

- [ ] ✅ Todos los endpoints funcionan
- [ ] ✅ Los selects se llenan automáticamente
- [ ] ✅ Se pueden guardar formularios con datos de la API
- [ ] ✅ El modo edición carga correctamente los datos
- [ ] ✅ Los logs en consola son claros
- [ ] ✅ No hay errores en consola
- [ ] ✅ Las credenciales de API son correctas

---

## 📊 Resultado Esperado

Al finalizar todas las verificaciones, deberías poder:

1. ✅ Crear templates con campos dinámicos
2. ✅ Llenar formularios con opciones de la API
3. ✅ Guardar formularios con datos de la API
4. ✅ Editar formularios manteniendo los datos
5. ✅ Usar 8 catálogos diferentes de la API externa
6. ✅ Ver logs claros en consola
7. ✅ Trabajar con autenticación Bearer Token automática

---

## 🎉 ¡Implementación Completada!

Si todos los items están marcados, ¡la implementación está completa y funcionando correctamente!

### 📚 Documentación de Referencia:
- `RESUMEN_IMPLEMENTACION_APIS.md` - Resumen técnico
- `GUIA_USO_APIS_IMPLEMENTADAS.md` - Guía de uso
- `EJEMPLOS_PRACTICOS_APIS.md` - Ejemplos de templates
- `GUIA_APIS_EXTERNAS.md` - Lista de todos los endpoints

### 🆘 ¿Necesitas ayuda?
Si algo no funciona:
1. Revisa los logs en consola (F12)
2. Verifica que el backend esté corriendo
3. Prueba los endpoints en Swagger/Postman
4. Revisa este checklist nuevamente
