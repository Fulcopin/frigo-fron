-- Script para obtener el JSON del Template 10
-- "CONTROL DE PRODUCTOS CONGELADOS (LIBERACIÓN DE TÚNELES)"

-- Ver información básica del template
SELECT 
    TemplateID,
    Nombre,
    IsMasterForm,
    FechaCreacion
FROM Templates
WHERE TemplateID = 10;

-- Ver el JSON completo de la estructura
SELECT 
    TemplateID,
    Nombre,
    StructureJSON,
    IsMasterForm
FROM Templates
WHERE TemplateID = 10;

-- Si quieres un formato más legible, usa esto en JSON:
SELECT 
    TemplateID as 'templateID',
    Nombre as 'nombre',
    JSON_QUERY(StructureJSON, '$.headerData') as 'headerData',
    JSON_QUERY(StructureJSON, '$.bodyElements') as 'bodyElements',
    IsMasterForm as 'isMasterForm'
FROM Templates
WHERE TemplateID = 10
FOR JSON PATH;
