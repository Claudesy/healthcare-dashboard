param(
  [int]$Year = (Get-Date).Year,
  [int]$Month = (Get-Date).Month,
  [string]$Mode = "full-cycle",
  [string]$ExportFile = "",
  [string]$BaseUrl = "http://localhost:7000",
  [string]$ApiToken = $env:CREW_ACCESS_API_TOKEN,
  [string]$Username = "",
  [string]$Password = "",
  [switch]$AutoDetectBaseUrl = $true,
  [switch]$AutoStartServer = $true
)

$ErrorActionPreference = "Stop"

$body = @{
  mode  = $Mode
  year  = $Year
  month = $Month
}

if ($Mode -eq "pipeline" -and $ExportFile) {
  $body.exportFile = $ExportFile
}

$json = $body | ConvertTo-Json -Depth 4

$hasLoginCreds = ($Username -and $Username.Trim().Length -gt 0 -and $Password -and $Password.Length -gt 0)
$hasApiToken = ($ApiToken -and $ApiToken.Trim().Length -gt 0)

if (-not $hasApiToken -and -not $hasLoginCreds) {
  throw "Unauthorized guard: isi -ApiToken atau kombinasi -Username dan -Password."
}

function Test-EndpointReachable {
  param([string]$Url)
  try {
    $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4
    return $true
  } catch {
    if ($_.Exception.Response) {
      # Response non-200 (misal 401) tetap berarti endpoint reachable.
      return $true
    }
    return $false
  }
}

function Get-ReachableBases {
  param([System.Collections.Generic.List[string]]$Candidates)
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($base in $Candidates) {
    $sessionUri = "$($base.TrimEnd('/'))/api/auth/session"
    if (Test-EndpointReachable -Url $sessionUri) {
      $result.Add($base.TrimEnd('/'))
    }
  }
  return $result
}

function Wait-ForReachableBases {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [int]$TimeoutSeconds = 45,
    [int]$IntervalSeconds = 3
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $reachable = Get-ReachableBases -Candidates $Candidates
    if ($reachable.Count -gt 0) {
      return $reachable
    }
    Start-Sleep -Seconds $IntervalSeconds
  }

  return (New-Object System.Collections.Generic.List[string])
}

