param(
  [switch]$KeepStack,
  [switch]$Headed
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$qaRoot = Join-Path $repo "tmp/security-e2e"
$envFile = Join-Path $qaRoot "e2e.env"
$serverOut = Join-Path $qaRoot "sso-server.out.log"
$serverErr = Join-Path $qaRoot "sso-server.err.log"
$project = "soc-security-e2e"

$hostIp = $env:SECURITY_E2E_HOST_IP
if (-not $hostIp) {
  $hostIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "100.*" } |
    Sort-Object @{ Expression = { if ($_.IPAddress -like "192.168.*") { 0 } else { 1 } } }, InterfaceIndex |
    Select-Object -First 1 -ExpandProperty IPAddress
}
if (-not $hostIp) { throw "Could not determine a private host IPv4 address; set SECURITY_E2E_HOST_IP explicitly." }

New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
$template = Get-Content (Join-Path $PSScriptRoot "e2e.env.example") -Raw
$template.Replace("__HOST_IP__", $hostIp) | Set-Content -LiteralPath $envFile -Encoding utf8

$env:SECURITY_E2E_ENV_FILE = $envFile
$env:LOCAL_QA_ENV_FILE = $envFile
$env:SECURITY_E2E_APP_URL = "http://${hostIp}:28765"
$env:LOCAL_QA_BIND = $hostIp
$env:LOCAL_QA_PORT = "28765"
$env:LOCAL_QA_UPSTREAM = "http://127.0.0.1:28080"
$env:SSO_CLIENT_ID = "soc-security-e2e"
$env:SSO_CLIENT_SECRET = "security-e2e-client-secret"
$env:NODE_ENV = "development"

$server = $null
try {
  docker compose --project-name $project --env-file $envFile --file (Join-Path $PSScriptRoot "compose.yml") up -d --build
  $serverEnvironment = @{
    LOCAL_QA_ENV_FILE = $envFile
    NODE_ENV = "development"
    SSO_CLIENT_ID = "soc-security-e2e"
    SSO_CLIENT_SECRET = "security-e2e-client-secret"
    LOCAL_QA_BIND = $hostIp
    LOCAL_QA_PORT = "28765"
    LOCAL_QA_UPSTREAM = "http://127.0.0.1:28080"
    LOCAL_QA_CALLBACK_URL = "/api/auth/login"
  }
  # Windows PowerShell 5.1 does not support Start-Process -Environment. Set
  # the process environment only while starting the child so the fixture gets
  # the same isolated configuration on both PowerShell generations.
  $previousServerEnvironment = @{}
  foreach ($name in $serverEnvironment.Keys) {
    $previousServerEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    [Environment]::SetEnvironmentVariable($name, [string]$serverEnvironment[$name], "Process")
  }
  try {
    $server = Start-Process -FilePath "python" -ArgumentList "tools/mobile_qa/sso_server.py" -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru
  } finally {
    foreach ($name in $serverEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable($name, $previousServerEnvironment[$name], "Process")
    }
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://${hostIp}:28765/__local-sso/health" -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Synthetic SSO server did not become ready." }

  $appReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://${hostIp}:28765/" -TimeoutSec 2
      if ($response.StatusCode -eq 200 -and $response.Content -match 'id="root"') {
        $appReady = $true
        break
      }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $appReady) { throw "Browser E2E application did not become ready." }

  $loginStartReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://${hostIp}:28765/api/auth/login/start" -TimeoutSec 2
      if ($response.StatusCode -eq 200 -and $response.Content -match 'loginUrl') {
        $loginStartReady = $true
        break
      }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $loginStartReady) { throw "Browser E2E login start endpoint did not become ready." }

  python tools/mobile_qa/smoke_test.py
  if ($LASTEXITCODE -ne 0) { throw "Synthetic SSO smoke test failed with exit code $LASTEXITCODE." }
  # The protocol smoke fixture and the browser flow are independent checks.
  # Reset only the disposable Redis instance between them so the browser's
  # normal auth budget is not consumed by fixture setup requests.
  docker compose --project-name $project --env-file $envFile --file (Join-Path $PSScriptRoot "compose.yml") exec -T redis redis-cli FLUSHDB | Out-Null
  $args = @("tools/security_qa/browser_security_e2e.py", "--scenario", "temporary")
  if ($Headed) { $args += "--headed" }
  python @args
  if ($LASTEXITCODE -ne 0) { throw "Browser security E2E failed with exit code $LASTEXITCODE." }
  # Keep the temporary and persisted account-switch checks independent of the
  # fixed per-IP auth budget while retaining the same-tab A→logout→B flow in
  # each browser context.
  docker compose --project-name $project --env-file $envFile --file (Join-Path $PSScriptRoot "compose.yml") exec -T redis redis-cli FLUSHDB | Out-Null
  $args = @("tools/security_qa/browser_security_e2e.py", "--scenario", "persisted")
  if ($Headed) { $args += "--headed" }
  python @args
  if ($LASTEXITCODE -ne 0) { throw "Browser security E2E failed with exit code $LASTEXITCODE." }
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
  if (-not $KeepStack) {
    docker compose --project-name $project --env-file $envFile --file (Join-Path $PSScriptRoot "compose.yml") down --volumes --remove-orphans
  }
  Remove-Item -LiteralPath $envFile -Force -ErrorAction SilentlyContinue
}
