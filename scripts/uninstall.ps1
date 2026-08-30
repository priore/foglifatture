# Ferma e rimuove l'attivita pianificata. Non tocca dati, config o codice.
$TaskName = "PrioreGroupFatturazione"

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Servizio fermato e rimosso ($TaskName)."
} else {
  Write-Host "Nessun servizio installato ($TaskName non trovato)."
}
