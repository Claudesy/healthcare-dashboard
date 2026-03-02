param(
  [string]$TaskName = "Puskesmas-LB1-Automation",
  [string]$RunTime = "08:00",
  [int]$DayOfMonth = 25,
  [string]$Mode = "full-cycle",
  [string]$BaseUrl = "http://localhost:7000",
  [string]$ApiToken = $env:CREW_ACCESS_API_TOKEN,
  [string]$Username = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$script = Join-Path $root "scripts/trigger-lb1-run.ps1"

$arg = "-ExecutionPolicy Bypass -File `"$script`" -Mode $Mode -BaseUrl `"$BaseUrl`""
if ($ApiToken -and $ApiToken.Trim().Length -gt 0) {
  $arg += " -ApiToken `"$($ApiToken.Trim())`""
}
if ($Username -and $Password) {
  $arg += " -Username `"$Username`" -Password `"$Password`""
}
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

# Build monthly trigger via CIM (kompatibel semua versi Windows 10/11/Server)
$timeParts = $RunTime -split ":"
$hour   = [int]$timeParts[0]
$minute = if ($timeParts.Count -gt 1) { [int]$timeParts[1] } else { 0 }

$startBoundary = (Get-Date -Year (Get-Date).Year -Month (Get-Date).Month -Day $DayOfMonth `
  -Hour $hour -Minute $minute -Second 0).ToString("yyyy-MM-ddTHH:mm:ss")

$triggerXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<CalendarTrigger xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <StartBoundary>$startBoundary</StartBoundary>
  <Enabled>true</Enabled>
  <ScheduleByMonth>
    <DaysOfMonth>
      <Day>$DayOfMonth</Day>
    </DaysOfMonth>
    <Months>
      <January/><February/><March/><April/><May/><June/>
      <July/><August/><September/><October/><November/><December/>
    </Months>
  </ScheduleByMonth>
</CalendarTrigger>
"@

# Register task pakai schtasks XML untuk monthly trigger yang reliable
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Trigger LB1 automation API on dashboard backend — setiap tgl $DayOfMonth jam $RunTime</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$startBoundary</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>$DayOfMonth</Day></DaysOfMonth>
        <Months>
          <January/><February/><March/><April/><May/><June/>
          <July/><August/><September/><October/><November/><December/>
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>$arg</Arguments>
    </Exec>
  </Actions>
</Task>
"@

$tmpXml = Join-Path $env:TEMP "lb1-task-$TaskName.xml"
[System.IO.File]::WriteAllText($tmpXml, $taskXml, [System.Text.Encoding]::Unicode)

schtasks /Create /TN $TaskName /XML $tmpXml /F | Out-Null
Remove-Item $tmpXml -Force -ErrorAction SilentlyContinue

Write-Host "Task created: $TaskName (day $DayOfMonth at $RunTime)" -ForegroundColor Green
