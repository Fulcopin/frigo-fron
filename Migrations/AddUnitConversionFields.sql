-- =====================================================
-- MIGRACIÓN: Agregar Campos de Conversión de Unidades
-- Fecha: 16 de diciembre de 2025
-- =====================================================

USE [FormBuilderDB]
GO

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'PesoLb')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [PesoLb] DECIMAL(18,2) NULL
    PRINT '✅ Columna PesoLb agregada'
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna PesoLb ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'PesoKg')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [PesoKg] DECIMAL(18,2) NULL
    PRINT '✅ Columna PesoKg agregada'
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna PesoKg ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'UnidadPeso')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [UnidadPeso] NVARCHAR(10) NULL DEFAULT 'lb'
    PRINT '✅ Columna UnidadPeso agregada'
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna UnidadPeso ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'Batches')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [Batches] NVARCHAR(500) NULL
    PRINT '✅ Columna Batches agregada'
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna Batches ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'Producto')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [Producto] NVARCHAR(200) NULL
    PRINT '✅ Columna Producto agregada'
END
ELSE
BEGIN
    PRINT 'ℹ️ Columna Producto ya existe'
END
GO

-- =====================================================
-- CONVERSIÓN DE DATOS EXISTENTES (OPCIONAL)
-- Si ya tienes datos con peso, ejecuta esto:
-- =====================================================

/*
-- Actualizar UnidadPeso por defecto para registros existentes
UPDATE [dbo].[FilledForms]
SET [UnidadPeso] = 'lb'
WHERE [UnidadPeso] IS NULL
GO

-- Si tus datos existentes tienen peso en algún campo JSON,
-- puedes parsearlo y convertirlo aquí
-- Ejemplo: Si HeaderData contiene {"peso": 100}

UPDATE f
SET 
    f.PesoLb = TRY_CAST(JSON_VALUE(f.HeaderData, '$.peso') AS DECIMAL(18,2)),
    f.PesoKg = ROUND(TRY_CAST(JSON_VALUE(f.HeaderData, '$.peso') AS DECIMAL(18,2)) * 0.453592, 2)
FROM [dbo].[FilledForms] f
WHERE JSON_VALUE(f.HeaderData, '$.peso') IS NOT NULL
AND f.PesoLb IS NULL
GO
*/

-- =====================================================
-- VERIFICACIÓN DE MIGRACIÓN
-- =====================================================

SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'FilledForms'
AND COLUMN_NAME IN ('PesoLb', 'PesoKg', 'UnidadPeso', 'Batches', 'Producto')
ORDER BY ORDINAL_POSITION
GO

PRINT '✅ Migración completada exitosamente'
PRINT 'ℹ️ Nuevas columnas disponibles:'
PRINT '   - PesoLb (decimal 18,2)'
PRINT '   - PesoKg (decimal 18,2)'
PRINT '   - UnidadPeso (nvarchar 10)'
PRINT '   - Batches (nvarchar 500)'
PRINT '   - Producto (nvarchar 200)'
GO

-- =====================================================
-- FUNCIÓN HELPER: Conversión Automática (OPCIONAL)
-- =====================================================

-- Función para convertir lb → kg
IF OBJECT_ID('dbo.fn_ConvertirLbAKg') IS NOT NULL
    DROP FUNCTION dbo.fn_ConvertirLbAKg
GO

CREATE FUNCTION dbo.fn_ConvertirLbAKg(@pesoLb DECIMAL(18,2))
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN ROUND(@pesoLb * 0.453592, 2)
END
GO

-- Función para convertir kg → lb
IF OBJECT_ID('dbo.fn_ConvertirKgALb') IS NOT NULL
    DROP FUNCTION dbo.fn_ConvertirKgALb
GO

CREATE FUNCTION dbo.fn_ConvertirKgALb(@pesoKg DECIMAL(18,2))
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN ROUND(@pesoKg * 2.20462, 2)
END
GO

PRINT '✅ Funciones de conversión creadas:'
PRINT '   - dbo.fn_ConvertirLbAKg(@pesoLb)'
PRINT '   - dbo.fn_ConvertirKgALb(@pesoKg)'
GO

-- =====================================================
-- PRUEBA DE FUNCIONES
-- =====================================================

SELECT 
    100 as 'Libras',
    dbo.fn_ConvertirLbAKg(100) as 'Kilogramos',
    dbo.fn_ConvertirKgALb(dbo.fn_ConvertirLbAKg(100)) as 'De vuelta a Libras'
GO

-- =====================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO (OPCIONAL)
-- =====================================================

-- Índice en Producto para búsquedas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FilledForms_Producto')
BEGIN
    CREATE NONCLUSTERED INDEX IX_FilledForms_Producto
    ON [dbo].[FilledForms] ([Producto])
    PRINT '✅ Índice IX_FilledForms_Producto creado'
END
GO

-- Índice en PesoLb para reportes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FilledForms_PesoLb')
BEGIN
    CREATE NONCLUSTERED INDEX IX_FilledForms_PesoLb
    ON [dbo].[FilledForms] ([PesoLb])
    PRINT '✅ Índice IX_FilledForms_PesoLb creado'
END
GO

PRINT '🎉 ¡Migración completada! Ya puedes usar la conversión de unidades.'
GO
