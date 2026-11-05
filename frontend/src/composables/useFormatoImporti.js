// Importi: i campi numerici con step 0.01 si normalizzano a due decimali a fine digitazione (blur o Invio).
// Listener globale in cattura: vale per ogni vista, desktop e Apple, senza toccare i singoli campi.
function formattaCampo(el) {
  if (!(el instanceof HTMLInputElement) || el.type !== 'number' || el.step !== '0.01' || el.value === '') return;
  const n = Number(el.value);
  if (!Number.isFinite(n)) return;
  const testo = n.toFixed(2);
  if (testo === el.value) return;
  el.value = testo;
  el.dispatchEvent(new Event('input', { bubbles: true })); // allinea il v-model
}

export function installaFormatoImporti() {
  document.addEventListener('focusout', (e) => formattaCampo(e.target), true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter') formattaCampo(e.target); }, true);
}
