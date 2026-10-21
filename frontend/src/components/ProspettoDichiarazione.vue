<script setup>
// K3: valori rigo per rigo da riportare nel modello Redditi PF (quadri LM, RR, RX31), con la stessa
// griglia a caselle del quadro RW cripto: clic su una casella per copiarne il valore.
import { ref, computed } from 'vue';

const props = defineProps({ prospetto: { type: Object, required: true } });

const copiata = ref('');
let timer;

// Colonne non monetarie: codice attività, coefficiente, forma di esercizio, codice aliquota.
const NON_EURO = new Set(['LM22.1', 'LM22.2', 'LM22.6', 'RR5.14']);
const mostra = (n) => new Intl.NumberFormat('it-IT').format(Number(n));

// Una sezione per rigo (LM22, LM34, ...), le caselle sono le colonne.
const sezioni = computed(() => {
  const per = new Map();
  // Le caselle a 0 non si mostrano (il modello le vuole vuote); i valori null sono quelli che l'app
  // non conosce e restano visibili tratteggiati, da compilare a mano.
  for (const r of props.prospetto.righe.filter((x) => x.valore !== 0)) {
    const [nome, col] = r.rigo.split('.');
    if (!per.has(nome)) per.set(nome, []);
    per.get(nome).push({ ...r, col, euro: !NON_EURO.has(r.rigo) });
  }
  return [...per].map(([nome, caselle]) => ({ nome, caselle }));
});

async function copia(c) {
  try {
    await navigator.clipboard.writeText(String(c.valore));
    copiata.value = c.rigo;
    clearTimeout(timer);
    timer = setTimeout(() => { copiata.value = ''; }, 1200);
  } catch { /* appunti non disponibili: il valore resta leggibile nella casella */ }
}
</script>

<template>
  <div class="pd-quadro">
    <div class="pd-intestazione">
      <span>Regime forfetario · Quadri LM, RR e rigo RX31</span>
      <span class="pd-periodo">{{ prospetto.modello }} · Periodo d'imposta {{ prospetto.annoImposta }}</span>
    </div>

    <div class="pd-sezioni">
    <div v-for="s in sezioni" :key="s.nome" class="pd-sezione" :class="{ 'pd-larga': s.caselle.length > 2 }">
      <div class="pd-nome-rigo">{{ s.nome }}</div>
      <div class="pd-riga">
        <template v-for="c in s.caselle" :key="c.rigo">
          <button v-if="c.valore !== null" type="button" class="pd-casella" :class="{ 'pd-copiata': copiata === c.rigo }" @click="copia(c)">
            <span v-if="c.col" class="pd-col">{{ c.col }}</span><span class="pd-titolo">{{ c.etichetta }}</span>
            <span class="pd-valore">{{ c.euro ? mostra(c.valore) : c.valore }}<small v-if="c.euro">,00</small></span>
            <span v-if="copiata === c.rigo" class="pd-esito">Copiato</span>
          </button>
          <div v-else class="pd-casella pd-controlla" title="Dato non tracciato dall'app: da controllare e compilare a mano (vedi nota (*) sotto)">
            <span v-if="c.col" class="pd-col">{{ c.col }}</span><span class="pd-titolo">{{ c.etichetta }}</span><span class="pd-valore">da controllare (*)</span>
          </div>
        </template>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Stessa resa del quadro RW cripto (QuadroRwCripto.vue). */
.pd-quadro { display: flex; flex-direction: column; gap: 12px; container-type: inline-size; }
.pd-intestazione { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 8px 12px; background: var(--cyan-soft); color: var(--cyan-soft-ink); border-radius: var(--radius-md); font-size: var(--font-size-xs); }
.pd-periodo { margin-left: auto; }
.pd-sezioni { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 12px; }
.pd-larga { grid-column: 1 / -1; }
.pd-sezione { display: flex; gap: 10px; align-items: stretch; border: 1px solid color-mix(in srgb, var(--cyan-soft-ink) 30%, var(--line)); border-radius: var(--radius-md); background: color-mix(in srgb, var(--cyan-soft) 22%, var(--ground)); padding: 8px; }
.pd-nome-rigo { border: 1px solid color-mix(in srgb, var(--cyan-soft-ink) 35%, var(--cyan-soft)); display: flex; justify-content: center; align-items: center; min-width: 56px; font-weight: 700; color: var(--cyan-soft-ink); background: var(--cyan-soft); border-radius: var(--radius-sm); padding: 4px 6px; text-align: center; }
.pd-riga { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; min-width: 0; }
.pd-casella { position: relative; display: flex; flex-direction: column; gap: 2px; min-height: 66px; padding: 6px 8px; text-align: left; font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); }
button.pd-casella { cursor: pointer; background: color-mix(in srgb, var(--cyan-soft) 45%, var(--card)); border-color: color-mix(in srgb, var(--cyan-soft-ink) 55%, var(--line)); }
button.pd-casella .pd-titolo { color: var(--ink-soft); }
button.pd-casella:hover, button.pd-casella:focus-visible { border-color: var(--cyan-soft-ink); box-shadow: var(--shadow); }
.pd-controlla { background: var(--warn-bg); border: 1px dashed var(--warn); color: var(--warn); }
.pd-controlla .pd-titolo { color: var(--ink-soft); }
.pd-controlla .pd-valore { font-family: inherit; font-size: var(--font-size-xs); color: var(--warn); }
.pd-vuota { background: transparent; border-style: dashed; border-color: color-mix(in srgb, var(--muted) 55%, transparent); color: var(--muted); }
.pd-col { font-size: var(--font-size-2xs); font-weight: 700; color: var(--cyan-soft-ink); background: var(--cyan-soft); border-radius: var(--radius-pill); align-self: flex-start; padding: 0 6px; }
.pd-titolo { font-size: var(--font-size-2xs); color: var(--muted); line-height: 1.2; overflow-wrap: anywhere; hyphens: auto; }
.pd-valore { margin-top: auto; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: var(--font-size-base); font-weight: 600; text-align: right; white-space: nowrap; color: var(--cyan-soft-ink); }
.pd-valore small { color: var(--ink-soft); font-weight: 400; }
.pd-esito { font-size: var(--font-size-2xs); font-weight: 600; color: var(--ok); text-align: right; }
button.pd-copiata { background: var(--ok-bg); border-color: var(--ok); }
@container (max-width: 560px) {
  .pd-sezione { flex-direction: column; }
  .pd-nome-rigo { min-height: 32px; }
}
</style>
