param(
  [string]$TaskName = "Puskesmas-LB1-Automation"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Task removed: $TaskName" -ForegroundColor Green
} else {
  Write-Host "Task not found: $TaskName" -ForegroundColor Yellow
}
