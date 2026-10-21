<script setup>
// Quadro RW (Redditi PF, Fascicolo 2) per le cripto-attività, con la stessa griglia di colonne del modello
// ufficiale: ogni casella mostra numero e titolo della colonna e si copia con un clic.
// Istruzioni di riferimento: Redditi PF 2026 Fasc. 2, colonne 1-34 dei righi RW1-RW5 e rigo RW8.
import { ref, computed } from 'vue';

const props = defineProps({ rw: { type: Object, required: true }, anno: { type: Number, required: true } });

const euroIntero = (n) => (n == null ? null : Math.round(n));
const testo = (n) => (n == null ? '' : String(n));
const mostra = (n) => (n == null || n === '' ? '' : new Intl.NumberFormat('it-IT').format(Number(n)));

const ivca = computed(() => props.rw.ivca);
const mancaFine = computed(() => !!ivca.value?.mancaValoreMercato);
const conRt = computed(() => (props.rw.plusvalenze?.cessioni?.length ?? 0) > 0);

// Un solo rigo aggregato (ammesso dalle istruzioni per beni omogenei): valori complessivi, giorni in media ponderata.
const imposta = computed(() => (mancaFine.value ? null : euroIntero(ivca.value.impostaLorda)));
const rigo = computed(() => [
  { n: 1, titolo: 'Codice titolo possesso', v: '1', nota: '1 = proprietà' },
  { n: 2, titolo: 'Tipo contribuente', v: '' },
  { n: 3, titolo: 'Codice individuazione bene', v: '21', nota: '21 = cripto-attività' },
  { n: 4, titolo: 'Codice Stato estero', v: '', nota: 'non obbligatorio per le valute virtuali' },
  { n: 5, titolo: 'Quota di possesso', v: '100', nota: '%' },
  { n: 6, titolo: 'Criterio determin. valore', v: '1', nota: '1 = valore di mercato' },
  { n: 7, titolo: 'Valore iniziale', v: testo(euroIntero(ivca.value.valoreInizio)), euro: true, mancante: ivca.value.valoreInizio == null },
  { n: 8, titolo: 'Valore finale', v: testo(euroIntero(mancaFine.value ? null : ivca.value.valoreFine)), euro: true, mancante: mancaFine.value },
  { n: 9, titolo: 'Valore massimo c/c paesi non collaborativi', v: '' },
  { n: 10, titolo: 'Giorni IVAFE-IC', v: testo(ivca.value.giorniTotaliPonderati), nota: 'media ponderata' },
  { n: 11, titolo: 'Mesi IVIE', v: '' },
  { n: 12, titolo: 'Credito d\'imposta', v: '' },
  { n: 13, titolo: 'Detrazioni IVIE', v: '' },
  { n: 14, titolo: 'Codice', v: conRt.value ? '3' : '5', nota: conRt.value ? '3 = compilazione quadro RT' : '5 = infruttifero' },
  { n: 15, titolo: 'Quota partecipazione', v: '' },
  { n: 16, titolo: 'Solo monitoraggio', v: '', nota: 'non barrare' },
]);
const rigoImposta = computed(() => [
  { n: 29, titolo: 'IVAFE', v: '' },
  { n: 30, titolo: 'IVAFE dovuta', v: '' },
  { n: 31, titolo: 'IVIE', v: '' },
  { n: 32, titolo: 'IVIE dovuta', v: '' },
  { n: 33, titolo: 'IC', v: testo(imposta.value), euro: true, mancante: mancaFine.value, nota: '0,20%' },
  { n: 34, titolo: 'IC dovuta', v: testo(imposta.value), euro: true, mancante: mancaFine.value },
]);

