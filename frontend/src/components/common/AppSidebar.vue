<script setup>
// Barra di navigazione laterale fissa: unico punto di accesso alle 3 schermate dell'app.
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api.js';
import { PASSI_IMPOSTAZIONI } from '../../wizardImpostazioniPassi.js';
import { PASSI_IMPORTA_STORICO } from '../../wizardImportaStoricoPassi.js';

const route = useRoute();
const nomeFornitore = ref('Consulente');
onMounted(async () => {
  const config = await api.getConfig().catch(() => null);
  if (config?.fornitore?.denominazione) nomeFornitore.value = config.fornitore.denominazione;
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
      <router-link to="/timesheet"><span class="dot"></span>Timesheet mensile</router-link>
      <router-link to="/fattura"><span class="dot"></span>Fattura Pro-Forma</router-link>
      <router-link to="/dashboard"><span class="dot"></span>Dashboard forfettario</router-link>
      <router-link to="/versamenti-f24"><span class="dot"></span>Versamenti F24</router-link>
      <router-link to="/importa-storico"><span class="dot"></span>Importa storico</router-link>
      <div v-if="route.path === '/importa-storico'" class="nav-sub">
        <router-link
          v-for="(passo, i) in PASSI_IMPORTA_STORICO" :key="passo"
          :to="{ path: '/importa-storico', query: { passo: i } }"
          active-class="" exact-active-class=""
          :class="{ 'router-link-active': Number(route.query.passo || 0) === i }"
        >{{ passo }}</router-link>
      </div>
      <router-link to="/impostazioni" :class="{ 'router-link-active': route.path.startsWith('/impostazioni') }"><span class="dot"></span>Impostazioni</router-link>
      <div v-if="route.path.startsWith('/impostazioni')" class="nav-sub">
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
        </template>
      </div>
    </nav>
    <div class="side-foot">
      <span>{{ nomeFornitore }}</span>
      <button type="button" class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Tema chiaro' : 'Tema scuro'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>
    <router-link to="/privacy" class="privacy-link">Privacy</router-link>
  </aside>
</template>
