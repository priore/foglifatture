<script setup>
defineProps({ modelValue: { type: Object, required: true } });
</script>

<template>
  <div class="form-grid">
    <div class="field"><label>Soglia bollo virtuale (€)</label><input type="number" step="0.01" v-model.number="modelValue.sogliaBolloVirtuale"></div>
    <div class="field"><label>Importo bollo (€)</label><input type="number" step="0.01" v-model.number="modelValue.importoBollo"></div>
  </div>
  <h3 style="margin:18px 0 8px">Dati di pagamento in fattura</h3>
  <p class="note-legal">Se l'IBAN è compilato, ogni nuova fattura riporta modalità, IBAN e scadenza (blocco DatiPagamento). Vuoto = nessun dato di pagamento in XML.</p>
  <div class="form-grid">
    <div class="field"><label>IBAN</label><input type="text" v-model="modelValue.iban" placeholder="IT60 X054 2811 1010 0000 0123 456"></div>
    <div class="field"><label>Intestatario conto</label><input type="text" v-model="modelValue.intestatario"></div>
    <div class="field"><label>Istituto finanziario (facoltativo)</label><input type="text" v-model="modelValue.istitutoFinanziario"></div>
    <div class="field"><label>Modalità predefinita</label>
      <select v-model="modelValue.modalitaDefault">
        <option value="MP05">Bonifico</option>
        <option value="MP19">Addebito diretto SEPA</option>
        <option value="MP08">Carta di pagamento</option>
        <option value="MP02">Assegno</option>
        <option value="MP01">Contanti</option>
        <option value="BTC">Bitcoin (indirizzo dal primo wallet in Fornitore)</option>
      </select>
    </div>
    <div class="field"><label>Giorni di scadenza predefiniti</label><input type="number" min="0" v-model.number="modelValue.giorniScadenzaDefault"></div>
  </div>
</template>
