<script setup>
// Logo del documento stampato: mostra il logo caricato dall'utente in Impostazioni
// (logoDataUrl) se presente, altrimenti un segnaposto (onda blu, stile "Lorem Ipsum")
// riprodotto dai template originali.
defineProps({
  width: { type: Number, default: 90 },
  height: { type: Number, default: 46 },
  mostraNome: { type: Boolean, default: true },
  logoDataUrl: { type: String, default: '' },
});
</script>

<template>
  <img v-if="logoDataUrl" :src="logoDataUrl" :style="{ height: height + 'px', maxWidth: (width * 1.6) + 'px', objectFit: 'contain' }" alt="Logo">
  <svg v-else :width="width" :height="height" viewBox="0 0 150 90" class="logo-slot">
    <path d="M4 34 C40 4, 90 4, 148 38" stroke="#7fa8d9" stroke-width="9" fill="none" />
    <path d="M4 56 C40 26, 90 26, 132 56" stroke="#4472a8" stroke-width="9" fill="none" />
    <text v-if="mostraNome" x="6" y="78" font-family="Georgia, serif" font-size="14" fill="#3a3a3a" letter-spacing="1">LOREM IPSUM</text>
  </svg>
</template>
