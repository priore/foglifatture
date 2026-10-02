# Compila FogliFatture-x.y.z.exe con Inno Setup
# Eseguire sulla VM Windows (Parallels "Windows 11 VS 2022")
# Prerequisito: Inno Setup installato da https://jrsoftware.org
param(
    [string]$Version = "1.4.1"
)
$ErrorActionPreference = "Stop"

# Percorso Inno Setup compiler (default install path)
$IsccPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$Iscc = $IsccPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Iscc) {
    Write-Error "Inno Setup non trovato. Installa da https://jrsoftware.org/isdl.php"
    exit 1
}

$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$IssFile = Join-Path $ScriptDir "windows\FogliFatture.iss"
$DistDir = Join-Path $ScriptDir "dist"
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

# Copia file helper nella dir windows/ prima di compilare
Copy-Item "$ScriptDir\windows\bootstrap.ps1" "$ScriptDir\windows\" -ErrorAction SilentlyContinue
Copy-Item "$ScriptDir\windows\launcher.vbs" "$ScriptDir\windows\" -ErrorAction SilentlyContinue
Copy-Item "$ScriptDir\windows\uninstall-helper.ps1" "$ScriptDir\windows\" -ErrorAction SilentlyContinue

Write-Host "Compilazione con Inno Setup $Version..."
& $Iscc "/DAppVersion=$Version" $IssFile

$Output = "$DistDir\FogliFatture-$Version-win-x64.exe"
if (Test-Path $Output) {
    Write-Host ""
    Write-Host "Output: $Output"
    Write-Host "Dimensione: $([math]::Round((Get-Item $Output).Length/1MB, 1)) MB"
    Write-Host ""
    Write-Host "Test sandbox VM:"
    Write-Host "  $Output /VERYSILENT /LOG=%TEMP%\FogliFatture-install.log"
    Write-Host "  oppure doppio click per wizard grafico"
} else {
    Write-Error "Build fallita: $Output non trovato"
}
