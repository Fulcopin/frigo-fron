-- 🔍 Script de Verificación - Sistema de Catálogo de Firmas
-- Ejecutar en SQL Server Management Studio

USE FormBuilderDB;  -- Cambiar por el nombre de tu base de datos
GO

PRINT '========================================';
PRINT '📋 VERIFICACIÓN DE CATÁLOGO DE FIRMAS';
PRINT '========================================';
PRINT '';

-- 1. Verificar que la tabla existe
PRINT '1️⃣ Verificando existencia de tabla CatalogoFirmas...';
IF OBJECT_ID('CatalogoFirmas', 'U') IS NOT NULL
    PRINT '✅ Tabla CatalogoFirmas existe'
ELSE
BEGIN
    PRINT '❌ ERROR: Tabla CatalogoFirmas NO existe'
    PRINT '   Ejecutar migración: dotnet ef database update'
    RETURN;
END
PRINT '';

-- 2. Ver estructura de la tabla
PRINT '2️⃣ Estructura de la tabla:';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'CatalogoFirmas'
ORDER BY ORDINAL_POSITION;
PRINT '';

-- 3. Contar registros
PRINT '3️⃣ Conteo de registros:';
DECLARE @TotalFirmas INT, @FirmasActivas INT, @FirmasInactivas INT;

SELECT @TotalFirmas = COUNT(*) FROM CatalogoFirmas;
SELECT @FirmasActivas = COUNT(*) FROM CatalogoFirmas WHERE Activo = 1;
SELECT @FirmasInactivas = COUNT(*) FROM CatalogoFirmas WHERE Activo = 0;

PRINT '   Total de firmas: ' + CAST(@TotalFirmas AS VARCHAR);
PRINT '   Firmas activas: ' + CAST(@FirmasActivas AS VARCHAR);
PRINT '   Firmas inactivas: ' + CAST(@FirmasInactivas AS VARCHAR);
PRINT '';

-- 4. Mostrar todas las firmas activas
IF @FirmasActivas > 0
BEGIN
    PRINT '4️⃣ Firmas activas en el catálogo:';
    SELECT 
        CatalogoFirmaID AS ID,
        Puesto,
        NombreCompleto AS Nombre,
        Area,
        Correo,
        FORMAT(FechaCreacion, 'yyyy-MM-dd HH:mm') AS Creado
    FROM CatalogoFirmas
    WHERE Activo = 1
    ORDER BY Puesto, NombreCompleto;
END
ELSE
BEGIN
    PRINT '⚠️ No hay firmas activas en el catálogo';
    PRINT '   Agregar desde la página /catalogo-firmas';
END
PRINT '';

-- 5. Verificar correos
PRINT '5️⃣ Verificando correos electrónicos:';
SELECT 
    COUNT(*) AS TotalConCorreo,
    (SELECT COUNT(*) FROM CatalogoFirmas WHERE Activo = 1 AND (Correo IS NULL OR Correo = '')) AS SinCorreo
FROM CatalogoFirmas
WHERE Activo = 1 AND Correo IS NOT NULL AND Correo <> '';

DECLARE @SinCorreo INT;
SELECT @SinCorreo = COUNT(*) 
FROM CatalogoFirmas 
WHERE Activo = 1 AND (Correo IS NULL OR Correo = '');

IF @SinCorreo > 0
    PRINT '⚠️ Hay ' + CAST(@SinCorreo AS VARCHAR) + ' firma(s) sin correo electrónico';
ELSE
    PRINT '✅ Todas las firmas activas tienen correo';
PRINT '';

-- 6. Buscar duplicados por nombre
PRINT '6️⃣ Verificando duplicados:';
SELECT 
    NombreCompleto,
    COUNT(*) AS Cantidad
FROM CatalogoFirmas
WHERE Activo = 1 AND NombreCompleto IS NOT NULL
GROUP BY NombreCompleto
HAVING COUNT(*) > 1;

IF @@ROWCOUNT = 0
    PRINT '✅ No hay nombres duplicados';
ELSE
    PRINT '⚠️ Hay nombres duplicados (ver tabla arriba)';
PRINT '';

