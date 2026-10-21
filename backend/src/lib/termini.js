// Termini d'uso: cambiare VERSIONE_TERMINI fa ripresentare l'accettazione a tutti, anche a
// chi aveva già accettato. Paragrafi separati da riga vuota.
// Basi normative verificate sulle fonti: art. 1229 c.c. (nullità dei patti di esonero per dolo
// o colpa grave), art. 1341 c. 2 c.c. (limitazioni di responsabilità inefficaci senza specifica
// approvazione scritta), art. 3 D.Lgs. 206/2005 (l'operatore agisce come professionista, non
// come consumatore), Dir. (UE) 2024/2853 art. 15 (nessuna esclusione contrattuale della
// responsabilità da prodotto, applicabile ai prodotti immessi sul mercato dopo il 9/12/2026).
// Bozza da far verificare a un legale prima della pubblicazione.
export const VERSIONE_TERMINI = '2026-10-19';

export const TESTO_TERMINI = `1. Natura dello strumento. Fogli & Fatture è uno strumento di supporto e di stima: non è consulenza fiscale, legale o contabile e non sostituisce il parere di un commercialista.

2. Oggetto e limiti. L'app calcola stime (imposta sostitutiva, contributi, bollo, piano dei versamenti, plusvalenze) e genera documenti (fatture, file FatturaPA, modelli F24, esportazioni) sulla base di regole fiscali versionate, di cui è indicata la data di verifica. Le regole possono essere incomplete o non aggiornate. L'app non esegue pagamenti, invii allo SDI né adempimenti per conto dell'operatore: il PDF F24 è solo un modello compilato, da controllare prima di presentarlo.

3. Responsabilità dell'operatore. L'operatore usa l'app nell'esercizio della propria attività professionale e non come consumatore. Resta l'unico responsabile della verifica di importi e documenti, dei versamenti, delle dichiarazioni, delle fatture emesse, della conservazione dei dati e dei backup.

4. Limitazione di responsabilità. Nei limiti consentiti dalla legge, il software è fornito «così com'è», senza garanzie, e l'autore non risponde dei danni, comprese sanzioni, interessi e maggiori imposte, derivanti dall'uso di calcoli o documenti non verificati dall'operatore. Nulla in questi termini esclude o limita la responsabilità per dolo o colpa grave né quella che la legge non consente di escludere.

5. Modifiche. Se i termini cambiano, l'accettazione viene richiesta di nuovo.`;

// Clausole che richiedono approvazione specifica per iscritto (art. 1341 c. 2 c.c.).
export const APPROVAZIONE_SPECIFICA = 'Approvo specificamente, ai sensi dell\'art. 1341, secondo comma, del codice civile, la clausola 4 (Limitazione di responsabilità).';

export function terminiAccettati(config) {
  const t = config?.termini;
  return t?.versione === VERSIONE_TERMINI && t?.approvazioneSpecifica === true;
}
