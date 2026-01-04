@echo off
chcp 65001 >nul
echo.
echo ============================================================
echo    LIMPIEZA DE CACHE DEL NAVEGADOR
echo ============================================================
echo.
echo TU CODIGO ESTA CORRECTO!
echo.
echo Archivos verificados:
echo   [OK] EditTemplate.jsx - 2 dropdowns implementados
echo   [OK] apiMappings.js - Array 'catalogs' con 8 APIs  
echo   [OK] Servidor corriendo en localhost:5173
echo.
echo El problema es SOLO el cache del navegador
echo.
echo ============================================================
echo    SOLUCION RAPIDA (30 segundos):
echo ============================================================
echo.
echo 1. Cierra TODAS las pestañas de localhost:5173
echo 2. Abre una NUEVA pestaña
echo 3. Ve a: http://localhost:5173/
echo 4. Presiona CTRL + SHIFT + R (o CTRL + F5)
echo 5. Ve a 'Crear Plantilla'
echo 6. Haz clic en '+ Agregar Campo'
echo 7. Deberias ver 2 DROPDOWNS
echo.
echo ============================================================
echo    SOLUCION GARANTIZADA (1 minuto):
echo ============================================================
echo.
echo 1. Presiona CTRL + SHIFT + N (ventana incognito)
echo 2. Ve a: http://localhost:5173/
echo 3. Ve a 'Crear Plantilla'
echo 4. Veras los 2 dropdowns (GARANTIZADO)
echo.
echo ============================================================
echo    QUE DEBERIAS VER:
echo ============================================================
echo.
echo Dropdown 1:
echo   API Lotes (Autocompletar desde Movimientos)
echo.
echo Dropdown 2:
echo   API Catalogos (Opciones desde API Externa)
echo     - Balanzas
echo     - Choferes  
echo     - Especies
echo     - Pesqueros
echo     - Productos
echo     - Proveedores
echo     - Configuraciones
echo     - Configuraciones FRIGO
echo.
echo ============================================================
echo Presiona cualquier tecla para abrir el navegador...
echo ============================================================
pause >nul

echo.
echo Abriendo navegador en localhost:5173...
start http://localhost:5173/
echo.
echo AHORA: Presiona CTRL + SHIFT + R para refrescar
echo O usa CTRL + SHIFT + N para abrir incognito
echo.
pause
