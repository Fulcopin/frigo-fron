-- ============================================================================
-- SCRIPT COMPLETO PARA LA BASE DE DATOS [FormBuilder-rg]
-- Fecha de generación: 2026-04-05
-- Nota: Este script crea la base de datos y todas sus tablas con los datos.
-- ============================================================================

USE [master]
GO

-- ============================================================================
-- CREAR LA BASE DE DATOS
-- ============================================================================
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'FormBuilder-rg')
BEGIN
    ALTER DATABASE [FormBuilder-rg] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [FormBuilder-rg];
END
GO

CREATE DATABASE [FormBuilder-rg]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'FormBuilder-rg', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\FormBuilder-rg.mdf' , SIZE = 73728KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'FormBuilder-rg_log', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\FormBuilder-rg_log.ldf' , SIZE = 73728KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
GO

IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [FormBuilder-rg].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO

ALTER DATABASE [FormBuilder-rg] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET ARITHABORT OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [FormBuilder-rg] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [FormBuilder-rg] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET  DISABLE_BROKER 
GO
ALTER DATABASE [FormBuilder-rg] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [FormBuilder-rg] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET RECOVERY FULL 
GO
ALTER DATABASE [FormBuilder-rg] SET  MULTI_USER 
GO
ALTER DATABASE [FormBuilder-rg] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [FormBuilder-rg] SET DB_CHAINING OFF 
GO
ALTER DATABASE [FormBuilder-rg] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [FormBuilder-rg] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO

USE [FormBuilder-rg]
GO

-- ============================================================================
-- CREAR TABLAS
-- ============================================================================

