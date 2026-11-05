// Punti di aggancio per i moduli opzionali di `src/estensioni/`: se la cartella manca, i campi restano vuoti e nulla cambia.
import { shallowReactive } from 'vue';

export const registro = shallowReactive({
  shell: null, // { componente, router } che sostituisce App.vue e il router del desktop, scelta una sola volta in main.js
  archivioCloud: null, // componente mostrato in Percorso dati al posto delle cartelle dei client cloud
  selettoreCartella: null, // componente v-model (percorso) che sostituisce il campo di testo di una cartella, con pannello nativo
  avvisoNotifiche: null, // componente mostrato in Promemoria sotto l'interruttore delle notifiche
  timesheetGriglia: null, // componente ({ giorni }) che sostituisce la griglia del Timesheet
  suRispostaNegata: null, // (risposta, corpo) => void, chiamata per ogni risposta HTTP non riuscita
});
