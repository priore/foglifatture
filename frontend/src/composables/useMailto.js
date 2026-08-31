// Apertura client di posta predefinito del sistema operativo via link mailto:, senza
// configurazione SMTP: il PDF va allegato manualmente dall'utente (mailto non supporta
// allegati), per questo oggetto/corpo invitano esplicitamente ad allegarlo.
export function apriMailto(email, oggetto, corpo) {
  const destinatari = String(email || '').split(',').map(e => e.trim()).filter(Boolean).join(',');
  const url = `mailto:${destinatari}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
  window.location.href = url;
}
