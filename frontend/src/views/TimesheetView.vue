<script setup>
// Schermata Timesheet: editor mensile + riepilogo + anteprima di stampa PDF.
import { ref, computed, watch, onMounted } from 'vue';
import MonthSwitcher from '../components/common/MonthSwitcher.vue';
import ClienteSwitcher from '../components/common/ClienteSwitcher.vue';
import TimesheetGrid from '../components/timesheet/TimesheetGrid.vue';
import TemplateStampa from '../components/common/TemplateStampa.vue';
import { api } from '../services/api.js';
import { calcolaTotaleMensile, calcolaOreGiorno, decimaleAHHmm, STATI_ASSENZA } from '../composables/useTimeCalculator.js';
import { esportaPdf, generaPdfBlob } from '../composables/usePdfExport.js';
import { inviaPdfEmail } from '../composables/useMailto.js';
import { preparaDatiTimesheet } from '../composables/useTemplateData.js';

const oggi = new Date();
const anno = ref(oggi.getFullYear());
const mese = ref(oggi.getMonth() + 1);
const giorni = ref([]);
const config = ref(null);
const clienteId = ref(null);
const salvando = ref(false);
const messaggioSalvataggio = ref('');
const anteprimaRef = ref(null);
const meseMinimo = ref(null);
const inviandoEmail = ref(false);
const esitoEmail = ref('');

const clientiAttivi = computed(() => config.value?.clienti.filter(c => c.attivo) ?? []);
const clienteCorrente = computed(() => clientiAttivi.value.find(c => c.id === clienteId.value) ?? null);

const totaleMensile = computed(() => calcolaTotaleMensile(giorni.value));
const giorniLavorati = computed(() => giorni.value.filter(g => calcolaOreGiorno(g) > 0).length);
const assenze = computed(() => giorni.value.filter(g => STATI_ASSENZA.includes(g.stato)).length);

const templateIdTimesheet = computed(() => clienteCorrente.value?.templateTimesheetId || 'timesheet-default');
const datiTimesheet = computed(() => {
  if (!config.value || !clienteCorrente.value || !giorni.value.length) return null;
  return preparaDatiTimesheet({
    anno: anno.value,
    mese: mese.value,
    giorni: giorni.value,
    consulente: config.value.fornitore.denominazione,
    localita: config.value.fornitore.comune,
    logoDataUrl: clienteCorrente.value.logoDataUrl,
    figura: clienteCorrente.value.figura,
    commessa: clienteCorrente.value.commessa,
    cliente: clienteCorrente.value.clientePdf,
    progetto: clienteCorrente.value.progetto,
  });
});

async function caricaTimesheet() {
  if (!clienteId.value) return;
  const dati = await api.getTimesheet(anno.value, mese.value, clienteId.value);
  giorni.value = dati.giorni;
}

async function aggiornaMeseMinimo() {
  const mesi = await api.listMesiTimesheet();
  const mesiCliente = mesi.filter(m => m.clienteId === clienteId.value);
  meseMinimo.value = mesiCliente.length ? mesiCliente[0].chiave.slice(0, 7) : null;
}

async function salvaTimesheet() {
  salvando.value = true;
  messaggioSalvataggio.value = '';
  try {
    await api.saveTimesheet(anno.value, mese.value, clienteId.value, giorni.value);
    messaggioSalvataggio.value = 'Salvato';
    await aggiornaMeseMinimo();
  } catch (err) {
    messaggioSalvataggio.value = `Errore: ${err.message}`;
  } finally {
    salvando.value = false;
    setTimeout(() => (messaggioSalvataggio.value = ''), 2500);
  }
}

async function esporta() {
  await esportaPdf(anteprimaRef.value.contentDocument().body, `timesheet-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`);
}

function esportaVms() {
  window.open(api.urlExportVms(anno.value, mese.value, clienteId.value), '_blank');
}

