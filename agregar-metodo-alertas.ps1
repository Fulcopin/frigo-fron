$newMethod = @'

        /// <summary>
        /// Crea alertas en la tabla Alerts para cada firmante pendiente
        /// </summary>
        private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
        {
            try
            {
                if (string.IsNullOrEmpty(form.FirmasData))
                {
                    _logger.LogWarning("FirmasData vacío para formulario {FormId}, no se crearon alertas", form.FormID);
                    return;
                }

                // Parsear FirmasData
                var firmasDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData);
                if (firmasDict == null || firmasDict.Count == 0)
                {
                    _logger.LogWarning("No se pudieron parsear FirmasData para formulario {FormId}", form.FormID);
                    return;
                }

                var templateName = form.Template?.Nombre ?? "Formulario";
                var formCode = form.Template?.Codigo ?? "N/A";

                // Recorrer cada puesto de firma
                foreach (var kvp in firmasDict)
                {
                    string puesto = kvp.Key;
                    var firmaData = kvp.Value;

                    if (firmaData.ValueKind != JsonValueKind.Object)
                        continue;

                    // Extraer email del firmante
                    string? targetEmail = null;
                    if (firmaData.TryGetProperty("email", out var emailProp))
                    {
                        targetEmail = emailProp.GetString();
                    }

                    // Si no hay email, intentar extraer de nombre
                    if (string.IsNullOrEmpty(targetEmail) && firmaData.TryGetProperty("nombre", out var nombreProp))
                    {
                        var nombre = nombreProp.GetString();
                        if (!string.IsNullOrEmpty(nombre) && nombre.Contains("@"))
                        {
                            targetEmail = nombre; // Por si el email está en el campo nombre
                        }
                    }

                    // Si no hay email, no podemos crear alerta
                    if (string.IsNullOrEmpty(targetEmail))
                    {
                        _logger.LogWarning("No se pudo extraer email para puesto {Puesto} en formulario {FormId}", puesto, form.FormID);
                        continue;
                    }

                    // Verificar si ya firmó este puesto
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

                    // Si ya firmó, no crear alerta
                    if (yaFirmo)
                    {
                        _logger.LogInformation("Usuario {Email} (puesto: {Puesto}) ya firmó el formulario {FormId}, no se crea alerta", targetEmail, puesto, form.FormID);
                        continue;
                    }

                    // Verificar si ya existe una alerta pendiente para este usuario y formulario
                    var existingAlert = await _context.Set<Alert>()
                        .FirstOrDefaultAsync(a =>
                            a.FormId == form.FormID &&
                            a.TargetEmail == targetEmail &&
                            a.Type == "signature" &&
                            a.Status == "pending");

                    if (existingAlert != null)
                    {
                        _logger.LogInformation("Ya existe alerta pendiente para {Email} en formulario {FormId}", targetEmail, form.FormID);
                        continue;
                    }

                    // Crear nueva alerta
                    var alert = new Alert
                    {
                        Type = "signature",
                        Priority = "high",
                        Title = $"Firma requerida: {templateName}",
                        Message = $"El formulario {formCode} ({templateName}) requiere tu firma en el puesto: {puesto}. Por favor revisa y firma el formulario lo antes posible.",
                        TargetEmail = targetEmail,
                        FormId = form.FormID,
                        FormCode = formCode,
                        CreatedDate = DateTime.UtcNow,
                        IsRead = false,
                        Status = "pending"
                    };

                    _context.Set<Alert>().Add(alert);

                    _logger.LogInformation("✅ Alerta de firma creada para {Email} (puesto: {Puesto}) en formulario {FormId}", targetEmail, puesto, form.FormID);
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("Alertas de firma guardadas para formulario {FormId}", form.FormID);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear alertas de firma para formulario {FormId}", form.FormID);
                // No lanzar excepción, solo registrar el error para no bloquear el flujo principal
            }
        }
'@

# Leer archivo original
$originalFile = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs"
$lines = Get-Content $originalFile

# Encontrar la última llave de cierre
$lastBrace = -1
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    if ($lines[$i].Trim() -eq "}") {
        $lastBrace = $i
        break
    }
}

# Insertar nuevo método antes de la última llave
$newLines = @()
$newLines += $lines[0..($lastBrace-1)]
$newLines += $newMethod.Split("`n")
$newLines += $lines[$lastBrace..($lines.Count-1)]

# Guardar archivo modificado
$newLines | Set-Content $originalFile -Encoding UTF8

Write-Host "✅ Método CreateSignatureAlertsForPendingSigners agregado exitosamente" -ForegroundColor Green
Write-Host "📍 Ubicación: línea aproximada $lastBrace" -ForegroundColor Cyan
