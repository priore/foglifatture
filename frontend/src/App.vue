<script setup>
import AppSidebar from './components/common/AppSidebar.vue';
import TerminiModal from './components/common/TerminiModal.vue';
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="main">
      <router-view />
    </div>
    <TerminiModal />
  </div>
</template>
