// Invio PDF al cliente via client di posta OS predefinito. mailto: non supporta allegati
// su nessun OS, quindi il PDF viene inviato al backend che lo salva su disco e avvia il
// flusso più adatto al sistema operativo corrente (vedi backend/src/services/mailService.js):
// su mac apre Mail.app con l'allegato già inserito, altrove rivela il file nel file manager
// e qui si apre comunque mailto: con oggetto/corpo precompilati per completare l'invio.
export async function inviaPdfEmail(pdfBlob, nomeFile, email, oggetto, corpo) {
  const form = new FormData();
  form.append('file', pdfBlob, nomeFile);
  form.append('email', email);
  form.append('oggetto', oggetto);
  form.append('corpo', corpo);

  const risposta = await fetch('/api/mail/invia', { method: 'POST', body: form });
  if (!risposta.ok) {
    throw new Error((await risposta.json().catch(() => ({}))).errore || `Errore HTTP ${risposta.status}`);
  }
  const risultato = await risposta.json();
  if (risultato.mailtoUrl) window.location.href = risultato.mailtoUrl;
  return risultato;
}
