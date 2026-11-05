// Calcoli della vista Fattura estratti come funzioni pure (il backend resta fonte di verità sui totali emessi).

// Incassato oltre il dovuto dopo una nota di credito.
export function daRimborsareNota(fattura) {
  if (!fattura?.notaCredito) return 0;
  const pagato = (fattura.pagamenti ?? []).reduce((t, p) => t + p.importo, 0);
  return Math.max(0, Number((pagato - (fattura.nettoAPagare - fattura.notaCredito.nettoAPagare)).toFixed(2)));
}

// Anteprima della fattura manuale (importo libero). `rivalsaCliente` null/undefined = vale la config globale.
export function anteprimaManuale(importo, { sogliaBolloVirtuale, importoBollo, rivalsaCliente, rivalsaConfig }) {
  const imponibile = Number((Number(importo) || 0).toFixed(2));
  const bolloApplicabile = imponibile > sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? importoBollo : 0;
  const rivalsaAttiva = rivalsaCliente !== null && rivalsaCliente !== undefined ? Boolean(rivalsaCliente) : Boolean(rivalsaConfig);
  const rivalsaInps = rivalsaAttiva ? Number((imponibile * 0.04).toFixed(2)) : 0;
  return { imponibile, bolloApplicabile, bollo, rivalsaInps, nettoAPagare: Number((imponibile + rivalsaInps).toFixed(2)) };
}

// bech32 (bc1...) esclude 1, b, i, o dal corpo: un indirizzo che li contiene è quasi sempre un errore di trascrizione.
export function indirizzoBech32NonValido(indirizzo) {
  if (!/^bc1/i.test(indirizzo)) return false;
  return /[1boi]/.test(indirizzo.slice(3));
}
