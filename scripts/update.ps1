# Applica un aggiornamento: checkout del tag di release, install/build, scrittura VERSION,
# poi termina il processo Node del backend -- la Scheduled Task (RestartCount) lo rilancia
# da sola con la build nuova. Lanciato da updateService.js, ma eseguibile anche a mano per test:
#   scripts\update.ps1 v1.2.3 <pid-processo-backend>
param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [Parameter(Mandatory = $true)][int]$BackendPid
)
$ErrorActionPreference = "Stop"

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$LogFile = Join-Path $ProjectDir "scripts\update.log"
Set-Location $ProjectDir

function Log($msg) {
  "[$(Get-Date -AsUTC -Format o)] $msg" | Add-Content -Path $LogFile
}

Log "Avvio aggiornamento a $Tag"

if (git status --porcelain) {
  Log "ERRORE: modifiche locali non committate, aggiornamento annullato"
  exit 1
}

git fetch --tags origin
git checkout $Tag

Log "Install dipendenze"
Push-Location backend
npm install --silent; if ($LASTEXITCODE -ne 0) { Log "ERRORE npm install backend"; exit 1 }
Pop-Location
Push-Location frontend
npm install --silent; if ($LASTEXITCODE -ne 0) { Log "ERRORE npm install frontend"; exit 1 }

Log "Build frontend"
npm run build --silent; if ($LASTEXITCODE -ne 0) { Log "ERRORE build frontend"; exit 1 }
Pop-Location

Set-Content -Path "backend\VERSION" -Value $Tag -NoNewline
Log "Aggiornamento a $Tag completato, riavvio processo backend (pid $BackendPid)"

Stop-Process -Id $BackendPid -ErrorAction SilentlyContinue
