USE [FormBuilder-rg]
GO

-- ============================================================
-- INSERTAR FORMULARIO LLENADO: Lista Maestra Documental
-- Código: FOR-SGC-3  |  Versión: 1
-- Fecha: 09/01/2025
-- ============================================================

DECLARE @TemplateID INT;
SELECT @TemplateID = TemplateID FROM Templates WHERE Codigo = 'FOR-LMD-01';

IF @TemplateID IS NULL
BEGIN
    PRINT '❌ ERROR: No se encontró la plantilla FOR-LMD-01. Verifica que exista en la tabla Templates.';
    RETURN;
END

PRINT '✅ TemplateID encontrado: ' + CAST(@TemplateID AS VARCHAR);

-- BodyData: tabla principal con todos los documentos
DECLARE @BodyData NVARCHAR(MAX) = N'[
  {
    "id": 1741500000001,
    "type": "table",
    "title": "Lista Maestra Documental",
    "data": [
      {"Nombre de Documento": "Procedimiento de acciones correctivas y preventivas", "Código": "PR-SGC-1", "Versión": "1", "Fecha": "27/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Procedimiento de control documental", "Código": "PR-SGC-2", "Versión": "2", "Fecha": "18/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Procedimiento de Auditoría Interna", "Código": "PR-SGC-3", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Procedimiento de reunión y Versión de la gerencia", "Código": "PR-SGC-4", "Versión": "1", "Fecha": "07/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Procedimiento de reunión mensual del equipo", "Código": "PR-SGC-5", "Versión": "1", "Fecha": "07/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Procedimiento de Requisitos Legales", "Código": "PR-SGC-6", "Versión": "1", "Fecha": "07/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Matriz de seguimiento de no conformidades", "Código": "MTR-SGC-1", "Versión": "1", "Fecha": "27/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "CÓDIGO DISPONIBLE", "Código": "MTR-SGC-2", "Versión": "", "Fecha": "", "Copia Controlada / Ubicación": ""},
      {"Nombre de Documento": "Matriz de Requisitos Legales", "Código": "MTR-SGC-3", "Versión": "1", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Objetivos", "Código": "MTR-SGC-4", "Versión": "2", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Analisis de causa raiz", "Código": "FOR-SGC-1", "Versión": "1", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de inspección BPM", "Código": "FOR-SGC-2", "Versión": "1", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Lista Maestra Documental", "Código": "FOR-SGC-3", "Versión": "1", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de Auditorias Internas BRCGS (Audit #1)", "Código": "FOR-SGC-4", "Versión": "2", "Fecha": "17/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de Auditorias Internas BRCGS (CAP: 2 Y 3)", "Código": "FOR-SGC-5", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de Auditorias Internas (CAP: 4)", "Código": "FOR-SGC-6", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de Auditorias Internas BRCGS (CAP: 5 Y 6)", "Código": "FOR-SGC-7", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de Auditorias Internas BRCGS (Toda la norma)", "Código": "FOR-SGC-8", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de acta de Reunión", "Código": "FOR-SGC-9", "Versión": "1", "Fecha": "07/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Informe de Auditoría Interna (BASC)", "Código": "FOR-SGC-10", "Versión": "1", "Fecha": "13/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de cumplimiento de especificaciones de clientes", "Código": "FOR-SGC-11", "Versión": "1", "Fecha": "13/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de cumplimiento de Histamina", "Código": "FOR-SGC-12", "Versión": "1", "Fecha": "13/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de cumplimiento de especificaciones microbiologicas de PT.", "Código": "FOR-SGC-13", "Versión": "1", "Fecha": "13/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Formato de cumplimiento de análisis de metabisulfito", "Código": "FOR-SGC-14", "Versión": "1", "Fecha": "13/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Clientes para el servicio de frío (MSC ASC)", "Código": "FOR-SGC-15", "Versión": "1", "Fecha": "15/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Checklist de Auditoría BASC", "Código": "FOR-SGC-16", "Versión": "1", "Fecha": "20/06/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Programa Anual de Auditoria BASC", "Código": "FOR-SGC-17", "Versión": "1", "Fecha": "13/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Versión Anual por la Gerencia", "Código": "FOR-SGC-18", "Versión": "1", "Fecha": "20/05/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Mapa de Proceso", "Código": "FOR-SGC-19", "Versión": "2", "Fecha": "26/06/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Cronograma de Auditorias Internas", "Código": "CRN-SGC-1", "Versión": "1", "Fecha": "19/02/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Cronograma de inspecciones BPM", "Código": "CRN-SGC-2", "Versión": "1", "Fecha": "09/01/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Lista de requisitos legales", "Código": "DOC-SGC-1", "Versión": "1", "Fecha": "10/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Acuerdo con proveedores de Materia Prima", "Código": "DOC-SGC-2", "Versión": "2", "Fecha": "18/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Misión, visión y valores Frigolab San Mateo", "Código": "DOC-SGC-3", "Versión": "1", "Fecha": "05/01/2025", "Copia Controlada / Ubicación": "Si - Entrada de Proceso, Comedor"},
      {"Nombre de Documento": "Politica integrada Frigolab San Mateo", "Código": "DOC-SGC-4", "Versión": "1", "Fecha": "21/05/2025", "Copia Controlada / Ubicación": "Si - Entrada, Comedor, Garita, Baños, Administración, Cámaras"},
      {"Nombre de Documento": "Carta de compromiso de la gerencia", "Código": "DOC-SGC-5", "Versión": "2", "Fecha": "25/02/2026", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Acuerdo con proveedores de Servicios", "Código": "DOC-SGC-6", "Versión": "1", "Fecha": "10/03/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Normas de BPM y Seguridad Alimentaria para visitantes", "Código": "DOC-SGC-7", "Versión": "1", "Fecha": "26/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Política de la conservación de la Biodiversidad", "Código": "DOC-SGC-8", "Versión": "1", "Fecha": "01/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Política de Medioambiente", "Código": "DOC-SGC-9", "Versión": "1", "Fecha": "01/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Política de Reciclaje", "Código": "DOC-SGC-10", "Versión": "1", "Fecha": "01/08/2025", "Copia Controlada / Ubicación": "No"},
      {"Nombre de Documento": "Plan de Auditoria Interna", "Código": "PL-SGC-1", "Versión": "1", "Fecha": "13/01/2025", "Copia Controlada / Ubicación": "No"}
    ]
  }
]';

DECLARE @HeaderData NVARCHAR(MAX) = N'{"Fecha":"2025-01-09"}';
DECLARE @FirmasData NVARCHAR(MAX) = N'{}';
DECLARE @Now DATETIME2 = GETDATE();

INSERT INTO [dbo].[FilledForms]
  ([TemplateID], [HeaderData], [FirmasData], [Observaciones], [CreatedAt], [BodyData],
   [TemplateVersion], [UpdatedAt], [FilledBy], [FilledByEmail], [FilledByRole])
VALUES
  (@TemplateID, @HeaderData, @FirmasData, NULL, @Now, @BodyData,
   '1', @Now, 'admin', 'procesos@frigolab.com.ec', 'admin');

PRINT '✅ Formulario Lista Maestra Documental insertado correctamente. FormID: ' + CAST(SCOPE_IDENTITY() AS VARCHAR);
GO
