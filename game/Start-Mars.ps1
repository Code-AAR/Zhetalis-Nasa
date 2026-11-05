$ErrorActionPreference = 'Stop'
$port = 8777
$url = "http://127.0.0.1:$port/"
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python 3 is needed to serve the game. Install Python, then run this launcher again.' }
try {
  $identity = Invoke-RestMethod -Uri ($url + 'data/build-info.json') -TimeoutSec 2
  if ($identity.id -ne 'zhetalis-unity-mars-20261106') { throw 'Different service' }
  $ready = $true
} catch { $ready = $false }
if (-not $ready) {
  Start-Process -FilePath $python.Source -ArgumentList @('-m','http.server',"$port",'--bind','127.0.0.1','--directory',$PSScriptRoot) -WindowStyle Hidden
  for ($attempt=0; $attempt -lt 15; $attempt++) {
    Start-Sleep -Milliseconds 200
    try { if ((Invoke-WebRequest -Uri $url -TimeoutSec 1).StatusCode -eq 200) { break } } catch {}
  }
}
Start-Process $url
