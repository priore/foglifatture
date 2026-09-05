// Polling stato aggiornamento app (tag Git semver remoto vs backend/VERSION locale).
import { ref, onMounted, onUnmounted } from 'vue';
import { updateApi } from '../services/api.js';

const INTERVALLO_MS = 10 * 60 * 1000; // ogni 10 minuti, in linea col polling backend (5 min) senza sovraccaricare

export function useUpdateCheck() {
  const stato = ref({ disponibile: false, versioneLocale: null, versioneRemota: null, changelog: '' });
  let timer = null;

  async function controlla() {
    stato.value = await updateApi.stato().catch(() => stato.value);
  }

  onMounted(() => {
    controlla();
    timer = setInterval(controlla, INTERVALLO_MS);
  });
  onUnmounted(() => clearInterval(timer));

  return { stato, controlla };
}