// RW8: col. 5 = col. 1 - col. 2 + col. 3 - col. 4 se positiva, altrimenti col. 6.
const rw8 = computed(() => {
  const r = props.rw.rw8;
  if (!r || mancaFine.value) return null;
  const c1 = euroIntero(ivca.value.impostaLorda), c2 = euroIntero(r.eccedenzaAnnoPrec), c3 = euroIntero(r.compensataF24), c4 = euroIntero(r.accontiVersati);
  const risultato = c1 - c2 + c3 - c4;
  return [
    { n: 1, titolo: 'Totale imposta dovuta', v: testo(c1), euro: true },
    { n: 2, titolo: 'Eccedenza dichiarazione precedente', v: testo(c2), euro: true },
    { n: 3, titolo: 'Eccedenza compensata Mod. F24', v: testo(c3), euro: true },
    { n: 4, titolo: 'Acconti versati', v: testo(c4), euro: true },
    { n: 5, titolo: 'Imposta a debito', v: testo(Math.max(0, risultato)), euro: true, nota: risultato > 0 && risultato <= 12 ? 'non si versa (≤ 12 €)' : '' },
    { n: 6, titolo: 'Imposta a credito', v: testo(Math.max(0, -risultato)), euro: true },
  ];
});

const copiata = ref('');
let timer;
async function copia(chiave, valore) {
  try {
    await navigator.clipboard.writeText(valore);
    copiata.value = chiave;
    clearTimeout(timer);
    timer = setTimeout(() => { copiata.value = ''; }, 1200);
  } catch { /* appunti non disponibili: il valore resta leggibile nella casella */ }
}
</script>

<template>
  <div class="rw-quadro">
    <div class="rw-intestazione">
      <span>Investimenti all'estero e/o attività estere di natura finanziaria · IVIE / IVAFE / Imposta cripto-attività</span>
      <span class="rw-periodo">Redditi PF {{ anno + 1 }} · Periodo d'imposta {{ anno }}</span>
    </div>

    <div class="rw-sezione">
      <div class="rw-nome-rigo">RW1</div>
      <div class="rw-righe">
        <div class="rw-riga rw-riga-8">
          <template v-for="c in rigo.slice(0, 8)" :key="c.n">
            <button v-if="c.v !== ''" type="button" class="rw-casella" :class="{ 'rw-copiata': copiata === 'r' + c.n }" :title="c.nota" @click="copia('r' + c.n, c.v)">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span>
              <span class="rw-valore">{{ c.euro ? mostra(c.v) : c.v }}<small v-if="c.euro">,00</small></span>
              <span v-if="copiata === 'r' + c.n" class="rw-esito">Copiato</span>
            </button>
            <div v-else class="rw-casella rw-vuota" :title="c.mancante ? 'Valore mancante' : c.nota">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span><span class="rw-valore">{{ c.mancante ? '?' : '' }}</span>
            </div>
          </template>
        </div>
        <div class="rw-riga rw-riga-8">
          <template v-for="c in rigo.slice(8)" :key="c.n">
            <button v-if="c.v !== ''" type="button" class="rw-casella" :class="{ 'rw-copiata': copiata === 'r' + c.n }" :title="c.nota" @click="copia('r' + c.n, c.v)">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span>
              <span class="rw-valore">{{ c.v }}</span>
              <span v-if="copiata === 'r' + c.n" class="rw-esito">Copiato</span>
            </button>
            <div v-else class="rw-casella rw-vuota" :title="c.nota">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span><span class="rw-valore" />
            </div>
          </template>
        </div>
        <div class="rw-riga rw-riga-6">
          <template v-for="c in rigoImposta" :key="c.n">
            <button v-if="c.v !== ''" type="button" class="rw-casella" :class="{ 'rw-copiata': copiata === 'r' + c.n }" :title="c.nota" @click="copia('r' + c.n, c.v)">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span>
              <span class="rw-valore">{{ mostra(c.v) }}<small>,00</small></span>
              <span v-if="copiata === 'r' + c.n" class="rw-esito">Copiato</span>
            </button>
            <div v-else class="rw-casella rw-vuota" :title="c.mancante ? 'Valore mancante' : c.nota">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span><span class="rw-valore">{{ c.mancante ? '?' : '' }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="rw8" class="rw-sezione">
      <div class="rw-nome-rigo">RW8<small>Imposta cripto-attività</small></div>
      <div class="rw-righe">
        <div class="rw-riga rw-riga-6">
          <template v-for="c in rw8" :key="c.n">
            <button type="button" class="rw-casella" :class="{ 'rw-copiata': copiata === 'o' + c.n }" :title="c.nota" @click="copia('o' + c.n, c.v)">
              <span class="rw-col">{{ c.n }}</span><span class="rw-titolo">{{ c.titolo }}</span>
              <span class="rw-valore">{{ mostra(c.v) }}<small>,00</small></span>
              <span v-if="copiata === 'o' + c.n" class="rw-esito">Copiato</span>
              <span v-else-if="c.nota" class="rw-nota">{{ c.nota }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <p class="rw-legenda">Clicca una casella per copiarne il valore. Importi in euro interi come da modello; le caselle vuote vanno lasciate vuote.</p>
  </div>
</template>

<style scoped>
.rw-quadro { display: flex; flex-direction: column; gap: 12px; container-type: inline-size; }
.rw-intestazione { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 8px 12px; background: var(--cyan-soft); color: var(--cyan-soft-ink); border-radius: var(--radius-md); font-size: var(--font-size-xs); }
.rw-intestazione strong { font-size: var(--font-size-md); letter-spacing: .04em; }
.rw-periodo { margin-left: auto; }
.rw-sezione { display: flex; gap: 10px; align-items: stretch; border: 1px solid color-mix(in srgb, var(--cyan-soft-ink) 30%, var(--line)); border-radius: var(--radius-md); background: color-mix(in srgb, var(--cyan-soft) 22%, var(--ground)); padding: 8px; }
.rw-nome-rigo { border: 1px solid color-mix(in srgb, var(--cyan-soft-ink) 35%, var(--cyan-soft)); display: flex; flex-direction: column; justify-content: center; align-items: center; min-width: 46px; font-weight: 700; color: var(--cyan-soft-ink); background: var(--cyan-soft); border-radius: var(--radius-sm); padding: 4px 6px; text-align: center; }
.rw-nome-rigo small { font-weight: 500; font-size: var(--font-size-2xs); }
.rw-righe { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rw-riga { display: grid; gap: 6px; }
.rw-riga-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
.rw-riga-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.rw-casella { position: relative; display: flex; flex-direction: column; gap: 2px; min-height: 66px; padding: 6px 8px; text-align: left; font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); }
button.rw-casella { cursor: pointer; background: color-mix(in srgb, var(--cyan-soft) 45%, var(--card)); border-color: color-mix(in srgb, var(--cyan-soft-ink) 55%, var(--line)); }
button.rw-casella .rw-titolo { color: var(--ink-soft); }
button.rw-casella:hover, button.rw-casella:focus-visible { border-color: var(--cyan-soft-ink); box-shadow: var(--shadow); }
.rw-vuota { background: transparent; border-style: dashed; border-color: color-mix(in srgb, var(--muted) 55%, transparent); color: var(--muted); }
.rw-col { font-size: var(--font-size-2xs); font-weight: 700; color: var(--cyan-soft-ink); background: var(--cyan-soft); border-radius: var(--radius-pill); align-self: flex-start; padding: 0 6px; }
.rw-titolo { font-size: var(--font-size-2xs); color: var(--muted); line-height: 1.2; overflow-wrap: anywhere; hyphens: auto; }
.rw-valore { margin-top: auto; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: var(--font-size-base); font-weight: 600; text-align: right; white-space: nowrap; color: var(--cyan-soft-ink); }
.rw-valore small { color: var(--ink-soft); font-weight: 400; }
.rw-nota { font-size: var(--font-size-2xs); color: var(--muted); text-align: right; }
.rw-esito { font-size: var(--font-size-2xs); font-weight: 600; color: var(--ok); text-align: right; }
button.rw-copiata { background: var(--ok-bg); border-color: var(--ok); }
.rw-legenda { margin: 0; font-size: var(--font-size-2xs); color: var(--muted); }
@container (max-width: 760px) {
  .rw-riga-8 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .rw-riga-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rw-sezione { flex-direction: column; }
  .rw-nome-rigo { flex-direction: row; gap: 8px; min-height: 32px; }
}
</style>
