<script setup>
// Griglia editabile del timesheet: un input per ciascun orario, select per lo stato
// giornaliero, note libere. Gli orari sono sempre editabili; uno stato di assenza
// esplicita (Malattia, Ferie, ...) azzera comunque il conteggio ore per quel giorno.
import { computed } from 'vue';
import { STATI_ASSENZA, calcolaOreGiorno, calcolaTotaleMensile, decimaleAHHmm } from '../../composables/useTimeCalculator.js';

const props = defineProps({
  giorni: { type: Array, required: true },
});

function abbreviaGiorno(nomeGiorno) {
  return nomeGiorno.slice(0, 3);
}

function isWeekend(nomeGiorno) {
  return nomeGiorno === 'Sabato' || nomeGiorno === 'Domenica';
}

// Svuota completamente un giorno: orari, note e stato tornano vuoti.
function svuotaGiorno(giorno) {
  giorno.inizioMattina = '';
  giorno.fineMattina = '';
  giorno.inizioPomeriggio = '';
  giorno.finePomeriggio = '';
  giorno.stato = '';
  giorno.note = '';
}

const totaleMensile = computed(() => calcolaTotaleMensile(props.giorni));
</script>

<template>
  <div style="overflow-x:auto">
    <table class="data-table">
      <thead>
        <tr>
          <th>Giorno</th><th>Data</th><th>Inizio matt.</th><th>Fine matt.</th>
          <th>Inizio pom.</th><th>Fine pom.</th><th>Ore</th><th>Stato</th><th>Note</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="giorno in giorni" :key="giorno.giorno" :class="{ weekend: isWeekend(giorno.nomeGiorno) }">
          <td>{{ abbreviaGiorno(giorno.nomeGiorno) }}</td>
          <td>{{ String(giorno.giorno).padStart(2, '0') }}</td>
          <td><input class="time-input" v-model="giorno.inizioMattina" placeholder="--:--"></td>
          <td><input class="time-input" v-model="giorno.fineMattina" placeholder="--:--"></td>
          <td><input class="time-input" v-model="giorno.inizioPomeriggio" placeholder="--:--"></td>
          <td><input class="time-input" v-model="giorno.finePomeriggio" placeholder="--:--"></td>
          <td>{{ calcolaOreGiorno(giorno).toFixed(1) }}</td>
          <td>
            <select class="status" v-model="giorno.stato">
              <option value=""></option>
              <option v-for="stato in STATI_ASSENZA" :key="stato" :value="stato">{{ stato }}</option>
            </select>
          </td>
          <td><input class="note" v-model="giorno.note" placeholder="Nota…"></td>
          <td>
            <button type="button" class="btn btn-ghost" title="Svuota giorno" style="padding:4px 8px" @click="svuotaGiorno(giorno)">✕</button>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6">Totale ore lavorate</td>
          <td>{{ totaleMensile.toFixed(1) }}</td>
          <td colspan="3">{{ decimaleAHHmm(totaleMensile) }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
