<script setup>
// Selettore template (fattura o timesheet): mostra solo il template assegnato al
// cliente; tap su di esso apre la lista di tutti i template disponibili per cambiarlo
// (o annullare). Thumbnail renderizzata dal motore Handlebars su dati d'esempio.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import TemplateStampa from '../common/TemplateStampa.vue';
import { api } from '../../services/api.js';
import { preparaDatiFattura, preparaDatiTimesheet } from '../../composables/useTemplateData.js';

const props = defineProps({
  modelValue: { type: String, default: null }, // id template selezionato, null = fallback
  tipo: { type: String, required: true }, // 'fattura' | 'timesheet'
  fallbackId: { type: String, required: true },
});
const emit = defineEmits(['update:modelValue']);

const templates = ref([]);
const ricerca = ref('');
const selezioneAperta = ref(false);

const DATI_ESEMPIO_FATTURA = preparaDatiFattura({
  fornitore: { denominazione: 'Studio Esempio Srl', indirizzo: 'Via Roma', numeroCivico: '1', cap: '00100', comune: 'Roma', provincia: 'RM', partitaIva: '12345678901', codiceFiscale: 'RSSMRA80A01H501U', logoDataUrl: '' },
  cliente: { denominazione: 'Cliente Esempio SpA', indirizzo: 'Via Milano 10', cap: '20100', comune: 'Milano', provincia: 'MI', partitaIva: '98765432109' },
  numero: '1/2026', data: '2026-01-15', descrizione: 'Servizi di consulenza per un totale di 160,00 ore mensili.',
  imponibile: 2000, bollo: 2, bolloApplicabile: true, nettoAPagare: 2000,
});
const DATI_ESEMPIO_TIMESHEET = preparaDatiTimesheet({
  anno: 2026, mese: 1, consulente: 'Mario Rossi', localita: 'Roma', logoDataUrl: '',
  figura: 'Consulente', commessa: 'MRO001', cliente: 'Cliente Esempio', progetto: 'Progetto Alfa',
  giorni: Array.from({ length: 10 }, (_, i) => ({
    giorno: i + 1, nomeGiorno: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][i % 7],
    inizioMattina: '09:00', fineMattina: '13:00', inizioPomeriggio: '14:00', finePomeriggio: '18:00',
    stato: '', note: '',
  })),
});

const datiEsempio = props.tipo === 'fattura' ? DATI_ESEMPIO_FATTURA : DATI_ESEMPIO_TIMESHEET;

onMounted(async () => {
  templates.value = await api.listTemplates(props.tipo);
});

const idAssegnato = computed(() => props.modelValue || props.fallbackId);
const templateAssegnato = computed(() => templates.value.find((t) => t.id === idAssegnato.value));

function selezionato(id) {
  return idAssegnato.value === id;
}

function scegli(id) {
  emit('update:modelValue', id === props.fallbackId ? null : id);
  selezioneAperta.value = false;
  ricerca.value = '';
}

// Scala il documento A4 (793.7px largo, alto quanto il rendering reale) al box quadrato
// del thumbnail, usando il lato più vincolante (l'altezza, essendo il documento più alto
// che largo) così l'intera pagina sta dentro il box invece di venire tagliata.
const LARGHEZZA_A4 = 793.7;
function aggiornaScala(el) {
  if (!el) return;
  const iframe = el.querySelector('iframe');
  const altezzaDocumento = iframe ? parseFloat(iframe.style.height) || LARGHEZZA_A4 : LARGHEZZA_A4;
  const box = el.getBoundingClientRect();
  const scala = Math.min(box.width / LARGHEZZA_A4, box.height / altezzaDocumento);
  el.style.setProperty('--scala-thumb', scala);
}
const osservatore = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // Osserva sia il box (cambi di larghezza) sia l'iframe al suo interno (l'altezza si
    // aggiorna async dopo il render del template, con un giro di ritardo rispetto al mount).
    const box = entry.target.matches('iframe') ? entry.target.closest('[data-thumb-box]') : entry.target;
    aggiornaScala(box);
  }
});
onBeforeUnmount(() => osservatore.disconnect());
function osservaBox(el) {
  if (!el) return;
  aggiornaScala(el);
  osservatore.observe(el);
  const iframe = el.querySelector('iframe');
  if (iframe) osservatore.observe(iframe);
}
</script>

<template>
  <div>
    <!-- Chiuso: solo il template assegnato, tap per aprire la scelta -->
    <div
      v-if="!selezioneAperta && templateAssegnato"
      class="card"
      style="cursor:pointer;overflow:hidden;padding:0"
      @click="selezioneAperta = true"
    >
      <div style="padding:8px;font-size:.8rem;display:flex;justify-content:space-between;align-items:center">
        <span>{{ templateAssegnato.nome }}</span>
        <span v-if="templateAssegnato.id === fallbackId" class="badge-mono">default</span>
      </div>
      <div :ref="osservaBox" data-thumb-box style="width:100%;aspect-ratio:210/297;overflow:hidden;position:relative;background:#f4f4f4">
        <div style="position:absolute;top:0;left:0;width:793.7px;transform:scale(var(--scala-thumb));transform-origin:top left;pointer-events:none">
          <TemplateStampa :template-id="templateAssegnato.id" :dati="datiEsempio" :adatta="false" />
        </div>
      </div>
    </div>

    <!-- Aperto: popup con lista di tutti i template del tipo, annulla o click fuori per chiudere -->
    <Teleport to="body">
      <div v-if="selezioneAperta" class="modal-overlay" @click.self="selezioneAperta = false">
        <div class="modal-box" style="max-width:1200px;width:92vw;max-height:92vh;display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex:0 0 auto">
            <h2 style="margin:0">Scegli template</h2>
            <button type="button" class="btn btn-ghost" @click="selezioneAperta = false">Annulla</button>
          </div>
          <input
            v-if="templates.length > 4"
            type="search" v-model="ricerca" placeholder="Cerca template…"
            style="width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:.86rem;background:var(--ground);color:var(--ink);margin-bottom:12px;flex:0 0 auto"
          >
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;overflow-y:auto;overflow-x:hidden;padding-bottom:4px">
            <div
              v-for="t in templates.filter(t => t.nome.toLowerCase().includes(ricerca.trim().toLowerCase()))"
              :key="t.id"
              class="card"
              style="cursor:pointer;overflow:hidden;padding:0"
              :style="{ borderColor: selezionato(t.id) ? 'var(--accent)' : 'var(--line)', borderWidth: selezionato(t.id) ? '2px' : '1px' }"
              @click="scegli(t.id)"
            >
              <div style="padding:8px;font-size:.8rem;display:flex;justify-content:space-between;align-items:center">
                <span>{{ t.nome }}</span>
                <span v-if="t.id === fallbackId" class="badge-mono">default</span>
              </div>
              <div :ref="osservaBox" data-thumb-box style="width:100%;aspect-ratio:210/297;overflow:hidden;position:relative;background:#f4f4f4">
                <div style="position:absolute;top:0;left:0;width:793.7px;transform:scale(var(--scala-thumb));transform-origin:top left;pointer-events:none">
                  <TemplateStampa :template-id="t.id" :dati="datiEsempio" :adatta="false" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
