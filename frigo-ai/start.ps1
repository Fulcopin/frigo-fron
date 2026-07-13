param(
  [ValidateSet("bot","api","both","mcp","webhook")]
  [string]$Mode = "both",
  [ValidateSet("stdio","sse")]
  [string]$McpTransport = "stdio",
  [switch]$NoInstall,
  [switch]$CleanPort4000
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force

$root = $PSScriptRoot
Set-Location $root

Write-Host "`n=== frigo-ai startup ===" -ForegroundColor Cyan

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "No existe $Path. Crea tu .env (puedes copiar .env.example)."
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }

    # key=value (permite espacios). Quita comillas simples/dobles si existen.
    if ($line -match '^\s*([^=]+?)\s*=\s*(.*)\s*$') {
      $k = $Matches[1].Trim()
      $v = $Matches[2].Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
  }
}

Load-DotEnv "$root\.env"
$env:PYTHONUTF8 = "1"

if ($CleanPort4000) {
  $prev = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
  if ($prev) {
    Write-Host "Limpiando proceso en puerto 4000 (LiteLLM u otro)..." -ForegroundColor Yellow
    Stop-Process -Id $prev.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

# --- Python / venv ---
$py = Join-Path $root "venv\Scripts\python.exe"
$pip = Join-Path $root "venv\Scripts\pip.exe"
$activate = Join-Path $root "venv\Scripts\Activate.ps1"

if (-not (Test-Path $py)) {
  Write-Host "Creando virtualenv (venv)..." -ForegroundColor Yellow
  python -m venv (Join-Path $root "venv")
}

if (-not $NoInstall) {
  Write-Host "Instalando dependencias (requirements.txt)..." -ForegroundColor Yellow
  & $py -m pip install --upgrade pip | Out-Host
  & $pip install -r (Join-Path $root "requirements.txt") | Out-Host
} else {
  Write-Host "Saltando instalación de dependencias (-NoInstall)." -ForegroundColor DarkGray
}

function Assert-Env([string[]]$Keys, [string]$Context) {
  $missing = @()
  foreach ($k in $Keys) {
    if (-not [System.Environment]::GetEnvironmentVariable($k, "Process")) { $missing += $k }
  }
  if ($missing.Count -gt 0) {
    throw "Faltan variables en .env para ${Context}: $($missing -join ', ')"
  }
}

if ($Mode -eq "bot" -or $Mode -eq "both") {
  Assert-Env @("TELEGRAM_BOT_TOKEN") "Telegram bot"
}

if ($Mode -eq "webhook") {
  Assert-Env @("TELEGRAM_BOT_TOKEN","WEBHOOK_URL","WEBHOOK_SECRET") "modo webhook"
}

if ($Mode -eq "api" -or $Mode -eq "both") {
  # Para levantar server.py se requiere el agente, y el agente necesita SQL_* ahora.
  Assert-Env @("SQL_SERVER","SQL_DATABASE","SQL_USER","SQL_PASSWORD") "API/Agente (SQL Server)"
}

if ($Mode -eq "mcp") {
  Assert-Env @("SQL_SERVER","SQL_DATABASE","SQL_USER","SQL_PASSWORD") "MCP server (SQL Server)"
}

$mcpPort = [int](($env:MCP_SSE_URL -replace ".*:(\d+).*", '$1') -replace "http://localhost:", "8001")
if (-not $mcpPort) { $mcpPort = 8001 }

function Start-McpServer {
  param([string]$Transport = "sse", [int]$Port = 8001)
  # Verificar si ya hay algo escuchando en el puerto
  $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "  MCP server: ya hay un proceso en el puerto $Port (reutilizando)." -ForegroundColor DarkGray
    return
  }
  Write-Host "  Iniciando MCP server en SSE modo (puerto $Port)..." -ForegroundColor DarkCyan
  $mcpCmd = "Set-Location '$root'; & '$activate'; & '$py' '$root\mcp_server.py' --transport $Transport --port $Port"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $mcpCmd -WindowStyle Minimized | Out-Null
  # Esperar a que el servidor levante (max 8 seg)
  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conn) {
      Write-Host "  MCP server listo en http://localhost:$Port/sse" -ForegroundColor Green
      [System.Environment]::SetEnvironmentVariable("MCP_SSE_URL", "http://localhost:$Port/sse", "Process")
      return
    }
  }
  Write-Host "  MCP server no respondio en 8s (el bot usara fallback stdio)." -ForegroundColor Yellow
}

switch ($Mode) {
  "bot" {
    Write-Host "Iniciando MCP server + Telegram bot..." -ForegroundColor Yellow
    Start-McpServer -Transport sse -Port $mcpPort
    & $py (Join-Path $root "telegram_bot.py")
  }
  "api" {
    Write-Host "Iniciando FastAPI server en http://localhost:8100 ..." -ForegroundColor Yellow
    Write-Host "  API:  http://localhost:8100" -ForegroundColor White
    Write-Host "  Docs: http://localhost:8100/docs`n" -ForegroundColor White
    & $py (Join-Path $root "server.py")
  }
  "mcp" {
    Write-Host "Iniciando MCP server (transport=$McpTransport)..." -ForegroundColor Yellow
    & $py (Join-Path $root "mcp_server.py") --transport $McpTransport
  }
  "both" {
    Write-Host "[1/3] Iniciando MCP server (ventana minimizada)..." -ForegroundColor Yellow
    Start-McpServer -Transport sse -Port $mcpPort

    Write-Host "[2/3] Iniciando Telegram bot (nueva ventana)..." -ForegroundColor Yellow
    $botCmd = "Set-Location '$root'; & '$activate'; & '$py' '$root\telegram_bot.py'; pause"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "       Telegram bot iniciado." -ForegroundColor Green

    Write-Host "[3/3] Iniciando FastAPI server en http://localhost:8100 ..." -ForegroundColor Yellow
    Write-Host "  API:  http://localhost:8100" -ForegroundColor White
    Write-Host "  Docs: http://localhost:8100/docs`n" -ForegroundColor White
    & $py (Join-Path $root "server.py")
  }
  "webhook" {
    # Modo Container Apps: uvicorn + PTB webhook.
    # WEBHOOK_URL debe apuntar a una URL publica accesible desde Internet
    # (en produccion: tu Azure Container App URL).
    # Para pruebas locales usa ngrok: https://ngrok.com/download
    #   ngrok http 8000   -> copia la URL https://xxxx.ngrok-free.app
    #   luego: $env:WEBHOOK_URL = "https://xxxx.ngrok-free.app"
    Start-McpServer -Transport sse -Port $mcpPort
    $uvicorn = Join-Path $root "venv\Scripts\uvicorn.exe"
    Write-Host "Iniciando servidor webhook (uvicorn) en http://0.0.0.0:8000 ..." -ForegroundColor Yellow
    Write-Host "  Health: http://localhost:8000/health" -ForegroundColor White
    Write-Host "  Docs:   http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  Webhook URL configurada: $($env:WEBHOOK_URL)" -ForegroundColor Cyan
    Write-Host ""
    & $uvicorn "server:app" --host "0.0.0.0" --port 8000 --workers 1
  }
}
