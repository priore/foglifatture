# Bootstrap post-install per Inno Setup
# Eseguito nascosto dopo il wizard "Avanti/Avanti/Fine"
$ErrorActionPreference = "Stop"

$RepoUrl = "http://localhost:3000/danilo/Timesheet.git"
$InstallDir = "$env:LOCALAPPDATA\FogliFatture"
$LogFile = "$env:TEMP\FogliFatture-install.log"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Tee-Object -Append -FilePath $LogFile
}

try {
    # Ricarica PATH dopo eventuale installazione Git
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Log "ERRORE: git non trovato dopo tentativo installazione"
        exit 1
    }

    Log "Git: $(git --version)"

    if (Test-Path "$InstallDir\.git") {
        Log "Aggiornamento repo esistente in $InstallDir"
        git -C $InstallDir fetch origin
        git -C $InstallDir checkout main
        git -C $InstallDir pull --ff-only origin main
    } else {
        Log "Clonazione repo in $InstallDir"
        if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
        git clone $RepoUrl $InstallDir
    }

    Log "Avvio install.ps1"
    & powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$InstallDir\scripts\install.ps1"

    Log "Installazione completata"
} catch {
    Log "ERRORE: $_"
    [System.Windows.Forms.MessageBox]::Show(
        "Installazione FogliFatture non riuscita.`n`nLog: $LogFile`n`nErrore: $_",
        "FogliFatture - Errore",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    exit 1
}
