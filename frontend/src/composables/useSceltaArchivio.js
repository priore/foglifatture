// Scelta iniziale dell'archivio sul desktop: `null` finché non si sa se serve, `true` popup aperto, `false` chiuso o non necessario.
// I termini d'uso aspettano che sia `false`, così il popup viene prima.
import { ref } from 'vue';

export const sceltaPendente = ref(null);
