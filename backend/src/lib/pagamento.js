import { normalizzaIban } from './iban.js';

// Blocco `pagamento` congelato nella fattura alla generazione (DatiPagamento XML + riquadro PDF).
// BTC non ha un codice ModalitaPagamento FatturaPA: per quella modalità l'XML non scrive
// DatiPagamento e vale la Causale BTC; l'indirizzo compare solo nel PDF.
export function costruisciPagamento(config, cliente) {
  const f = config.fatturazione;
  const modalita = cliente.modalitaPagamento || f.modalitaDefault;
  const usaBtc = modalita === 'BTC' || cliente.pagamentoBtc;
  const btcAddress = usaBtc ? (config.walletBtc?.[0]?.indirizzo ?? '') : '';
  if (!f.iban && !btcAddress) return null;
  return {
    modalita,
    iban: normalizzaIban(f.iban),
    intestatario: f.intestatario,
    istitutoFinanziario: f.istitutoFinanziario,
    giorniScadenza: Number.isFinite(cliente.giorniScadenza) ? cliente.giorniScadenza : f.giorniScadenzaDefault,
    btcAddress,
  };
}