-- 7. Ver firmas más recientes
PRINT '7️⃣ Últimas 5 firmas creadas:';
SELECT TOP 5
    CatalogoFirmaID AS ID,
    Puesto,
    NombreCompleto AS Nombre,
    Correo,
    CASE WHEN Activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS Estado,
    FORMAT(FechaCreacion, 'yyyy-MM-dd HH:mm') AS Creado
FROM CatalogoFirmas
ORDER BY FechaCreacion DESC;
PRINT '';

-- 8. Verificar integración con FilledForms
PRINT '8️⃣ Verificando uso en formularios:';
IF OBJECT_ID('FilledForms', 'U') IS NOT NULL
BEGIN
    DECLARE @FormsConFirmas INT;
    SELECT @FormsConFirmas = COUNT(*) 
    FROM FilledForms 
    WHERE FirmasData IS NOT NULL AND FirmasData <> '{}';
    
    PRINT '   Formularios con firmas: ' + CAST(@FormsConFirmas AS VARCHAR);
    
    IF @FormsConFirmas > 0
    BEGIN
        PRINT '';
        PRINT '   📄 Último formulario con firmas:';
        SELECT TOP 1
            FormID,
            TemplateID,
            FilledBy AS LlenadoPor,
            FORMAT(CreatedAt, 'yyyy-MM-dd HH:mm') AS Fecha,
            LEN(FirmasData) AS TamañoJSON
        FROM FilledForms
        WHERE FirmasData IS NOT NULL AND FirmasData <> '{}'
        ORDER BY CreatedAt DESC;
    END
END
ELSE
    PRINT '⚠️ Tabla FilledForms no existe';
PRINT '';

-- 9. Resumen final
PRINT '========================================';
PRINT '📊 RESUMEN';
PRINT '========================================';
PRINT '✅ Sistema de Catálogo de Firmas configurado correctamente';
PRINT '';
PRINT 'Total de firmas: ' + CAST(@TotalFirmas AS VARCHAR);
PRINT 'Firmas activas: ' + CAST(@FirmasActivas AS VARCHAR);
PRINT '';

IF @FirmasActivas = 0
BEGIN
    PRINT '⚠️ ACCIÓN REQUERIDA:';
    PRINT '   1. Ir a http://localhost:5174/catalogo-firmas';
    PRINT '   2. Crear al menos 3 firmas de prueba';
    PRINT '   3. Volver a ejecutar este script';
END
ELSE IF @FirmasActivas < 3
BEGIN
    PRINT '💡 SUGERENCIA:';
    PRINT '   Crear más firmas para tener un catálogo completo';
END
ELSE
BEGIN
    PRINT '✅ Catálogo listo para usar';
    PRINT '';
    PRINT 'Próximos pasos:';
    PRINT '   1. Ir a /fill-form';
    PRINT '   2. Llenar un formulario con firmas';
    PRINT '   3. Verificar que aparezcan las firmas del catálogo';
END

PRINT '========================================';
GO

-- 10. Consultas adicionales útiles

PRINT '';
PRINT '========================================';
PRINT '🔧 CONSULTAS ÚTILES ADICIONALES';
PRINT '========================================';
PRINT '';
PRINT '-- Ver todas las firmas con correo:';
PRINT 'SELECT * FROM CatalogoFirmas WHERE Correo IS NOT NULL ORDER BY Puesto;';
PRINT '';
PRINT '-- Buscar firma por nombre:';
PRINT 'SELECT * FROM CatalogoFirmas WHERE NombreCompleto LIKE ''%NOMBRE%'';';
PRINT '';
PRINT '-- Ver firmas de un área específica:';
PRINT 'SELECT * FROM CatalogoFirmas WHERE Area = ''Producción'';';
PRINT '';
PRINT '-- Contar firmas por área:';
PRINT 'SELECT Area, COUNT(*) AS Total FROM CatalogoFirmas WHERE Activo = 1 GROUP BY Area;';
PRINT '';
PRINT '-- Ver emails extraídos de formularios:';
PRINT 'SELECT FormID, JSON_QUERY(FirmasData) FROM FilledForms WHERE FirmasData IS NOT NULL;';
PRINT '';
PRINT '========================================';
