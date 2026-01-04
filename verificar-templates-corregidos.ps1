# Script para verificar templates actualizados
# Ejecutar después de actualizar los templates en Postman

$baseUrl = "http://localhost:5189/api/templates"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🔍 VERIFICADOR DE TEMPLATES ACTUALIZADOS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Templates a verificar
$templates = @(10, 9)

foreach ($templateId in $templates) {
    Write-Host "📋 Verificando Template $templateId..." -ForegroundColor Yellow
    Write-Host "------------------------------------------" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/$templateId" -Method GET -ContentType "application/json"
        
        Write-Host "  ✅ Template encontrado: $($response.nombre)" -ForegroundColor Green
        Write-Host "  📌 Código: $($response.codigo)" -ForegroundColor White
        
        # Parsear BodyElements
        $bodyElements = $null
        if ($response.structureJSON) {
            try {
                $bodyElements = $response.structureJSON | ConvertFrom-Json
            } catch {
                $bodyElements = $response.bodyElements | ConvertFrom-Json
            }
        } elseif ($response.bodyElements) {
            if ($response.bodyElements -is [string]) {
                $bodyElements = $response.bodyElements | ConvertFrom-Json
            } else {
                $bodyElements = $response.bodyElements
            }
        }
        
        if ($bodyElements) {
            Write-Host "  🔍 Analizando columnas..." -ForegroundColor Cyan
            
            $allColumnNames = @()
            $allColumnIds = @()
            $columnCount = 0
            
            foreach ($element in $bodyElements) {
                if ($element.type -eq "table") {
                    Write-Host "    📊 Tabla: $($element.title)" -ForegroundColor White
                    
                    foreach ($column in $element.columns) {
                        $columnCount++
                        
                        $columnId = $column.id
                        $columnName = $column.name
                        $columnLabel = $column.label
                        
                        # Verificar que tenga ID
                        if (-not $columnId) {
                            Write-Host "      ⚠️  Columna sin ID: $columnLabel" -ForegroundColor Red
                        } else {
                            $allColumnIds += $columnId
                        }
                        
                        # Verificar que tenga name
                        if (-not $columnName) {
                            Write-Host "      ⚠️  Columna sin name: $columnLabel" -ForegroundColor Red
                        } else {
                            $allColumnNames += $columnName
                            Write-Host "      ✓ $columnLabel → name: '$columnName'" -ForegroundColor Green
                        }
                    }
                }
            }
            
            # Verificar duplicados en IDs
            Write-Host ""
            Write-Host "  🔎 Verificando IDs únicos..." -ForegroundColor Cyan
            $duplicateIds = $allColumnIds | Group-Object | Where-Object { $_.Count -gt 1 }
            
            if ($duplicateIds) {
                Write-Host "    ❌ IDs DUPLICADOS ENCONTRADOS:" -ForegroundColor Red
                foreach ($dup in $duplicateIds) {
                    Write-Host "      • '$($dup.Name)' aparece $($dup.Count) veces" -ForegroundColor Red
                }
            } else {
                Write-Host "    ✅ Todos los IDs son únicos" -ForegroundColor Green
            }
            
            # Verificar duplicados en names
            Write-Host ""
            Write-Host "  🔎 Verificando names únicos..." -ForegroundColor Cyan
            $duplicateNames = $allColumnNames | Group-Object | Where-Object { $_.Count -gt 1 }
            
            if ($duplicateNames) {
                Write-Host "    ❌ NAMES DUPLICADOS ENCONTRADOS:" -ForegroundColor Red
                foreach ($dup in $duplicateNames) {
                    Write-Host "      • '$($dup.Name)' aparece $($dup.Count) veces" -ForegroundColor Red
                }
            } else {
                Write-Host "    ✅ Todos los names son únicos" -ForegroundColor Green
            }
            
            Write-Host ""
            Write-Host "  📊 Total de columnas analizadas: $columnCount" -ForegroundColor Cyan
            
        } else {
            Write-Host "  ⚠️  No se pudieron parsear los bodyElements" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "  ❌ Error al obtener template: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "✅ Verificación completada" -ForegroundColor Green
Write-Host ""
Write-Host "💡 TIPS:" -ForegroundColor Yellow
Write-Host "  • Si ves IDs o names duplicados, actualiza el template en Postman" -ForegroundColor White
Write-Host "  • Usa los archivos TEMPLATE_X_CORREGIDO_FINAL.json" -ForegroundColor White
Write-Host "  • Recarga el frontend (F5) después de actualizar" -ForegroundColor White
Write-Host ""
