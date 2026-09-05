# Installa l'app come attivita pianificata: parte al login di Windows e si riavvia
# da sola se va in crash. Un solo comando, nessuna finestra da tenere aperta.
$ErrorActionPreference = "Stop"

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$TaskName = "PrioreGroupFatturazione"
$LogDir = Join-Path $ProjectDir "logs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Node.js non trovato: installazione tramite winget..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js non trovato e installazione automatica non riuscita. Installa Node.js da nodejs.org e riprova."
    exit 1
  }
}
$NodeBin = (Get-Command node).Source

Write-Host "Installazione build frontend e dipendenze backend..."
Push-Location "$ProjectDir\frontend"
npm install --silent; if ($LASTEXITCODE -ne 0) { exit 1 }
npm run build --silent; if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location

Push-Location "$ProjectDir\backend"
npm install --silent; if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location

$EnvPath = "$ProjectDir\backend\.env"
if (-not (Test-Path $EnvPath)) {
  Copy-Item "$ProjectDir\backend\.env.example" $EnvPath
  Write-Host "Creato backend\.env dai valori di default (nessuna credenziale Google configurata)."
}

$EnvContent = Get-Content -Raw $EnvPath
if ($EnvContent -match "SESSION_SECRET=cambia-questo-segreto") {
  $RandomSecret = & $NodeBin -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ($EnvContent -replace "SESSION_SECRET=cambia-questo-segreto", "SESSION_SECRET=$RandomSecret") | Set-Content -NoNewline $EnvPath
  Write-Host "Generato SESSION_SECRET casuale."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute $NodeBin -Argument "`"$ProjectDir\backend\src\server.js`"" -WorkingDirectory "$ProjectDir\backend"
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Backend fatturazione PrioreGroup" | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "Installato e avviato: http://localhost:1969"
Write-Host "Stato: Get-ScheduledTask -TaskName $TaskName"
Write-Host "Disinstalla con: scripts\uninstall.ps1"

Start-Sleep -Seconds 2
Start-Process "http://localhost:1969"
