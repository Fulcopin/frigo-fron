<#
    Copia las notas estaticas nuevas de una plantilla hacia sus versiones
    anteriores y hacia los registros ya guardados.

    Que hace:
      1. Respalda el DLL actual.
      2. Copia FormBuilder.API.dll y .pdb a la carpeta del sitio.
      3. Recicla el App Pool.
      4. Muestra que falta (solo lectura).
      5. Aplica el cambio y vuelve a verificar.

    Como usarlo (EN EL SERVIDOR, como Administrador):
      - Descomprimir actualizacion-backend.zip en una carpeta.
      - Copiar este script en esa misma carpeta.
      - Clic derecho > Ejecutar con PowerShell.
      - Si Windows lo bloquea:
          powershell -ExecutionPolicy Bypass -File .\APLICAR-NOTAS-CC07.ps1

    Solo mirar, sin cambiar nada:
      powershell -ExecutionPolicy Bypass -File .\APLICAR-NOTAS-CC07.ps1 -SoloVerificar
#>
param(
    [string]$Origen  = $PSScriptRoot,
    [string]$Destino = 'C:\inetpub\wwwroot\DeployFormularios',
    [string]$Api     = 'http://localhost:8096/api',
    [string]$Codigo  = 'FOR-CC-07',
    [switch]$SoloVerificar
)

$ErrorActionPreference = 'Stop'

function Titulo($texto) {
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor DarkGray
    Write-Host $texto -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor DarkGray
}

function Ok($texto)   { Write-Host ('  OK  ' + $texto) -ForegroundColor Green }
function Aviso($texto){ Write-Host ('  !   ' + $texto) -ForegroundColor Yellow }
function Error($texto){ Write-Host ('  X   ' + $texto) -ForegroundColor Red }

# ---------------------------------------------------------------- comprobaciones
$esAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    Error 'Hay que ejecutar PowerShell como Administrador.'
    exit 1
}

$dll = Join-Path $Origen 'FormBuilder.API.dll'
$pdb = Join-Path $Origen 'FormBuilder.API.pdb'
if (-not (Test-Path $dll)) { Error "No encuentro $dll"; exit 1 }
if (-not (Test-Path $Destino)) { Error "No existe la carpeta $Destino"; exit 1 }

Titulo "Notas en versiones anteriores - $Codigo"
Write-Host ("  Origen : $Origen")
Write-Host ("  Destino: $Destino")
Write-Host ("  API    : $Api")

# ---------------------------------------------------------------- 1. respaldo
Titulo '1. Respaldando el DLL actual'
$marca = Get-Date -Format 'yyyyMMdd-HHmmss'
$dllDestino = Join-Path $Destino 'FormBuilder.API.dll'
if (Test-Path $dllDestino) {
    $respaldo = Join-Path $Destino ("FormBuilder.API.dll.bak-" + $marca)
    Copy-Item $dllDestino $respaldo -Force
    Ok "Respaldo: $respaldo"
} else {
    Aviso 'No habia DLL en el destino (instalacion nueva).'
}

# ---------------------------------------------------------------- 2. copiar
Titulo '2. Copiando DLL y PDB'
Copy-Item $dll (Join-Path $Destino 'FormBuilder.API.dll') -Force
Ok 'FormBuilder.API.dll copiado'
if (Test-Path $pdb) {
    Copy-Item $pdb (Join-Path $Destino 'FormBuilder.API.pdb') -Force
    Ok 'FormBuilder.API.pdb copiado'
}
if (Test-Path (Join-Path $Origen 'appsettings.json')) {
    Aviso 'No se copia appsettings.json: se conserva el del servidor.'
}

