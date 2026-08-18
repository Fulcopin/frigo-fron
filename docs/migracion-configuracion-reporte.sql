/* ===========================================================================
   Migraciones 20260804205308_PendingModelChanges y 20260815232841_AddConfiguracionReporte

   Este script NO se guía por __EFMigrationsHistory sino por los objetos que
   realmente existen en la base. El script que genera EF asume que si la
   migración no figura en el historial entonces sus tablas tampoco están, y en
   esta base eso no se cumple: las tablas ya habían sido creadas sin dejar el
   registro, así que fallaba con "El índice IX_FilledFormChanges_FormID ya
   existe en la tabla FilledFormChanges".

   Se puede correr las veces que haga falta: cada paso se saltea si ya está hecho.
   =========================================================================== */

SET XACT_ABORT ON;   -- ante cualquier error, revierte todo el lote
BEGIN TRANSACTION;

/* ── 1. DocumentosManuales ─────────────────────────────────────────────── */
IF OBJECT_ID(N'[dbo].[DocumentosManuales]', N'U') IS NULL
BEGIN
    CREATE TABLE [DocumentosManuales] (
        [Id] int NOT NULL IDENTITY,
        [Area] nvarchar(100) NOT NULL,
        [Nombre] nvarchar(400) NOT NULL,
        [Codigo] nvarchar(100) NULL,
        [Version] nvarchar(50) NULL,
        [Fecha] datetime2 NULL,
        [CopiaControlada] nvarchar(10) NOT NULL,
        [Ubicacion] nvarchar(300) NULL,
        [Obsoleto] bit NOT NULL,
        [Observaciones] nvarchar(500) NULL,
        [CreadoPor] nvarchar(200) NULL,
        [CreadoEn] datetime2 NOT NULL,
        [ActualizadoEn] datetime2 NULL,
        CONSTRAINT [PK_DocumentosManuales] PRIMARY KEY ([Id])
    );
    PRINT 'Creada la tabla DocumentosManuales';
END
ELSE PRINT 'DocumentosManuales ya existia: sin cambios';

/* ── 2. FilledFormChanges ──────────────────────────────────────────────── */
IF OBJECT_ID(N'[dbo].[FilledFormChanges]', N'U') IS NULL
BEGIN
    CREATE TABLE [FilledFormChanges] (
        [Id] int NOT NULL IDENTITY,
        [FormID] int NOT NULL,
        [ChangedBy] nvarchar(200) NULL,
        [ChangedByEmail] nvarchar(200) NULL,
        [ChangedByRole] nvarchar(100) NULL,
        [ChangedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        [Cambios] nvarchar(max) NULL,
        [TotalCambios] int NOT NULL,
        CONSTRAINT [PK_FilledFormChanges] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FilledFormChanges_FilledForms_FormID] FOREIGN KEY ([FormID])
            REFERENCES [FilledForms] ([FormID]) ON DELETE CASCADE
    );
    PRINT 'Creada la tabla FilledFormChanges';
END
ELSE PRINT 'FilledFormChanges ya existia: sin cambios';

-- El índice se revisa aparte: es el que estaba haciendo fallar el script
IF OBJECT_ID(N'[dbo].[FilledFormChanges]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'IX_FilledFormChanges_FormID'
                     AND object_id = OBJECT_ID(N'[dbo].[FilledFormChanges]'))
BEGIN
    CREATE INDEX [IX_FilledFormChanges_FormID] ON [FilledFormChanges] ([FormID]);
    PRINT 'Creado el indice IX_FilledFormChanges_FormID';
END
ELSE PRINT 'IX_FilledFormChanges_FormID ya existia: sin cambios';

/* ── 3. ConfiguracionesReporte (el armado del Excel por formulario) ────── */
IF OBJECT_ID(N'[dbo].[ConfiguracionesReporte]', N'U') IS NULL
BEGIN
    CREATE TABLE [ConfiguracionesReporte] (
        [Id] int NOT NULL IDENTITY,
        [TemplateID] int NULL,
        [Nombre] nvarchar(max) NOT NULL,
        [ColumnasVisibles] nvarchar(max) NOT NULL,
        [Operaciones] nvarchar(max) NOT NULL,
        [UnaLineaPorForm] bit NOT NULL,
        [OcultarVacias] bit NOT NULL,
        [CompactarFilas] bit NOT NULL,
        [OmitirTotalesDelForm] bit NOT NULL,
        [SubtotalPorForm] bit NOT NULL,
        [ModoResumen] bit NOT NULL,
        [AgruparPor] nvarchar(max) NOT NULL,
        [ActualizadoPor] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ConfiguracionesReporte] PRIMARY KEY ([Id])
    );
    PRINT 'Creada la tabla ConfiguracionesReporte';
END
ELSE PRINT 'ConfiguracionesReporte ya existia: sin cambios';

IF OBJECT_ID(N'[dbo].[ConfiguracionesReporte]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'IX_ConfiguracionesReporte_TemplateID'
                     AND object_id = OBJECT_ID(N'[dbo].[ConfiguracionesReporte]'))
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ConfiguracionesReporte_TemplateID]
           ON [ConfiguracionesReporte] ([TemplateID]) WHERE [TemplateID] IS NOT NULL');
    PRINT 'Creado el indice IX_ConfiguracionesReporte_TemplateID';
END
ELSE PRINT 'IX_ConfiguracionesReporte_TemplateID ya existia: sin cambios';

/* ── 4. CostosProducto ─────────────────────────────────────────────────── */
IF OBJECT_ID(N'[dbo].[CostosProducto]', N'U') IS NULL
BEGIN
    CREATE TABLE [CostosProducto] (
        [Id] int NOT NULL IDENTITY,
        [Producto] nvarchar(200) NOT NULL,
        [CostoUnitario] decimal(18,4) NOT NULL,
        [Moneda] nvarchar(10) NOT NULL,
        [Unidad] nvarchar(20) NOT NULL,
        [Notas] nvarchar(500) NULL,
        [ActualizadoPor] nvarchar(150) NULL,
        [CreadoEn] datetime2 NOT NULL,
        [ActualizadoEn] datetime2 NOT NULL,
        CONSTRAINT [PK_CostosProducto] PRIMARY KEY ([Id])
    );
    PRINT 'Creada la tabla CostosProducto';
END
ELSE PRINT 'CostosProducto ya existia: sin cambios';

/* ── 5. Dejar registradas las migraciones ──────────────────────────────────
   Sin estas filas, la próxima vez que alguien corra "dotnet ef database
   update" EF va a volver a intentar crear todo y va a fallar igual. */
IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory]
               WHERE [MigrationId] = N'20260804205308_PendingModelChanges')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260804205308_PendingModelChanges', N'9.0.9');
    PRINT 'Registrada la migracion PendingModelChanges';
END

IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory]
               WHERE [MigrationId] = N'20260815232841_AddConfiguracionReporte')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260815232841_AddConfiguracionReporte', N'9.0.9');
    PRINT 'Registrada la migracion AddConfiguracionReporte';
END

COMMIT;
GO

/* ── Verificación: las 4 tablas y las 2 migraciones tienen que aparecer ─── */
SELECT name AS Tabla
FROM sys.tables
WHERE name IN ('DocumentosManuales', 'FilledFormChanges', 'ConfiguracionesReporte', 'CostosProducto')
ORDER BY name;

SELECT [MigrationId]
FROM [__EFMigrationsHistory]
WHERE [MigrationId] IN (N'20260804205308_PendingModelChanges', N'20260815232841_AddConfiguracionReporte');
GO
