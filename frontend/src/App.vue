<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppSidebar from './components/common/AppSidebar.vue';
import TerminiModal from './components/common/TerminiModal.vue';
import ConfermaPopup from './components/common/ConfermaPopup.vue';
import SceltaArchivioPopup from './components/common/SceltaArchivioPopup.vue';

// Lo scroll sta sul contenuto, non sulla finestra: a ogni navigazione si riparte dall'alto.
const route = useRoute();
const contenuto = ref(null);
watch(() => route.fullPath, () => contenuto.value?.scrollTo(0, 0));
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div ref="contenuto" class="contenuto">
      <div class="main">
        <router-view />
      </div>
    </div>
    <SceltaArchivioPopup />
    <TerminiModal />
    <ConfermaPopup />
  </div>
</template>