async function inviaEmail() {
  inviandoEmail.value = true;
  esitoEmail.value = '';
  try {
    const pdfBlob = await generaPdfBlob(anteprimaRef.value.contentDocument().body);
    const nomeFile = `timesheet-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`;
    const oggetto = `Timesheet ${String(mese.value).padStart(2, '0')}/${anno.value}`;
    const corpo = `Buongiorno,\n\nin allegato il timesheet relativo al mese di ${String(mese.value).padStart(2, '0')}/${anno.value}.\n\nCordiali saluti.`;
    const risultato = await inviaPdfEmail(pdfBlob, nomeFile, clienteCorrente.value.email, oggetto, corpo);
    esitoEmail.value = risultato.modalita === 'mail-app-mac'
      ? 'Bozza aperta in Mail con allegato pronto'
      : 'PDF salvato e rivelato nel file manager: trascinalo nella mail appena aperta';
  } catch (err) {
    esitoEmail.value = `Errore: ${err.message}`;
  } finally {
    inviandoEmail.value = false;
  }
}

// Ultimo cliente selezionato persistito in localStorage (stesso pattern del tema in
// AppSidebar.vue), ripristinato al prossimo accesso; fallback al primo cliente attivo
// se il valore salvato non corrisponde più a un cliente attivo esistente.
function inizializzaClienteId() {
  const salvato = localStorage.getItem('clienteAttivoId');
  clienteId.value = clientiAttivi.value.some(c => c.id === salvato)
    ? salvato
    : clientiAttivi.value[0]?.id ?? null;
}
watch(clienteId, (id) => { if (id) localStorage.setItem('clienteAttivoId', id); });

watch([anno, mese, clienteId], caricaTimesheet);
onMounted(async () => {
  config.value = await api.getConfig();
  inizializzaClienteId();
  await caricaTimesheet();
  await aggiornaMeseMinimo();
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Timesheet — {{ mese }}/{{ anno }}</h1>
        <p>Pianificazione mensile ore, replica struttura foglio aziendale</p>
      </div>
    </div>
    <div class="cliente-row" v-if="clientiAttivi.length">
      <ClienteSwitcher v-model="clienteId" :clienti="clientiAttivi" />
    </div>
    <div class="actions" style="margin-bottom:16px">
      <MonthSwitcher v-model:anno="anno" v-model:mese="mese" :mese-minimo="meseMinimo" />
      <button class="btn btn-blue" :disabled="salvando" @click="salvaTimesheet">
        {{ salvando ? 'Salvo…' : (messaggioSalvataggio || 'Salva') }}
      </button>
      <button class="btn btn-ok" @click="esporta">Esporta PDF</button>
      <button class="btn btn-amber" :disabled="!clienteCorrente?.email || inviandoEmail" @click="inviaEmail">
        {{ inviandoEmail ? 'Preparo…' : 'Invia email al cliente' }}
      </button>
      <button class="btn btn-violet" :disabled="!giorni.length" @click="esportaVms">Esporta CSV per import VMS</button>
    </div>
    <p v-if="esitoEmail" class="badge-mono" style="margin-top:-10px;margin-bottom:16px">{{ esitoEmail }}</p>

    <div class="summary-row">
      <div class="stat accent"><div class="label">Ore lavorate</div><div class="value">{{ totaleMensile.toFixed(1) }}</div></div>
      <div class="stat"><div class="label">Giorni lavorativi</div><div class="value">{{ giorniLavorati }}</div></div>
      <div class="stat"><div class="label">Assenze</div><div class="value">{{ assenze }}</div></div>
      <div class="stat ok"><div class="label">Totale HH:mm</div><div class="value">{{ decimaleAHHmm(totaleMensile) }}</div></div>
    </div>

    <div class="card" v-if="giorni.length">
      <div class="card-head"><h2>Griglia giornaliera</h2><span class="badge-mono">{{ giorni.length }} giorni</span></div>
      <div class="card-body">
        <TimesheetGrid :giorni="giorni" />
      </div>
    </div>

    <div class="card" v-if="config && clienteCorrente && giorni.length">
      <div class="card-head"><h2>Anteprima stampa PDF</h2><span class="badge-mono">replica foglio Excel aziendale</span></div>
      <div class="card-body" style="min-width:0">
        <TemplateStampa v-if="datiTimesheet" ref="anteprimaRef" :template-id="templateIdTimesheet" :dati="datiTimesheet" />
      </div>
    </div>
  </div>
</template>
