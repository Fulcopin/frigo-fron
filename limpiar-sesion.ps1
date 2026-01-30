# Script para limpiar sesión antigua del localStorage

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  LIMPIAR SESION ANTIGUA - localStorage" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "El problema:" -ForegroundColor Yellow
Write-Host "  - Tienes una sesion antigua de usuarios demo guardada" -ForegroundColor Gray
Write-Host "  - Esta en el localStorage del navegador" -ForegroundColor Gray
Write-Host "  - Por eso parece que funciona con usuarios hardcodeados" -ForegroundColor Gray
Write-Host ""

Write-Host "Soluciones:" -ForegroundColor Green
Write-Host ""

Write-Host "OPCION 1: Abrir DevTools del navegador" -ForegroundColor Cyan
Write-Host "  1. Presiona F12 en el navegador" -ForegroundColor White
Write-Host "  2. Ve a la tab 'Application' o 'Aplicacion'" -ForegroundColor White
Write-Host "  3. En el menu izquierdo: Storage > Local Storage" -ForegroundColor White
Write-Host "  4. Selecciona: http://localhost:5173" -ForegroundColor White
Write-Host "  5. Busca y ELIMINA estas claves:" -ForegroundColor White
Write-Host "     - fishcort_user" -ForegroundColor Yellow
Write-Host "     - fishcort_token" -ForegroundColor Yellow
Write-Host "     - fishcort_token_expiration" -ForegroundColor Yellow
Write-Host "  6. Recarga la pagina (F5)" -ForegroundColor White
Write-Host ""

Write-Host "OPCION 2: Usar la consola del navegador" -ForegroundColor Cyan
Write-Host "  1. Presiona F12 en el navegador" -ForegroundColor White
Write-Host "  2. Ve a la tab 'Console'" -ForegroundColor White
Write-Host "  3. Copia y pega este codigo:" -ForegroundColor White
Write-Host ""
Write-Host "     localStorage.removeItem('fishcort_user');" -ForegroundColor Yellow
Write-Host "     localStorage.removeItem('fishcort_token');" -ForegroundColor Yellow
Write-Host "     localStorage.removeItem('fishcort_token_expiration');" -ForegroundColor Yellow
Write-Host "     console.log('Sesion limpiada!');" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Presiona Enter" -ForegroundColor White
Write-Host "  5. Recarga la pagina (F5)" -ForegroundColor White
Write-Host ""

Write-Host "OPCION 3: Limpiar todos los datos del sitio" -ForegroundColor Cyan
Write-Host "  1. En el navegador, ve a: http://localhost:5173" -ForegroundColor White
Write-Host "  2. Presiona F12" -ForegroundColor White
Write-Host "  3. Tab 'Application' > Storage" -ForegroundColor White
Write-Host "  4. Click derecho en 'http://localhost:5173'" -ForegroundColor White
Write-Host "  5. Click en 'Clear site data' o 'Borrar datos del sitio'" -ForegroundColor White
Write-Host "  6. Recarga la pagina (F5)" -ForegroundColor White
Write-Host ""

Write-Host "OPCION 4: Modo incognito" -ForegroundColor Cyan
Write-Host "  1. Abre una ventana de incognito (Ctrl+Shift+N en Chrome)" -ForegroundColor White
Write-Host "  2. Ve a: http://localhost:5173" -ForegroundColor White
Write-Host "  3. Intenta login con: tadmin / Tadmin26*" -ForegroundColor White
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DESPUES DE LIMPIAR" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Deberias ver la pantalla de Login" -ForegroundColor White
Write-Host "2. Intenta con usuarios VIEJOS (deberia FALLAR):" -ForegroundColor White
Write-Host "   - admin / fishcort2025" -ForegroundColor Red
Write-Host "   - supervisor / fishcort2025" -ForegroundColor Red
Write-Host "   Resultado esperado: 'Credenciales invalidas'" -ForegroundColor Red
Write-Host ""
Write-Host "3. Intenta con usuarios NUEVOS (deberia FUNCIONAR):" -ForegroundColor White
Write-Host "   - tadmin / Tadmin26*" -ForegroundColor Green
Write-Host "   - tsupervisor / Tsupervisor26**" -ForegroundColor Green
Write-Host "   - toperador / Toperador26**" -ForegroundColor Green
Write-Host "   Resultado esperado: 'Login exitoso'" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para verificar que NO hay usuarios demo en el codigo:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Busca en authService.js:" -ForegroundColor White
Write-Host "  - Archivo: src/services/authService.js" -ForegroundColor Gray
Write-Host "  - NO deberia tener: if (username === 'admin')" -ForegroundColor Red
Write-Host "  - SI deberia tener: fetch(API_BASE_URL + '/Auth/login')" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  IMPORTANTE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El codigo YA ESTA CORRECTO." -ForegroundColor Green
Write-Host "Solo necesitas limpiar la sesion antigua del navegador." -ForegroundColor Yellow
Write-Host ""
Write-Host "El sistema SOLO acepta usuarios de la base de datos." -ForegroundColor Green
Write-Host ""
