-- ✨ Migración: Agregar campos de auditoría a FilledForms
-- Fecha: 2026-02-17
-- Descripción: Agrega FilledBy, FilledByEmail, FilledByRole para auditoría

USE [FormBuilderDb]
GO

-- Verificar si las columnas ya existen antes de agregarlas
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') 
               AND name = 'FilledBy')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [FilledBy] NVARCHAR(200) NULL
    
    PRINT '✅ Columna FilledBy agregada'
END
ELSE
BEGIN
    PRINT '⚠️ Columna FilledBy ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') 
               AND name = 'FilledByEmail')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [FilledByEmail] NVARCHAR(200) NULL
    
    PRINT '✅ Columna FilledByEmail agregada'
END
ELSE
BEGIN
    PRINT '⚠️ Columna FilledByEmail ya existe'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') 
               AND name = 'FilledByRole')
BEGIN
    ALTER TABLE [dbo].[FilledForms]
    ADD [FilledByRole] NVARCHAR(100) NULL
    
    PRINT '✅ Columna FilledByRole agregada'
END
ELSE
BEGIN
    PRINT '⚠️ Columna FilledByRole ya existe'
END
GO

-- Verificar que las columnas se agregaron correctamente
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'FilledForms'
AND COLUMN_NAME IN ('FilledBy', 'FilledByEmail', 'FilledByRole')
GO

PRINT '✅ Migración completada exitosamente'
PRINT 'Columnas agregadas: FilledBy, FilledByEmail, FilledByRole'
GO
