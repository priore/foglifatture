<script setup>
import { ref, computed } from 'vue';
import StepCliente from './StepCliente.vue';
import TemplateGrid from './TemplateGrid.vue';

const props = defineProps({ modelValue: { type: Array, required: true } });
const emit = defineEmits(['salva-subito']);

const ricerca = ref('');
const clientiFiltrati = computed(() => {
  const q = ricerca.value.trim().toLowerCase();
  const attivi = props.modelValue.filter((c) => c.attivo);
  if (!q) return attivi;
  return attivi.filter((c) => (c.denominazione || '').toLowerCase().includes(q));
});

// Tracciato per id cliente, non per indice posizionale: con la ricerca attiva l'indice
// nell'elenco filtrato cambia a ogni digitazione, un Set di indici aprirebbe/chiuderebbe
// pannelli sbagliati.
const aperti = ref(new Set(props.modelValue[0] ? [props.modelValue[0].id] : []));
function toggleAperto(id) {
  aperti.value.has(id) ? aperti.value.delete(id) : aperti.value.add(id);
  aperti.value = new Set(aperti.value);
}

function aggiungiCliente() {
  const nuovo = {
    id: crypto.randomUUID(), attivo: true,
    denominazione: '', indirizzo: '', cap: '', comune: '', provincia: '',
    partitaIva: '', codiceDestinatarioSdi: '', logoDataUrl: '', tariffaOraria: 0, email: '',
    figura: '', commessa: '', clientePdf: '', progetto: '',
  };
  props.modelValue.push(nuovo);
  ricerca.value = '';
  aperti.value = new Set([nuovo.id]);
}

// Cancellazione logica (attivo:false), mai rimozione dall'array: le fatture/timesheet
// storici del cliente restano risolvibili. Doppia conferma perché è comunque un'azione
// che toglie il cliente da tutti i selettori attivi dell'app.
function disattivaCliente(cliente) {
  if (props.modelValue.filter((c) => c.attivo).length <= 1) {
    alert('Deve restare sempre almeno un cliente attivo.');
    return;
  }
  if (!confirm(`Disattivare "${cliente.denominazione || 'questo cliente'}"? Rimane nello storico ma sparisce dai selettori.`)) return;
  if (!confirm('Confermi? Potrai riattivarlo in qualsiasi momento da "Clienti disattivati".')) return;
  cliente.attivo = false;
}

function riattivaCliente(cliente) {
  cliente.attivo = true;
}
</script>

<template>
  <div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <button type="button" class="btn btn-primary" @click="aggiungiCliente">+ Aggiungi cliente</button>
      <input
        v-if="modelValue.filter(c => c.attivo).length > 1"
        type="search" v-model="ricerca" placeholder="Cerca cliente…"
        class="clienti-cerca-input"
      >
    </div>

    <p v-if="ricerca && !clientiFiltrati.length" class="note-legal">Nessun cliente trovato.</p>

    <div v-for="cliente in clientiFiltrati" :key="cliente.id" class="card" style="margin-bottom:12px">
      <div
        class="card-head" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center"
        role="button" tabindex="0" :aria-expanded="aperti.has(cliente.id)"
        @click="toggleAperto(cliente.id)"
        @keydown.enter="toggleAperto(cliente.id)"
        @keydown.space.prevent="toggleAperto(cliente.id)"
      >
        <h3 style="margin:0">{{ cliente.denominazione || 'Nuovo cliente' }}</h3>
        <button type="button" class="btn btn-ghost" @click.stop="disattivaCliente(cliente)">Disattiva</button>
      </div>
      <div class="card-body" v-show="aperti.has(cliente.id)">
        <StepCliente v-model="modelValue[modelValue.indexOf(cliente)]" />
        <div class="field" style="margin-top:12px">
          <label>Tariffa oraria (€)</label>
          <input type="number" step="0.01" v-model.number="cliente.tariffaOraria">
        </div>
        <div class="field" style="margin-top:12px">
          <label>Email cliente</label>
          <input type="text" v-model="cliente.email" placeholder="destinatario1@esempio.it, destinatario2@esempio.it">
          <small class="note-legal">Una o più email separate da virgola, usate per l'invio di timesheet e fattura via app di posta.</small>
        </div>
        <div style="display:flex;gap:20px;margin-top:12px">
          <div class="field" style="flex:1">
            <label>Template fattura</label>
            <TemplateGrid v-model="cliente.templateFatturaId" tipo="fattura" fallback-id="fattura-default" @update:model-value="emit('salva-subito')" />
          </div>
          <div class="field" style="flex:1">
            <label>Template timesheet</label>
            <TemplateGrid v-model="cliente.templateTimesheetId" tipo="timesheet" fallback-id="timesheet-default" @update:model-value="emit('salva-subito')" />
          </div>
        </div>
      </div>
    </div>

    <details v-if="modelValue.some(c => !c.attivo)" style="margin-top:20px">
      <summary>Clienti disattivati</summary>
      <div v-for="cliente in modelValue.filter(c => !c.attivo)" :key="cliente.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
        <span>{{ cliente.denominazione || 'Cliente senza nome' }}</span>
        <button type="button" class="btn btn-ghost" @click="riattivaCliente(cliente)">Riattiva</button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.clienti-cerca-input {
  flex: 1; border: 1px solid var(--line); border-radius: var(--radius-md);
  padding: 9px 11px; font-size: var(--font-size-base); background: var(--ground); color: var(--ink);
}
</style>
