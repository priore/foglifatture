<script setup>
// Cronologia PEC: una scheda per invio SDI con le sue ricevute. In alto le fatture da
// risolvere (scartate, errore di invio, in attesa da oltre 48 ore), sotto l'archivio paginato.
import { capacita } from '../composables/useCapacita.js';
import { ref, computed, onMounted } from 'vue';
import { api } from '../services/api.js';

const PER_PAGINA = 20;
const ATTESA_LUNGA_MS = 48 * 60 * 60 * 1000;

const invii = ref([]);
const caricamento = ref(true);
const pagina = ref(1);
// Schermo stretto: solo riepilogo e da risolvere, archivio chiuso e compatto.
const stretto = window.matchMedia('(max-width: 520px)').matches;

onMounted(async () => {
  const dati = await api.cronologiaPec();
  invii.value = dati.invii;
  caricamento.value = false;
});

const inAttesaLunga = (i) => i.stato === 'in-attesa' && Date.now() - new Date(i.dataInvio).getTime() > ATTESA_LUNGA_MS;
const daRisolvere = computed(() => invii.value.filter((i) => ['scartata', 'errore-invio'].includes(i.stato) || inAttesaLunga(i)));
const archivio = computed(() => invii.value.filter((i) => !daRisolvere.value.includes(i)));
const pagine = computed(() => Math.max(1, Math.ceil(archivio.value.length / PER_PAGINA)));
const archivioPagina = computed(() => archivio.value.slice((pagina.value - 1) * PER_PAGINA, pagina.value * PER_PAGINA));
const riepilogo = computed(() => ({
  scartate: invii.value.filter((i) => ['scartata', 'errore-invio'].includes(i.stato)).length,
  attesa: invii.value.filter(inAttesaLunga).length,
  accettate: invii.value.filter((i) => i.stato === 'accettata').length,
}));

const ETICHETTE = {
  accettata: ['Accettata', 'ok'],
  scartata: ['Scartata da SDI', 'ko'],
  'errore-invio': ['Invio non riuscito', 'ko'],
  'in-attesa': ['In attesa di SDI', 'wait'],
};

// Tre tappe: invio PEC, prima risposta SDI, esito finale.
function tappe(i) {
  const prima = i.ricevute[0];
  const esito = { accettata: ['ok', 'Accettata'], scartata: ['ko', 'Scartata'] }[i.stato];
  return [
    { stato: i.stato === 'errore-invio' ? 'ko' : 'ok', nome: i.stato === 'errore-invio' ? 'Invio fallito' : 'Inviata', data: i.dataInvio },
    { stato: prima ? 'ok' : (i.stato === 'in-attesa' ? 'now' : ''), nome: 'Risposta SDI', data: prima?.data },
    { stato: esito?.[0] ?? '', nome: esito?.[1] ?? 'Esito', data: esito ? i.ricevute.at(-1)?.data : null },
  ];
}
const errori = (i) => i.ricevute.flatMap((r) => r.errori ?? []);
const linkFattura = (i) => ({ path: '/fattura', query: { anno: i.anno, mese: i.mese, cliente: i.clienteId } });

