$ErrorActionPreference = 'Stop'
$phonePort = 8778
$pythonCommand = Get-Command python -ErrorAction Stop
$adapter = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
$phoneAddress = $adapter.IPv4Address.IPAddress | Select-Object -First 1
if (-not $phoneAddress -or $phoneAddress -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)') { throw 'Connect this computer and phone to the same private Wi-Fi network, then try again.' }
$phoneUrl = "http://${phoneAddress}:$phonePort/?v=phone-ready-9"
try { $identity=Invoke-RestMethod -Uri "http://${phoneAddress}:$phonePort/data/build-info.json" -TimeoutSec 2; $serverReady=$identity.id -eq 'zhetalis-unity-mars-20261106' } catch { $serverReady=$false }
if (-not $serverReady) {
  $phoneArguments=@('-m','http.server',"$phonePort",'--bind',"$phoneAddress",'--directory',('"'+$PSScriptRoot+'"'))
  $phoneProcess=Start-Process -FilePath $pythonCommand.Source -ArgumentList $phoneArguments -WindowStyle Hidden -PassThru
  $phoneProcess.Id | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'phone-preview.pid')
}
Write-Host ''
Write-Host 'Open this URL on your phone, using the same Wi-Fi:'
Write-Host $phoneUrl -ForegroundColor Green
Write-Host 'Keep this computer on while playing. The existing desktop preview stays on port 8777.'
Write-Host 'If Windows asks about Python, allow it on your private network only.'
Write-Host ''
Read-Host 'Press Enter to stop the phone preview'
if ($phoneProcess -and -not $phoneProcess.HasExited) { Stop-Process -Id $phoneProcess.Id }
