// Messaggi aggiuntivi per specifici codici di scarto SDI ricorrenti, oltre al
// suggerimento ufficiale già presente nella notifica NS: solo testo esplicativo,
// nessuna correzione automatica sui dati — i dati fiscali (P.IVA/CF/numerazione)
// restano sempre sotto controllo umano, si mostra solo dove guardare.
const MESSAGGI_PER_CODICE = {
  '00300': 'IdCodice non valido nel campo IdTrasmittente/DatiTrasmissione: verificare che sia il Codice Fiscale del fornitore, non la Partita IVA.',
  '00301': 'Partita IVA del cedente/prestatore non valida o non registrata presso l\'Agenzia delle Entrate.',
  '00305': 'Partita IVA errata: controllare il valore in Impostazioni > Fornitore.',
  '00404': 'Fattura già accettata da SDI con questo numero e progressivo: serve un nuovo numero fattura (rigenerare con "Genera fattura" dopo aver corretto la numerazione), non un semplice reinvio.',
  '00002': 'Nome file/progressivo di trasmissione già usato presso SDI per questo fornitore (anche da invii di anni fa o di altri gestionali). Reinviare genera automaticamente un nuovo progressivo casuale.',
};

/**
 * @returns {string | null}
 */
export function messaggioPerCodice(codice) {
  return MESSAGGI_PER_CODICE[codice] ?? null;
}
