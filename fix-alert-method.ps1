# Script para corregir el método CreateSignatureAlertsForPendingSigners
$filePath = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs"

# Leer contenido
$content = Get-Content $filePath -Raw

# Buscar y reemplazar el método completo
$oldMethodPattern = '(?s)private async Task CreateSignatureAlertsForPendingSigners\(FilledForm form, string justSignedBy\)\s*\{.*?(?=\n\s{8}(?:private|public|protected|\}))'

$newMethod = @"
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
                    _logger.LogWarning("No se pudo parsear FirmasData del formulario {FormId}", form.FormID);
                    return;
                }

                var templateName = form.Template?.Nombre ?? "Formulario";
                var formCode = form.Template?.Codigo ?? "N/A";

                _logger.LogInformation("📋 Procesando alertas para formulario {FormId} ({FormCode}). Total puestos: {Count}", form.FormID, formCode, firmasDict.Count);

                foreach (var kvp in firmasDict)
                {
                    string puesto = kvp.Key;
                    var firmaData = kvp.Value;

                    if (firmaData.ValueKind != JsonValueKind.Object)
                    {
                        _logger.LogWarning("  ⚠️ Puesto {Puesto} no es un objeto JSON válido", puesto);
                        continue;
                    }

                    // Extraer email del firmante asignado
                    string? targetEmail = null;
                    if (firmaData.TryGetProperty("email", out var emailProp))
                    {
                        targetEmail = emailProp.GetString();
                    }

                    // Fallback: buscar en nombre si contiene @
                    if (string.IsNullOrEmpty(targetEmail) && firmaData.TryGetProperty("nombre", out var nombreProp))
                    {
                        var nombre = nombreProp.GetString();
                        if (!string.IsNullOrEmpty(nombre) && nombre.Contains("@"))
                        {
                            targetEmail = nombre;
                        }
                    }

                    // Si no hay email, saltar este puesto
                    if (string.IsNullOrEmpty(targetEmail))
                    {
                        _logger.LogWarning("  ⚠️ Puesto {Puesto}: No se encontró email, saltando", puesto);
                        continue;
                    }

                    _logger.LogInformation("  🔍 Puesto {Puesto}: Email asignado = {Email}", puesto, targetEmail);

                    // Verificar si este puesto ya tiene firma digital
                    bool yaFirmo = false;
                    if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
                    {
                        bool tieneUrl = firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString());
                        bool tieneBase64 = firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString());
                        yaFirmo = tieneUrl || tieneBase64;

                        if (yaFirmo)
                        {
                            _logger.LogInformation("  ✅ Puesto {Puesto} ({Email}): YA FIRMÓ (tiene imagen de firma)", puesto, targetEmail);
                        }
                    }

                    // Si ya firmó, NO crear alerta
                    if (yaFirmo)
                    {
                        continue;
                    }

                    _logger.LogInformation("  ⏳ Puesto {Puesto} ({Email}): Pendiente de firma", puesto, targetEmail);

                    // Verificar si ya existe una alerta pendiente para este usuario y formulario
                    var existingAlert = await _context.Set<Alert>()
                        .FirstOrDefaultAsync(a =>
                            a.FormId == form.FormID &&
                            a.TargetEmail == targetEmail &&
                            a.Type == "signature" &&
                            a.Status == "pending");

                    if (existingAlert != null)
                    {
                        _logger.LogInformation("  ℹ️ Ya existe alerta pendiente para {Email} en formulario {FormId}", targetEmail, form.FormID);
                        continue;
                    }

                    // Crear nueva alerta para este usuario específico
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
                    _logger.LogInformation("  ✅ ALERTA CREADA para {Email} en puesto {Puesto}", targetEmail, puesto);
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("📨 Alertas guardadas para formulario {FormId}", form.FormID);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al crear alertas para formulario {FormId}", form.FormID);
            }
        }
"@

if ($content -match $oldMethodPattern)
{
    $content = $content -replace $oldMethodPattern, $newMethod
    $content | Set-Content $filePath -Encoding UTF8 -NoNewline
    Write-Host "✅ Método actualizado exitosamente" -ForegroundColor Green
}
else
{
    Write-Host "❌ No se pudo encontrar el método para reemplazar" -ForegroundColor Red
}