function formatta(data) {
  return new Date(data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Cronologia PEC</h1><p>Invii SDI e relative ricevute, una scheda per fattura</p></div>
    </div>

    <p v-if="caricamento" class="note-legal">Caricamento…</p>
    <template v-else>
      <div class="cp-riepilogo">
        <div class="ko"><b>{{ riepilogo.scartate }}</b><span>Scartate, da correggere</span></div>
        <div class="wait"><b>{{ riepilogo.attesa }}</b><span>In attesa da oltre 48 ore</span></div>
        <div class="ok"><b>{{ riepilogo.accettate }}</b><span>Accettate</span></div>
      </div>

      <template v-if="daRisolvere.length">
        <h2 class="cp-titolo">Da risolvere</h2>
        <div class="cp-lista">
          <article v-for="i in daRisolvere" :key="`${i.clienteId}-${i.progressivoInvio}`" class="card cp-scheda" :class="ETICHETTE[i.stato][1]">
            <div class="cp-top">
              <strong>Fattura {{ i.mese }}/{{ i.anno }} · progr. {{ i.progressivoInvio }}</strong>
              <span class="cp-stato" :class="ETICHETTE[i.stato][1]">{{ inAttesaLunga(i) ? 'Nessuna ricevuta da oltre 48 ore' : ETICHETTE[i.stato][0] }}</span>
            </div>
            <ol class="cp-tappe">
              <li v-for="t in tappe(i)" :key="t.nome" :class="t.stato">
                <i></i><b>{{ t.nome }}</b><span>{{ t.data ? formatta(t.data) : '' }}</span>
              </li>
            </ol>
            <details v-if="i.tentativiPrecedenti.length" class="cp-tentativi">
              <summary>{{ i.tentativiPrecedenti.length }} {{ i.tentativiPrecedenti.length === 1 ? 'tentativo precedente' : 'tentativi precedenti' }}</summary>
              <ul>
                <li v-for="t in i.tentativiPrecedenti" :key="t.progressivoInvio" :class="ETICHETTE[t.stato][1]">
                  <span>Progr. {{ t.progressivoInvio }} · {{ ETICHETTE[t.stato][0] }}</span>
                  <span class="badge-mono">{{ formatta(t.dataInvio) }}</span>
                </li>
              </ul>
            </details>
            <div v-if="i.errore" class="cp-errore"><span>{{ i.errore }}</span></div>
            <div v-for="(e, n) in errori(i)" :key="n" class="cp-errore">
              <span><strong>{{ e.codice }}</strong> — {{ e.descrizione }}</span>
              <span v-if="e.dettaglio" class="sub">{{ e.dettaglio }}</span>
              <span v-else-if="e.suggerimento" class="sub">{{ e.suggerimento }}</span>
            </div>
            <div><router-link :to="linkFattura(i)" class="btn btn-blue">Apri fattura</router-link></div>
          </article>
        </div>
      </template>

      <details class="cp-archivio" :open="!stretto">
        <summary>Archivio · {{ archivio.length }} invii</summary>
      <div v-if="archivioPagina.length" class="cp-lista">
        <article v-for="i in archivioPagina" :key="`${i.clienteId}-${i.progressivoInvio}`" class="card cp-scheda cp-compatta">
          <div class="cp-top">
            <strong>Fattura {{ i.mese }}/{{ i.anno }} · progr. {{ i.progressivoInvio }}</strong>
            <span class="cp-stato" :class="ETICHETTE[i.stato][1]">{{ ETICHETTE[i.stato][0] }}</span>
          </div>
          <ol class="cp-tappe">
            <li v-for="t in tappe(i)" :key="t.nome" :class="t.stato">
              <i></i><b>{{ t.nome }}</b><span>{{ t.data ? formatta(t.data) : '' }}</span>
            </li>
          </ol>
          <details v-if="i.tentativiPrecedenti.length" class="cp-tentativi cp-solo-largo">
            <summary>{{ i.tentativiPrecedenti.length }} {{ i.tentativiPrecedenti.length === 1 ? 'tentativo precedente' : 'tentativi precedenti' }}</summary>
            <ul>
              <li v-for="t in i.tentativiPrecedenti" :key="t.progressivoInvio" :class="ETICHETTE[t.stato][1]">
                <span>Progr. {{ t.progressivoInvio }} · {{ ETICHETTE[t.stato][0] }}</span>
                <span class="badge-mono">{{ formatta(t.dataInvio) }}</span>
              </li>
            </ul>
          </details>
        </article>
      </div>
      <p v-else class="note-legal" style="opacity:.5">
        Nessun invio PEC in archivio.
        <template v-if="capacita.cartellaLibera">Configura la cartella archivio in Impostazioni &gt; PEC per vedere le ricevute.</template>
      </p>

      <div v-if="pagine > 1" class="cp-pagine">
        <button class="btn btn-blue" :disabled="pagina === 1" @click="pagina--">Precedente</button>
        <span class="badge-mono">Pagina {{ pagina }} di {{ pagine }}</span>
        <button class="btn btn-blue" :disabled="pagina === pagine" @click="pagina++">Successiva</button>
      </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.cp-riepilogo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.cp-riepilogo div { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 10px 14px; display: flex; flex-direction: column; }
.cp-riepilogo b { font-size: 1.5rem; line-height: 1.1; }
.cp-riepilogo span { font-size: var(--font-size-xs); color: var(--muted); }
.cp-riepilogo .ko b { color: var(--warn); }
.cp-riepilogo .wait b { color: var(--accent); }
.cp-riepilogo .ok b { color: var(--ok); }
.cp-archivio > summary { cursor: pointer; font-size: 1rem; font-weight: 600; margin: 18px 0 8px; }
.cp-titolo { font-size: 1rem; margin: 18px 0 8px; }
.cp-lista { display: flex; flex-direction: column; gap: 10px; }
.cp-scheda { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; border-left: 4px solid var(--line); }
.cp-scheda.ko { border-left-color: var(--warn); }
.cp-scheda.wait { border-left-color: var(--accent); }
.cp-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.cp-stato { font-size: var(--font-size-xs); font-weight: 600; padding: 2px 9px; border-radius: var(--radius-pill); background: var(--ground); color: var(--ink-soft); }
.cp-stato.ok { background: var(--ok-bg); color: var(--ok); }
.cp-stato.ko { background: var(--warn-bg); color: var(--warn); }
.cp-stato.wait { background: var(--btn-primary-bg); color: var(--btn-primary-ink); }
.cp-tappe { list-style: none; margin: 0; padding: 0; display: flex; }
.cp-tappe li { flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; font-size: var(--font-size-xs); color: var(--muted); }
.cp-tappe li::before { content: ''; position: absolute; top: 9px; left: -50%; width: 100%; height: 2px; background: var(--line); }
.cp-tappe li:first-child::before { display: none; }
.cp-tappe i { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--line); background: var(--card); z-index: 1; }
.cp-tappe b { font-weight: 600; }
.cp-tappe .ok { color: var(--ink); }
.cp-tappe .ok i { background: var(--ok); border-color: var(--ok); }
.cp-tappe .ok::before { background: var(--ok); }
.cp-tappe .ko { color: var(--warn); }
.cp-tappe .ko i { background: var(--warn); border-color: var(--warn); }
.cp-tappe .ko::before { background: var(--warn); }
.cp-tappe .now i { border-color: var(--accent); }
.cp-tappe .now::before { background: var(--ok); }
.cp-errore { background: var(--warn-bg); border: 1px solid var(--warn); border-radius: var(--radius-sm); padding: 8px 10px; font-size: var(--font-size-xs); display: flex; flex-direction: column; gap: 3px; color: var(--ink); }
.cp-errore .sub { opacity: .8; }
.cp-tentativi summary { cursor: pointer; font-size: var(--font-size-xs); color: var(--ink-soft); }
.cp-tentativi ul { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: var(--font-size-xs); }
.cp-tentativi li { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border-radius: var(--radius-sm); background: var(--ground); color: var(--ink); }
.cp-tentativi li.ok { background: color-mix(in srgb, var(--ok) 14%, transparent); }
.cp-tentativi li.ko { background: color-mix(in srgb, var(--warn) 14%, transparent); }
.cp-tentativi li.wait { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.cp-tentativi li .badge-mono { background: transparent; border-color: currentColor; color: inherit; }
.cp-pagine { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
@media (max-width: 520px) {
  .cp-riepilogo { grid-template-columns: 1fr; }
  .cp-tappe li span { display: none; }
  .cp-compatta .cp-tappe, .cp-solo-largo { display: none; }
}
</style>
