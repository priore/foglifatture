<script setup>
// Griglia editabile del timesheet: un input per ciascun orario, select per lo stato
// giornaliero, note libere. Gli orari sono sempre editabili; uno stato di assenza
// esplicita (Malattia, Ferie, ...) azzera comunque il conteggio ore per quel giorno.
import { ref, computed } from 'vue';
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

// Inserisce ':' dopo le ore mentre si digita, es. "0900" -> "09:00" in tempo reale.
function formattaOrario(giorno, campo) {
  let valore = giorno[campo].replace(/[^\d:]/g, '');
  if (valore.length >= 2 && !valore.includes(':')) {
    valore = `${valore.slice(0, 2)}:${valore.slice(2, 4)}`;
  }
  giorno[campo] = valore.slice(0, 5);
}

// Appunti copia/incolla: orari, stato e note di un giorno copiati in memoria,
// pronti per essere incollati su un altro giorno.
const appunti = ref(null);

function copiaGiorno(giorno) {
  const { inizioMattina, fineMattina, inizioPomeriggio, finePomeriggio, stato, note } = giorno;
  appunti.value = { inizioMattina, fineMattina, inizioPomeriggio, finePomeriggio, stato, note };
}

function incollaGiorno(giorno) {
  if (!appunti.value) return;
  Object.assign(giorno, appunti.value);
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
          <td><input class="time-input" v-model="giorno.inizioMattina" placeholder="--:--" maxlength="5" @input="formattaOrario(giorno, 'inizioMattina')"></td>
          <td><input class="time-input" v-model="giorno.fineMattina" placeholder="--:--" maxlength="5" @input="formattaOrario(giorno, 'fineMattina')"></td>
          <td><input class="time-input" v-model="giorno.inizioPomeriggio" placeholder="--:--" maxlength="5" @input="formattaOrario(giorno, 'inizioPomeriggio')"></td>
          <td><input class="time-input" v-model="giorno.finePomeriggio" placeholder="--:--" maxlength="5" @input="formattaOrario(giorno, 'finePomeriggio')"></td>
          <td>{{ calcolaOreGiorno(giorno).toFixed(1) }}</td>
          <td>
            <select class="status" v-model="giorno.stato">
              <option value=""></option>
              <option v-for="stato in STATI_ASSENZA" :key="stato" :value="stato">{{ stato }}</option>
            </select>
          </td>
          <td><input class="note" v-model="giorno.note" placeholder="Nota…"></td>
          <td style="white-space:nowrap">
            <button type="button" class="btn btn-ghost" title="Copia giorno" aria-label="Copia giorno" style="padding:4px 8px" @click="copiaGiorno(giorno)">⧉</button>
            <button type="button" class="btn btn-ghost" title="Incolla giorno" aria-label="Incolla giorno" style="padding:4px 8px" :disabled="!appunti" @click="incollaGiorno(giorno)">📋</button>
            <button type="button" class="btn btn-ghost" title="Svuota giorno" aria-label="Svuota giorno" style="padding:4px 8px" @click="svuotaGiorno(giorno)">✕</button>
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
