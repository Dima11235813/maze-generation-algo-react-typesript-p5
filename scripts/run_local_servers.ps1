<#
.SYNOPSIS
  Keep the Maze Lab local server up (web dev server on the LAN). Idempotent heartbeat.
.DESCRIPTION
  Owner's decision, 2026-10-03: leave the Maze Lab dev server running "until further notice" so the
  owner can test progress from a phone or tablet at home while work lands. Same pattern as
  finese-finance (scripts\run_local_servers.ps1 there).

  Each run checks every server's port. A server whose port is not listening is started (hidden, logs
  under .local\logs\local-servers\). A server that is already listening is left alone, whoever started
  it. Nothing is ever killed here. One heartbeat line per run goes to
  .local\logs\local-servers\heartbeat.jsonl.

  Ports (block 41920-41939, claimed in D:\GDrive\proj-mgmt\inventory\local-ports.md):
    41920  web dev server  0.0.0.0  (LAN)  Vite with hot reload: shows whatever is checked out, so
                                           it follows the work branch while a work item is in progress
                                           and `develop`/`main` once it is merged.

  Registered as the MazeLab-LocalServers scheduled task by register_local_servers.ps1 (which is also
  the off switch: -Unregister).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Web      = Join-Path $RepoRoot 'apps\web'
$LogDir   = Join-Path $RepoRoot '.local\logs\local-servers'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Stable interpreter path (fnm's per-shell node path changes every shell, so it can't be used here).
$Node = Join-Path $env:APPDATA 'fnm\node-versions\v22.23.2\installation\node.exe'

$servers = @(
    @{ Name = 'web'; Port = 41920; Exe = $Node; Cwd = $Web;
       Args = @('node_modules/vite/bin/vite.js', '--port', '41920', '--strictPort', '--host', '0.0.0.0');
       Env  = @{ NODE_OPTIONS = '--use-system-ca' } }
)

function Test-Listening([int]$Port) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return [bool]$c
}

$beat = [ordered]@{ ts = (Get-Date).ToUniversalTime().ToString('o'); servers = [ordered]@{} }
foreach ($s in $servers) {
    $status = 'up'
    if (-not (Test-Listening $s.Port)) {
        if (-not (Test-Path $s.Exe)) {
            $status = "missing-exe:$($s.Exe)"
        } else {
            $saved = @{}
            foreach ($k in $s.Env.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, $s.Env[$k], 'Process') }
            try {
                Start-Process -FilePath $s.Exe -ArgumentList $s.Args -WorkingDirectory $s.Cwd -WindowStyle Hidden `
                    -RedirectStandardOutput (Join-Path $LogDir "$($s.Name).log") `
                    -RedirectStandardError  (Join-Path $LogDir "$($s.Name).err") | Out-Null
                $status = 'started'
            } catch {
                $status = "start-failed:$($_.Exception.Message)"
            } finally {
                foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
            }
        }
    }
    $beat.servers[$s.Name] = @{ port = $s.Port; status = $status }
}

($beat | ConvertTo-Json -Compress -Depth 4) | Add-Content -Path (Join-Path $LogDir 'heartbeat.jsonl') -Encoding UTF8
exit 0
