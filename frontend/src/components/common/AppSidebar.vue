<script setup>
// Barra di navigazione laterale fissa: unico punto di accesso alle 3 schermate dell'app.
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { soloFatture, aggiornaGestioniClienti } from '../../composables/useClienteAttivo.js';
import { capacita } from '../../composables/useCapacita.js';
import { api, updateApi } from '../../services/api.js';
import { PASSI_IMPOSTAZIONI } from '../../wizardImpostazioniPassi.js';
import { iconaMenu } from './iconeMenu.js';

const route = useRoute();
const router = useRouter();
const compresso = ref(localStorage.getItem('menuCompresso') === '1');
function toggleMenu() {
  sopra.value = false;
  compresso.value = !compresso.value;
  localStorage.setItem('menuCompresso', compresso.value ? '1' : '0');
}
// Menu compresso: al passaggio del mouse si espande sopra il contenuto (senza spostarlo) e si ricomprime all'uscita.
// Solo con puntatore che supporta l'hover; il clic sull'icona resta il comando manuale persistente.
const sopra = ref(false);
const conHover = matchMedia('(hover: hover)').matches;
let ritardo = null;
let suPulsante = false; // sull'icona expand/collapse il menu non si apre: lì il comando è il clic
function entra() {
  if (!conHover || !compresso.value || suPulsante) return;
  clearTimeout(ritardo);
  ritardo = setTimeout(() => { sopra.value = true; }, 600);
}
function esci() { clearTimeout(ritardo); sopra.value = false; }
function entraPulsante() { suPulsante = true; clearTimeout(ritardo); }
function esciPulsante() { suPulsante = false; entra(); }
const nomeFornitore = ref('');
const versioneApp = ref('');
onMounted(async () => {
  const config = await api.getConfig().catch(() => null);
  aggiornaGestioniClienti(config?.clienti);
  if (config?.fornitore?.denominazione) nomeFornitore.value = config.fornitore.denominazione;
  if (document.documentElement.dataset.shell) return;
  const stato = await updateApi.stato().catch(() => null);
  versioneApp.value = stato?.versioneLocale || '';
});

// Cliente "solo fatture" selezionato: niente Timesheet, eventuale pagina aperta ripiega su Fattura.
watch([soloFatture, () => route.path], ([sf, path]) => { if (sf && path === '/timesheet') router.replace('/fattura'); });

// Senza una scelta salvata vale il tema di sistema: l'icona deve rispecchiare quello visibile.
const temaScelto = document.documentElement.getAttribute('data-theme');
const isDark = ref(temaScelto ? temaScelto === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
function toggleTheme() {
  isDark.value = !isDark.value;
  const theme = isDark.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
</script>

<template>
  <aside class="sidebar" :class="{ compresso: compresso && !sopra, sovrapposta: compresso && sopra }" @mouseenter="entra" @mouseleave="esci">
    <div class="brand-riga">
      <div class="brand">{{ capacita.nomeApp }}<small>Consulenza IT · Regime forfettario</small></div>
      <button type="button" class="menu-toggle" @click="toggleMenu" @mouseenter="entraPulsante" @mouseleave="esciPulsante" :title="compresso ? 'Espandi menu' : 'Comprimi menu'" :aria-label="compresso ? 'Espandi menu' : 'Comprimi menu'"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path :d="compresso ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'"/></svg></button>
    </div>
    <nav class="nav">
      <router-link to="/dashboard"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Dashboard')"></svg><span class="nav-txt">Dashboard forfettario</span></router-link>
      <router-link v-if="!soloFatture" to="/timesheet"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Timesheet')"></svg><span class="nav-txt">Timesheet mensile</span></router-link>
      <router-link to="/fattura"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Fattura')"></svg><span class="nav-txt">Fattura Pro-Forma</span></router-link>
      <router-link to="/bitcoin"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Bitcoin')"></svg><span class="nav-txt">Bitcoin</span></router-link>
      <router-link to="/versamenti-f24"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('F24')"></svg><span class="nav-txt">Versamenti F24</span></router-link>
      <router-link to="/clienti"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Clienti')"></svg><span class="nav-txt">Clienti</span></router-link>
      <router-link to="/pec-cronologia"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('PEC')"></svg><span class="nav-txt">Cronologia PEC</span></router-link>
      <router-link to="/impostazioni" :class="{ 'router-link-active': route.path.startsWith('/impostazioni') || route.path === '/importa-storico' }"><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Impostazioni')"></svg><span class="nav-txt">Impostazioni</span><svg class="accordion-caret" :class="{ open: route.path.startsWith('/impostazioni') || route.path === '/importa-storico' }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></router-link>
      <div v-if="route.path.startsWith('/impostazioni') || route.path === '/importa-storico'" class="nav-sub">
        <template v-for="(passo, i) in PASSI_IMPOSTAZIONI" :key="passo">
          <router-link
            :to="{ path: '/impostazioni', query: { passo: i } }"
            active-class="" exact-active-class=""
            :class="{ 'router-link-active': route.path === '/impostazioni' && Number(route.query.passo || 0) === i }"
          ><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu(passo)"></svg><span class="nav-txt">{{ passo }}</span></router-link>
          <template v-if="passo === 'Percorso dati'">
            <router-link
              to="/importa-storico"
              active-class="" exact-active-class=""
              :class="{ 'router-link-active': route.path === '/importa-storico' }"
            ><svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconaMenu('Importa storico')"></svg><span class="nav-txt">Importa storico</span></router-link>
          </template>
        </template>
      </div>
    </nav>
    <div class="side-foot">
      <span>{{ nomeFornitore }}</span>
      <button type="button" class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Tema chiaro' : 'Tema scuro'" :aria-label="isDark ? 'Tema chiaro' : 'Tema scuro'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>
    <div class="side-foot-links">
      <router-link to="/privacy" class="privacy-link">Privacy</router-link>
      <span v-if="versioneApp || capacita.versione" class="app-version">{{ versioneApp || capacita.versione }}</span>
    </div>
  </aside>
</template>
