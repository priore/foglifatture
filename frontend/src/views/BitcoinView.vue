<script setup>
// Vista Bitcoin: registro movimenti BTC (FP-012) e import transazioni (FP-014), cioè le azioni
// che modificano i dati. La dashboard (tab Bitcoin) resta la sola visualizzazione.
import { ref } from 'vue';
import BtcRegistro from '../components/BtcRegistro.vue';
import BtcImport from '../components/BtcImport.vue';
import BtcValoreLive from '../components/BtcValoreLive.vue';

const anni = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const annoSelezionato = ref(new Date().getFullYear());
const versioneRegistro = ref(0); // cambia quando una proposta confermata aggiunge movimenti
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Bitcoin</h1><p>Registro movimenti, plusvalenze e import delle transazioni</p></div>
      <div class="page-head-actions">
        <router-link to="/dashboard" class="btn btn-ghost">Riepilogo in dashboard</router-link>
        <select v-model.number="annoSelezionato" class="status" aria-label="Anno">
          <option v-for="a in anni" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-titolo"><h2>Valore BTC</h2></span></div>
      <div class="card-body"><BtcValoreLive /></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-titolo"><h2>Registro BTC</h2></span></div>
      <div class="card-body"><BtcRegistro :key="versioneRegistro" :anno="annoSelezionato" /></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-titolo"><h2>Importa BTC</h2></span></div>
      <div class="card-body"><BtcImport @cambiato="versioneRegistro++" /></div>
    </div>
  </div>
</template>
