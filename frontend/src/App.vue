<script setup>
import AppSidebar from './components/common/AppSidebar.vue';
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="main">
      <router-view />
    </div>
  </div>
</template>
