# Chiamato da Inno Setup durante la disinstallazione
$InstallDir = "$env:LOCALAPPDATA\FogliFatture"
$UninstallScript = "$InstallDir\scripts\uninstall.ps1"

if (Test-Path $UninstallScript) {
    & powershell.exe -NonInteractive -ExecutionPolicy Bypass -File $UninstallScript
}
# I dati fiscali in backend/data/ non vengono toccati da uninstall.ps1 per design
