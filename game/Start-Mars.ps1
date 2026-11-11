$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'start-log.txt'
Start-Transcript -Path $log -Force | Out-Null
try {
$port = 8777
$url = "http://127.0.0.1:$port/"

# Find a real Python. Prefer the "py" launcher; skip the Microsoft Store "python" stub in WindowsApps.
$exe = $null; $pre = @()
$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) { $exe = $py.Source; $pre = @('-3') }
else {
  $python = Get-Command python -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch 'WindowsApps' } | Select-Object -First 1
  if ($python) { $exe = $python.Source }
}
"Python: $exe $pre"
if (-not $exe) { throw 'Python 3 not found. Install it from python.org (tick "Add to PATH"), then run this again.' }

function Test-Game {
  try { return ((Invoke-RestMethod -Uri ($url + 'data/build-info.json') -TimeoutSec 1).id -eq 'zhetalis-unity-mars-20261106') } catch { return $false }
}

if (-not (Test-Game)) {
  $serve = Join-Path $PSScriptRoot 'serve.py'
  "Starting server..."
  Start-Process -FilePath $exe -ArgumentList ($pre + @("`"$serve`"", "$port")) -WindowStyle Hidden
  $up = $false
  for ($i = 0; $i -lt 25; $i++) { Start-Sleep -Milliseconds 200; if (Test-Game) { $up = $true; break } }
  if (-not $up) { throw "The game server didn't start on port $port. Another program may be using that port; close it or restart the PC and try again." }
}
Start-Process $url
"Opened $url"
} catch { "ERROR: $_"; throw } finally { Stop-Transcript | Out-Null }
