// Prezzo BTC/EUR in tempo reale (CoinGecko) e BTC detenuti oggi (registro lotti): stato condiviso
// tra vista Bitcoin e dashboard, così le due card non raddoppiano le chiamate. Si aggiorna ogni 60 s.
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../services/api.js';

const prezzo = ref(null); // { eur, variazione24h }
const satoshi = ref(null); // saldo al 31/12 dell'anno corrente = detenuti oggi
const errore = ref('');
const caricando = ref(false);
let ultimo = 0;

async function aggiorna(forza = false) {
  if (caricando.value || (!forza && Date.now() - ultimo < 30000)) return;
  caricando.value = true;
  errore.value = '';
  const [p, r] = await Promise.allSettled([api.prezzoMercatoBtc(), api.rwBtc(new Date().getFullYear())]);
  if (p.status === 'fulfilled' && p.value?.bitcoin?.eur) prezzo.value = { eur: p.value.bitcoin.eur, variazione24h: p.value.bitcoin.eur_24h_change };
  else errore.value = `Prezzo non disponibile (${p.reason?.message ?? 'errore rete'})`;
  if (r.status === 'fulfilled') satoshi.value = r.value.saldo.satoshi;
  ultimo = Date.now();
  caricando.value = false;
}

export function useBtcLive() {
  let timer;
  onMounted(() => { aggiorna(true); timer = setInterval(aggiorna, 60000); });
  onUnmounted(() => clearInterval(timer));
  const valoreDetenuti = computed(() => (prezzo.value && satoshi.value != null ? (satoshi.value / 1e8) * prezzo.value.eur : null));
  return { prezzo, satoshi, valoreDetenuti, errore, caricando, aggiorna };
}
