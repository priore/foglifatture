<script setup>
// Barra di navigazione laterale fissa: unico punto di accesso alle 3 schermate dell'app.
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

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
      <router-link to="/importa-storico"><span class="dot"></span>Importa storico</router-link>
      <router-link to="/impostazioni"><span class="dot"></span>Impostazioni</router-link>
    </nav>
    <div class="side-foot">
      {{ nomeFornitore }}
      <button type="button" class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Tema chiaro' : 'Tema scuro'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>
  </aside>
</template>
