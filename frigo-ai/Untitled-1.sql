SELECT 'Templates' AS Tabla, COUNT(*) AS Cantidad_De_Registros FROM "Templates"
UNION ALL
SELECT 'FilledForms', COUNT(*) FROM "FilledForms"
UNION ALL
SELECT 'CatalogoFirmas', COUNT(*) FROM "CatalogoFirmas"
UNION ALL
SELECT 'FormDrafts', COUNT(*) FROM "FormDrafts"
UNION ALL
SELECT 'Alerts', COUNT(*) FROM "Alerts";