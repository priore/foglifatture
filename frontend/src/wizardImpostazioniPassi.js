// Etichette dei passi del wizard Impostazioni: condivise tra AppSidebar.vue (sotto-voci
// verticali) e ImpostazioniView.vue (titolo passo corrente), per non duplicare l'elenco.
export const PASSI_IMPOSTAZIONI = ['Fornitore', 'Tariffa & fiscali', 'Clienti', 'PEC', 'Percorso dati', 'Backup Automatico', 'Promemoria', 'Login', 'AI'];

// Gli step "Login" (Google) e "AI" gestiscono da sé il proprio salvataggio (scrivono su .env, non su config.json).
// "Percorso dati" agisce subito tramite il proprio pulsante (spostaPercorsoDati), non tramite il salva generico.
export const PASSI_AUTOSALVANTI = ['Login', 'AI', 'Percorso dati'];

// Sottotitolo mostrato sotto "Impostazioni", specifico per ogni passo del wizard.
export const DESCRIZIONI_PASSI = {
  Fornitore: 'Anagrafica fornitore e regime forfettario',
  Clienti: 'Elenco clienti e tariffe orarie',
  'Tariffa & fiscali': 'Bollo virtuale e dati di pagamento in fattura',
  PEC: 'Casella PEC per invio e ricezione fatture SDI',
  'Percorso dati': 'Cartella dove sono salvati timesheet, fatture e configurazione',
  'Backup Automatico': 'Backup automatico cifrato dei dati',
  Promemoria: 'Avviso fine mese per ore non registrate',
  Login: 'Credenziali OAuth per il login',
  AI: 'API key Gemini e Groq per le funzioni assistite da AI',
};
