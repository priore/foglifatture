import { ref } from 'vue';

// Anno selezionato, condiviso (singleton di modulo) tra Dashboard, Bitcoin, F24, Timesheet e Fattura:
// cambiando vista resta quello scelto, finché l'app resta aperta.
export const annoSelezionato = ref(new Date().getFullYear());
