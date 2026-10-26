# Finestra di scelta cartella di Windows. Argomenti: messaggio, cartella iniziale (facoltativa).
# Stampa il percorso scelto; nessun output se l'utente annulla.
param([string]$Messaggio = 'Scegli la cartella', [string]$Iniziale = '')
Add-Type -AssemblyName System.Windows.Forms
$finestra = New-Object System.Windows.Forms.FolderBrowserDialog
$finestra.Description = $Messaggio
$finestra.ShowNewFolderButton = $true
if ($Iniziale -and (Test-Path -LiteralPath $Iniziale)) { $finestra.SelectedPath = $Iniziale }
if ($finestra.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($finestra.SelectedPath) }
