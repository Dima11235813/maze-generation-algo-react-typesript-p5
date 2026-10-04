<#
.SYNOPSIS
  Register (or remove) MazeLab-LocalServers: keeps the Maze Lab dev server on the LAN running.
.DESCRIPTION
  One scheduled task, current user, no elevation. It runs run_local_servers.ps1 at logon and then every
  15 minutes as a heartbeat; each run starts only what is down and never kills anything.

  -Unregister is the abort: it removes the task AND stops whatever listens on the Maze Lab block
  (41920-41939), so "until further notice" has a clean off switch.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register_local_servers.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register_local_servers.ps1 -Unregister
#>
[CmdletBinding()]
param([switch]$Unregister)

$ErrorActionPreference = 'Stop'
$TaskName = 'MazeLab-LocalServers'
$Launcher = Join-Path $PSScriptRoot 'run_local_servers.ps1'
$Block    = 41920..41939

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    $pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $Block -contains $_.LocalPort } |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) { Stop-Process -Id $p -Force -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host "Removed $TaskName and stopped $(@($pids).Count) server process(es)."
    return
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Launcher`""
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$heartbeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($atLogon, $heartbeat) `
    -Settings $settings -Principal $principal -Force `
    -Description 'Maze Lab local dev server (41920, LAN) -- heartbeat every 15 min; run_local_servers.ps1' | Out-Null
Write-Host "Registered $TaskName (at logon + every 15 minutes)."
