-- ============================================
-- Migración: AddTemplateHistoryTable
-- Descripción: Crear tabla para historial de versiones de plantillas
-- Fecha: 2025-12-15
-- ============================================

-- Crear tabla TemplateHistory
CREATE TABLE [dbo].[TemplateHistory] (
    [HistoryID] INT NOT NULL IDENTITY(1,1),
    [TemplateID] INT NOT NULL,
    [TemplateSnapshot] NVARCHAR(MAX) NOT NULL,
    [Version] NVARCHAR(20) NOT NULL,
    [ChangeType] NVARCHAR(50) NULL,
    [ChangeDescription] NVARCHAR(MAX) NULL,
    [ChangedBy] NVARCHAR(100) NULL,
    [ChangedAt] DATETIME2 NOT NULL,
    
    CONSTRAINT [PK_TemplateHistory] PRIMARY KEY ([HistoryID]),
    
    CONSTRAINT [FK_TemplateHistory_Templates_TemplateID] 
        FOREIGN KEY ([TemplateID]) 
        REFERENCES [dbo].[Templates] ([TemplateID]) 
        ON DELETE CASCADE
);

-- Crear índices para mejorar performance
CREATE INDEX [IX_TemplateHistory_TemplateID] ON [dbo].[TemplateHistory] ([TemplateID]);
CREATE INDEX [IX_TemplateHistory_Version] ON [dbo].[TemplateHistory] ([Version]);
CREATE INDEX [IX_TemplateHistory_ChangedAt] ON [dbo].[TemplateHistory] ([ChangedAt]);

-- Registrar la migración (si usas EF Core)
INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) 
VALUES (N'20251215_AddTemplateHistoryTable', N'9.0.9');

PRINT '✅ Tabla TemplateHistory creada exitosamente';
PRINT '✅ Índices creados para mejor performance';
PRINT '✅ Relaciones configuradas correctamente';

-- ============================================
-- OPCIONAL: Migrar datos existentes
-- ============================================

-- Si quieres crear un registro de historial para cada plantilla existente:
/*
INSERT INTO [dbo].[TemplateHistory] (
    [TemplateID],
    [TemplateSnapshot],
    [Version],
    [ChangeType],
    [ChangeDescription],
    [ChangedBy],
    [ChangedAt]
)
SELECT 
    t.TemplateID,
    (SELECT * FROM Templates t2 WHERE t2.TemplateID = t.TemplateID FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) as TemplateSnapshot,
    t.Version,
    'Migrated' as ChangeType,
    'Migración inicial desde plantilla existente' as ChangeDescription,
    'Sistema' as ChangedBy,
    COALESCE(t.CreatedAt, GETUTCDATE()) as ChangedAt
FROM [dbo].[Templates] t;

PRINT '✅ Datos históricos migrados para plantillas existentes';
*/
