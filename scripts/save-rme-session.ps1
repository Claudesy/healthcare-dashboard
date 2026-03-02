# save-rme-session.ps1
# Buka browser visible, Chief login manual ke ePuskesmas, lalu simpan session ke file.
# Session ini digunakan oleh RPA LB1 untuk bypass login + CAPTCHA.
#
# Cara pakai:
#   powershell -ExecutionPolicy Bypass -File .\scripts\save-rme-session.ps1
#
# Session disimpan ke: runtime/rme-session.json
# TTL default: 8 jam. Setelah expired, jalankan script ini lagi.

param(
  [string]$BaseUrl  = "",
  [int]$TtlHours    = 8,
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Tentukan path output
if (-not $OutputFile) {
  $OutputFile = Join-Path $root "runtime\rme-session.json"
}

# Pastikan runtime/ ada
$runtimeDir = Split-Path -Parent $OutputFile
if (-not (Test-Path $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

# Baca base_url dari lb1-config.yaml jika tidak dipass via param
if (-not $BaseUrl) {
  $configPath = Join-Path $root "runtime\lb1-config.yaml"
  if (Test-Path $configPath) {
    $configContent = Get-Content -Path $configPath -Raw
    if ($configContent -match 'base_url:\s*"([^"]+)"') {
      $BaseUrl = $matches[1]
    }
  }
}

if (-not $BaseUrl) {
  $BaseUrl = "https://kotakediri.epuskesmas.id"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SIMPAN SESSION RME — ePuskesmas Login Manual" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Target   : $BaseUrl" -ForegroundColor White
Write-Host "  Output   : $OutputFile" -ForegroundColor White
Write-Host "  TTL      : $TtlHours jam" -ForegroundColor White
Write-Host ""
Write-Host "  INSTRUKSI:" -ForegroundColor Yellow
Write-Host "  1. Browser Chromium akan terbuka (non-headless)" -ForegroundColor White
Write-Host "  2. Login ke ePuskesmas seperti biasa (isi CAPTCHA manual)" -ForegroundColor White
Write-Host "  3. Setelah berhasil login dan halaman dashboard terbuka," -ForegroundColor White
Write-Host "     KEMBALI ke terminal ini dan tekan ENTER" -ForegroundColor White
Write-Host ""
Write-Host "  PENTING: Jangan tutup browser sebelum tekan ENTER!" -ForegroundColor Red
Write-Host ""
Read-Host "Tekan ENTER untuk membuka browser..."

# Buat script Node.js/Playwright inline untuk save session
$playwrightScript = @"
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

(async () => {
  const outputFile = process.argv[2];
  const baseUrl = process.argv[3] || 'https://kotakediri.epuskesmas.id';
  const ttlHours = parseInt(process.argv[4] || '8', 10);

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('');
  console.log('Browser sudah terbuka. Login manual ke ePuskesmas sekarang.');
  console.log('Setelah halaman dashboard terbuka, kembali ke terminal ini dan tekan ENTER.');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('Tekan ENTER setelah berhasil login... ', () => { rl.close(); resolve(); }));

  // Simpan storageState (cookies + localStorage)
  const storageState = await context.storageState();

  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const sessionData = {
    saved_at: new Date().toISOString(),
    expires_at: expiresAt,
    ttl_hours: ttlHours,
    base_url: baseUrl,
    storage_state: storageState,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(sessionData, null, 2), 'utf-8');

  console.log('');
  console.log('Session berhasil disimpan ke: ' + outputFile);
  console.log('Expires at: ' + expiresAt);

  await browser.close();
  process.exit(0);
})();
"@

# Tulis script temp ke folder project (agar require('playwright') resolve dari node_modules lokal)
$tmpScript = Join-Path $root "_save-rme-session-tmp.js"
[System.IO.File]::WriteAllText($tmpScript, $playwrightScript, [System.Text.Encoding]::UTF8)

try {
  # Jalankan dari root project — require('playwright') akan resolve ke node_modules di sini
  $nodeArgs = @($tmpScript, $OutputFile, $BaseUrl, $TtlHours.ToString())
  $proc = Start-Process -FilePath "node" `
    -ArgumentList $nodeArgs `
    -WorkingDirectory $root `
    -NoNewWindow `
    -Wait `
    -PassThru

  if ($proc.ExitCode -ne 0) {
    throw "Node script keluar dengan exit code $($proc.ExitCode)"
  }

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Green
  Write-Host "  SESSION TERSIMPAN" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  File    : $OutputFile" -ForegroundColor White

  # Baca dan tampilkan expires_at
  if (Test-Path $OutputFile) {
    $sessionJson = Get-Content -Path $OutputFile -Raw | ConvertFrom-Json
    Write-Host "  Dibuat  : $($sessionJson.saved_at)" -ForegroundColor White
    Write-Host "  Expires : $($sessionJson.expires_at) ($TtlHours jam)" -ForegroundColor White
  }

  Write-Host ""
  Write-Host "  RPA LB1 sekarang akan otomatis menggunakan session ini." -ForegroundColor Green
  Write-Host "  Jalankan script ini lagi jika session expired." -ForegroundColor DarkGray
  Write-Host ""
} finally {
  # Hapus script temp dari folder project
  Remove-Item $tmpScript -Force -ErrorAction SilentlyContinue
}
