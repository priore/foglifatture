<script setup>
// Barra di navigazione laterale fissa: unico punto di accesso alle 3 schermate dell'app.
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api, updateApi } from '../../services/api.js';
import { PASSI_IMPOSTAZIONI } from '../../wizardImpostazioniPassi.js';
import { PASSI_IMPORTA_STORICO } from '../../wizardImportaStoricoPassi.js';

const route = useRoute();
const nomeFornitore = ref('Consulente');
const versioneApp = ref('');
onMounted(async () => {
  const config = await api.getConfig().catch(() => null);
  if (config?.fornitore?.denominazione) nomeFornitore.value = config.fornitore.denominazione;
  const stato = await updateApi.stato().catch(() => null);
  versioneApp.value = stato?.versioneLocale || '';
});

const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark');
function toggleTheme() {
  isDark.value = !isDark.value;
  const theme = isDark.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">Fogli & Fatture<small>Consulenza IT · Regime forfettario</small></div>
    <nav class="nav">
      <router-link to="/dashboard"><span class="dot"></span>Dashboard forfettario</router-link>
      <router-link to="/timesheet"><span class="dot"></span>Timesheet mensile</router-link>
      <router-link to="/fattura"><span class="dot"></span>Fattura Pro-Forma</router-link>
      <router-link to="/versamenti-f24"><span class="dot"></span>Versamenti F24</router-link>
      <router-link to="/impostazioni" :class="{ 'router-link-active': route.path.startsWith('/impostazioni') || route.path === '/importa-storico' }"><span class="dot"></span>Impostazioni<svg class="accordion-caret" :class="{ open: route.path.startsWith('/impostazioni') || route.path === '/importa-storico' }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></router-link>
      <div v-if="route.path.startsWith('/impostazioni') || route.path === '/importa-storico'" class="nav-sub">
        <template v-for="(passo, i) in PASSI_IMPOSTAZIONI" :key="passo">
          <router-link
            :to="{ path: '/impostazioni', query: { passo: i } }"
            active-class="" exact-active-class=""
            :class="{ 'router-link-active': route.path === '/impostazioni' && Number(route.query.passo || 0) === i }"
          >{{ passo }}</router-link>
          <router-link
            v-if="passo === 'PEC'" to="/impostazioni/pec-cronologia" class="nav-sub-sub"
            active-class="" exact-active-class=""
            :class="{ 'router-link-active': route.path === '/impostazioni/pec-cronologia' }"
          >Cronologia</router-link>
          <template v-if="passo === 'Percorso dati'">
            <router-link
              to="/importa-storico"
              active-class="" exact-active-class=""
              :class="{ 'router-link-active': route.path === '/importa-storico' }"
            >Importa storico<svg class="accordion-caret" :class="{ open: route.path === '/importa-storico' }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></router-link>
            <template v-if="route.path === '/importa-storico'">
              <router-link
                v-for="(sotto, j) in PASSI_IMPORTA_STORICO" :key="sotto"
                :to="{ path: '/importa-storico', query: { passo: j } }"
                class="nav-sub-sub" active-class="" exact-active-class=""
                :class="{ 'router-link-active': Number(route.query.passo || 0) === j }"
              >{{ sotto }}</router-link>
            </template>
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
      <span v-if="versioneApp" class="app-version">{{ versioneApp }}</span>
    </div>
  </aside>
</template>