function Start-DashboardDevServer {
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $lockPath = Join-Path $projectRoot ".next\\dev\\lock"
  if (Test-Path $lockPath) {
    $rawLock = (Get-Content -Path $lockPath -ErrorAction SilentlyContinue | Select-Object -First 1)
    $lockPid = 0
    $parsedLockPid = [int]::TryParse(($rawLock | Out-String).Trim(), [ref]$lockPid)

    if ($parsedLockPid -and $lockPid -gt 0) {
      $lockProcess = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
      if ($lockProcess) {
        Write-Host "Terdeteksi next dev aktif (PID=$lockPid) via lock file, skip auto-start baru." -ForegroundColor Yellow
        return $false
      }

      Write-Host "Lock Next.js terdeteksi namun proses tidak aktif, membersihkan lock stale." -ForegroundColor Yellow
      Remove-Item -Path $lockPath -Force -ErrorAction SilentlyContinue
    } else {
      Write-Host "Format lock Next.js tidak dikenali, skip hapus lock dan menunggu instance existing." -ForegroundColor Yellow
      return $false
    }
  }

  $npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
  if (-not $npmCmd) {
    $npmCmd = (Get-Command "npm" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
  }
  if (-not $npmCmd) {
    throw "npm command tidak ditemukan untuk auto start server."
  }

  Start-Process -FilePath $npmCmd -ArgumentList @("run", "dev") -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
  return $true
}

$baseCandidates = New-Object System.Collections.Generic.List[string]
$baseCandidates.Add($BaseUrl.TrimEnd("/"))
if ($AutoDetectBaseUrl) {
  foreach ($candidate in @("http://localhost:7000", "http://localhost:7001", "http://localhost:3000")) {
    $c = $candidate.TrimEnd("/")
    if (-not $baseCandidates.Contains($c)) {
      $baseCandidates.Add($c)
    }
  }
}

$errors = @()
$reachableBases = Get-ReachableBases -Candidates $baseCandidates
if ($reachableBases.Count -eq 0 -and $AutoStartServer) {
  Write-Host "Server belum reachable, mencoba start dashboard dev server..." -ForegroundColor Yellow
  try {
    $started = Start-DashboardDevServer
    if ($started) {
      Write-Host "Menunggu server siap..." -ForegroundColor DarkYellow
    } else {
      Write-Host "Skip start proses baru, menunggu server existing siap..." -ForegroundColor DarkYellow
    }
    $reachableBases = Wait-ForReachableBases -Candidates $baseCandidates -TimeoutSeconds 60 -IntervalSeconds 3
  } catch {
    $errors += "[autostart] $($_.Exception.Message)"
  }
}

$basesToTry = if ($reachableBases.Count -gt 0) { $reachableBases } else { $baseCandidates }

$resp = $null
$usedBase = ""

foreach ($base in $basesToTry) {
  $runUri = "$base/api/report/automation/run"
  $preflightUri = "$base/api/report/automation/preflight?year=$Year&month=$Month&mode=$Mode"
  $loginUri = "$base/api/auth/login"
  $sessionUri = "$base/api/auth/session"

  if (-not (Test-EndpointReachable -Url $sessionUri)) {
    $errors += "[$base] server tidak reachable"
    continue
  }

  try {
    $headers = @{}
    $webSession = $null

    if ($hasLoginCreds) {
      Write-Host "Auth mode: Login session ($Username) @ $base" -ForegroundColor Cyan
      $loginBody = @{
        username = $Username
        password = $Password
      } | ConvertTo-Json -Depth 3

      $loginResp = Invoke-RestMethod `
        -Uri $loginUri `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -SessionVariable webSession

      if (-not $loginResp.ok) {
        throw "Login gagal: $($loginResp.error)"
      }
    } elseif ($hasApiToken) {
      $headers["x-crew-access-token"] = $ApiToken.Trim()
      Write-Host "Auth mode: API token @ $base" -ForegroundColor Cyan
    } else {
      throw "Tidak ada mekanisme auth yang valid."
    }

    $preflightParams = @{
      Uri        = $preflightUri
      Method     = "GET"
      TimeoutSec = 45
    }
    if ($headers.Count -gt 0) { $preflightParams.Headers = $headers }
    if ($webSession) { $preflightParams.WebSession = $webSession }

    $preflight = Invoke-RestMethod @preflightParams
    if (-not $preflight.ok) {
      $issues = @()
      if ($preflight.issues) {
        $issues = @($preflight.issues | ForEach-Object { "$_" })
      }
      $issueText = if ($issues.Count -gt 0) { $issues -join "; " } else { "Unknown preflight issue" }
      throw "Preflight gagal: $issueText"
    }

    if ($preflight.warnings -and @($preflight.warnings).Count -gt 0) {
      Write-Host ("Preflight warnings: " + (@($preflight.warnings) -join " | ")) -ForegroundColor Yellow
    }
    Write-Host "Preflight OK @ $base" -ForegroundColor Green

    Write-Host "Trigger endpoint: $runUri" -ForegroundColor DarkCyan

    $requestParams = @{
      Uri         = $runUri
      Method      = "POST"
      ContentType = "application/json"
      Body        = $json
      TimeoutSec  = 120
    }
    if ($headers.Count -gt 0) { $requestParams.Headers = $headers }
    if ($webSession) { $requestParams.WebSession = $webSession }

    $resp = Invoke-RestMethod @requestParams
    $usedBase = $base
    break
  } catch {
    $errors += "[$base] $($_.Exception.Message)"
  }
}

if (-not $resp) {
  throw ("Gagal trigger LB1 pada semua endpoint kandidat: " + ($errors -join " | "))
}

Write-Host "LB1 triggered via $usedBase" -ForegroundColor Green
$resp | ConvertTo-Json -Depth 6
