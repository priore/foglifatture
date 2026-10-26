// Punti di aggancio per i moduli opzionali di `src/estensioni/`: se la cartella manca, i campi restano vuoti e nulla cambia.
import { shallowReactive } from 'vue';

export const registro = shallowReactive({
  archivioCloud: null, // componente mostrato in Percorso dati al posto delle cartelle dei client cloud
  suRispostaNegata: null, // (risposta, corpo) => void, chiamata per ogni risposta HTTP non riuscita
});
