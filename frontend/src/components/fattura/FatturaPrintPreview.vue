<script setup>
// Anteprima di stampa della Fattura Pro-Forma: replica esatta di FATT08_2026.doc
// (ordine dei blocchi, font, colori — vedi src/assets/print-fattura.css).
import LogoPlaceholder from '../common/LogoPlaceholder.vue';

defineProps({
  fornitore: { type: Object, required: true },
  cliente: { type: Object, required: true },
  numero: { type: String, required: true },
  data: { type: String, required: true },
  descrizione: { type: String, required: true },
  imponibile: { type: Number, required: true },
  bollo: { type: Number, required: true },
  bolloApplicabile: { type: Boolean, required: true },
  nettoAPagare: { type: Number, required: true },
});

function formattaEuro(numero) {
  return numero.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formattaData(isoDate) {
  const [anno, mese, giorno] = isoDate.split('-');
  return `${giorno}/${mese}/${anno}`;
}
</script>

<template>
  <div class="a4">
    <div class="header-row">
      <LogoPlaceholder :width="100" :height="50" :logo-data-url="fornitore.logoDataUrl" />
      <div class="sender-frame">
        <p class="doc-line sender-title">{{ fornitore.denominazione || 'Intestazione azienda fornitore' }}</p>
        <p class="doc-line">{{ fornitore.indirizzo }} {{ fornitore.numeroCivico }}, {{ fornitore.cap }} {{ fornitore.comune }} ({{ fornitore.provincia }})</p>
        <p class="doc-line">P.IVA {{ fornitore.partitaIva }}</p>
        <p class="doc-line">CF {{ fornitore.codiceFiscale }}</p>
      </div>
    </div>

    <p class="doc-line">{{ cliente.denominazione || 'Intestazione Azienda cliente' }}</p>
    <p class="doc-line">{{ cliente.indirizzo }}, {{ cliente.cap }} {{ cliente.comune }} ({{ cliente.provincia }})</p>
    <p class="doc-line">P.IVA {{ cliente.partitaIva }}</p>
    <div class="doc-gap-lg"></div>

    <table class="doc-table">
      <thead><tr>
        <td class="col-num">Fattura&nbsp;&nbsp;n.</td>
        <td class="col-data">Data</td>
        <td class="col-oggetto">Oggetto</td>
      </tr></thead>
      <tbody><tr>
        <td class="col-num">{{ numero }}</td>
        <td class="col-data">{{ formattaData(data) }}</td>
        <td class="col-oggetto">{{ descrizione }}</td>
      </tr></tbody>
    </table>
    <div class="doc-gap-lg"></div>

    <table class="doc-table compenso">
      <tr><td>Compenso professionale</td><td>{{ formattaEuro(imponibile) }} €</td></tr>
      <tr><td>NETTO A PAGARE</td><td>{{ formattaEuro(nettoAPagare) }} €</td></tr>
    </table>
    <div class="doc-gap-lg"></div>

    <p class="legal-note">Operazione senza applicazione dell'IVA ai sensi dell'art.1, comma 58, Legge 190/2014, regime forfetario; operazione senza applicazione della ritenuta alla fonte a titolo di acconto ai sensi dell'art.1, comma 67, Legge 190/2014.</p>
    <p v-if="bolloApplicabile" class="legal-note">Imposta di bollo assolta in modo virtuale ai sensi dell'articolo 15 del d.p.r. 642/1972 e del DM 17/06/2014.</p>
  </div>
</template>
