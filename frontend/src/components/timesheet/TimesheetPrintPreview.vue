<script setup>
// Anteprima di stampa del timesheet: replica pixel-per-pixel il foglio Excel
// aziendale (vedi src/assets/print-timesheet.css per la provenienza dei colori).
import { computed } from 'vue';
import LogoPlaceholder from '../common/LogoPlaceholder.vue';
import { STATI_ASSENZA, calcolaOreGiorno, calcolaTotaleMensile } from '../../composables/useTimeCalculator.js';

const props = defineProps({
  anno: { type: Number, required: true },
  mese: { type: Number, required: true },
  giorni: { type: Array, required: true },
  consulente: { type: String, default: '' },
  localita: { type: String, default: '' },
  logoDataUrl: { type: String, default: '' },
  figura: { type: String, default: '' },
  commessa: { type: String, default: '' },
  cliente: { type: String, default: '' },
  progetto: { type: String, default: '' },
});

const NOMI_MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function isWeekend(nomeGiorno) {
  return nomeGiorno === 'Sabato' || nomeGiorno === 'Domenica';
}

const totaleOre = computed(() => calcolaTotaleMensile(props.giorni));
const giorniLavorati = computed(() => props.giorni.filter(g => calcolaOreGiorno(g) > 0).length);

const conteggioAssenze = computed(() => {
  const conteggio = Object.fromEntries(STATI_ASSENZA.map(s => [s, 0]));
  for (const g of props.giorni) if (g.stato in conteggio) conteggio[g.stato] += 1;
  return conteggio;
});
const totaleAssenze = computed(() =>
  Object.values(conteggioAssenze.value).reduce((s, n) => s + n, 0)
);
</script>

<template>
  <div class="xls-page">
    <div class="xls-topbar">
      <LogoPlaceholder :width="90" :height="46" :logo-data-url="logoDataUrl" />
      <div class="xls-title">MRO - PIANIFICAZIONE MENSILE</div>
      <div class="xls-code">MRO/TN</div>
    </div>

    <table class="xls-info">
      <tr><td class="k">Consulente:</td><td class="v">{{ consulente }}</td><td class="k">Commessa:</td><td class="v">{{ commessa }}</td></tr>
      <tr><td class="k">Figura:</td><td class="v">{{ figura }}</td><td class="k">Cliente:</td><td class="v">{{ cliente }}</td></tr>
      <tr><td class="k">Mese:</td><td class="v">{{ NOMI_MESI[mese - 1] }}</td><td class="k">Località:</td><td class="v">{{ localita }}</td></tr>
      <tr><td class="k">Anno:</td><td class="v">{{ anno }}</td><td class="k">Progetto:</td><td class="v">{{ progetto }}</td></tr>
    </table>
    <div class="doc-gap"></div>

    <table class="xls-grid">
      <thead>
        <tr><th>GG</th><th>Giorno</th><th>Entrata</th><th>Uscita</th><th>Entrata</th><th>Uscita</th><th>Totale<br>Giorn.</th><th>Motivo<br>Assenza</th><th>NOTE</th></tr>
      </thead>
      <tbody>
        <tr v-for="giorno in giorni" :key="giorno.giorno" :class="{ wknd: isWeekend(giorno.nomeGiorno) }">
          <td class="num">{{ giorno.giorno }}</td>
          <td class="day">{{ giorno.nomeGiorno }}</td>
          <td>{{ giorno.inizioMattina }}</td>
          <td>{{ giorno.fineMattina }}</td>
          <td>{{ giorno.inizioPomeriggio }}</td>
          <td>{{ giorno.finePomeriggio }}</td>
          <td>{{ calcolaOreGiorno(giorno) > 0 ? calcolaOreGiorno(giorno).toFixed(2).replace('.', ',') : '' }}</td>
          <td :class="{ absence: giorno.stato && !isWeekend(giorno.nomeGiorno) }">
            {{ !isWeekend(giorno.nomeGiorno) ? giorno.stato : '' }}
          </td>
          <td>{{ giorno.note }}</td>
        </tr>
      </tbody>
    </table>

    <div class="xls-total-row">
      <table class="xls-total"><tr><td class="lbl">TOTALE ORE LAVORATE</td><td class="val">{{ totaleOre.toFixed(2).replace('.', ',') }}</td></tr></table>
    </div>
    <div class="doc-gap"></div>

    <table class="xls-summary">
      <tr><td class="hdr" colspan="6">RIEPILOGO DATI MENSILI</td></tr>
      <tr><td class="sub" colspan="2">Giorni</td><td class="sub" colspan="4">Ore</td></tr>
      <tr><td class="col">Lavor.</td><td class="col">Assenze</td><td class="col">Ordin.</td><td class="col">Straord.</td><td class="col">Perm.</td><td class="col">Totale</td></tr>
      <tr>
        <td>{{ giorniLavorati }}</td><td>{{ totaleAssenze }}</td>
        <td>{{ totaleOre.toFixed(2).replace('.', ',') }}</td><td>0,00</td><td>0,00</td>
        <td>{{ totaleOre.toFixed(2).replace('.', ',') }}</td>
      </tr>
      <tr><td class="rowhdr" colspan="6">Monitoraggi</td></tr>
      <tr><td class="italic-lbl" colspan="2">effettivi</td><td colspan="4"></td></tr>
      <tr><td class="italic-lbl" colspan="2">previsti</td><td colspan="4"></td></tr>
      <tr><td class="rowhdr" colspan="6">Monitoraggi<br><span class="small">(Limiti di accettabilità)</span></td></tr>
      <tr><td class="sub" colspan="6">Giustificazione Assenze</td></tr>
      <tr><td class="col" colspan="4">descrizione</td><td class="col" colspan="2">giorni</td></tr>
      <tr v-for="stato in STATI_ASSENZA.filter(s => s !== 'Lavoro')" :key="stato">
        <td colspan="4">{{ stato }}</td><td colspan="2">{{ conteggioAssenze[stato] }}</td>
      </tr>
      <tr><td class="col" colspan="2">Note:</td><td colspan="4"></td></tr>
    </table>
  </div>
</template>
