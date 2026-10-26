<script setup>
// Primo avvio sul desktop (nessun fornitore ancora configurato), prima dei termini: se sul computer ci sono client Dropbox, OneDrive o Google Drive già collegati
// si offre di tenere l'archivio in una loro cartella. Nessun login: il client del provider è già collegato all'account.
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '../../services/api.js';
import { avvisa } from '../../composables/useConferma.js';
import { sceltaPendente } from '../../composables/useSceltaArchivio.js';

const CHIAVE = 'sceltaArchivioFatta';
const cartelle = ref([]);
const occupato = ref(false);
const errore = ref('');

const gia = () => { try { return sessionStorage.getItem(CHIAVE) === '1'; } catch { return false; } };
function chiudi() {
  try { sessionStorage.setItem(CHIAVE, '1'); } catch { /* resta aperta al prossimo caricamento: accettabile */ }
  sceltaPendente.value = false;
}

onMounted(async () => {
  window.addEventListener('keydown', alTasto);
  try {
    // Negli ambienti embedded la scelta è nativa. I termini possono ricomparire a ogni nuova versione: non indicano il primo avvio,
    // lo indica un archivio ancora senza fornitore.
    if (document.documentElement.dataset.shell || gia()) return void (sceltaPendente.value = false);
    const config = await api.getConfig();
    if (config.fornitore?.denominazione) return void (sceltaPendente.value = false);
    cartelle.value = await api.cartelleCloud();
    sceltaPendente.value = cartelle.value.length > 0;
  } catch {
    sceltaPendente.value = false;
  }
});
onUnmounted(() => window.removeEventListener('keydown', alTasto));
function alTasto(e) { if (e.key === 'Escape' && sceltaPendente.value) chiudi(); }

async function scegli(c) {
  occupato.value = true;
  errore.value = '';
  try {
    const esito = await api.cartelleCloudEsamina(c.radice);
    if (esito.stato === 'estranea') {
      await avvisa(`La cartella FogliFatture su ${c.nome} contiene file che non sono un archivio: svuotala o scegli un altro servizio.`, { titolo: `Archivio su ${c.nome}` });
      return;
    }
    await (esito.stato === 'archivio' ? api.apriArchivioEsistente(esito.percorso) : api.spostaPercorsoDati(esito.percorso));
    chiudi();
  } catch (err) {
    errore.value = `Errore: ${err.message}`;
  } finally {
    occupato.value = false;
  }
}
</script>

<template>
  <div v-if="sceltaPendente" class="modal-overlay" @click.self="chiudi">
    <div class="modal-box scelta-box" role="dialog" aria-modal="true" aria-label="Dove tenere l'archivio">
      <h2>Dove tenere l'archivio</h2>
      <p class="note-legal">Scegli dove salvare i tuoi dati. Potrai cambiarla più avanti in Impostazioni → Percorso dati.</p>
      <div class="scelta-griglia">
        <button v-for="c in cartelle" :key="c.provider" type="button" class="scelta-voce" :disabled="occupato" @click="scegli(c)">
          <svg class="scelta-icona" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 .5 9.5z"/></svg>
          <span class="scelta-testo">
            <b>{{ c.nome }}</b>
            <span>Sincronizza con la cartella FogliFatture del client {{ c.nome }} già installato e collegato al tuo account su questo computer: nessun altro accesso.</span>
          </span>
        </button>
        <button type="button" class="scelta-voce" :disabled="occupato" @click="chiudi">
          <svg class="scelta-icona" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2-8h10l2 8M7 16.5h.01M11 16.5h.01"/></svg>
          <span class="scelta-testo">
            <b>Locale</b>
            <span>I dati restano solo su questo computer: nessuna sincronizzazione con altri dispositivi e nessuna copia su cloud. Se lo perdi o lo sostituisci li perdi, salvo i backup che fai tu.</span>
          </span>
        </button>
      </div>
      <p v-if="errore" class="note-legal">{{ errore }}</p>
    </div>
  </div>
</template>

<style scoped>
.scelta-box { max-width: 760px; padding: calc(var(--gap-md) * 2.4); }
.scelta-griglia { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--gap-md); margin-top: var(--gap-md); }
@media (max-width: 640px) { .scelta-griglia { grid-template-columns: 1fr; } }
.scelta-voce { display: flex; gap: var(--gap-md); align-items: flex-start; text-align: left; padding: var(--gap-md); background: var(--ground); color: var(--ink); border: 1px solid var(--line); border-radius: var(--radius-md); cursor: pointer; font: inherit; }
.scelta-voce:hover:not(:disabled) { border-color: var(--accent); }
.scelta-voce:disabled { opacity: .6; cursor: default; }
.scelta-icona { flex: none; opacity: .7; }
.scelta-testo { display: flex; flex-direction: column; gap: calc(var(--gap-sm) / 2); }
.scelta-testo span { font-size: var(--font-size-sm); opacity: .7; }
</style>
