<script setup>
import { computed, onMounted } from 'vue';
import LogoUpload from './LogoUpload.vue';
import { pivaValida, codiceSdiValido } from '../../composables/useValidazioneFiscale.js';

const props = defineProps({ modelValue: { type: Object, required: true } });

onMounted(() => {
  if (!props.modelValue.paese) props.modelValue.paese = 'IT';
  if (!props.modelValue.tipo) props.modelValue.tipo = 'azienda';
});

const clienteEstero = computed(() => (props.modelValue.paese ?? 'IT').toUpperCase() !== 'IT');
const partitaIvaOk = computed(() => {
  if (clienteEstero.value) return /^[0-9A-Za-z]{1,28}$/.test(props.modelValue.partitaIva ?? '');
  return pivaValida(props.modelValue.partitaIva);
});
const codiceSdiOk = computed(() => {
  if (clienteEstero.value) return true; // XXXXXXX è fisso per gli esteri
  return codiceSdiValido(props.modelValue.codiceDestinatarioSdi);
});
const mostraServizi7Sep = computed(() =>
  clienteEstero.value &&
  (props.modelValue.tipo ?? 'azienda') === 'privato' &&
  !['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'].includes((props.modelValue.paese ?? 'IT').toUpperCase())
);
</script>

<template>
  <div class="form-grid">
    <div class="field full"><LogoUpload v-model="modelValue.logoDataUrl" etichetta="Logo per la stampa PDF del Timesheet" /></div>
    <div class="field field-full full"><label>Denominazione</label><input v-model="modelValue.denominazione"></div>
    <div class="field">
      <label>Partita IVA / identificativo fiscale</label>
      <input v-model="modelValue.partitaIva" :class="{ 'campo-non-valido': !partitaIvaOk }" :placeholder="clienteEstero ? 'es. DE123456789' : '11 cifre'">
      <small v-if="!partitaIvaOk" class="nota-errore">{{ clienteEstero ? 'Max 28 caratteri alfanumerici.' : 'Deve essere di 11 cifre numeriche.' }}</small>
    </div>
    <div class="field">
      <label>Codice destinatario SDI</label>
      <input v-if="!clienteEstero" v-model="modelValue.codiceDestinatarioSdi" :class="{ 'campo-non-valido': !codiceSdiOk }" placeholder="7 caratteri, es. 0000000">
      <input v-else value="XXXXXXX" disabled>
      <small v-if="!codiceSdiOk" class="nota-errore">Deve essere di 7 caratteri alfanumerici.</small>
      <small v-if="clienteEstero" class="note-legal" style="margin-top:4px">Per clienti esteri il codice destinatario è XXXXXXX (specifiche FatturaPA 1.9.1).</small>
    </div>

    <!-- Paese e tipo cliente -->
    <div class="field">
      <label>Paese</label>
      <select :value="modelValue.paese || 'IT'" @change="modelValue.paese = $event.target.value">
        <option value="IT">IT — Italia</option>
        <option disabled>── UE ──</option>
        <option value="AT">AT — Austria</option>
        <option value="BE">BE — Belgio</option>
        <option value="BG">BG — Bulgaria</option>
        <option value="CY">CY — Cipro</option>
        <option value="CZ">CZ — Repubblica Ceca</option>
        <option value="DE">DE — Germania</option>
        <option value="DK">DK — Danimarca</option>
        <option value="EE">EE — Estonia</option>
        <option value="ES">ES — Spagna</option>
        <option value="FI">FI — Finlandia</option>
        <option value="FR">FR — Francia</option>
        <option value="GR">GR — Grecia</option>
        <option value="HR">HR — Croazia</option>
        <option value="HU">HU — Ungheria</option>
        <option value="IE">IE — Irlanda</option>
        <option value="LT">LT — Lituania</option>
        <option value="LU">LU — Lussemburgo</option>
        <option value="LV">LV — Lettonia</option>
        <option value="MT">MT — Malta</option>
        <option value="NL">NL — Paesi Bassi</option>
        <option value="PL">PL — Polonia</option>
        <option value="PT">PT — Portogallo</option>
        <option value="RO">RO — Romania</option>
        <option value="SE">SE — Svezia</option>
        <option value="SI">SI — Slovenia</option>
        <option value="SK">SK — Slovacchia</option>
        <option disabled>── Extra-UE ──</option>
        <option value="GB">GB — Regno Unito</option>
        <option value="CH">CH — Svizzera</option>
        <option value="NO">NO — Norvegia</option>
        <option value="US">US — Stati Uniti</option>
        <option value="CA">CA — Canada</option>
        <option value="AU">AU — Australia</option>
        <option value="JP">JP — Giappone</option>
        <option value="CN">CN — Cina</option>
        <option value="IN">IN — India</option>
        <option value="BR">BR — Brasile</option>
        <option value="SG">SG — Singapore</option>
        <option value="AE">AE — Emirati Arabi</option>
        <option value="IL">IL — Israele</option>
        <option value="MX">MX — Messico</option>
        <option value="NZ">NZ — Nuova Zelanda</option>
        <option value="ZA">ZA — Sudafrica</option>
        <option value="AR">AR — Argentina</option>
        <option value="KR">KR — Corea del Sud</option>
        <option value="TR">TR — Turchia</option>
        <option value="RU">RU — Russia</option>
        <option value="UA">UA — Ucraina</option>
      </select>
    </div>
    <div class="field">
      <label>Tipo soggetto</label>
      <select v-model="modelValue.tipo">
        <option value="azienda">Azienda / soggetto passivo IVA</option>
        <option value="privato">Privato</option>
      </select>
    </div>

    <div class="field"><label>Indirizzo</label><input v-model="modelValue.indirizzo"></div>
    <div class="field"><label>CAP</label><input v-model="modelValue.cap" :placeholder="clienteEstero ? 'CAP locale (facoltativo)' : '5 cifre'"></div>
    <div class="field"><label>Comune / Città</label><input v-model="modelValue.comune"></div>
    <div class="field" v-if="!clienteEstero"><label>Provincia</label><input v-model="modelValue.provincia" maxlength="2" style="text-transform:uppercase"></div>

    <!-- Avviso VIES per aziende UE -->
    <div v-if="clienteEstero && modelValue.tipo === 'azienda' && ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'].includes((modelValue.paese ?? '').toUpperCase())" class="field full">
      <small class="note-legal" style="margin-top:4px">
        Azienda UE: la fattura userà <strong>N2.1 — inversione contabile</strong> (art. 7-ter DPR 633/72). Assicurarsi di essere iscritti al VIES (Impostazioni → Anagrafica fornitore) prima di emettere. Presentare l'elenco Intrastat servizi resi entro il 25 del mese dopo ogni trimestre.
      </small>
    </div>

    <!-- Servizi art. 7-septies (solo privati extra-UE) -->
    <div v-if="mostraServizi7Sep" class="field full">
      <div style="display:flex;align-items:center;gap:8px">
        <input id="servizi-7-septies" type="checkbox" v-model="modelValue.servizi7Septies" class="checkbox-app">
        <label for="servizi-7-septies" style="margin:0">Prestazioni rientranti nell'art. 7-septies DPR 633/72 (consulenza, elaborazione dati, pubblicità, cessione software, ecc.)</label>
      </div>
      <small class="note-legal" style="margin-top:4px">Se spuntato, la fattura a questo cliente privato extra-UE userà N2.1 + dicitura "non soggetta". Altrimenti trattamento ordinario forfettario (N2.2).</small>
    </div>

    <div class="field"><label>Figura</label><input v-model="modelValue.figura"></div>
    <div class="field"><label>Commessa</label><input v-model="modelValue.commessa"></div>
    <div class="field"><label>Cliente</label><input v-model="modelValue.clientePdf"></div>
    <div class="field"><label>Progetto</label><input v-model="modelValue.progetto"></div>
  </div>
</template>