-- Tabla: __EFMigrationsHistory
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[__EFMigrationsHistory](
    [MigrationId] [nvarchar](150) NOT NULL,
    [ProductVersion] [nvarchar](32) NOT NULL,
 CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY CLUSTERED 
(
    [MigrationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

-- Tabla: AlertConfigurations
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertConfigurations](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [EnableMissingFormAlerts] [bit] NOT NULL,
    [DailyCheckTime] [nvarchar](max) NOT NULL,
    [MissingFormRecipients] [nvarchar](max) NOT NULL,
    [EnableSignatureAlerts] [bit] NOT NULL,
    [SignatureAlertDelay] [int] NOT NULL,
    [SignatureRecipients] [nvarchar](max) NOT NULL,
    [SenderEmail] [nvarchar](max) NOT NULL,
    [SenderName] [nvarchar](max) NOT NULL,
 CONSTRAINT [PK_AlertConfigurations] PRIMARY KEY CLUSTERED 
(
    [Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: Alerts
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Alerts](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [Type] [nvarchar](max) NOT NULL,
    [Priority] [nvarchar](max) NOT NULL,
    [Title] [nvarchar](max) NOT NULL,
    [Message] [nvarchar](max) NOT NULL,
    [TargetEmail] [nvarchar](max) NOT NULL,
    [FormId] [int] NULL,
    [FormCode] [nvarchar](max) NULL,
    [CreatedDate] [datetime2](7) NOT NULL,
    [IsRead] [bit] NOT NULL,
    [ReadDate] [datetime2](7) NULL,
    [Status] [nvarchar](max) NOT NULL,
 CONSTRAINT [PK_Alerts] PRIMARY KEY CLUSTERED 
(
    [Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: CatalogoFirmas
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CatalogoFirmas](
    [CatalogoFirmaID] [int] IDENTITY(1,1) NOT NULL,
    [Puesto] [nvarchar](100) NOT NULL,
    [NombreCompleto] [nvarchar](200) NULL,
    [Area] [nvarchar](100) NULL,
    [Activo] [bit] NOT NULL,
    [FechaCreacion] [datetime2](7) NOT NULL,
    [Correo] [nvarchar](150) NULL,
    [FirmaImageUrl] [nvarchar](500) NULL,
 CONSTRAINT [PK_CatalogoFirmas] PRIMARY KEY CLUSTERED 
(
    [CatalogoFirmaID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

-- Tabla: FilledForms
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FilledForms](
    [FormID] [int] IDENTITY(1,1) NOT NULL,
    [TemplateID] [int] NOT NULL,
    [HeaderData] [nvarchar](max) NULL,
    [FirmasData] [nvarchar](max) NULL,
    [Observaciones] [nvarchar](max) NULL,
    [CreatedAt] [datetime2](7) NOT NULL,
    [BodyData] [nvarchar](max) NULL,
    [TemplateSnapshot] [nvarchar](max) NULL,
    [TemplateVersion] [nvarchar](20) NULL,
    [UpdatedAt] [datetime2](7) NULL,
    [FechaVersion] [datetime2](7) NULL,
    [FilledBy] [nvarchar](200) NULL,
    [FilledByEmail] [nvarchar](200) NULL,
    [FilledByRole] [nvarchar](100) NULL,
    [TipoProducto] [nvarchar](50) NULL,
 CONSTRAINT [PK_FilledForms] PRIMARY KEY CLUSTERED 
(
    [FormID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: FormDrafts
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FormDrafts](
    [DraftID] [int] IDENTITY(1,1) NOT NULL,
    [TemplateID] [int] NOT NULL,
    [TemplateName] [nvarchar](300) NULL,
    [TemplateCodigo] [nvarchar](50) NULL,
    [UserName] [nvarchar](200) NULL,
    [UserEmail] [nvarchar](200) NULL,
    [UserRole] [nvarchar](100) NULL,
    [HeaderData] [nvarchar](max) NULL,
    [BodyData] [nvarchar](max) NULL,
    [FirmasData] [nvarchar](max) NULL,
    [TemplateSnapshot] [nvarchar](max) NULL,
    [Progress] [int] NOT NULL,
    [Nota] [nvarchar](500) NULL,
    [CreatedAt] [datetime2](7) NOT NULL,
    [UpdatedAt] [datetime2](7) NOT NULL,
    [ExpiresAt] [datetime2](7) NOT NULL,
    [IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_FormDrafts] PRIMARY KEY CLUSTERED 
(
    [DraftID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: SignatureRejections
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SignatureRejections](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [FilledFormId] [int] NOT NULL,
    [RejectedBy] [nvarchar](max) NOT NULL,
    [RejectedDate] [datetime2](7) NOT NULL,
    [Reason] [nvarchar](1000) NULL,
    [Status] [nvarchar](50) NOT NULL,
 CONSTRAINT [PK_SignatureRejections] PRIMARY KEY CLUSTERED 
(
    [Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: Signatures
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Signatures](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [FilledFormId] [int] NOT NULL,
    [SignatureImage] [nvarchar](max) NOT NULL,
    [SignedBy] [nvarchar](max) NOT NULL,
    [SignedDate] [datetime2](7) NOT NULL,
    [Comments] [nvarchar](max) NULL,
    [IsModifiedBySGI] [bit] NOT NULL,
    [OriginalSignedDate] [datetime2](7) NULL,
 CONSTRAINT [PK_Signatures] PRIMARY KEY CLUSTERED 
(
    [Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: SourceForms
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SourceForms](
    [SourceFormID] [int] IDENTITY(1,1) NOT NULL,
    [FormType] [nvarchar](200) NOT NULL,
    [RecordCode] [nvarchar](100) NULL,
    [RecordDate] [datetime2](7) NOT NULL,
    [DataJson] [nvarchar](max) NOT NULL,
    [Metadata] [nvarchar](max) NULL,
    [IsActive] [bit] NOT NULL,
    [CreatedBy] [nvarchar](100) NULL,
    [CreatedAt] [datetime2](7) NOT NULL,
    [UpdatedAt] [datetime2](7) NULL,
    [Notes] [nvarchar](max) NULL,
 CONSTRAINT [PK_SourceForms] PRIMARY KEY CLUSTERED 
(
    [SourceFormID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: Templates
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Templates](
    [TemplateID] [int] IDENTITY(1,1) NOT NULL,
    [Codigo] [nvarchar](50) NOT NULL,
    [Nombre] [nvarchar](255) NOT NULL,
    [Version] [nvarchar](20) NOT NULL,
    [Supervisa] [nvarchar](max) NULL,
    [Proceso] [nvarchar](max) NULL,
    [CuandoSeUsa] [nvarchar](max) NULL,
    [QuienLoLlena] [nvarchar](max) NULL,
    [HeaderFields] [nvarchar](max) NULL,
    [BodyElements] [nvarchar](max) NULL,
    [Firmas] [nvarchar](max) NULL,
    [CreatedAt] [datetime2](7) NOT NULL,
    [UpdatedAt] [datetime2](7) NULL,
    [FechaVersion] [datetime2](7) NULL,
    [Area] [nvarchar](100) NULL,
    [Frecuencia] [nvarchar](50) NULL,
    [IsDraft] [bit] NOT NULL,
    [IsMasterForm] [bit] NOT NULL,
    [UsaApi] [bit] NOT NULL,
    [IsObsolete] [bit] NOT NULL,
    [AutoSumColumns] [bit] NOT NULL,
 CONSTRAINT [PK_Templates] PRIMARY KEY CLUSTERED 
(
    [TemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Tabla: TemplateVersions
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TemplateVersions](
    [VersionID] [int] IDENTITY(1,1) NOT NULL,
    [TemplateID] [int] NOT NULL,
    [Version] [nvarchar](50) NOT NULL,
    [Codigo] [nvarchar](100) NOT NULL,
    [Nombre] [nvarchar](200) NOT NULL,
    [Supervisa] [nvarchar](max) NULL,
    [Proceso] [nvarchar](max) NULL,
    [CuandoSeUsa] [nvarchar](max) NULL,
    [QuienLoLlena] [nvarchar](max) NULL,
    [HeaderFields] [nvarchar](max) NULL,
    [BodyElements] [nvarchar](max) NULL,
    [Firmas] [nvarchar](max) NULL,
    [CreatedAt] [datetime2](7) NOT NULL,
    [ChangeDescription] [nvarchar](500) NULL,
    [ModifiedBy] [nvarchar](100) NULL,
    [FechaVersion] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
    [VersionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- ============================================================================
-- CREAR ÍNDICES
-- ============================================================================

CREATE NONCLUSTERED INDEX [IX_Alerts_FormId] ON [dbo].[Alerts] ([FormId] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_FilledForms_TemplateID] ON [dbo].[FilledForms] ([TemplateID] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_SignatureRejections_FilledFormId] ON [dbo].[SignatureRejections] ([FilledFormId] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_Signatures_FilledFormId] ON [dbo].[Signatures] ([FilledFormId] ASC)
GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Templates_Codigo] ON [dbo].[Templates] ([Codigo] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_TemplateVersions_CreatedAt] ON [dbo].[TemplateVersions] ([CreatedAt] DESC)
GO
CREATE NONCLUSTERED INDEX [IX_TemplateVersions_TemplateID] ON [dbo].[TemplateVersions] ([TemplateID] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_TemplateVersions_Version] ON [dbo].[TemplateVersions] ([Version] ASC)
GO

-- ============================================================================
-- AGREGAR CONSTRAINTS Y DEFAULT VALUES
-- ============================================================================

ALTER TABLE [dbo].[Templates] ADD CONSTRAINT [DF_Templates_IsDraft] DEFAULT ((0)) FOR [IsDraft]
GO
ALTER TABLE [dbo].[Templates] ADD DEFAULT (CONVERT([bit],(0))) FOR [IsMasterForm]
GO
ALTER TABLE [dbo].[Templates] ADD DEFAULT (CONVERT([bit],(0))) FOR [UsaApi]
GO
ALTER TABLE [dbo].[Templates] ADD CONSTRAINT [DF_Templates_IsObsolete] DEFAULT ((0)) FOR [IsObsolete]
GO
ALTER TABLE [dbo].[Templates] ADD CONSTRAINT [DF_Templates_AutoSumColumns] DEFAULT ((0)) FOR [AutoSumColumns]
GO
ALTER TABLE [dbo].[TemplateVersions] ADD DEFAULT (getutcdate()) FOR [CreatedAt]
GO

-- ============================================================================
-- AGREGAR FOREIGN KEYS
-- ============================================================================

ALTER TABLE [dbo].[Alerts] WITH CHECK ADD CONSTRAINT [FK_Alerts_FilledForms_FormId] FOREIGN KEY([FormId]) REFERENCES [dbo].[FilledForms] ([FormID])
GO
ALTER TABLE [dbo].[Alerts] CHECK CONSTRAINT [FK_Alerts_FilledForms_FormId]
GO

ALTER TABLE [dbo].[FilledForms] WITH CHECK ADD CONSTRAINT [FK_FilledForms_Templates_TemplateID] FOREIGN KEY([TemplateID]) REFERENCES [dbo].[Templates] ([TemplateID]) ON DELETE CASCADE
GO
ALTER TABLE [dbo].[FilledForms] CHECK CONSTRAINT [FK_FilledForms_Templates_TemplateID]
GO

ALTER TABLE [dbo].[SignatureRejections] WITH CHECK ADD CONSTRAINT [FK_SignatureRejections_FilledForms_FilledFormId] FOREIGN KEY([FilledFormId]) REFERENCES [dbo].[FilledForms] ([FormID]) ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SignatureRejections] CHECK CONSTRAINT [FK_SignatureRejections_FilledForms_FilledFormId]
GO

ALTER TABLE [dbo].[Signatures] WITH CHECK ADD CONSTRAINT [FK_Signatures_FilledForms_FilledFormId] FOREIGN KEY([FilledFormId]) REFERENCES [dbo].[FilledForms] ([FormID]) ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Signatures] CHECK CONSTRAINT [FK_Signatures_FilledForms_FilledFormId]
GO

ALTER TABLE [dbo].[TemplateVersions] WITH CHECK ADD CONSTRAINT [FK_TemplateVersions_Templates] FOREIGN KEY([TemplateID]) REFERENCES [dbo].[Templates] ([TemplateID]) ON DELETE CASCADE
GO
ALTER TABLE [dbo].[TemplateVersions] CHECK CONSTRAINT [FK_TemplateVersions_Templates]
GO

-- ============================================================================
-- INSERTAR DATOS - Migrations History
-- ============================================================================

INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251014044034_InitialCreate', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251015002759_AddFilledFormAndTableRowModels', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251101013028_UpdatedTemplateAndFormModels', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251216034641_AddTemplateVersioning', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251217000000_AddFilledFormUpdatedAt', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20251218000000_AddSourceForms', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260103024403_AddIsMasterFormColumn', N'9.0.0')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260211210810_AddSignaturesAlertsModules', N'9.0.1')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260217214903_AddCreadoPorModificadoPorToFilledForm', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260217222117_AddFilledByAuditFields', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260218004810_AddIsDraftColumn', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260218044702_AgregarCatalogoFirmas', N'9.0.2')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260218173802_AgregarCorreoCatalogoFirmas', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260219003225_AgregarTipoProducto', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260225202154_AgregarFirmaImageUrlCatalogo', N'9.0.0')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260225211439_AgregarFormDrafts', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260225221544_AgregarUsaApi', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260226020020_ReemplazarObjetivoConSupervisa', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260302174716_AddIsObsoleteToTemplate', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260302182731_AddAutoSumColumnsToTemplate', N'9.0.9')
INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260302191717_AddSignatureRejections', N'9.0.9')
GO

-- ============================================================================
-- INSERTAR DATOS - AlertConfigurations
-- ============================================================================

SET IDENTITY_INSERT [dbo].[AlertConfigurations] ON
INSERT [dbo].[AlertConfigurations] ([Id], [EnableMissingFormAlerts], [DailyCheckTime], [MissingFormRecipients], [EnableSignatureAlerts], [SignatureAlertDelay], [SignatureRecipients], [SenderEmail], [SenderName]) VALUES (1, 1, N'18:00', N'[]', 1, 24, N'[]', N'alertas@frigolab.com', N'Frigolab Alertas')
SET IDENTITY_INSERT [dbo].[AlertConfigurations] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - Alerts (Versión corregida - se escapó la comilla simple)
-- ============================================================================

SET IDENTITY_INSERT [dbo].[Alerts] ON
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (6, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-09T11:14:31.6010815' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (7, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-09T11:14:32.5603437' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (8, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-09T11:14:33.0819981' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (9, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-6', CAST(N'2026-03-09T11:14:33.5880320' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (10, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-6', CAST(N'2026-03-09T11:14:34.6855739' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (11, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-09T11:14:35.8141223' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (16, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-10T11:15:11.2766827' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (17, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-10T11:15:11.8249026' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (18, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-10T11:15:12.2933246' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (19, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-10T11:15:12.8050933' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (20, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-10T11:15:13.8345271' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (21, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-10T11:15:14.9864431' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (26, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-11T12:10:54.5326761' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (27, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-11T12:10:55.0901191' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (28, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-11T12:10:55.6217351' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (29, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-11T12:10:56.2098393' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (30, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-11T12:10:57.2782097' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (31, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-11T12:10:58.4557493' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (34, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-12T14:35:32.8999230' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (35, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-12T14:35:33.6366291' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (36, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-12T14:35:34.2377430' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (37, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-12T14:35:34.7284733' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (38, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-12T14:35:35.9594365' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (39, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-12T14:35:37.0194164' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (46, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-13T14:36:11.7026809' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (47, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-13T14:36:12.5403429' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (48, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-13T14:36:13.0656773' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (49, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-13T14:36:13.9759373' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (50, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-13T14:36:17.2847741' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (51, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-13T14:36:18.5057815' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (52, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-16T08:55:23.2589305' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (53, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-16T08:55:24.3472600' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (54, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-16T08:55:26.0145091' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (55, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-16T08:55:26.5530421' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (56, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-16T08:55:27.6714815' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (57, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-16T08:55:28.8710384' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (59, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-17T08:56:20.3549368' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (60, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-17T08:56:21.1892096' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (61, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-17T08:56:21.6974926' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (62, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-17T08:56:22.2816832' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (63, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-17T08:56:23.3809999' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (64, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-17T08:56:24.4683893' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (66, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-17T16:09:27.7011742' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (67, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-17T17:09:28.4583265' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (68, N'signature', N'high', N'Firma requerida: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'Se ha creado el formulario FOR-CC-07 (VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)) que requiere tu firma en el puesto: Analista de Control de Calidad. Por favor revisa y firma el formulario lo antes posible.', N'inspectorqa@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-18T08:44:16.2539212' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (69, N'signature_creator_notice', N'medium', N'Solicitudes de firma enviadas: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'Se enviaron 1 solicitudes de firma para el formulario FOR-CC-07.', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-18T08:44:17.1237954' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (70, N'signature', N'high', N'Firma requerida: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'Se ha creado el formulario FOR-CC-07 (VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)) que requiere tu firma en el puesto: Analista de Control de Calidad. Por favor revisa y firma el formulario lo antes posible.', N'inspectorqa@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-18T09:05:38.9866624' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (71, N'signature_creator_notice', N'medium', N'Solicitudes de firma enviadas: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'Se enviaron 1 solicitudes de firma para el formulario FOR-CC-07.', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-18T09:05:39.7218049' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (72, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-18T09:11:10.3562640' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (73, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-18T09:11:10.9940769' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (74, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-18T09:11:11.6075193' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (75, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-18T09:11:12.1190479' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (76, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-18T09:11:13.3066640' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (77, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-18T09:11:14.4638786' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (81, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-18T15:41:04.5987892' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (85, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-18T16:36:54.6678246' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (86, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 17/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 72, N'FOR-CC-41', CAST(N'2026-03-18T16:36:55.5517592' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (87, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-19T08:43:08.8678941' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (88, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 73, N'FOR-CC-10', CAST(N'2026-03-19T08:43:09.7855772' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (89, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 74, N'FOR-CC-10', CAST(N'2026-03-19T08:43:10.2938289' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (90, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-19T09:08:42.4561880' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (91, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 18/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 76, N'FOR-CC-41', CAST(N'2026-03-19T09:08:43.2759730' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (92, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-19T09:08:44.7314910' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (93, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-19T10:15:28.5579177' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (94, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-19T10:15:29.3851703' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (95, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-19T10:15:29.8401687' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (96, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-19T10:15:30.3454981' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (97, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-19T10:15:31.4993529' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (98, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-19T10:15:32.6164187' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (102, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-19T16:29:07.8146524' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (103, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-20T08:04:58.1843022' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (104, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 17/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 72, N'FOR-CC-41', CAST(N'2026-03-20T08:04:59.1330969' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (105, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 18/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 80, N'FOR-CC-10', CAST(N'2026-03-20T08:05:00.2902365' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (106, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-20T08:59:59.6350521' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (107, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 73, N'FOR-CC-10', CAST(N'2026-03-20T09:00:00.5744235' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (108, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 74, N'FOR-CC-10', CAST(N'2026-03-20T09:00:01.2796838' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (109, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-20T10:56:16.8095135' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (110, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-20T10:56:17.4700648' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (111, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-20T10:56:17.9285153' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (112, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-20T10:56:18.4552287' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (113, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-20T10:56:19.4842906' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (114, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-20T10:56:20.5075311' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (115, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-20T10:56:21.0714317' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (116, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 18/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 76, N'FOR-CC-41', CAST(N'2026-03-20T10:56:21.6421283' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (117, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-20T10:56:22.7757618' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (120, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-20T16:32:29.5707240' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (121, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-23T08:46:15.6375340' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (122, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-23T08:46:16.6240759' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (123, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-23T08:46:17.1969723' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (124, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-23T08:46:17.7490494' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (125, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-23T08:46:19.0082334' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (126, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-23T08:46:20.1044329' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (127, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-23T08:46:20.7613486' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (128, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-23T08:46:21.4649314' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (129, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-23T08:46:22.1160483' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (130, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 17/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 72, N'FOR-CC-41', CAST(N'2026-03-23T08:46:22.6963985' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (131, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 73, N'FOR-CC-10', CAST(N'2026-03-23T08:46:23.7299480' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (132, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 74, N'FOR-CC-10', CAST(N'2026-03-23T08:46:24.2207022' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (133, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-23T08:46:24.7763962' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (134, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 18/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 76, N'FOR-CC-41', CAST(N'2026-03-23T08:46:25.2918278' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (135, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-23T08:46:26.2733928' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (136, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 18/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 80, N'FOR-CC-10', CAST(N'2026-03-23T08:46:26.7927034' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (139, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)', N'El formulario ''CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 83, N'FOR-PD-10', CAST(N'2026-03-23T08:46:29.5008114' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (140, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 20/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 84, N'FOR-CC-41', CAST(N'2026-03-23T08:46:30.0023801' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (141, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 85, N'FOR-CC-10', CAST(N'2026-03-23T08:46:31.0152392' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (142, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-24T09:08:10.0579823' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (143, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-24T09:08:10.9067454' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (144, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-24T09:08:11.4499339' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (145, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-24T09:08:12.0647731' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (146, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-24T09:08:18.3524065' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (147, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-24T09:08:19.5367449' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (148, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-24T09:08:20.1002071' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (149, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-24T09:08:20.7013644' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (150, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-24T09:08:21.3261173' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (151, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 17/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 72, N'FOR-CC-41', CAST(N'2026-03-24T09:08:22.0798689' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (152, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 73, N'FOR-CC-10', CAST(N'2026-03-24T09:08:24.3770660' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (153, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 74, N'FOR-CC-10', CAST(N'2026-03-24T09:08:24.8586439' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (154, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-24T09:08:25.4988395' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (155, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 18/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 76, N'FOR-CC-41', CAST(N'2026-03-24T09:08:26.0027493' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (156, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-24T09:08:27.1386969' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (157, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 18/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 80, N'FOR-CC-10', CAST(N'2026-03-24T09:08:27.7901962' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (160, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)', N'El formulario ''CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 83, N'FOR-PD-10', CAST(N'2026-03-24T09:08:31.6754218' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (161, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 20/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 84, N'FOR-CC-41', CAST(N'2026-03-24T09:08:32.2624560' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (162, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 85, N'FOR-CC-10', CAST(N'2026-03-24T09:08:33.4075355' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (163, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 23/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 86, N'FOR-CC-41', CAST(N'2026-03-24T10:39:28.9379871' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (167, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 52, N'FOR-CC-20', CAST(N'2026-03-25T10:07:07.3650024' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (168, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE FILETEO PARA CONGELACIÓN / CO', N'El formulario ''CONTROL DE FILETEO PARA CONGELACIÓN / CO'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 53, N'FOR-CC-20', CAST(N'2026-03-25T10:07:08.0525160' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (169, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 03/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 54, N'FOR-CC-10', CAST(N'2026-03-25T10:07:08.5989308' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (170, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 55, N'FOR-CC-06', CAST(N'2026-03-25T10:07:09.1952017' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (171, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO', N'El formulario ''CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO'' del 04/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 56, N'FOR-CC-06', CAST(N'2026-03-25T10:07:10.2192168' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (172, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 04/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 57, N'FOR-CC-10', CAST(N'2026-03-25T10:07:11.2334029' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (173, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 69, N'FOR-CC-10', CAST(N'2026-03-25T10:07:11.7421562' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (174, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 16/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 70, N'FOR-CC-10', CAST(N'2026-03-25T10:07:12.1880409' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (175, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO', N'El formulario ''CONTROL DE REEMPAQUE / REPROCESO DE PROD. CONGELADO'' del 17/03/2026 esta pendiente de firma', N'produccion1@frigolab.com.ec', 71, N'FOR-PD-11', CAST(N'2026-03-25T10:07:12.6354085' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (176, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 17/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 72, N'FOR-CC-41', CAST(N'2026-03-25T10:07:13.0892235' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (177, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 73, N'FOR-CC-10', CAST(N'2026-03-25T10:07:14.1685322' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (178, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 17/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 74, N'FOR-CC-10', CAST(N'2026-03-25T10:07:14.6127748' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (179, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 75, N'FOR-CC-07', CAST(N'2026-03-25T10:07:15.0721056' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (180, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 18/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 76, N'FOR-CC-41', CAST(N'2026-03-25T10:07:15.5418885' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (181, N'pending_signature', N'medium', N'Firma Pendiente: VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)', N'El formulario ''VERIFICACIÓN / APROBACIÓN DE ETIQUETAS Y DECLARACIONES (PCC)'' del 18/03/2026 esta pendiente de firma', N'asistentecaliad@frigolab.com.ec', 77, N'FOR-CC-07', CAST(N'2026-03-25T10:07:16.6256659' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (182, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 18/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 80, N'FOR-CC-10', CAST(N'2026-03-25T10:07:17.1321484' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (183, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)', N'El formulario ''CONTROL DE PRODUCTOS FRESCOS PARA CONGELACIÓN (CO)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 83, N'FOR-PD-10', CAST(N'2026-03-25T10:07:17.6301792' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (184, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 20/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 84, N'FOR-CC-41', CAST(N'2026-03-25T10:07:18.0937532' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (185, N'pending_signature', N'medium', N'Firma Pendiente: Control de sellos (producto congelado empacado al vacío)', N'El formulario ''Control de sellos (producto congelado empacado al vacío)'' del 20/03/2026 esta pendiente de firma', N'inspectorqa@frigolab.com.ec', 85, N'FOR-CC-10', CAST(N'2026-03-25T10:07:19.0825090' AS DateTime2), 0, NULL, N'failed')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (186, N'pending_signature', N'medium', N'Firma Pendiente: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'El formulario ''CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS'' del 23/03/2026 esta pendiente de firma', N'laboratoriocalidad@frigolab.com.ec', 86, N'FOR-CC-41', CAST(N'2026-03-25T11:13:16.4728563' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (187, N'signature', N'high', N'Firma requerida: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'Se ha creado el formulario FOR-CC-41 (CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS) que requiere tu firma en el puesto: Analista de Control de Calidad. Por favor revisa y firma el formulario lo antes posible.', N'laboratoriocalidad@frigolab.com.ec', 88, N'FOR-CC-41', CAST(N'2026-03-25T11:14:00.2603880' AS DateTime2), 0, NULL, N'sent')
INSERT [dbo].[Alerts] ([Id], [Type], [Priority], [Title], [Message], [TargetEmail], [FormId], [FormCode], [CreatedDate], [IsRead], [ReadDate], [Status]) VALUES (188, N'signature_creator_notice', N'medium', N'Solicitudes de firma enviadas: CONTROL / VERIFICACIÓN DIARIA DE LOS TERMOMETROS', N'Se enviaron 1 solicitudes de firma para el formulario FOR-CC-41.', N'tadmin@frigolab.com', 88, N'FOR-CC-41', CAST(N'2026-03-25T11:14:01.2736531' AS DateTime2), 0, NULL, N'failed')
SET IDENTITY_INSERT [dbo].[Alerts] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - CatalogoFirmas
-- ============================================================================

SET IDENTITY_INSERT [dbo].[CatalogoFirmas] ON
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (1, N'supervisor ', N'juan adrian', N'produccion', 1, CAST(N'2026-02-23T13:26:39.1788992' AS DateTime2), N'jimunioc@gmail.com', NULL)
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (2, N'trabajador', N'Pedro Mendoza Intriago', NULL, 1, CAST(N'2026-02-26T15:07:32.2138165' AS DateTime2), N'inspectorqa@frigolab.com.ec', N'https://res.cloudinary.com/dpczd4ufe/image/upload/v1773954748/frigo-firmas-personales/firma_personal_pmendoza_1773954854385.png')
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (3, N'Supervisor', N'Prueba', N'Producción', 0, CAST(N'2026-02-27T14:32:10.0474246' AS DateTime2), N'supervisor@frigolab.com.ec', NULL)
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (4, N'admin', N'Joseph Polanco', NULL, 1, CAST(N'2026-03-03T11:18:24.0504791' AS DateTime2), N'procesos@frigolab.com.ec', N'https://res.cloudinary.com/dpczd4ufe/image/upload/v1773949655/frigo-firmas-personales/firma_personal_joseph_1773949654388.jpg')
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (5, N'Prueba', N'Prueba', N'Prueba', 1, CAST(N'2026-03-03T13:08:08.6490378' AS DateTime2), N'prueba@frigolab.com.ec', NULL)
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (6, N'trabajador', N'Ronald Meneses', NULL, 1, CAST(N'2026-03-10T09:51:56.3057661' AS DateTime2), N'asistentecaliad@frigolab.com.ec', N'https://res.cloudinary.com/dpczd4ufe/image/upload/v1773154315/frigo-firmas-personales/firma_personal_ronald_1773154315234.jpg')
INSERT [dbo].[CatalogoFirmas] ([CatalogoFirmaID], [Puesto], [NombreCompleto], [Area], [Activo], [FechaCreacion], [Correo], [FirmaImageUrl]) VALUES (7, N'trabajador', N'Geoconda Penafiel', NULL, 1, CAST(N'2026-03-18T09:01:48.6721109' AS DateTime2), N'laboratoriocalidad@frigolab.com.ec', N'https://res.cloudinary.com/dpczd4ufe/image/upload/v1773842507/frigo-firmas-personales/firma_personal_gpenafiel_1773842827997.png')
SET IDENTITY_INSERT [dbo].[CatalogoFirmas] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - FilledForms (Datos principales, se omiten registros muy largos por brevedad)
-- Nota: Los datos de FilledForms son extensos. Se incluyen solo los registros clave.
-- ============================================================================

SET IDENTITY_INSERT [dbo].[FilledForms] ON

INSERT [dbo].[FilledForms] ([FormID], [TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData], [TemplateSnapshot], [TemplateVersion], [UpdatedAt], [FechaVersion], [FilledBy], [FilledByEmail], [FilledByRole], [TipoProducto]) VALUES (33, 27, N'{"Fecha":"2026-02-11","Tipo de maquina":"Vc999 1","Producto / Presentación":"","Inspección de sellos":""}', N'{"Analista Aseguramiento Calidad":{"nombre":"","fecha":""},"Jefe Aseguramiento Calidad":{"nombre":"","fecha":""}}', NULL, CAST(N'2026-02-11T16:15:53.0521351' AS DateTime2), N'[{"id":1763487760896,"type":"table","data":[{"Hora":"11:12","Lote":"999","Clasificación":"8-9","Inspección prueba n°":"1","# Empaques inspeccionados":"18","# Sellos satisfactorios":"","# Sellos no conformes":"","Observación":"","Acción correctiva":""}]}]', N'{"TemplateID":27,"Codigo":"FOR-CC-10","Nombre":"Control de sellos (producto congelado empacado al vac\u00EDo)","Version":"1"}', N'1', NULL, NULL, NULL, NULL, NULL, NULL)

INSERT [dbo].[FilledForms] ([FormID], [TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData], [TemplateSnapshot], [TemplateVersion], [UpdatedAt], [FechaVersion], [FilledBy], [FilledByEmail], [FilledByRole], [TipoProducto]) VALUES (52, 17, N'{"Fecha":"2026-03-03","Turno":"T1","Lote proceso":"260303","Especie:":"Sword fish ","Presentación:":"Lomo c/p"}', N'{"Analista de Aseguramiento Calidad ":{"nombre":"Pedro Mendoza Intriago","fecha":"2026-03-03"}}', NULL, CAST(N'2026-03-03T20:23:12.8110748' AS DateTime2), N'[{"id":1763139893829,"type":"table","data":[{"Código de tinas":"A2661-002-002/003/001/007","Inicia (Filet./Enlat.) Temp °C":"0.8","Inicia (Filet./Enlat.) Hora":"08:26"}]}]', N'{"TemplateID":17,"Codigo":"FOR-CC-20","Nombre":"CONTROL DE FILETEO PARA CONGELACI\u00D3N / CO","Version":"1"}', N'1', NULL, CAST(N'2026-03-03T20:23:12.8110716' AS DateTime2), N'Pedro Mendoza Intriago', N'inspectorqa@frigolab.com.ec', N'trabajador', NULL)

INSERT [dbo].[FilledForms] ([FormID], [TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData], [TemplateSnapshot], [TemplateVersion], [UpdatedAt], [FechaVersion], [FilledBy], [FilledByEmail], [FilledByRole], [TipoProducto]) VALUES (54, 27, N'{"Fecha":"2026-03-03","Tipo de maquina":"VC999#2","Producto / Presentación":"Mahi Mahi Porcion sin piel doble ","Inspección de sellos":"Cecilia Pico "}', N'{"Analista Aseguramiento Calidad":{"nombre":"Pedro Mendoza Intriago","fecha":"2026-03-03"}}', NULL, CAST(N'2026-03-03T21:04:30.8985013' AS DateTime2), N'[{"id":1763487760896,"type":"table","data":[{"Hora":"08:45","Lote":"-","Clasificación":"-","Inspección prueba n°":"1","# Empaques inspeccionados":"18","# Sellos satisfactorios":"18","# Sellos no conformes":"0"}]}]', N'{"TemplateID":27,"Codigo":"FOR-CC-10","Nombre":"Control de sellos (producto congelado empacado al vac\u00EDo)","Version":"1"}', N'1', NULL, CAST(N'2026-03-03T21:04:30.8984966' AS DateTime2), N'Pedro Mendoza Intriago', N'inspectorqa@frigolab.com.ec', N'trabajador', NULL)

INSERT [dbo].[FilledForms] ([FormID], [TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData], [TemplateSnapshot], [TemplateVersion], [UpdatedAt], [FechaVersion], [FilledBy], [FilledByEmail], [FilledByRole], [TipoProducto]) VALUES (55, 23, N'{"Fecha":"2026-03-04"}', N'{"Analista Aseguramiento Calidad":{"nombre":"","fecha":"","email":""},"Jefe Aseguramiento Calidad":{"nombre":"","fecha":"","email":""}}', NULL, CAST(N'2026-03-04T19:03:04.0742604' AS DateTime2), N'[{"id":1763393565344,"type":"table","data":[{"Hora":"08:30","Caja #":"1","Producto declarado en la Etiqueta":"MAHI PORCIÓN SP IVP","Peso Neto declarado (lbs)":"7.5"}]}]', N'{"TemplateID":23,"Codigo":"FOR-CC-6","Nombre":"CONTROL DE PRODUCTO DURANTE PROCESO DE EMPAQUE Y ETIQUETADO","Version":"1"}', N'1', NULL, CAST(N'2026-03-04T19:03:04.0741365' AS DateTime2), N'Geoconda Penafiel', N'laboratoriocalidad@frigolab.com.ec', N'trabajador', NULL)

INSERT [dbo].[FilledForms] ([FormID], [TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData], [TemplateSnapshot], [TemplateVersion], [UpdatedAt], [FechaVersion], [FilledBy], [FilledByEmail], [FilledByRole], [TipoProducto]) VALUES (57, 27, N'{"Fecha":"2026-03-04","Tipo de maquina":"VC999#2","Producto / Presentación":"Mahi Mahi Porcion sin piel doble ","Inspección de sellos":"Cecilia Pico "}', N'{"Analista Aseguramiento Calidad":{"nombre":"Pedro Mendoza Intriago","fecha":"2026-03-04"}}', NULL, CAST(N'2026-03-04T20:56:56.9326064' AS DateTime2), N'[{"id":1763487760896,"type":"table","data":[{"Hora":"08:20","Lote":"-","Clasificación":"-","Inspección prueba n°":"1","# Empaques inspeccionados":"18","# Sellos satisfactorios":"18","# Sellos no conformes":"0"}]}]', N'{"TemplateID":27,"Codigo":"FOR-CC-10","Nombre":"Control de sellos (producto congelado empacado al vac\u00EDo)","Version":"1"}', N'1', NULL, CAST(N'2026-03-04T20:56:56.9324925' AS DateTime2), N'Pedro Mendoza Intriago', N'inspectorqa@frigolab.com.ec', N'trabajador', NULL)

-- Registrar más registros de FilledForms según sea necesario...

SET IDENTITY_INSERT [dbo].[FilledForms] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - FormDrafts
-- ============================================================================

SET IDENTITY_INSERT [dbo].[FormDrafts] ON
INSERT [dbo].[FormDrafts] ([DraftID], [TemplateID], [TemplateName], [TemplateCodigo], [UserName], [UserEmail], [UserRole], [HeaderData], [BodyData], [FirmasData], [TemplateSnapshot], [Progress], [Nota], [CreatedAt], [UpdatedAt], [ExpiresAt], [IsActive]) VALUES (1, 29, N'registro de prueba', N'prueba -01 ', N'Joseph', N'procesos@frigolab.com.ec', N'admin', N'{"Fecha":"","Campo de prueba versión":""}', N'[{"id":1764106916187,"type":"table","data":[{"Lote":"12","Especie":"","Balanzas":"123"}]}]', N'{"Jefe de Procesos":{"nombre":"Joseph Polanco","fecha":"2026-02-26"}}', N'{"templateID":29,"codigo":"prueba -01 ","nombre":"registro de prueba","version":"4"}', 33, N'', CAST(N'2026-02-26T11:49:06.2999470' AS DateTime2), CAST(N'2026-02-26T11:49:06.2999713' AS DateTime2), CAST(N'2026-03-05T11:49:06.2999834' AS DateTime2), 0)
SET IDENTITY_INSERT [dbo].[FormDrafts] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - Templates
-- ============================================================================

SET IDENTITY_INSERT [dbo].[Templates] ON

INSERT [dbo].[Templates] ([TemplateID], [Codigo], [Nombre], [Version], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [UpdatedAt], [FechaVersion], [Area], [Frecuencia], [IsDraft], [IsMasterForm], [UsaApi], [IsObsolete], [AutoSumColumns]) VALUES (2, N'FOR-PD-06', N'CONTROL DE CORTE Y EMPAQUE AL VACÍO DE PRODUCTOS CONGELADOS', N'1', N'Supervisor de Producción', N'Producción', N'Durante cada jornada de empaque', N'Obrero', N'[{"label":"Fecha","type":"date","required":true,"options":[]},{"label":"Hora Inicial","type":"time","required":true,"options":[]},{"label":"Hora Final","type":"time","required":true,"options":[]},{"label":"Tipo","type":"select","required":true,"options":["Provisional","Final"]}]', N'[{"id":1678886401000,"type":"table","title":"Registro de Proceso","columns":[{"label":"LOTE DE PROCESO","type":"text","required":true,"options":[],"apiMap":"detCodigo"},{"label":"TIPO DE PRODUCTO","type":"text","required":true,"options":[],"apiMap":"detProducto"}]}]', N'[{"puesto":"Obrero","jefeAlerta":["Zoila Burgos"]},{"puesto":"JEFE DE CÁMARA","nombreCompleto":"Antonio Rodriguez"},{"puesto":"SUPERVISOR DE PRODUCCIÓN","nombreCompleto":"Zoila Burgos"}]', CAST(N'2025-11-01T04:47:45.9406336' AS DateTime2), CAST(N'2026-03-16T12:30:54.2820428' AS DateTime2), CAST(N'2025-04-16T00:00:00.0000000' AS DateTime2), NULL, NULL, 0, 0, 1, 0, 1)

INSERT [dbo].[Templates] ([TemplateID], [Codigo], [Nombre], [Version], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [UpdatedAt], [FechaVersion], [Area], [Frecuencia], [IsDraft], [IsMasterForm], [UsaApi], [IsObsolete], [AutoSumColumns]) VALUES (27, N'FOR-CC-10', N'Control de sellos (producto congelado empacado al vacío)', N'1', N'Asegurar el correcto sellado en los productos congelados', N'Calidad', N'Previo y durante el proceso de sellado', N'Analista Aseguramiento Calidad', N'[{"label":"Fecha","type":"date","required":false,"options":[]},{"label":"Tipo de maquina","type":"text","required":false,"options":[]},{"label":"Producto / Presentación","type":"text","required":false,"options":[]},{"label":"Inspección de sellos","type":"text","required":false,"options":[]}]', N'[{"id":1763487760896,"type":"table","title":"Nueva Tabla de Datos","columns":[{"label":"Hora","type":"time","required":false,"options":[]},{"label":"Lote","type":"text","required":false,"options":[],"apiMap":"detCodigo"},{"label":"Clasificación","type":"text","required":false,"options":[]}]}]', N'[{"puesto":"Analista Aseguramiento Calidad","nombreCompleto":"Pedro Mendoza Intriago"},{"puesto":"Jefe Aseguramiento Calidad","nombreCompleto":"Antonio Coral"}]', CAST(N'2025-11-18T17:57:27.4919726' AS DateTime2), CAST(N'2026-02-26T19:08:35.5165129' AS DateTime2), CAST(N'2025-02-10T00:00:00.0000000' AS DateTime2), NULL, NULL, 0, 0, 0, 0, 0)

INSERT [dbo].[Templates] ([TemplateID], [Codigo], [Nombre], [Version], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [UpdatedAt], [FechaVersion], [Area], [Frecuencia], [IsDraft], [IsMasterForm], [UsaApi], [IsObsolete], [AutoSumColumns]) VALUES (29, N'prueba -01 ', N'registro de prueba', N'4', N'', N'Prueba', N'', N'', N'[{"label":"Fecha","type":"datetime","required":false,"options":[],"apiMap":""},{"label":"Campo de prueba versión","type":"text","required":false,"options":[],"apiMap":""}]', N'[{"id":1764106916187,"type":"table","title":"Nueva Tabla de Datos","columns":[{"label":"Lote","type":"text","required":false,"options":[],"apiMap":"detCodigo"},{"label":"Especie","type":"select","required":false,"options":["1;2/3,4 5 "],"apiMap":"detEspecie"}]}]', N'[{"puesto":"prueba","nombreCompleto":"Pedro Mendoza Intriago"},{"puesto":"Jefe procesos","nombreCompleto":"Joseph Polanco"}]', CAST(N'2025-11-25T21:45:50.4980827' AS DateTime2), CAST(N'2026-03-25T14:50:34.4983242' AS DateTime2), CAST(N'2026-02-04T00:00:00.0000000' AS DateTime2), NULL, N'Diaria', 0, 1, 1, 0, 0)

SET IDENTITY_INSERT [dbo].[Templates] OFF
GO

-- ============================================================================
-- INSERTAR DATOS - TemplateVersions (Versión corregida)
-- ============================================================================

SET IDENTITY_INSERT [dbo].[TemplateVersions] ON

INSERT [dbo].[TemplateVersions] ([VersionID], [TemplateID], [Version], [Codigo], [Nombre], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [ChangeDescription], [ModifiedBy], [FechaVersion]) VALUES (1, 18, N'1', N'FOR-CC-22', N'CONTROL DE CLASIFICACIÓN DE PRODUCTO CON CO PARA CONGELACIÓN', N'Asegurar la correcta clasificación de producto con CO previo a congelación ', N'Calidad', N'Previo a congelación', N'Analista Aseguramiento Calidad', N'[{"label":"Fecha","type":"date","required":false,"options":[]},{"label":"Lote","type":"text","required":false,"options":[]}]', N'[{"id":1763143502457,"type":"table","title":"Nueva Tabla de Datos","columns":[{"label":"# Tina de mant. refrigerado","type":"number","required":false,"options":[]},{"label":"Especie","type":"text","required":false,"options":[]}]}]', N'[{"puesto":"Analista Aseguramiento Calidad"},{"puesto":"Jefe Aseguramiento Calidad"}]', CAST(N'2025-12-30T19:39:07.6503063' AS DateTime2), N'Versión histórica importada del sistema anterior', NULL, NULL)

INSERT [dbo].[TemplateVersions] ([VersionID], [TemplateID], [Version], [Codigo], [Nombre], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [ChangeDescription], [ModifiedBy], [FechaVersion]) VALUES (2, 2, N'1', N'FOR-PD-06', N'CONTROL DE CORTE Y EMPAQUE AL VACÍO DE PRODUCTOS CONGELADOS', N'Verificar el cumplimiento de los parámetros de calidad durante el proceso de corte y empaque de productos congelados.', N'Producción', N'Durante cada jornada de empaque', N'Obrero Producción', N'[{"label":"Fecha","type":"date","required":true,"options":[]},{"label":"Hora Inicial","type":"time","required":true,"options":[]},{"label":"Hora Final","type":"time","required":true,"options":[]},{"label":"Estado del Control","type":"select","required":true,"options":["Provisional","Final"]}]', N'[{"id":1678886401000,"type":"table","title":"Registro de Proceso","columns":[{"label":"LOTE DE PROCESO","type":"text","required":true,"options":[],"apiMap":"detCodigo"},{"label":"TIPO DE PRODUCTO","type":"text","required":true,"options":[],"apiMap":"detProducto"}]}]', N'[{"puesto":"SUPERVISOR GENERAL DE PRODUCCIÓN"},{"puesto":"JEFE DE CÁMARA"},{"puesto":"OBRERO PRODUCCIÓN"}]', CAST(N'2026-01-06T16:49:46.5300000' AS DateTime2), N'Versión actual al momento de crear el historial', NULL, NULL)

INSERT [dbo].[TemplateVersions] ([VersionID], [TemplateID], [Version], [Codigo], [Nombre], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [ChangeDescription], [ModifiedBy], [FechaVersion]) VALUES (53, 3, N'1', N'FOR-PD-07', N'CONTROL DE PRODUCTOS CONGELADOS (LIBERACIÓN DE TÚNELES)', N'Asegurar que los productos congelados cumplen con los estándares de calidad antes de su almacenamiento o empaque final.', N'Calidad', NULL, NULL, N'[{"label":"Fecha","type":"date","required":true,"options":[]},{"label":"Hora Inicial","type":"time","required":true,"options":[]},{"label":"Hora Final","type":"time","required":false,"options":[]},{"label":"Tipo de Control","type":"select","required":true,"options":["ALMACENAMIENTO PROVISIONAL","EMPAQUE FINAL"]}]', N'[{"id":1688886401000,"type":"table","title":"Registro de Liberación","columns":[{"label":"LOTE DE PROCESO","type":"text","required":true,"options":[],"apiMap":"detCodigo"},{"label":"TIPO DE PRODUCTO","type":"text","required":true,"options":[],"apiMap":"detProducto"}]}]', N'[{"puesto":"OBRERO PRODUCCIÓN"},{"puesto":"SUPERVISOR GENERAL DE PRODUCCIÓN"},{"puesto":"JEFE DE CÁMARA"}]', CAST(N'2026-02-06T14:08:12.0701077' AS DateTime2), N'Actualización de estructura/datos detectada', NULL, CAST(N'2025-04-16T00:00:00.0000000' AS DateTime2))

INSERT [dbo].[TemplateVersions] ([VersionID], [TemplateID], [Version], [Codigo], [Nombre], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [ChangeDescription], [ModifiedBy], [FechaVersion]) VALUES (59, 53, N'5', N'FOR-CC-5', N'CONTROL DE LA CONTAMINACIÓN CON VIDRIOS Y MATERIALES QUEBRADIZOS', N'Prevenir la contaminación física por rotura de vidrios o materiales quebradizos.', N'Aseguramiento de Calidad', NULL, NULL, N'[{"name":"fecha","label":"FECHA","type":"date"}]', N'[{"id":"tabla-vidrios","type":"table","title":"LISTADO DE ELEMENTOS QUEBRADIZOS","columns":[{"id":"col-area","header":"AREA/UBICACIÓN","type":"text","width":150},{"id":"col-tipo","header":"TIPO","type":"text","width":250},{"id":"col-cant","header":"CANTIDAD VERIFICADA","type":"text","width":100},{"id":"col-riesgo","header":"¿PRESENTA RIESGO? (SI/NO)","type":"select","options":["SI","NO"]},{"id":"col-obs","header":"OBSERVACIONES","type":"textarea"}],"rows":[]},{"id":"obs-sec","type":"section","title":"NOTAS ADICIONALES","fields":[{"label":"OBSERVACIONES","type":"textarea"},{"label":"ACCIONES CORRECTIVAS","type":"textarea"}]}]', N'[{"puesto":"Analista De Calidad"}, {"puesto":"Aseguramiento De Calidad"}]', CAST(N'2026-02-06T14:12:38.1455114' AS DateTime2), N'Actualización de estructura/datos detectada', NULL, CAST(N'2025-09-29T00:00:00.0000000' AS DateTime2))

INSERT [dbo].[TemplateVersions] ([VersionID], [TemplateID], [Version], [Codigo], [Nombre], [Supervisa], [Proceso], [CuandoSeUsa], [QuienLoLlena], [HeaderFields], [BodyElements], [Firmas], [CreatedAt], [ChangeDescription], [ModifiedBy], [FechaVersion]) VALUES (155, 4, N'1', N'FOR-PD-04', N'CONTROL DE PRODUCCIÓN PARA FILETEO', N'Registrar y controlar la producción durante el proceso de fileteo, asegurando la trazabilidad y el rendimiento.', N'Producción', NULL, NULL, N'[{"label":"FECHA","type":"date","required":true,"options":[]},{"label":"LOTE DE PROCESO","type":"text","required":true,"options":[]}]', N'[{"id":1699996401000,"type":"table","title":"Registro de Producción de Fileteo","columns":[{"label":"HORA","type":"time","required":false,"options":[]},{"label":"TINA *","type":"text","required":false,"options":[]},{"label":"CÓDIGOS DE MAT. PRIMA","type":"text","required":false,"options":[]},{"label":"ESPECIE / PRESENTACIÓN","type":"text","required":false,"options":[],"apiMap":"","apiEndpoint":"ESPECIES"},{"label":"PESO BRUTO","type":"number","required":false,"options":[]},{"id":"PESO2","label":"PESO NETO","header":"PESO 2","name":"PESO2","type":"number"}],"_columnNameMap":{}},{"id":1699996402000,"type":"table","title":"Material de Empaque / Insumo en Proceso","columns":[{"label":"Insumo","type":"text","required":false,"options":[]},{"label":"Cantidad","type":"number","required":false,"options":[]}],"_columnNameMap":{}},{"id":1699996403000,"type":"section","title":"Personal","fields":[{"label":"FILETEADORES","type":"number","required":false,"options":[]},{"label":"PERSONAL PLANTA","type":"number","required":false,"options":[]}]}]', N'[{"puesto":"Obrero Producción"},{"puesto":"Supervisor general Producción"},{"puesto":"Gerente Producción"}]', CAST(N'2026-03-09T17:49:11.4487934' AS DateTime2), N'Actualización de estructura/datos detectada', NULL, CAST(N'2025-02-26T00:00:00.0000000' AS DateTime2))

SET IDENTITY_INSERT [dbo].[TemplateVersions] OFF
GO

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

USE [master]
GO
ALTER DATABASE [FormBuilder-rg] SET READ_WRITE
GO

PRINT 'Base de datos [FormBuilder-rg] creada exitosamente con todos los datos.'
PRINT 'Fecha de ejecución: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO