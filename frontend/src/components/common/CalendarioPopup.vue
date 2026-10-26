<script setup>
// Calendario a popup centrato, condiviso da tutti i campi data (DateField) e dal selettore mese.
// Il valore cambia solo con OK; tap fuori, Esc o Annulla chiudono senza selezione.
// modo "giorno": modelValue "YYYY-MM-DD"; modo "mese": modelValue "YYYY-MM".
import { ref, computed, onMounted, onUnmounted } from 'vue';
const props = defineProps({
  modelValue: { type: String, default: '' },
  modo: { type: String, default: 'giorno' },
  titolo: { type: String, required: true },
  descrizione: { type: String, default: '' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
});
const emit = defineEmits(['conferma', 'chiudi']);

const NOMI_MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const pad = (n) => String(n).padStart(2, '0');

const oggi = new Date();
const chiaveOggi = `${oggi.getFullYear()}-${pad(oggi.getMonth() + 1)}-${pad(oggi.getDate())}`;
const [a0, m0] = (props.modelValue || chiaveOggi).split('-').map(Number);
const anno = ref(a0);
const mese = ref(m0);
const bozza = ref(props.modelValue);
const vista = ref(props.modo === 'mese' ? 'mesi' : 'giorni');

// Limiti confrontati come stringhe ISO, troncate alla lunghezza del valore (mese: YYYY-MM).
const fuoriLimiti = (chiave) => Boolean((props.min && chiave < props.min.slice(0, chiave.length)) || (props.max && chiave > props.max.slice(0, chiave.length)));

const celle = computed(() => {
  const primo = (new Date(anno.value, mese.value - 1, 1).getDay() + 6) % 7; // lunedì = 0
  const giorni = new Date(anno.value, mese.value, 0).getDate();
  return [...Array(primo).fill(null), ...Array.from({ length: giorni }, (_, i) => i + 1)];
});
const chiaveGiorno = (g) => `${anno.value}-${pad(mese.value)}-${pad(g)}`;

function sposta(delta) {
  if (vista.value === 'mesi') { anno.value += delta; return; }
  const d = new Date(anno.value, mese.value - 1 + delta, 1);
  anno.value = d.getFullYear();
  mese.value = d.getMonth() + 1;
}
function scegliMese(m) {
  mese.value = m;
  if (props.modo === 'mese') bozza.value = `${anno.value}-${pad(m)}`;
  else vista.value = 'giorni';
}
function conferma() {
  if (bozza.value) emit('conferma', bozza.value);
}
const alTasto = (e) => { if (e.key === 'Escape') emit('chiudi'); };
onMounted(() => window.addEventListener('keydown', alTasto));
onUnmounted(() => window.removeEventListener('keydown', alTasto));
</script>

<template>
  <Teleport to="body">
    <div class="cal-overlay" @click.self="emit('chiudi')">
      <div class="cal-box" role="dialog" aria-modal="true" :aria-label="titolo">
        <h2 class="cal-titolo">{{ titolo }}</h2>
        <p v-if="descrizione" class="cal-descrizione">{{ descrizione }}</p>

        <div class="cal-nav">
          <button type="button" class="cal-freccia" aria-label="Precedente" @click="sposta(-1)">‹</button>
          <button
            type="button" class="cal-etichetta" :disabled="modo === 'mese'"
            @click="vista = vista === 'giorni' ? 'mesi' : 'giorni'"
          >{{ vista === 'mesi' ? anno : `${NOMI_MESI[mese - 1]} ${anno}` }}</button>
          <button type="button" class="cal-freccia" aria-label="Successivo" @click="sposta(1)">›</button>
        </div>

        <div v-if="vista === 'giorni'" class="cal-griglia">
          <span v-for="g in GIORNI" :key="g" class="cal-intest">{{ g }}</span>
          <template v-for="(g, i) in celle" :key="i">
            <span v-if="!g" />
            <button
              v-else type="button" class="cal-giorno"
              :class="{ selezionato: bozza === chiaveGiorno(g), oggi: chiaveOggi === chiaveGiorno(g) }"
              :disabled="fuoriLimiti(chiaveGiorno(g))"
              @click="bozza = chiaveGiorno(g)"
            >{{ g }}</button>
          </template>
        </div>
        <div v-else class="cal-griglia cal-mesi">
          <button
            v-for="(nome, i) in NOMI_MESI" :key="nome" type="button" class="cal-giorno"
            :class="{ selezionato: bozza === `${anno}-${pad(i + 1)}`, oggi: chiaveOggi.startsWith(`${anno}-${pad(i + 1)}`) }"
            :disabled="fuoriLimiti(`${anno}-${pad(i + 1)}`)"
            @click="scegliMese(i + 1)"
          >{{ nome.slice(0, 3) }}</button>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ok" :disabled="!bozza" @click="conferma">OK</button>
          <button type="button" class="btn btn-warn" @click="emit('chiudi')">Annulla</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
