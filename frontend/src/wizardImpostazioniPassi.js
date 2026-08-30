// Etichette dei passi del wizard Impostazioni: condivise tra AppSidebar.vue (sotto-voci
// verticali) e ImpostazioniView.vue (titolo passo corrente), per non duplicare l'elenco.
export const PASSI_IMPOSTAZIONI = ['Fornitore', 'Clienti', 'Tariffa & fiscali', 'PEC', 'Backup', 'Promemoria', 'Forfettario', 'Login Google'];

// Lo step "Login Google" gestisce da sé il proprio salvataggio (scrive su .env, non su config.json).
export const PASSI_AUTOSALVANTI = ['Login Google'];
