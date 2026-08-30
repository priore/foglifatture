<script setup>
import { ref } from 'vue';
import StepCliente from './StepCliente.vue';

const props = defineProps({ modelValue: { type: Array, required: true } });

const aperti = ref(new Set([0]));
function toggleAperto(i) {
  aperti.value.has(i) ? aperti.value.delete(i) : aperti.value.add(i);
  aperti.value = new Set(aperti.value);
}

function aggiungiCliente() {
  props.modelValue.push({
    id: crypto.randomUUID(), attivo: true,
    denominazione: '', indirizzo: '', cap: '', comune: '', provincia: '',
    partitaIva: '', codiceDestinatarioSdi: '', logoDataUrl: '', tariffaOraria: 0,
  });
  aperti.value = new Set([props.modelValue.length - 1]);
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
    <div v-for="(cliente, i) in modelValue.filter(c => c.attivo)" :key="cliente.id" class="card" style="margin-bottom:12px">
      <div class="card-head" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" @click="toggleAperto(i)">
        <h3 style="margin:0">{{ cliente.denominazione || 'Nuovo cliente' }}</h3>
        <button type="button" class="btn btn-ghost" @click.stop="disattivaCliente(cliente)">Disattiva</button>
      </div>
      <div class="card-body" v-show="aperti.has(i)">
        <StepCliente v-model="modelValue[modelValue.indexOf(cliente)]" />
        <div class="field" style="margin-top:12px">
          <label>Tariffa oraria (€)</label>
          <input type="number" step="0.01" v-model.number="cliente.tariffaOraria">
        </div>
      </div>
    </div>

    <button type="button" class="btn btn-primary" @click="aggiungiCliente">+ Aggiungi cliente</button>

    <details v-if="modelValue.some(c => !c.attivo)" style="margin-top:20px">
      <summary>Clienti disattivati</summary>
      <div v-for="cliente in modelValue.filter(c => !c.attivo)" :key="cliente.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
        <span>{{ cliente.denominazione || 'Cliente senza nome' }}</span>
        <button type="button" class="btn btn-ghost" @click="riattivaCliente(cliente)">Riattiva</button>
      </div>
    </details>
  </div>
</template>
