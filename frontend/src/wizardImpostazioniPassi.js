// Etichette dei passi del wizard Impostazioni: condivise tra AppSidebar.vue (sotto-voci
// verticali) e ImpostazioniView.vue (titolo passo corrente), per non duplicare l'elenco.
export const PASSI_IMPOSTAZIONI = ['Fornitore', 'Clienti', 'Tariffa & fiscali', 'PEC', 'Backup', 'Promemoria', 'Forfettario', 'Google', 'Gemini'];

// Gli step "Google" e "Gemini" gestiscono da sé il proprio salvataggio (scrivono su .env, non su config.json).
export const PASSI_AUTOSALVANTI = ['Google', 'Gemini'];
