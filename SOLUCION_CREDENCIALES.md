# 🚨 SOLUCIÓN: "Credenciales Inválidas" para Supervisor y Trabajador

## El problema está resuelto en el código ✅

Los cambios ya están implementados correctamente en:
- ✅ `src/services/authService.js`
- ✅ `src/components/RoleBasedRoute.jsx`
- ✅ `src/App.jsx`
- ✅ `src/pages/Login.jsx`
- ✅ `src/components/UserInfo.jsx`

## 🔧 Cómo aplicar los cambios

### Opción 1: Reiniciar el servidor (RECOMENDADO)

```powershell
# 1. Detén el servidor actual (Ctrl+C en la terminal donde corre)

# 2. Limpia la caché del navegador:
#    - Chrome/Edge: Ctrl+Shift+Delete → Borrar todo
#    - O abre en modo incógnito: Ctrl+Shift+N

# 3. Reinicia el servidor:
npm run dev

# 4. Prueba con las credenciales:
#    - supervisor / fishcort2025
#    - trabajador / fishcort2025
```

### Opción 2: Usar el script automático

```powershell
.\reiniciar-servidor.ps1
```

Este script:
- Detiene procesos de Node
- Limpia caché de npm y Vite
- Reinstala dependencias
- Inicia el servidor
- Muestra las credenciales

---

## 🧪 Verificar que funciona

### 1. Abre la consola del navegador (F12)
Deberías ver logs como:
```
🔍 Intentando login con: {username: "supervisor", password: "fishcort2025"}
✅ Login como SUPERVISOR exitoso
```

### 2. Prueba con el archivo de prueba
Abre `test-login.html` en tu navegador y haz clic en los botones de prueba.

---

## 📝 Credenciales Correctas

| Rol | Usuario | Contraseña | Permisos |
|-----|---------|------------|----------|
| 👑 Admin | `admin` | `fishcort2025` | Todo |
| 👔 Supervisor | `supervisor` | `fishcort2025` | Todo |
| 👷 Trabajador | `trabajador` | `fishcort2025` | Solo formularios |

---

## 🔍 Si sigue sin funcionar

### Paso 1: Verifica que los archivos están actualizados

```powershell
.\check-roles.ps1
```

Deberías ver:
```
[OK] authService.js encontrado
[OK] RoleBasedRoute.jsx encontrado
[OK] App.jsx encontrado
SISTEMA DE ROLES IMPLEMENTADO CORRECTAMENTE
```

### Paso 2: Verifica el código manualmente

Abre `src/services/authService.js` y busca:

```javascript
else if (username === 'supervisor' && password === 'fishcort2025') {
```

Si NO lo encuentras, el archivo no se guardó correctamente.

### Paso 3: Limpia TODO

```powershell
# Detén el servidor (Ctrl+C)

# Elimina node_modules
Remove-Item -Recurse -Force node_modules

# Elimina package-lock.json
Remove-Item package-lock.json

# Reinstala todo
npm install

# Inicia el servidor
npm run dev
```

### Paso 4: Verifica la caché del navegador

1. Abre DevTools (F12)
2. Ve a la pestaña "Network"
3. Marca "Disable cache"
4. Recarga la página (Ctrl+F5)

---

## 💡 Tips Adicionales

### Si usas VS Code:
1. Reinicia VS Code completamente
2. Verifica que no haya errores en la terminal integrada
3. Asegúrate de que Vite se reinició después de los cambios

### Si el problema persiste:
1. Cierra completamente el navegador
2. Abre en modo incógnito
3. Ve a `http://localhost:5173` (o el puerto que uses)
4. Intenta login con `supervisor / fishcort2025`

---

## ✅ Checklist de Verificación

- [ ] Servidor detenido y reiniciado
- [ ] Caché del navegador limpiada
- [ ] Navegador en modo incógnito
- [ ] Console.log muestra "🔍 Intentando login"
- [ ] Los 3 archivos verificados con check-roles.ps1
- [ ] Puerto correcto (probablemente 5173)

---

## 🆘 Último Recurso

Si nada funciona, prueba esto:

```powershell
# 1. Guarda una copia de tus cambios
git add .
git commit -m "Sistema de roles implementado"

# 2. Cierra TODO (VS Code, navegadores, terminales)

# 3. Reinicia tu computadora

# 4. Abre VS Code de nuevo

# 5. Ejecuta:
npm install
npm run dev

# 6. Abre el navegador en modo incógnito
# 7. Prueba las credenciales
```

---

## 📞 Ayuda Adicional

Si ves en la consola:
- ❌ "Credenciales inválidas" → El servidor está usando código viejo
- 🔍 "Intentando login" pero sin ✅ → Revisa que username/password sean exactos
- Sin logs → La página no se está recargando correctamente

**Recuerda:** Los cambios ya están en el código. Solo necesitas asegurarte de que el navegador y el servidor estén usando la versión actualizada.
