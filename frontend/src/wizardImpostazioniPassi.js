// Etichette dei passi del wizard Impostazioni: condivise tra AppSidebar.vue (sotto-voci
// verticali) e ImpostazioniView.vue (titolo passo corrente), per non duplicare l'elenco.
import { computed, shallowReactive } from 'vue';

// Passi aggiunti in coda dalle estensioni (`registraPassoImpostazioni`), così gli indici dei passi precedenti non cambiano.
const PASSI_ESTESI = shallowReactive([]);
export const PASSI_IMPOSTAZIONI = computed(() => [
  'Fornitore', 'PEC', 'Percorso dati', 'Backup Automatico', 'Promemoria', 'Login', 'AI',
  ...PASSI_ESTESI.filter((p) => p.visibile()).map((p) => p.nome),
]);

// Gli step "Login" (Google) e "AI" gestiscono da sé il proprio salvataggio (scrivono su .env, non su config.json).
// "Percorso dati" ha il Salva come gli altri: la scelta della cartella cloud si applica da lì (il passo espone `salva()`).
export const PASSI_AUTOSALVANTI = ['Login', 'AI'];

// Sottotitolo mostrato sotto "Impostazioni", specifico per ogni passo del wizard.
export const DESCRIZIONI_PASSI = {
  Fornitore: 'Anagrafica, regime forfettario, INPS, bollo virtuale, dati di pagamento e wallet',
  PEC: 'Casella PEC per invio e ricezione fatture SDI',
  'Percorso dati': 'Cartella dove sono salvati timesheet, fatture e configurazione',
  'Backup Automatico': 'Backup automatico cifrato dei dati',
  Promemoria: 'Avviso fine mese per ore non registrate',
  Login: 'Credenziali OAuth per il login',
  AI: 'API key Gemini e Groq per le funzioni assistite da AI',
};

// Un passo extra: { nome, descrizione, componente, visibile: () => boolean, autosalvante }.
export function registraPassoImpostazioni({ nome, descrizione, componente, visibile = () => true, autosalvante = false }) {
  PASSI_ESTESI.push({ nome, componente, visibile });
  DESCRIZIONI_PASSI[nome] = descrizione;
  if (autosalvante) PASSI_AUTOSALVANTI.push(nome);
}

export const componentePasso = (nome) => PASSI_ESTESI.find((p) => p.nome === nome)?.componente;
