// K3: prospetto rigo per rigo per la dichiarazione Redditi PF (quadri LM, RR, RX31) del regime forfettario.
// Calcolo per cassa sugli stessi dati di stimaVersamentiService. Aiuto alla compilazione, non invio.
import { impostaCassaAnno, aliquotaImposta, roundEuro } from './forfettarioService.js';
import { tutteLeFattureRisolte } from './forfettarioService.js';
import { arricchisciStatoPagamento } from './invoiceService.js';
import { listVersamenti, contributiInpsVersati, accontiImpostaVersati } from './versamentiF24Service.js';
import { regoleAnno, leggiPacchettoVersionato } from './regoleFiscaliService.js';

const CODICE_ALIQUOTA_GS = { 24: 'A', 25.72: 'B', 26.07: 'C' };

// Funzione pura. Righi in euro interi (Istr. Redditi PF, arrotondamento). Eccedenze e perdite
// pregresse, crediti d'imposta e LM43/LM44 non sono tracciati dall'app: restano 0 e sono segnalati.
export function costruisciProspetto({ coefficiente, codiceAteco, ricavi, aliquota, contributiVersati, accontiVersati,
  gestioneSeparata, aliquotaGs, massimale, inpsAccontiVersati }) {
  const redditoLordo = roundEuro(ricavi * coefficiente / 100);
  const lm35c1 = roundEuro(contributiVersati);
  const lm35c2 = Math.min(lm35c1, redditoLordo);
  const lm36 = redditoLordo - lm35c2;
  const lm38 = lm36; // LM37 perdite pregresse non tracciate
  const lm39 = roundEuro(lm38 * aliquota / 100);
  const lm42 = lm39; // LM40 crediti e LM41 ritenute consorzio non tracciati
  const lm45 = roundEuro(accontiVersati ?? 0);
  const netto = lm42 - lm45; // LM42 - LM43 + LM44 - LM45 c.2, con LM43 = LM44 = 0
  const lm46 = Math.max(0, netto);
  const lm47 = Math.max(0, -netto);

  const valori = {
    'LM22.1': codiceAteco || null,
    'LM22.2': coefficiente,
    'LM22.3': roundEuro(ricavi),
    'LM22.5': redditoLordo,
    ...(gestioneSeparata ? { 'LM22.6': 2, 'LM34.2': redditoLordo } : {}),
    'LM34.3': redditoLordo,
    'LM35.1': lm35c1,
    'LM35.2': lm35c2,
    'LM36': lm36,
    'LM37.5': null, // non tracciati dall'app: da compilare a mano (valore null)
    'LM38': lm38,
    'LM39': lm39,
    'LM40': null,
    'LM42': lm42,
    'LM43': null,
    'LM44': null,
    'LM45.2': lm45,
    'LM46.1': lm46,
    'LM47.1': lm47,
    ...(lm35c1 > lm35c2 ? { 'LM49': lm35c1 - lm35c2 } : {}),
    'RX31.1': lm46,
    'RX31.2': lm47,
  };

  if (gestioneSeparata) {
    const imponibile = roundEuro(Math.min(redditoLordo, massimale));
    const dovuto = roundEuro(imponibile * aliquotaGs / 100);
    const acconti = roundEuro(inpsAccontiVersati ?? 0);
    Object.assign(valori, {
      'RR5.2': redditoLordo,
      'RR5.11': imponibile,
      'RR5.14': CODICE_ALIQUOTA_GS[aliquotaGs] ?? null,
      'RR5.15': dovuto,
      'RR5.16': acconti,
      'RR7': Math.max(0, dovuto - acconti),
      'RR8.1': Math.max(0, acconti - dovuto),
    });
  }
  return valori;
}

export async function prospettoDichiarazione(config, anno) {
  const regole = await regoleAnno(anno);
  const decl = regole.dichiarazione ?? (await leggiPacchettoVersionato(regole.anno))?.dichiarazione;
  if (!decl) throw new Error('Righi della dichiarazione non disponibili nelle regole fiscali');

  const tutte = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
  const versamenti = await listVersamenti(anno);
  const versamentiPrec = await listVersamenti(anno - 1);
  const f = config.forfettario;
  const [dati, datiPrec] = await Promise.all([
    impostaCassaAnno(anno, tutte, config, versamenti, regole),
    impostaCassaAnno(anno - 1, tutte, config, versamentiPrec, regole),
  ]);
  const gestioneSeparata = f.gestionePrevidenziale === 'gestioneSeparata';
  const gs = regole.inpsGestioneSeparata;
  const aliquotaGs = f.altraCoperturaPrevidenziale ? (gs?.aliquotaAltreAttivita ?? 24) : (gs?.aliquota ?? 26.07);

  const valori = costruisciProspetto({
    coefficiente: f.coefficenteRedditivita,
    codiceAteco: f.codiceAteco,
    ricavi: dati.ricavi,
    aliquota: await aliquotaImposta(f.dataInizioAttivita, anno, f.requisitiAliquotaRidotta),
    contributiVersati: contributiInpsVersati(versamenti, anno),
    accontiVersati: accontiImpostaVersati(versamenti, anno),
    gestioneSeparata,
    aliquotaGs,
    massimale: gs?.massimale ?? 119650,
    inpsAccontiVersati: (datiPrec.inps ?? 0) * 0.8, // stesso criterio del piano F24: 80% dell'INPS dell'anno precedente
  });

  const avvisi = [
    'Bozza da verificare: i valori sono una stima dai dati dell\'app e vanno controllati prima di compilare la dichiarazione.',
    '(*) Non tracciati dall\'app e da compilare a mano: perdite pregresse (LM37), crediti d\'imposta (LM40), eccedenze della dichiarazione precedente (LM43, LM44). Se li hai, correggi LM46/LM47 a mano.',
  ];
  if (decl.annoImposta !== anno) avvisi.push(`I righi sono verificati sul modello ${decl.modello} (anno d'imposta ${decl.annoImposta}): per il ${anno} controlla la numerazione sulle istruzioni dell'anno.`);
  if (accontiImpostaVersati(versamenti, anno) === null) avvisi.push('Nessun acconto registrato con codice 1790/1791: LM45 colonna 2 è 0.');
  if (!f.codiceAteco) avvisi.push('Codice ATECO non configurato: LM22 colonna 1 da compilare a mano.');
  if (f.altreAttivitaCoefficienteDiverso) avvisi.push('Hai altre attività con coefficiente diverso: il prospetto applica un solo coefficiente, compila a mano un rigo LM per ciascun gruppo.');
  if (!gestioneSeparata) avvisi.push('Gestione separata non configurata: quadro RR non incluso.');
  else avvisi.push('RR5 colonna 16: acconti INPS stimati dall\'anno precedente (80%), non risultano dai versamenti registrati.');
  if (regole.provvisorie && regole.banner) avvisi.push(regole.banner);

  const righe = Object.entries(valori).map(([chiave, valore]) => ({
    rigo: chiave, etichetta: decl.righi[chiave] ?? chiave, valore,
  }));
  return { annoImposta: anno, modello: decl.modello, modelloPdf: decl.modelloPdf, righe, avvisi };
}
