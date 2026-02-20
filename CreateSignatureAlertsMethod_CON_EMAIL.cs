/// <summary>
/// Crea alertas Y ENVÍA EMAILS para los usuarios específicos asignados en cada puesto que aún no han firmado
/// </summary>
private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
{
    try
    {
        if (string.IsNullOrEmpty(form.FirmasData))
        {
            _logger.LogWarning("FirmasData vacío para formulario {FormId}", form.FormID);
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

        _logger.LogInformation("📋 Procesando alertas y emails para formulario {FormId} ({FormCode}). Total puestos: {Count}", form.FormID, formCode, firmasDict.Count);

        foreach (var kvp in firmasDict)
        {
            string puesto = kvp.Key;
            var firmaData = kvp.Value;

            if (firmaData.ValueKind != JsonValueKind.Object)
            {
                _logger.LogWarning("  ⚠️ Puesto {Puesto} no es un objeto JSON válido", puesto);
                continue;
            }

            // Extraer email Y NOMBRE del usuario ASIGNADO a este puesto específico
            string? targetEmail = null;
            string? targetName = null;
            
            if (firmaData.TryGetProperty("email", out var emailProp))
            {
                targetEmail = emailProp.GetString();
            }

            if (firmaData.TryGetProperty("nombre", out var nombreProp))
            {
                targetName = nombreProp.GetString();
            }

            // Fallback: buscar en nombre si contiene @
            if (string.IsNullOrEmpty(targetEmail) && !string.IsNullOrEmpty(targetName) && targetName.Contains("@"))
            {
                targetEmail = targetName;
            }

            // Si no hay email asignado, saltar este puesto
            if (string.IsNullOrEmpty(targetEmail))
            {
                _logger.LogWarning("  ⚠️ Puesto {Puesto}: No se encontró email asignado, saltando", puesto);
                continue;
            }

            _logger.LogInformation("  🔍 Puesto {Puesto}: Usuario asignado = {Name} ({Email})", puesto, targetName ?? "Sin nombre", targetEmail);

            // Verificar si este puesto ya tiene firma digital (imagen)
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

            // Si ya firmó este puesto, NO crear alerta ni enviar email
            if (yaFirmo)
            {
                continue;
            }

            _logger.LogInformation("  ⏳ Puesto {Puesto} ({Email}): Pendiente de firma", puesto, targetEmail);

            // Verificar si ya existe una alerta pendiente (evitar duplicados)
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

            // ✅ CREAR ALERTA EN BASE DE DATOS
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
            _logger.LogInformation("  ✅ ALERTA CREADA para {Email} en puesto {Puesto}", targetEmail, puesto);

            // 📧 ENVIAR EMAIL DE NOTIFICACIÓN
            try
            {
                var emailSubject = $"✍️ Firma Requerida - {templateName}";
                var emailBody = $@"
                    <html>
                    <head>
                        <style>
                            body {{ margin: 0; padding: 0; font-family: Arial, sans-serif; }}
                            .container {{ max-width: 600px; margin: 0 auto; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                        padding: 30px; 
                                        border-radius: 10px; 
                                        color: white; 
                                        margin-bottom: 20px;'>
                                <h1 style='margin: 0;'>✍️ Firma Requerida</h1>
                                <p style='margin: 10px 0 0 0; font-size: 18px;'>Sistema de Gestión Frigolab</p>
                            </div>
                            
                            <div style='background: #f8f9fa; 
                                        padding: 20px; 
                                        border-radius: 10px; 
                                        margin-bottom: 20px;'>
                                <h2 style='color: #333; margin-top: 0;'>Hola {targetName ?? "Usuario"},</h2>
                                <p style='color: #555; font-size: 16px; line-height: 1.6;'>
                                    Se requiere tu firma digital en el siguiente formulario:
                                </p>
                                
                                <table style='width: 100%; 
                                            margin: 20px 0; 
                                            background: white; 
                                            border-radius: 8px; 
                                            overflow: hidden;
                                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>
                                    <tr style='background: #667eea; color: white;'>
                                        <td style='padding: 12px; font-weight: bold; width: 40%;'>Formulario</td>
                                        <td style='padding: 12px;'>{templateName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 12px; 
                                                   border-bottom: 1px solid #ddd; 
                                                   font-weight: bold;'>Código</td>
                                        <td style='padding: 12px; 
                                                   border-bottom: 1px solid #ddd;'>{formCode}</td>
                                    </tr>
                                    <tr style='background: #f8f9fa;'>
                                        <td style='padding: 12px; 
                                                   border-bottom: 1px solid #ddd; 
                                                   font-weight: bold;'>Tu puesto</td>
                                        <td style='padding: 12px; 
                                                   border-bottom: 1px solid #ddd;'>{puesto}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 12px; font-weight: bold;'>Fecha de solicitud</td>
                                        <td style='padding: 12px;'>{DateTime.Now:dd/MM/yyyy HH:mm}</td>
                                    </tr>
                                </table>
                                
                                <div style='margin: 30px 0; text-align: center;'>
                                    <a href='http://localhost:5173/signatures' 
                                       style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                              color: white; 
                                              padding: 15px 40px; 
                                              text-decoration: none; 
                                              border-radius: 8px; 
                                              font-size: 16px; 
                                              font-weight: bold;
                                              display: inline-block;
                                              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);'>
                                        ✍️ Ir a Firmar Ahora
                                    </a>
                                </div>
                                
                                <p style='color: #777; font-size: 14px; margin-top: 20px;'>
                                    <strong>Nota:</strong> Por favor firma este formulario lo antes posible para 
                                    completar el proceso de aprobación.
                                </p>
                            </div>
                            
                            <div style='color: #999; 
                                        font-size: 12px; 
                                        text-align: center; 
                                        margin-top: 30px; 
                                        padding: 20px;
                                        border-top: 1px solid #ddd;'>
                                <p style='margin: 5px 0;'>Este es un mensaje automático del Sistema de Gestión Frigolab.</p>
                                <p style='margin: 5px 0;'>Por favor no responder a este correo.</p>
                                <p style='margin: 5px 0; color: #bbb;'>© 2026 Frigolab - Todos los derechos reservados</p>
                            </div>
                        </div>
                    </body>
                    </html>
                ";

                // Enviar email usando el servicio inyectado
                await _emailService.SendAlertEmailAsync(targetEmail, emailSubject, emailBody);
                _logger.LogInformation("  📧 EMAIL ENVIADO a {Email} ({Name})", targetEmail, targetName ?? "Sin nombre");
            }
            catch (Exception emailEx)
            {
                _logger.LogError(emailEx, "  ❌ Error al enviar email a {Email}", targetEmail);
                // No lanzar excepción para no bloquear el flujo principal
                // El usuario aún recibirá la alerta en la aplicación
            }
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("📨 Alertas guardadas y emails enviados para formulario {FormId}", form.FormID);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "❌ Error al crear alertas y enviar emails para formulario {FormId}", form.FormID);
        // No lanzar excepción para no bloquear el flujo principal de firma
    }
}