# ---------------------------------------------------------------- 3. reciclar
Titulo '3. Reciclando el App Pool'
Import-Module WebAdministration -ErrorAction Stop
$ruta = $Destino.TrimEnd('\')
$sitio = Get-Website | Where-Object { $_.PhysicalPath -and ($_.PhysicalPath.TrimEnd('\') -ieq $ruta) } | Select-Object -First 1
if (-not $sitio) {
    $sitio = Get-Website | Where-Object { $_.PhysicalPath -and $_.PhysicalPath -like '*DeployFormularios*' } | Select-Object -First 1
}
if (-not $sitio) { Error 'No encontre el sitio en IIS.'; exit 1 }

Write-Host ("  Sitio: " + $sitio.Name + "  |  App Pool: " + $sitio.ApplicationPool)
Restart-WebAppPool -Name $sitio.ApplicationPool
Ok 'App Pool reciclado'

Write-Host '  Esperando que la API responda...'
$listo = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        Invoke-RestMethod -Uri ($Api + '/Images/diagnostico') -TimeoutSec 10 | Out-Null
        $listo = $true
        break
    } catch { }
}
if ($listo) { Ok 'La API esta arriba' } else { Aviso 'La API no respondio en 60 segundos; revisar en IIS.' }

# ---------------------------------------------------------------- 4. ver
Titulo '4. Que falta (solo lectura)'
$preview = $null
try {
    $preview = Invoke-RestMethod -Uri ($Api + '/Mantenimiento/notas-faltantes?codigo=' + $Codigo) -TimeoutSec 30
} catch {
    Error ('No se pudo consultar: ' + $_.Exception.Message)
    Error 'Si dice 404, el DLL no es el nuevo. Verificar la copia y reciclar el pool.'
    exit 1
}

Write-Host ("  Version actual : " + $preview.versionActual)
Write-Host ("  Notas          : " + @($preview.notas.$values).Count)
Write-Host '  Versiones:'
foreach ($v in $preview.versiones.$values) {
    $marcaActual = ''
    if ($v.esActual) { $marcaActual = '  (actual)' }
    Write-Host ("    v" + $v.version + $marcaActual + "  elementos=" + $v.elementos + "  faltan=" + $v.notasFaltantes)
}
$regs = $preview.registros
Write-Host ("  Registros: total=" + $regs.total + "  sinNotas=" + $regs.sinNotas)

if ($SoloVerificar) {
    Titulo 'Solo verificar: no se cambio nada'
    exit 0
}

if ($preview.registros.sinNotas -eq 0 -and -not (@($preview.versiones.$values) | Where-Object { $_.notasFaltantes -gt 0 })) {
    Ok 'Ya estaba todo aplicado. No hay nada que hacer.'
    exit 0
}

# ---------------------------------------------------------------- 5. aplicar
Titulo '5. Aplicar'
$respuesta = Read-Host '  Escribir SI para aplicar los cambios'
if ($respuesta -ne 'SI') {
    Aviso 'Cancelado. No se cambio nada.'
    exit 0
}

try {
    $r = Invoke-RestMethod -Method Post -Uri ($Api + '/Mantenimiento/copiar-notas-versiones?codigo=' + $Codigo) -TimeoutSec 180
    Ok 'Aplicado'
    Write-Host ("  Versiones modificadas : " + $r.versionesCambiadas + "  (notas agregadas: " + $r.notasEnVersiones + ")")
    Write-Host ("  Registros modificados : " + $r.registrosCambiados + "  (notas agregadas: " + $r.notasEnRegistros + ")")
} catch {
    Error ('Fallo al aplicar: ' + $_.Exception.Message)
    exit 1
}

# ---------------------------------------------------------------- 6. verificar
Titulo '6. Verificacion final'
$final = Invoke-RestMethod -Uri ($Api + '/Mantenimiento/notas-faltantes?codigo=' + $Codigo) -TimeoutSec 30
$quedan = $final.registros.sinNotas
$versionesPendientes = @($final.versiones.$values) | Where-Object { $_.notasFaltantes -gt 0 }
if ($quedan -eq 0 -and -not $versionesPendientes) {
    Ok 'Todo aplicado: versiones y registros tienen las notas.'
} else {
    Aviso ("Todavia faltan: registros=" + $quedan + ", versiones=" + @($versionesPendientes).Count)
}

Titulo 'Listo'
Write-Host '  Abrir un formulario viejo, imprimirlo y comprobar que salen las notas.'
Write-Host '  Para volver atras: restaurar el archivo .bak del DLL y reciclar el App Pool.'
Write-Host ''
