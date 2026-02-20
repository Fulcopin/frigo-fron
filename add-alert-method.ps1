# Script para agregar método de alertas al SignaturesController
$originalFile = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs"
$tempFile = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController_TEMP.cs"

# Leer contenido original
$content = Get-Content $originalFile -Raw

# Método a agregar (antes del último cierre de clase)
$newMethod = @"

        /// <summary>
        /// Crea alertas en la tabla Alerts para cada firmante pendiente
        /// </summary>
        private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
        {
            try
            {
                if (string.IsNullOrEmpty(form.FirmasData))
                {
                    _logger.LogWarning("FirmasData vacio para formulario {FormId}", form.FormID);
                    return;
                }

                var firmasDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData);
                if (firmasDict == null || firmasDict.Count == 0)
                {
                    return;
                }

                var templateName = form.Template?.Nombre ?? "Formulario";
                var formCode = form.Template?.Codigo ?? "N/A";

                foreach (var kvp in firmasDict)
                {
                    string puesto = kvp.Key;
                    var firmaData = kvp.Value;

                    if (firmaData.ValueKind != JsonValueKind.Object)
                        continue;

                    string? targetEmail = null;
                    if (firmaData.TryGetProperty("email", out var emailProp))
                    {
                        targetEmail = emailProp.GetString();
                    }

                    if (string.IsNullOrEmpty(targetEmail) && firmaData.TryGetProperty("nombre", out var nombreProp))
                    {
                        var nombre = nombreProp.GetString();
                        if (!string.IsNullOrEmpty(nombre) && nombre.Contains("@"))
                        {
                            targetEmail = nombre;
                        }
                    }

                    if (string.IsNullOrEmpty(targetEmail))
                    {
                        continue;
                    }

                    bool yaFirmo = false;
                    if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
                    {
                        if (firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString()))
                        {
                            yaFirmo = true;
                        }
                        else if (firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString()))
                        {
                            yaFirmo = true;
                        }
                    }

                    if (yaFirmo)
                    {
                        continue;
                    }

                    var existingAlert = await _context.Set<Alert>()
                        .FirstOrDefaultAsync(a =>
                            a.FormId == form.FormID &&
                            a.TargetEmail == targetEmail &&
                            a.Type == "signature" &&
                            a.Status == "pending");

                    if (existingAlert != null)
                    {
                        continue;
                    }

                    var alert = new Alert
                    {
                        Type = "signature",
                        Priority = "high",
                        Title = "Firma requerida: " + templateName,
                        Message = "El formulario " + formCode + " (" + templateName + ") requiere tu firma en el puesto: " + puesto + ". Por favor revisa y firma el formulario lo antes posible.",
                        TargetEmail = targetEmail,
                        FormId = form.FormID,
                        FormCode = formCode,
                        CreatedDate = DateTime.UtcNow,
                        IsRead = false,
                        Status = "pending"
                    };

                    _context.Set<Alert>().Add(alert);
                    _logger.LogInformation("Alerta creada para {Email} en formulario {FormId}", targetEmail, form.FormID);
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear alertas para formulario {FormId}", form.FormID);
            }
        }
"@

# Buscar el último cierre de clase (antes del último })
$lastCloseBrace = $content.LastIndexOf("    }")

if ($lastCloseBrace -gt 0)
{
    # Insertar nuevo método antes del último cierre
    $newContent = $content.Substring(0, $lastCloseBrace) + $newMethod + "`n" + $content.Substring($lastCloseBrace)
    
    # Guardar a archivo temporal primero
    $newContent | Set-Content $tempFile -Encoding UTF8 -NoNewline
    
    # Copiar temporal al original
    Copy-Item $tempFile $originalFile -Force
    Remove-Item $tempFile
    
    Write-Host "Metodo agregado exitosamente"
}
else
{
    Write-Host "No se pudo encontrar el cierre de clase"
}
